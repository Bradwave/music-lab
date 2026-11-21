// Web Audio DSP Engine for PRISM:
// West-Coast Buchla LPG / FM / Wavefolder bus architecture with:
// - Kick/Bass-driven sidechain ducking bus
// - Tempo-synced stereo ping-pong delay with unity-slope feedback saturation
// - Procedural crystalline shimmer hall reverb IR
// - Flux-adaptive master warmth/wavefold & glue compressor
// - Real-time analyser for bezel telemetry

import { state } from '../state/store.js';

let audioCtx = null;

// Buses
let dryBus = null;
let sidechainGain = null;
let bassBus = null;
let percBus = null;

// Stereo Ping-Pong Delay Send
let delaySend = null;
let delayL = null;
let delayR = null;
let delayFbL = null;
let delayFbR = null;
let delayFilterL = null;
let delayFilterR = null;
let delaySatL = null;
let delaySatR = null;
let delayReturn = null;

// Shimmer Hall Reverb Send
let reverbSend = null;
let reverbConvolver = null;
let reverbFilter = null;
let reverbReturn = null;

// Master Chain
let masterSum = null;
let masterDrive = null;
let masterTone = null;
let masterComp = null;
let masterGain = null;
let analyser = null;
let freqData = null;

// Shared reusable buffers & curves
let noiseBuffer = null;
let foldCurves = {};

const MAX_ACTIVE_VOICES = 32;
let activeVoices = 0;

export function acquireVoiceSlot() {
  if (activeVoices >= MAX_ACTIVE_VOICES) return false;
  activeVoices++;
  return true;
}

export function releaseVoiceSlot() {
  activeVoices = Math.max(0, activeVoices - 1);
}

const paramTargets = new WeakMap();

export function setParamSmooth(param, value, time, timeConstant = 0.03, eps = 1e-4) {
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

// Odd-length (2049) zero-DC soft saturation curve; unitySlope=true keeps feedback loops bounded
function makeSatCurve(drive = 1.6, unitySlope = false) {
  const n = 2049;
  const curve = new Float32Array(n);
  const inv = unitySlope ? 1 / drive : 1 / Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * drive) * inv;
  }
  return curve;
}

// Buchla-style trigonometric wavefolder curve (zero DC at x=0)
function makeWavefoldCurve(folds = 2.6) {
  const n = 2049;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const folded = Math.sin(x * Math.PI * folds) * 0.78 + Math.tanh(x * 1.8) * 0.22;
    curve[i] = Math.max(-1, Math.min(1, folded));
  }
  return curve;
}

function createNoiseBuffer(ctx) {
  const sr = ctx.sampleRate;
  const len = sr * 2;
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() * 2 - 1;
    }
  }
  return buf;
}

// Procedural stereo crystalline shimmer hall IR (warm early room + airy diffuse tail)
function createShimmerHallIR(ctx) {
  const sr = ctx.sampleRate;
  const dur = 2.4;
  const len = Math.floor(sr * dur);
  const ir = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    let hp = 0;
    let shimmerPhaseA = ch * 1.1;
    let shimmerPhaseB = ch * 2.3;

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const attack = Math.min(1, t / 0.022);
      const decay = Math.pow(1 - i / len, 2.75);
      const w = Math.random() * 2 - 1;

      // Smooth diffuse body
      lp = lp * 0.72 + w * 0.28;
      // Airy upper sparkle
      hp = w - lp;

      // Subtle harmonic glass modal shimmer inside tail
      shimmerPhaseA += (Math.PI * 2 * (1174.66 + ch * 4.5)) / sr;
      shimmerPhaseB += (Math.PI * 2 * (1760.0 - ch * 3.8)) / sr;
      const modal = (Math.sin(shimmerPhaseA) * 0.55 + Math.sin(shimmerPhaseB) * 0.45)
        * Math.exp(-t / 0.75) * 0.032;

      d[i] = (lp * 0.72 + hp * 0.22 * Math.exp(-t * 1.1) + modal) * attack * decay * 0.75;
    }
  }
  return ir;
}

