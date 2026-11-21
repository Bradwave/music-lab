// Web Audio DSP Engine for DUST:
// Detroit jazz-wax & Jan Jelinek micro-wax signal chain —
// 4-stage liquid analog phaser, stereo BBD chorus, intimate wooden spring/room,
// kick-driven sidechain pocket, 12-bit transformer warmth, and pitch-coupled vinyl bed.

import { state, getMarks } from '../state/store.js';
import { getSide } from '../state/scales.js';
import { ensurePressing } from '../engine/waxPressing.js';

let audioCtx = null;
let pressing = null;

// Core Buses
let kickBus = null;
let duckBus = null;
let percBus = null;
let sidechainGain = null;

// 4-Stage Liquid Analog Phaser (on duckBus)
let phaserIn = null;
let phaserDry = null;
let phaserWet = null;
let phaserStages = [];
let phaserFeedback = null;
let phaserFbClip = null;
let phaserLfo = null;
let phaserLfoGain = null;

// Stereo BBD Analog Chorus Send
let chorusSend = null;
let chorusDelayL = null;
let chorusDelayR = null;
let chorusLfoL = null;
let chorusLfoR = null;
let chorusDepthL = null;
let chorusDepthR = null;
let chorusFilter = null;
let chorusReturn = null;

// Intimate Vintage Spring / Wooden Room Reverb Send
let roomSend = null;
let roomConvolver = null;
let roomFilter = null;
let roomReturn = null;

// Dynamic Pitch-Coupled Vinyl Surface Bed
let vinylBedSource = null;
let vinylBedFilter = null;
let vinylBedGain = null;

// Master Chain
let masterToneFilter = null;
let masterWarmth = null;
let masterComp = null;
let masterGain = null;
let analyser = null;

// AudioParam automation deduplication (prevents long-session event queue buildup)
const paramTargets = new WeakMap();

export function setParamSmooth(param, value, time, timeConstant, eps = 1e-4) {
  if (!param || !Number.isFinite(value)) return;
  const prev = paramTargets.get(param);
  if (prev !== undefined && Math.abs(prev - value) <= eps) return;
  paramTargets.set(param, value);

  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(time);
  } else {
    param.cancelScheduledValues(time);
    param.setValueAtTime(param.value, time);
  }
  param.setTargetAtTime(value, time, timeConstant);
}

const MAX_ACTIVE_VOICES = 30;
let activeVoices = 0;

export function acquireVoiceSlot() {
  if (activeVoices >= MAX_ACTIVE_VOICES) return false;
  activeVoices++;
  return true;
}

export function releaseVoiceSlot() {
  activeVoices = Math.max(0, activeVoices - 1);
}

// Odd-length (2049) zero-DC soft saturation curve; unitySlope=true keeps feedback loops stable
function makeWarmCurve(drive = 1.6, unitySlope = false) {
  const n = 2049;
  const curve = new Float32Array(n);
  const inv = unitySlope ? 1 / drive : 1 / Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * drive) * inv;
  }
  return curve;
}

function createWarmSpringRoomIR(ctx) {
  const sr = ctx.sampleRate;
  const dur = 1.35;
  const len = Math.floor(sr * dur);
  const ir = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    let springPhase = ch * 0.9;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.pow(1 - i / len, 3.2);
      const w = Math.random() * 2 - 1;
      lp = lp * 0.8 + w * 0.2;

      let spring = 0;
      if (t < 0.18) {
        springPhase += (Math.PI * 2 * (340 + ch * 27 - t * 650)) / sr;
        spring = Math.sin(springPhase) * Math.exp(-t / 0.045) * 0.14;
      }

      const early = (i === Math.floor(0.017 * sr) || i === Math.floor(0.031 * sr) || i === Math.floor(0.053 * sr))
        ? (ch === 0 ? 0.25 : -0.22)
        : 0;

      d[i] = (lp * 0.58 + spring) * env + early;
    }
  }
  return ir;
}

