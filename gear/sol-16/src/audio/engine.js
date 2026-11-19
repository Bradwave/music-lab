import { state, showLcdMessage, notify } from '../state/store.js';
import { CHANNELS } from '../state/scales.js';

let audioCtx = null;
let masterGain = null;
let masterFilter = null;
let masterComp = null;
let tapeSat = null;
let analyser = null;
let drumBus = null;
let duckBus = null;
let sidechainGain = null;
const trackStrips = {};

// Sends
let dubSend = null;
let dubDelayNode = null;
let dubFeedback = null;
let dubFilter = null;
let reverbSend = null;
let reverbNode = null;

// Vinyl dust
let vinylGain = null;
let vinylSource = null;
let noiseBuffer = null;

function makeSoftClipCurve(amount = 6) {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * (1 + amount * 0.08));
  }
  return curve;
}

function createWarmPlateIR(ctx, duration = 2.4, decay = 2.7) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, decay);
      const white = Math.random() * 2 - 1;
      lp = lp * 0.72 + white * 0.28;
      data[i] = lp * env * 0.68;
    }
  }
  return impulse;
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

function createVinylDustBuffer(ctx) {
  const len = ctx.sampleRate * 5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const hiss = (Math.random() * 2 - 1) * 0.012;
    lp = lp * 0.9 + hiss * 0.1;
    let pop = 0;
    if (Math.random() < 0.00022) {
      pop = (Math.random() * 2 - 1) * 0.18;
    }
    data[i] = lp + pop;
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

  drumBus = audioCtx.createGain();
  drumBus.gain.value = 0.94;

  duckBus = audioCtx.createGain();
  duckBus.gain.value = 0.92;

  sidechainGain = audioCtx.createGain();
  sidechainGain.gain.value = 1.0;

  masterFilter = audioCtx.createBiquadFilter();
  masterFilter.type = 'lowpass';
  masterFilter.frequency.value = 17500;
  masterFilter.Q.value = 0.75;

  tapeSat = audioCtx.createWaveShaper();
  tapeSat.curve = makeSoftClipCurve(4 + (state.pump / 100) * 6);
  tapeSat.oversample = '2x';

  masterComp = audioCtx.createDynamicsCompressor();
  masterComp.threshold.value = -13;
  masterComp.knee.value = 18;
  masterComp.ratio.value = 3.2;
  masterComp.attack.value = 0.008;
  masterComp.release.value = 0.16;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.88;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.74;

  // Dotted-8th Dub Tape Delay Send
  dubSend = audioCtx.createGain();
  dubSend.gain.value = 0.36;

  dubDelayNode = audioCtx.createDelay(2.0);
  dubDelayNode.delayTime.value = (60 / state.bpm) * 0.75;

  dubFilter = audioCtx.createBiquadFilter();
  dubFilter.type = 'bandpass';
  dubFilter.frequency.value = 1280;
  dubFilter.Q.value = 0.85;

  dubFeedback = audioCtx.createGain();
  dubFeedback.gain.value = 0.44;

  dubSend.connect(dubDelayNode);
  dubDelayNode.connect(dubFilter);
  dubFilter.connect(dubFeedback);
  dubFeedback.connect(dubDelayNode);
  dubFilter.connect(sidechainGain);

  // Warm Plate Reverb Send
  reverbSend = audioCtx.createGain();
  reverbSend.gain.value = 0.34;

  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = createWarmPlateIR(audioCtx, 2.5, 2.6);

  reverbSend.connect(reverbNode);
  reverbNode.connect(sidechainGain);

  // Master Routing
  drumBus.connect(masterFilter);
  duckBus.connect(sidechainGain);
  sidechainGain.connect(masterFilter);

  // Per-track analog saturation + punchy compressor strips (including KICK & PERC!)
  CHANNELS.forEach(ch => {
    const input = audioCtx.createGain();
    const preGain = audioCtx.createGain();
    const shaper = audioCtx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(12);
    shaper.oversample = '2x';

    const comp = audioCtx.createDynamicsCompressor();
    comp.knee.value = 10;
    comp.attack.value = ch.id === 'bd' || ch.id === 'pr' ? 0.004 : 0.008;
    comp.release.value = ch.id === 'bd' || ch.id === 'pr' ? 0.085 : 0.14;

    const makeup = audioCtx.createGain();

    input.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(comp);
    comp.connect(makeup);
    makeup.connect(ch.id === 'bd' || ch.id === 'pr' ? drumBus : duckBus);

    trackStrips[ch.id] = { input, preGain, shaper, comp, makeup };
    updateTrackDrive(ch.id);
  });

  masterFilter.connect(tapeSat);
  tapeSat.connect(masterComp);
  masterComp.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);
  updateFxAudioParams();

  // Warm Vinyl Dust Loop
  vinylGain = audioCtx.createGain();
  vinylGain.gain.value = state.vinylOn ? 0.18 : 0.0;
  vinylSource = audioCtx.createBufferSource();
  vinylSource.buffer = createVinylDustBuffer(audioCtx);
  vinylSource.loop = true;
  vinylSource.connect(vinylGain);
  vinylGain.connect(masterFilter);
  vinylSource.start();

  return audioCtx;
}