export function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx({ latencyHint: 'interactive' });

  noiseBuffer = createNoiseBuffer(audioCtx);
  foldCurves = {
    warm: makeSatCurve(1.35, false),
    acid: makeWavefoldCurve(2.2),
    glitch: makeWavefoldCurve(3.4),
    void: makeSatCurve(1.15, false),
    fbSat: makeSatCurve(1.45, true)
  };

  // Buses
  dryBus = audioCtx.createGain();
  dryBus.gain.value = 0.92;

  sidechainGain = audioCtx.createGain();
  sidechainGain.gain.value = 1.0;

  bassBus = audioCtx.createGain();
  bassBus.gain.value = 0.95;

  percBus = audioCtx.createGain();
  percBus.gain.value = 0.8;

  // Stereo Ping-Pong Delay
  delaySend = audioCtx.createGain();
  delaySend.gain.value = 0.34;

  delayL = audioCtx.createDelay(1.5);
  delayR = audioCtx.createDelay(1.5);
  delayL.delayTime.value = 0.25;
  delayR.delayTime.value = 0.375;

  delayFilterL = audioCtx.createBiquadFilter();
  delayFilterL.type = 'lowpass';
  delayFilterL.frequency.value = 3400;

  delayFilterR = audioCtx.createBiquadFilter();
  delayFilterR.type = 'lowpass';
  delayFilterR.frequency.value = 2800;

  delaySatL = audioCtx.createWaveShaper();
  delaySatL.curve = foldCurves.fbSat;

  delaySatR = audioCtx.createWaveShaper();
  delaySatR.curve = foldCurves.fbSat;

  delayFbL = audioCtx.createGain();
  delayFbR = audioCtx.createGain();
  delayFbL.gain.value = 0.42;
  delayFbR.gain.value = 0.42;

  const panL = audioCtx.createStereoPanner();
  const panR = audioCtx.createStereoPanner();
  panL.pan.value = -0.78;
  panR.pan.value = 0.78;

  delayReturn = audioCtx.createGain();
  delayReturn.gain.value = 0.42;

  // Ping-pong cross routing
  delaySend.connect(delayL);
  delayL.connect(delayFilterL);
  delayFilterL.connect(delaySatL);
  delaySatL.connect(panL);
  panL.connect(delayReturn);
  delaySatL.connect(delayFbL);
  delayFbL.connect(delayR);

  delayR.connect(delayFilterR);
  delayFilterR.connect(delaySatR);
  delaySatR.connect(panR);
  panR.connect(delayReturn);
  delaySatR.connect(delayFbR);
  delayFbR.connect(delayL);

  // Shimmer Hall Reverb
  reverbSend = audioCtx.createGain();
  reverbSend.gain.value = 0.32;

  reverbConvolver = audioCtx.createConvolver();
  reverbConvolver.buffer = createShimmerHallIR(audioCtx);

  reverbFilter = audioCtx.createBiquadFilter();
  reverbFilter.type = 'highpass';
  reverbFilter.frequency.value = 180;

  reverbReturn = audioCtx.createGain();
  reverbReturn.gain.value = 0.46;

  reverbSend.connect(reverbConvolver);
  reverbConvolver.connect(reverbFilter);
  reverbFilter.connect(reverbReturn);

  // Master Chain
  masterSum = audioCtx.createGain();
  masterSum.gain.value = 0.88;

  masterDrive = audioCtx.createWaveShaper();
  masterDrive.curve = foldCurves.warm;
  masterDrive.oversample = '2x';

  masterTone = audioCtx.createBiquadFilter();
  masterTone.type = 'highshelf';
  masterTone.frequency.value = 4600;
  masterTone.gain.value = 1.5;

  masterComp = audioCtx.createDynamicsCompressor();
  masterComp.threshold.value = -13;
  masterComp.knee.value = 16;
  masterComp.ratio.value = 4.2;
  masterComp.attack.value = 0.004;
  masterComp.release.value = 0.14;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.72;
  freqData = new Uint8Array(analyser.frequencyBinCount);

  // Connections
  dryBus.connect(sidechainGain);
  sidechainGain.connect(masterSum);
  bassBus.connect(masterSum);
  percBus.connect(masterSum);
  delayReturn.connect(masterSum);
  reverbReturn.connect(masterSum);

  masterSum.connect(masterDrive);
  masterDrive.connect(masterTone);
  masterTone.connect(masterComp);
  masterComp.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  updateEngineParams();
  return audioCtx;
}