export function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    refreshPressingIfNeeded();
    return audioCtx;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass({ latencyHint: 'interactive' });

  pressing = ensurePressing(audioCtx, state.side, state.keyId);
  state.needsPressingRebake = false;

  // Master Bus
  masterToneFilter = audioCtx.createBiquadFilter();
  masterToneFilter.type = 'lowpass';
  masterToneFilter.frequency.value = 11500;
  masterToneFilter.Q.value = 0.7;

  masterWarmth = audioCtx.createWaveShaper();
  masterWarmth.curve = makeWarmCurve(1.55, false);
  masterWarmth.oversample = '2x';

  masterComp = audioCtx.createDynamicsCompressor();
  masterComp.threshold.value = -13;
  masterComp.knee.value = 14;
  masterComp.ratio.value = 3.2;
  masterComp.attack.value = 0.008;
  masterComp.release.value = 0.16;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.88;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  masterToneFilter.connect(masterWarmth);
  masterWarmth.connect(masterComp);
  masterComp.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Input Buses + Sidechain + 4-Stage Liquid Analog Phaser
  kickBus = audioCtx.createGain();
  kickBus.gain.value = 1.0;
  kickBus.connect(masterToneFilter);

  percBus = audioCtx.createGain();
  percBus.gain.value = 0.92;
  percBus.connect(masterToneFilter);

  duckBus = audioCtx.createGain();
  duckBus.gain.value = 1.0;

  sidechainGain = audioCtx.createGain();
  sidechainGain.gain.value = 1.0;

  phaserIn = audioCtx.createGain();
  phaserDry = audioCtx.createGain();
  phaserDry.gain.value = 0.72;
  phaserWet = audioCtx.createGain();
  phaserWet.gain.value = 0.38;

  const baseFreqs = [620, 1080, 1820, 2950];
  phaserStages = baseFreqs.map((f) => {
    const ap = audioCtx.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.value = f;
    ap.Q.value = 0.85;
    return ap;
  });

  for (let i = 0; i < phaserStages.length - 1; i++) {
    phaserStages[i].connect(phaserStages[i + 1]);
  }

  phaserFeedback = audioCtx.createGain();
  phaserFeedback.gain.value = 0.34;

  phaserFbClip = audioCtx.createWaveShaper();
  phaserFbClip.curve = makeWarmCurve(1.4, true);

  phaserLfo = audioCtx.createOscillator();
  phaserLfo.type = 'sine';
  phaserLfo.frequency.value = 0.22;

  phaserLfoGain = audioCtx.createGain();
  phaserLfoGain.gain.value = 380;
  phaserLfo.connect(phaserLfoGain);
  phaserStages.forEach((stage) => {
    phaserLfoGain.connect(stage.frequency);
  });
  phaserLfo.start();

  duckBus.connect(sidechainGain);
  sidechainGain.connect(phaserIn);

  phaserIn.connect(phaserDry);
  phaserDry.connect(masterToneFilter);

  phaserIn.connect(phaserStages[0]);
  const lastStage = phaserStages[phaserStages.length - 1];
  lastStage.connect(phaserWet);
  phaserWet.connect(masterToneFilter);

  lastStage.connect(phaserFbClip);
  phaserFbClip.connect(phaserFeedback);
  phaserFeedback.connect(phaserStages[0]);

  // Parallel Send 1: Stereo BBD Analog Chorus
  chorusSend = audioCtx.createGain();
  chorusSend.gain.value = 0.65;

  chorusDelayL = audioCtx.createDelay(0.08);
  chorusDelayR = audioCtx.createDelay(0.08);
  chorusDelayL.delayTime.value = 0.012;
  chorusDelayR.delayTime.value = 0.018;

  chorusLfoL = audioCtx.createOscillator();
  chorusLfoR = audioCtx.createOscillator();
  chorusLfoL.type = 'sine';
  chorusLfoR.type = 'sine';
  chorusLfoL.frequency.value = 0.41;
  chorusLfoR.frequency.value = 0.34;

  chorusDepthL = audioCtx.createGain();
  chorusDepthR = audioCtx.createGain();
  chorusDepthL.gain.value = 0.0024;
  chorusDepthR.gain.value = 0.0028;

  chorusLfoL.connect(chorusDepthL);
  chorusDepthL.connect(chorusDelayL.delayTime);
  chorusLfoR.connect(chorusDepthR);
  chorusDepthR.connect(chorusDelayR.delayTime);
  chorusLfoL.start();
  chorusLfoR.start();

  const chorusMerger = audioCtx.createChannelMerger(2);
  chorusFilter = audioCtx.createBiquadFilter();
  chorusFilter.type = 'lowpass';
  chorusFilter.frequency.value = 3600;

  chorusReturn = audioCtx.createGain();
  chorusReturn.gain.value = 0.42;

  chorusSend.connect(chorusDelayL);
  chorusSend.connect(chorusDelayR);
  chorusDelayL.connect(chorusMerger, 0, 0);
  chorusDelayR.connect(chorusMerger, 0, 1);
  chorusMerger.connect(chorusFilter);
  chorusFilter.connect(chorusReturn);
  chorusReturn.connect(masterToneFilter);

  // Parallel Send 2: Intimate Spring / Wooden Room Reverb
  roomSend = audioCtx.createGain();
  roomSend.gain.value = 0.55;

  roomConvolver = audioCtx.createConvolver();
  roomConvolver.buffer = createWarmSpringRoomIR(audioCtx);

  roomFilter = audioCtx.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 4200;

  roomReturn = audioCtx.createGain();
  roomReturn.gain.value = 0.38;

  roomSend.connect(roomConvolver);
  roomConvolver.connect(roomFilter);
  roomFilter.connect(roomReturn);
  roomReturn.connect(masterToneFilter);

  // Dynamic Pitch-Coupled Vinyl Surface Bed
  vinylBedSource = audioCtx.createBufferSource();
  vinylBedSource.buffer = pressing.vinylBed;
  vinylBedSource.loop = true;

  vinylBedFilter = audioCtx.createBiquadFilter();
  vinylBedFilter.type = 'bandpass';
  vinylBedFilter.frequency.value = 2100;
  vinylBedFilter.Q.value = 0.45;

  vinylBedGain = audioCtx.createGain();
  vinylBedGain.gain.value = 0.0;

  vinylBedSource.connect(vinylBedFilter);
  vinylBedFilter.connect(vinylBedGain);
  vinylBedGain.connect(masterComp);
  vinylBedSource.start();

  updateEngineParams();
  return audioCtx;
}