export function getTrackInput(chId) {
  return trackStrips[chId]?.input || (chId === 'bd' || chId === 'pr' ? drumBus : duckBus);
}

export function updateTrackDrive(chId) {
  if (!audioCtx || !trackStrips[chId]) return;
  const now = audioCtx.currentTime;
  const d = Math.max(0, Math.min(1, state.trackParams[chId]?.drive ?? 0.2));
  const strip = trackStrips[chId];

  // Warm analog saturation drive + tight per-track compression squash
  const pre = 0.95 + d * 3.1;
  const threshold = -6 - d * 24;   // -6dB (open) -> -30dB (heavily squashed!)
  const ratio = 1.5 + d * 8.5;     // 1.5:1 -> 10:1
  const makeup = 1.0 + d * 0.45 - Math.max(0, d - 0.5) * 0.35; // balanced loudness

  strip.preGain.gain.setTargetAtTime(pre, now, 0.025);
  strip.comp.threshold.setTargetAtTime(threshold, now, 0.025);
  strip.comp.ratio.setTargetAtTime(ratio, now, 0.025);
  strip.makeup.gain.setTargetAtTime(makeup, now, 0.025);
}

export function updateAllTrackDrives() {
  CHANNELS.forEach(ch => updateTrackDrive(ch.id));
}

export function getAudioNodes() {
  return {
    audioCtx,
    masterGain,
    analyser,
    drumBus,
    duckBus,
    dubSend,
    reverbSend,
    noiseBuffer
  };
}

export function updateVinylAudio() {
  if (!audioCtx || !vinylGain) return;
  vinylGain.gain.setTargetAtTime(state.vinylOn ? 0.18 : 0.0, audioCtx.currentTime, 0.06);
}

export function updateFxAudioParams() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const baseDelay = (60 / state.bpm) * 0.75;
  dubDelayNode.delayTime.setTargetAtTime(state.fx.TAPE ? baseDelay * 1.32 : baseDelay, now, 0.045);

  dubFeedback.gain.setTargetAtTime(state.fx.DUB ? 0.86 : 0.44, now, 0.035);
  dubSend.gain.setTargetAtTime(state.fx.DUB ? 0.96 : 0.36, now, 0.035);

  if (state.fx.LPF) {
    masterFilter.frequency.setTargetAtTime(380, now, 0.035);
    masterFilter.Q.setTargetAtTime(3.0, now, 0.035);
  } else if (state.fx.TAPE) {
    masterFilter.frequency.setTargetAtTime(1450, now, 0.05);
    masterFilter.Q.setTargetAtTime(1.3, now, 0.05);
  } else {
    masterFilter.frequency.setTargetAtTime(17500, now, 0.04);
    masterFilter.Q.setTargetAtTime(0.75, now, 0.04);
  }

  const compNorm = Math.max(0, Math.min(1, (state.comp ?? 42) / 100));
  const baseDrive = 2 + compNorm * 22;
  tapeSat.curve = makeSoftClipCurve(state.fx.TAPE ? 30 : baseDrive);

  // Master bus glue compressor (compresses EVERYTHING including Kick & Perc!)
  masterComp.threshold.setTargetAtTime(-8 - compNorm * 24, now, 0.03);
  masterComp.ratio.setTargetAtTime(1.8 + compNorm * 8.5, now, 0.03);
  masterComp.release.setTargetAtTime(0.18 - compNorm * 0.08, now, 0.03);
  masterGain.gain.setTargetAtTime(0.84 + compNorm * 0.44, now, 0.03);
}

export function triggerSidechain(time, intensity = 0.85) {
  if (!sidechainGain) return;
  const pumpNorm = state.pump / 100;
  if (pumpNorm < 0.02) return;
  const duckDepth = Math.max(0.14, 1.0 - intensity * pumpNorm * 0.82);
  sidechainGain.gain.cancelScheduledValues(time);
  sidechainGain.gain.setValueAtTime(1.0, time);
  sidechainGain.gain.linearRampToValueAtTime(duckDepth, time + 0.012);
  sidechainGain.gain.exponentialRampToValueAtTime(1.0, time + 0.16 + pumpNorm * 0.12);
}

