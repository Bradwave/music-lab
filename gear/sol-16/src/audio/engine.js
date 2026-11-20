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

// Extreme-capable asymmetrical analog overdrive / fuzz curve (0 = clean, 1 = filthy crunch)
function makeOverdriveCurve(driveNorm = 0) {
  const n = 2048;
  const curve = new Float32Array(n);
  if (driveNorm <= 0.01) {
    for (let i = 0; i < n; i++) curve[i] = (i * 2) / n - 1;
    return curve;
  }
  const k = 1 + Math.pow(driveNorm, 1.55) * 44;
  const asym = driveNorm * 0.16;
  const biasOffset = Math.tanh(asym);
  const norm = 1 / Math.max(0.001, Math.tanh(k + asym) - biasOffset);
  const hardMix = Math.max(0, (driveNorm - 0.55) / 0.45);

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    const soft = (Math.tanh(x * k + asym) - biasOffset) * norm;
    const hard = Math.max(-0.82, Math.min(0.82, x * (1 + k * 0.45))) / 0.82;
    curve[i] = soft * (1 - hardMix * 0.45) + hard * (hardMix * 0.45);
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

  // Per-track analog overdrive + heavy compressor strips (including KICK & PERC!)
  CHANNELS.forEach(ch => {
    const input = audioCtx.createGain();
    const preGain = audioCtx.createGain();
    const shaper = audioCtx.createWaveShaper();
    shaper.oversample = '4x';

    // Warm post-distortion tone filter so extreme crunch stays thick, never harsh fizz
    const postLp = audioCtx.createBiquadFilter();
    postLp.type = 'lowpass';
    postLp.frequency.value = 18000;
    postLp.Q.value = 0.7;

    const comp = audioCtx.createDynamicsCompressor();
    comp.knee.value = 8;
    comp.attack.value = ch.id === 'bd' || ch.id === 'pr' ? 0.003 : 0.006;
    comp.release.value = ch.id === 'bd' || ch.id === 'pr' ? 0.07 : 0.12;

    const makeup = audioCtx.createGain();
    const volGain = audioCtx.createGain();
    const panner = typeof audioCtx.createStereoPanner === 'function'
      ? audioCtx.createStereoPanner()
      : null;

    input.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(postLp);
    postLp.connect(comp);
    comp.connect(makeup);
    makeup.connect(volGain);

    const dest = ch.id === 'bd' || ch.id === 'pr' ? drumBus : duckBus;
    if (panner) {
      volGain.connect(panner);
      panner.connect(dest);
    } else {
      volGain.connect(dest);
    }

    trackStrips[ch.id] = { input, preGain, shaper, postLp, comp, makeup, volGain, panner };
    updateTrackDrive(ch.id);
    updateTrackMix(ch.id);
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

  // Dramatic analog overdrive (clean -> warm console -> gritty MPC -> filthy squash!)
  strip.shaper.curve = makeOverdriveCurve(d);
  const pre = 1.0 + Math.pow(d, 1.45) * 9.5;
  const postCut = 18000 - Math.pow(d, 0.85) * 13200; // warms extreme grit down to ~4.8kHz
  const threshold = -4 - d * 40;                      // -4dB (open) -> -44dB (brickwall squash)
  const ratio = 1.5 + Math.pow(d, 1.2) * 17.5;        // 1.5:1 -> 19:1
  const knee = 12 - d * 10;                           // softer -> hard punchy knee
  const makeup = 1.0 + d * 0.55 - Math.pow(d, 1.8) * 0.58; // keep perceived loudness punchy & safe

  strip.preGain.gain.setTargetAtTime(pre, now, 0.02);
  strip.postLp.frequency.setTargetAtTime(Math.max(3800, postCut), now, 0.025);
  strip.comp.threshold.setTargetAtTime(threshold, now, 0.02);
  strip.comp.ratio.setTargetAtTime(ratio, now, 0.02);
  strip.comp.knee.setTargetAtTime(Math.max(0, knee), now, 0.02);
  strip.makeup.gain.setTargetAtTime(Math.max(0.65, makeup), now, 0.02);
}

export function updateAllTrackDrives() {
  CHANNELS.forEach(ch => updateTrackDrive(ch.id));
}

export function updateTrackMix(chId) {
  if (!audioCtx || !trackStrips[chId]) return;
  const now = audioCtx.currentTime;
  const p = state.trackParams[chId] || {};
  const vol = Math.max(0, Math.min(1, p.vol ?? 0.85));
  const pan = Math.max(-1, Math.min(1, p.pan ?? 0));
  const strip = trackStrips[chId];
  // Musical exponential volume taper so low levels feel smooth and granular
  strip.volGain.gain.setTargetAtTime(vol * vol * 1.32, now, 0.02);
  if (strip.panner) {
    strip.panner.pan.setTargetAtTime(pan, now, 0.02);
  }
}

export function updateAllTrackMix() {
  CHANNELS.forEach(ch => updateTrackMix(ch.id));
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
  const lvl = Math.max(0, Math.min(1, (state.vinylLevel ?? 32) / 100));
  vinylGain.gain.setTargetAtTime(state.vinylOn ? lvl * 0.48 : 0.0, audioCtx.currentTime, 0.05);
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
  tapeSat.curve = state.fx.TAPE
    ? makeOverdriveCurve(0.68)
    : makeOverdriveCurve(compNorm * 0.58);

  // Master bus glue compressor (compresses EVERYTHING including Kick & Perc!)
  const masterLvl = Math.max(0, Math.min(1, (state.masterVol ?? 88) / 100));
  masterComp.threshold.setTargetAtTime(-6 - compNorm * 34, now, 0.03);
  masterComp.ratio.setTargetAtTime(1.8 + Math.pow(compNorm, 1.2) * 14.2, now, 0.03);
  masterComp.knee.setTargetAtTime(14 - compNorm * 11, now, 0.03);
  masterComp.release.setTargetAtTime(0.18 - compNorm * 0.1, now, 0.03);
  masterGain.gain.setTargetAtTime((0.88 + compNorm * 0.56) * masterLvl * masterLvl * 1.15, now, 0.03);
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