export function refreshPressingIfNeeded() {
  if (!audioCtx) return null;
  if (state.needsPressingRebake || !pressing) {
    pressing = ensurePressing(audioCtx, state.side, state.keyId);
    state.needsPressingRebake = false;
  }
  return pressing;
}

export function getAudioContext() {
  return audioCtx;
}

export function getAudioNodes() {
  return {
    audioCtx,
    pressing: refreshPressingIfNeeded(),
    kickBus,
    duckBus,
    percBus,
    chorusSend,
    roomSend,
    masterGain,
    analyser
  };
}

export function updateEngineParams() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const gp = state.groovePos;
  const side = getSide(state.side);
  const absSpeed = Math.abs(state.omegaRatio);

  const phaserAmt = side.phaserMix * (0.45 + gp * 0.72);
  setParamSmooth(phaserWet.gain, phaserAmt, now, 0.06);
  setParamSmooth(phaserDry.gain, 0.84 - phaserAmt * 0.25, now, 0.06);
  setParamSmooth(phaserFeedback.gain, Math.min(0.46, 0.18 + gp * 0.24), now, 0.06);
  setParamSmooth(phaserLfo.frequency, 0.14 + gp * 0.22 + (state.isRimHeld ? 0.15 : 0), now, 0.08);

  setParamSmooth(chorusReturn.gain, side.chorusMix * (0.85 + (1 - gp) * 0.45), now, 0.06);
  setParamSmooth(roomReturn.gain, side.roomMix * (0.55 + gp * 0.65), now, 0.06);

  const brakeDarken = absSpeed < 0.85 ? (0.35 + absSpeed * 0.76) : 1.0;
  const masterCut = Math.max(1100, Math.min(14000, (5600 + gp * 6800) * brakeDarken));
  setParamSmooth(masterToneFilter.frequency, masterCut, now, 0.045, 5);

  if (vinylBedSource && vinylBedGain) {
    const rate = Math.max(0.2, Math.min(2.2, absSpeed || 0.2));
    setParamSmooth(vinylBedSource.playbackRate, rate, now, 0.04, 0.005);

    const markCount = getMarks().length;
    const dustBoost = Math.min(0.065, markCount * 0.0024);
    const bedLevel = state.needleDropped && absSpeed > 0.06
      ? (0.042 + dustBoost) * Math.min(1.15, absSpeed)
      : 0.0;
    setParamSmooth(vinylBedGain.gain, bedLevel, now, 0.05, 0.0005);
  }
}

