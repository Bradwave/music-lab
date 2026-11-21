// Web Audio engine for 3AM: 4 magnetic tape lane strips, sidechain duck bus,
// stereo dotted-8th dub tape delay, dark club plate reverb, and master tape glue.

import { state } from '../state/store.js';
import { LANES, getHour } from '../state/scales.js';

let audioCtx = null;
let masterGain = null;
let masterFilter = null;
let masterGate = null;
let masterComp = null;
let tapeSat = null;
let analyser = null;

let dryBus = null;
let duckBus = null;
let sidechainGain = null;

const laneStrips = {};

// Stereo Dub Tape Delay & Plate Reverb sends
let dubSend = null;
let dubDelayL = null;
let dubDelayR = null;
let dubFeedbackL = null;
let dubFeedbackR = null;
let dubFilter = null;
let dubReturn = null;

let reverbSend = null;
let reverbNode = null;
let reverbReturn = null;

let noiseBuffer = null;
let tapeFloorSource = null;
let tapeFloorGain = null;
let lastSatHourId = null;

// Track last-scheduled targets per AudioParam to avoid redundant automation events
const paramTargets = new WeakMap();

function setParamSmooth(param, value, time, timeConstant, eps = 1e-4) {
  if (!param) return;
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

// Odd curve length (2049) ensures exact 0.0 -> 0.0 mapping with zero DC offset.
// When unitySlope is true (used inside feedback loops), small-signal gain is <= 1.0
// so the delay loop can never self-oscillate into runaway crackling distortion.
function makeSoftTapeCurve(amount = 4.5, unitySlope = false) {
  const n = 2049;
  const curve = new Float32Array(n);
  const drive = 1 + amount * 0.14;
  const invDrive = unitySlope ? 1 / drive : 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * drive) * invDrive;
  }
  return curve;
}

function createNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function createClubPlateIR(ctx, duration = 2.3, decay = 2.6) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * duration);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      const w = Math.random() * 2 - 1;
      lp = lp * 0.76 + w * 0.24;
      d[i] = lp * env * 0.65;
    }
  }
  return ir;
}

function createTapeHissBuffer(ctx) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const hiss = (Math.random() * 2 - 1) * 0.014;
    lp = lp * 0.88 + hiss * 0.12;
    const pop = Math.random() < 0.00018 ? (Math.random() * 2 - 1) * 0.15 : 0;
    d[i] = lp + pop;
  }
  return buf;
}

export function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();
  noiseBuffer = createNoiseBuffer(audioCtx);

  // Master chain: dryBus + duckBus -> tapeSat -> masterComp -> masterGain -> analyser -> destination
  dryBus = audioCtx.createGain();
  dryBus.gain.value = 0.96;

  duckBus = audioCtx.createGain();
  duckBus.gain.value = 0.96;

  sidechainGain = audioCtx.createGain();
  sidechainGain.gain.value = 1.0;

  tapeSat = audioCtx.createWaveShaper();
  tapeSat.curve = makeSoftTapeCurve(4.2);
  tapeSat.oversample = '2x';

  masterComp = audioCtx.createDynamicsCompressor();
  masterComp.threshold.value = -13;
  masterComp.knee.value = 18;
  masterComp.ratio.value = 3.2;
  masterComp.attack.value = 0.008;
  masterComp.release.value = 0.16;

  masterFilter = audioCtx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 18000;
  masterFilter.Q.value = 0.8;

  masterGate = audioCtx.createGain();
  masterGate.gain.value = 1.0;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.88;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;

  dryBus.connect(tapeSat);
  duckBus.connect(sidechainGain);
  sidechainGain.connect(tapeSat);

  tapeSat.connect(masterFilter);
  masterFilter.connect(masterGate);
  masterGate.connect(masterComp);
  masterComp.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Stereo Ping-Pong Dub Tape Delay
  dubSend = audioCtx.createGain();
  dubSend.gain.value = 1.0;

  dubFilter = audioCtx.createBiquadFilter();
  dubFilter.type = 'bandpass';
  dubFilter.frequency.value = 1350;
  dubFilter.Q.value = 0.72;

  const dubSat = audioCtx.createWaveShaper();
  dubSat.curve = makeSoftTapeCurve(6.5, true);

  dubDelayL = audioCtx.createDelay(2.0);
  dubDelayR = audioCtx.createDelay(2.0);
  dubFeedbackL = audioCtx.createGain();
  dubFeedbackR = audioCtx.createGain();

  const panL = audioCtx.createStereoPanner();
  panL.pan.value = -0.62;
  const panR = audioCtx.createStereoPanner();
  panR.pan.value = 0.62;

  dubReturn = audioCtx.createGain();
  dubReturn.gain.value = 0.56;

  // Single-loop stereo ping-pong tape echo (strictly bounded loop gain < 1.0)
  dubSend.connect(dubFilter);
  dubFilter.connect(dubSat);
  dubSat.connect(dubDelayL);

  dubDelayL.connect(dubFeedbackL);
  dubFeedbackL.connect(dubDelayR);
  dubDelayR.connect(dubFeedbackR);
  dubFeedbackR.connect(dubFilter);

  dubDelayL.connect(panL);
  dubDelayR.connect(panR);
  panL.connect(dubReturn);
  panR.connect(dubReturn);
  dubReturn.connect(duckBus);

  // Dark Club Plate Reverb
  reverbSend = audioCtx.createGain();
  reverbSend.gain.value = 1.0;

  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = createClubPlateIR(audioCtx);

  const revLowCut = audioCtx.createBiquadFilter();
  revLowCut.type = 'highpass';
  revLowCut.frequency.value = 210;

  reverbReturn = audioCtx.createGain();
  reverbReturn.gain.value = 0.36;

  reverbSend.connect(revLowCut);
  revLowCut.connect(reverbNode);
  reverbNode.connect(reverbReturn);
  reverbReturn.connect(duckBus);

  // 4 Per-Lane Magnetic Head Channel Strips
  for (const laneDef of LANES) {
    const id = laneDef.id;
    const input = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = id === 'chd' ? 1.4 : 0.7;

    const level = audioCtx.createGain();
    const dubTap = audioCtx.createGain();
    dubTap.gain.value = 0;

    input.connect(filter);
    filter.connect(level);
    level.connect(id === 'sub' ? dryBus : duckBus);

    // Per-lane dub throw send tap (post-filter)
    filter.connect(dubTap);
    dubTap.connect(dubSend);

    laneStrips[id] = { input, filter, level, dubTap };
  }

  // Subtle ambient tape/vinyl floor
  tapeFloorGain = audioCtx.createGain();
  tapeFloorGain.gain.value = 0;
  tapeFloorSource = audioCtx.createBufferSource();
  tapeFloorSource.buffer = createTapeHissBuffer(audioCtx);
  tapeFloorSource.loop = true;
  tapeFloorSource.connect(tapeFloorGain);
  tapeFloorGain.connect(duckBus);
  tapeFloorSource.start();

  updateAudioParams();
  return audioCtx;
}