export function getAudioNodes() {
  return {
    audioCtx,
    dryBus,
    bassBus,
    percBus,
    delaySend,
    reverbSend,
    masterGain,
    noiseBuffer,
    foldCurves
  };
}

/**
 * Trigger a tight groove-pocket sidechain duck on melodic buses when bass or emitter kick fires.
 */
export function triggerSidechainDuck(time, depth = 0.38, release = 0.14) {
  if (!sidechainGain || !audioCtx) return;
  const duckTo = Math.max(0.25, 1 - depth);
  sidechainGain.gain.cancelScheduledValues(time);
  sidechainGain.gain.setValueAtTime(sidechainGain.gain.value, time);
  sidechainGain.gain.linearRampToValueAtTime(duckTo, time + 0.008);
  sidechainGain.gain.exponentialRampToValueAtTime(1.0, time + release);
}

/**
 * Sync delay times, feedback, reverb space, and master tone with BPM, FLUX mode, and HYPER hold.
 */
export function updateEngineParams() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const stepSec = 60 / state.bpm / 4;

  const isHyper = state.isHyper;
  const flux = state.flux;

  // Tempo-synced ping-pong delay times (tighter + hypnotic during HYPER)
  let dTimeL = stepSec * 3; // dotted 8th
  let dTimeR = stepSec * 2; // 8th
  let fb = 0.4;
  let dCut = 3200;
  let dRet = 0.42;
  let rRet = 0.45;
  let shelfGain = 1.5;

  if (flux === 'glass') {
    dTimeL = stepSec * 3;
    dTimeR = stepSec * 4;
    fb = 0.42;
    dCut = 3800;
    dRet = 0.44;
    rRet = 0.54;
    shelfGain = 2.0;
    masterDrive.curve = foldCurves.warm;
  } else if (flux === 'acid') {
    dTimeL = stepSec * 3;
    dTimeR = stepSec * 2;
    fb = 0.36;
    dCut = 2600;
    dRet = 0.36;
    rRet = 0.28;
    shelfGain = 1.2;
    masterDrive.curve = makeSatCurve(2.05, false);
  } else if (flux === 'glitch') {
    dTimeL = stepSec * 1.5;
    dTimeR = stepSec * 2.5;
    fb = 0.52;
    dCut = 4800;
    dRet = 0.48;
    rRet = 0.36;
    shelfGain = 3.2;
    masterDrive.curve = makeSatCurve(2.4, false);
  } else if (flux === 'void') {
    dTimeL = stepSec * 4;
    dTimeR = stepSec * 6;
    fb = 0.58;
    dCut = 1900;
    dRet = 0.54;
    rRet = 0.82;
    shelfGain = -1.5;
    masterDrive.curve = foldCurves.void;
  }

  if (isHyper) {
    dTimeL = Math.max(0.04, stepSec * 0.75);
    dTimeR = Math.max(0.055, stepSec * 1.125);
    fb = 0.76;
    dCut = 5200;
    dRet = 0.62;
    rRet = Math.max(rRet, 0.62);
    shelfGain += 2.5;
  }

  setParamSmooth(delayL.delayTime, Math.min(1.4, dTimeL), now, 0.045);
  setParamSmooth(delayR.delayTime, Math.min(1.4, dTimeR), now, 0.045);
  setParamSmooth(delayFbL.gain, fb, now, 0.04);
  setParamSmooth(delayFbR.gain, fb, now, 0.04);
  setParamSmooth(delayFilterL.frequency, dCut, now, 0.05);
  setParamSmooth(delayFilterR.frequency, dCut * 0.85, now, 0.05);
  setParamSmooth(delayReturn.gain, dRet, now, 0.04);
  setParamSmooth(reverbReturn.gain, rRet, now, 0.05);
  setParamSmooth(masterTone.gain, shelfGain, now, 0.06);
}

/**
 * Sample 8 compact frequency energy bands (0..1) for live bezel telemetry bars.
 */
export function getEnergyBands(out) {
  if (!analyser || !freqData) {
    for (let i = 0; i < out.length; i++) out[i] *= 0.85;
    return;
  }
  analyser.getByteFrequencyData(freqData);
  const step = Math.max(1, Math.floor(freqData.length / out.length));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) {
      sum += freqData[Math.min(freqData.length - 1, i * step + j)];
    }
    const target = sum / (step * 255);
    out[i] = out[i] * 0.55 + target * 0.45;
  }
}