export function triggerSidechain(time, strength = 1.0) {
  if (!sidechainGain || !audioCtx) return;
  const gp = state.groovePos;
  const pumpDepth = (0.24 + gp * 0.34) * Math.min(1, strength);
  const floor = Math.max(0.36, 1.0 - pumpDepth);
  const g = sidechainGain.gain;
  g.cancelScheduledValues(time);
  g.setValueAtTime(Math.max(floor, g.value), time);
  g.linearRampToValueAtTime(floor, time + 0.011);
  g.exponentialRampToValueAtTime(1.0, time + 0.22 + gp * 0.12);
}

export function playStylusDropThump() {
  const ctx = initAudio();
  const now = ctx.currentTime + 0.004;
  if (!pressing) return;

  const src = ctx.createBufferSource();
  src.buffer = pressing.modalPercs[4];
  src.playbackRate.setValueAtTime(0.82, now);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.45, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  src.connect(g);
  g.connect(percBus);
  src.onended = () => {
    src.onended = null;
    try {
      src.disconnect();
      g.disconnect();
    } catch { /* ignore */ }
  };
  src.start(now);
}

export function playScrubZip() {
  const ctx = initAudio();
  const now = ctx.currentTime + 0.003;
  if (!pressing) return;

  const src = ctx.createBufferSource();
  src.buffer = pressing.chords[0];
  src.playbackRate.setValueAtTime(1.9, now);
  src.playbackRate.exponentialRampToValueAtTime(0.75, now + 0.14);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1800, now);
  bp.frequency.exponentialRampToValueAtTime(620, now + 0.14);
  bp.Q.value = 1.6;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.32, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  src.connect(bp);
  bp.connect(g);
  g.connect(percBus);
  g.connect(roomSend);

  src.onended = () => {
    src.onended = null;
    try {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    } catch { /* ignore */ }
  };
  src.start(now, 0.14, 0.16);
}

/**
 * Silky carbon-fiber brush sweep across vinyl when clearing dust & smudges.
 */
export function playBrushWipeSound() {
  const ctx = initAudio();
  const now = ctx.currentTime + 0.004;
  if (!pressing) return;

  const src = ctx.createBufferSource();
  src.buffer = pressing.brushRide;
  src.playbackRate.setValueAtTime(0.68, now);
  src.playbackRate.exponentialRampToValueAtTime(1.18, now + 0.24);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1100, now);
  bp.frequency.exponentialRampToValueAtTime(3400, now + 0.16);
  bp.frequency.exponentialRampToValueAtTime(1500, now + 0.26);
  bp.Q.value = 1.1;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.28, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

  src.connect(bp);
  bp.connect(g);
  g.connect(percBus);
  g.connect(roomSend);

  src.onended = () => {
    src.onended = null;
    try {
      src.disconnect();
      bp.disconnect();
      g.disconnect();
    } catch { /* ignore */ }
  };
  src.start(now);
  src.stop(now + 0.29);
}