export function getAudioNodes() {
  return {
    audioCtx,
    masterGain,
    analyser,
    dubSend,
    reverbSend,
    noiseBuffer
  };
}

export function getLaneInput(laneId) {
  return laneStrips[laneId]?.input || dryBus;
}

function computeLaneCutoff(id, pressure, phaseMod, depth, drift, tone) {
  // Slow 16-bar filter breathing when DRIFT > 0
  const breathe = drift > 0.01
    ? Math.sin(phaseMod + (id === 'chd' ? 0 : 1.7)) * drift * 0.18
    : 0;
  const effP = Math.max(0.05, Math.min(1, pressure + breathe));

  let cutoff = 16000;
  if (id === 'sub') {
    cutoff = (140 + Math.pow(effP, 1.8) * 1600) * (tone.subWeight > 1.1 ? 0.82 : 1.0);
  } else if (id === 'cut') {
    cutoff = (420 + Math.pow(effP, 1.9) * 11500) * Math.min(1.25, tone.airBright);
  } else if (id === 'chd') {
    cutoff = (260 + Math.pow(effP, 2.0) * (5400 - depth * 2200)) * tone.chordBright;
  } else if (id === 'air') {
    cutoff = (1100 + Math.pow(effP, 1.6) * 14500) * tone.airBright;
  }
  return Math.max(120, Math.min(18000, cutoff));
}

export function updateDriftFilters(phaseMod = 0, time = null) {
  if (!audioCtx || state.drift <= 0.01) return;
  const tNow = time ?? audioCtx.currentTime;
  const depth = state.depth;
  const drift = state.drift;
  const tone = getHour(state.hourId).tone;

  for (const laneDef of LANES) {
    const id = laneDef.id;
    const lane = state.lanes[id];
    const strip = laneStrips[id];
    if (!strip || !lane || lane.muted || lane.pressure <= 0.02) continue;
    const cutoff = computeLaneCutoff(id, lane.pressure, phaseMod, depth, drift, tone);
    setParamSmooth(strip.filter.frequency, cutoff, tNow, 0.08, 2.0);
  }
}