// Normalize a mono AudioBuffer cleanly
function normalizeMonoBuffer(ctx, inputBuf, maxDurationSec) {
  const maxSamples = Math.min(inputBuf.length, Math.floor(inputBuf.sampleRate * maxDurationSec));
  const outBuf = ctx.createBuffer(1, Math.max(1, maxSamples), inputBuf.sampleRate);
  const out = outBuf.getChannelData(0);
  const chCount = inputBuf.numberOfChannels;

  let peak = 0.01;
  for (let i = 0; i < maxSamples; i++) {
    let sum = 0;
    for (let c = 0; c < chCount; c++) {
      sum += inputBuf.getChannelData(c)[i];
    }
    const val = sum / chCount;
    out[i] = val;
    const abs = Math.abs(val);
    if (abs > peak) peak = abs;
  }

  const norm = 0.88 / peak;
  for (let i = 0; i < maxSamples; i++) out[i] *= norm;
  return outBuf;
}

// Import any browser-supported audio file (MP3, WAV, OGG, M4A, WEBM) into VOX or SMPL
export async function importAudioFile(file, targetChannel = 'sm') {
  const ctx = initAudio();
  try {
    const arrayBuf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    const maxSec = targetChannel === 'sm' ? 6.0 : 3.0;
    const cleanBuf = normalizeMonoBuffer(ctx, decoded, maxSec);
    const shortName = file.name.replace(/\.[^.]+$/, '').slice(0, 14).toUpperCase();

    if (targetChannel === 'vx') {
      state.voxMicBuffer = cleanBuf;
      state.voxUseMic = true;
      state.voxSampleName = shortName;
      showLcdMessage(`VOX LOADED: ${shortName}`);
    } else {
      state.smplBuffer = cleanBuf;
      state.smplUseCustom = true;
      state.smplSampleName = shortName;
      showLcdMessage(`8 CHOPS: ${shortName}`);
    }
    notify('sample');
    return true;
  } catch {
    showLcdMessage('COULD NOT DECODE AUDIO');
    return false;
  }
}

// PO-33 style Microphone Sampler for VOX (1.5s pitched) or SMPL (2.5s auto-sliced into 8 chops)
export async function recordMicSample(targetChannel = 'vx') {
  initAudio();
  if (state.isMicRecording) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showLcdMessage('MIC NOT AVAILABLE');
    return;
  }

  const durationSec = targetChannel === 'sm' ? 2.4 : 1.5;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.isMicRecording = true;
    state.micTargetChannel = targetChannel;
    showLcdMessage(`REC ${targetChannel === 'sm' ? 'SMPL 2.4S' : 'VOX 1.5S'}...`, durationSec * 1000 + 200);
    notify('sample');

    const src = audioCtx.createMediaStreamSource(stream);
    const recNode = audioCtx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    let totalSamples = 0;
    const maxSamples = Math.floor(audioCtx.sampleRate * durationSec);

    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    src.connect(recNode);
    recNode.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    const finish = () => {
      if (!state.isMicRecording) return;
      state.isMicRecording = false;
      recNode.disconnect();
      src.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach(t => t.stop());

      const len = Math.min(totalSamples, maxSamples);
      const buf = audioCtx.createBuffer(1, Math.max(1, len), audioCtx.sampleRate);
      const out = buf.getChannelData(0);
      let offset = 0;
      let peak = 0.01;
      for (const c of chunks) {
        for (let i = 0; i < c.length && offset < len; i++) {
          out[offset] = c[i];
          const abs = Math.abs(c[i]);
          if (abs > peak) peak = abs;
          offset++;
        }
      }
      const norm = 0.88 / peak;
      for (let i = 0; i < len; i++) out[i] *= norm;

      if (targetChannel === 'sm') {
        state.smplBuffer = buf;
        state.smplUseCustom = true;
        state.smplSampleName = 'MIC CHOPS';
        showLcdMessage('SMPL 8 CHOPS READY!');
      } else {
        state.voxMicBuffer = buf;
        state.voxUseMic = true;
        state.voxSampleName = 'MIC VOX';
        showLcdMessage('VOX MIC SAMPLED!');
      }
      notify('sample');
    };

    recNode.onaudioprocess = (e) => {
      if (!state.isMicRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
      totalSamples += input.length;
      if (totalSamples >= maxSamples) finish();
    };

    setTimeout(finish, durationSec * 1000 + 80);
  } catch {
    state.isMicRecording = false;
    showLcdMessage('MIC ACCESS DENIED');
    notify('sample');
  }
}