export function updateAudioParams(phaseMod = 0) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const depth = state.depth;
  const drift = state.drift;
  const hour = getHour(state.hourId);
  const t = hour.tone;

  // Update master tape saturation warmth when Night-Arc Hour shifts
  if (lastSatHourId !== state.hourId) {
    tapeSat.curve = makeSoftTapeCurve(t.satDrive);
    lastSatHourId = state.hourId;
  }

  // Tempo-synced dotted-8th (L) & asymmetric ping-pong (R) dub echo times
  const stepSec = 60 / state.bpm / 4;
  const delayLTime = Math.max(0.12, Math.min(1.2, stepSec * 3));
  const delayRTime = Math.max(0.14, Math.min(1.4, stepSec * 3.5));
  setParamSmooth(dubDelayL.delayTime, delayLTime, now, 0.04, 1e-4);
  setParamSmooth(dubDelayR.delayTime, delayRTime, now, 0.04, 1e-4);

  // Any active dub throw or WASH FX pushes feedback up dramatically for swirling tails
  // Single-loop ping-pong feedback: full-cycle gain = fb * 0.94 (strictly < 1.0)
  const anyThrow = Object.values(state.laneDubThrow).some(Boolean);
  const washOn = Boolean(state.fx.WASH);
  const baseFb = Math.max(0.12, Math.min(0.72, 0.20 + depth * 0.42 + t.dubFbBoost));
  const fb = washOn
    ? 0.82
    : anyThrow
      ? Math.min(0.78, Math.max(0.58, baseFb + 0.2))
      : baseFb;
  const perTapFb = Math.sqrt(fb);
  setParamSmooth(dubFeedbackL.gain, perTapFb, now, 0.03, 1e-3);
  setParamSmooth(dubFeedbackR.gain, perTapFb * 0.94, now, 0.03, 1e-3);

  const dubCut = washOn ? 1850 : Math.max(420, (950 + (1 - depth) * 1450) * t.dubDark);
  setParamSmooth(dubFilter.frequency, dubCut, now, 0.04, 1.0);
  setParamSmooth(dubReturn.gain, 0.28 + depth * 0.52 + (anyThrow ? 0.2 : 0) + (washOn ? 0.34 : 0), now, 0.03, 1e-3);
  setParamSmooth(reverbReturn.gain, (0.16 + depth * 0.42 + (washOn ? 0.28 : 0)) * t.reverbScale, now, 0.04, 1e-3);

  // Master Submerge (SUBM) resonant underwater club filter
  if (masterFilter) {
    const submOn = Boolean(state.fx.SUBM);
    setParamSmooth(masterFilter.frequency, submOn ? 340 : 18500, now, submOn ? 0.055 : 0.04, 1.0);
    setParamSmooth(masterFilter.Q, submOn ? 4.2 : 0.75, now, 0.04, 1e-2);
  }

  // Tape hiss floor only breathes softly while playing
  const hissTarget = state.isPlaying ? (0.04 + depth * 0.14 + (state.fx.FLUT ? 0.14 : 0)) : 0;
  setParamSmooth(tapeFloorGain.gain, hissTarget, now, 0.08, 1e-3);

  // Per-lane head pressure (filter cutoff + level) & dub throw taps
  for (const laneDef of LANES) {
    const id = laneDef.id;
    const lane = state.lanes[id];
    const strip = laneStrips[id];
    if (!strip || !lane) continue;

    const p = lane.pressure;
    const isMuted = lane.muted || p <= 0.02;
    const throwOn = Boolean(state.laneDubThrow[id]);

    const cutoff = computeLaneCutoff(id, p, phaseMod, depth, drift, t);
    setParamSmooth(strip.filter.frequency, cutoff, now, 0.035, 1.0);
    const targetLevel = isMuted ? 0 : (0.18 + Math.pow(p, 0.85) * 0.82);
    setParamSmooth(strip.level.gain, targetLevel, now, 0.015, 1e-3);

    // Live dub throw or WASH floods into stereo tape echo
    const baseDub = id === 'chd' ? (0.18 + depth * 0.44) : id === 'cut' ? (depth * 0.20) : (depth * 0.08);
    const dubAmt = isMuted ? 0 : (throwOn || (washOn && id !== 'sub') ? 0.92 : baseDub);
    setParamSmooth(strip.dubTap.gain, dubAmt, now, 0.02, 1e-3);
  }
}

export function triggerSliceGate(time, stepSec) {
  if (!masterGate || !audioCtx) return;
  const g = masterGate.gain;
  if (typeof g.cancelAndHoldAtTime === 'function') {
    g.cancelAndHoldAtTime(time);
  } else {
    g.cancelScheduledValues(time);
  }
  // Crisp rhythmic microhouse 32nd-note chopper
  const half = stepSec * 0.5;
  g.setValueAtTime(1.0, time);
  g.linearRampToValueAtTime(0.08, time + half * 0.42);
  g.setValueAtTime(0.08, time + half * 0.85);
  g.linearRampToValueAtTime(1.0, time + half);
  g.linearRampToValueAtTime(0.14, time + stepSec * 0.82);
  g.linearRampToValueAtTime(1.0, time + stepSec);
}

export function resetMasterGate() {
  if (!masterGate || !audioCtx) return;
  const now = audioCtx.currentTime;
  const g = masterGate.gain;
  if (typeof g.cancelAndHoldAtTime === 'function') {
    g.cancelAndHoldAtTime(now);
  } else {
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
  }
  g.setTargetAtTime(1.0, now, 0.015);
}

export function triggerSidechain(time, strength = 1.0) {
  if (!sidechainGain || !audioCtx) return;
  const pumpAmt = (0.18 + state.depth * 0.56) * Math.min(1, strength);
  const floor = Math.max(0.18, 1 - pumpAmt);
  const g = sidechainGain.gain;
  if (typeof g.cancelAndHoldAtTime === 'function') {
    g.cancelAndHoldAtTime(time);
  } else {
    g.cancelScheduledValues(time);
    g.setValueAtTime(Math.max(floor, g.value), time);
  }
  g.linearRampToValueAtTime(floor, time + 0.009);
  g.exponentialRampToValueAtTime(1.0, time + 0.24 + state.depth * 0.14);
}
