// Full Project + Embedded Sample Pack Export & Import (.sol16.json)
// Allows sharing complete songs, patterns, knob settings, AND custom audio samples cleanly!

import { state, normalizePatterns, saveState, showLcdMessage, notify } from '../state/store.js';
import { CHANNELS } from '../state/scales.js';
import { PATTERN_COUNT } from '../state/presets.js';
import { initAudio, updateFxAudioParams, updateVinylAudio, updateAllTrackDrives, updateAllTrackMix } from './engine.js';

// Downsample AudioBuffer to compact 22050Hz 16-bit mono PCM base64 so project JSON stays nimble
function serializeAudioBuffer(buf) {
  if (!buf) return null;
  const srcRate = buf.sampleRate;
  const targetRate = Math.min(22050, srcRate);
  const ratio = srcRate / targetRate;
  const src = buf.getChannelData(0);
  const outLen = Math.max(1, Math.floor(src.length / ratio));

  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, src[Math.floor(i * ratio)] || 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return {
    sampleRate: targetRate,
    pcm16Base64: btoa(binary)
  };
}

function deserializeAudioBuffer(ctx, encoded) {
  if (!encoded || !encoded.pcm16Base64) return null;
  const binary = atob(encoded.pcm16Base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const rate = Number(encoded.sampleRate) || 22050;

  const buf = ctx.createBuffer(1, Math.max(1, pcm.length), rate);
  const out = buf.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = pcm[i] / 0x8000;
  }
  return buf;
}

export function exportProjectJson() {
  const payload = {
    format: 'sol-16-project',
    version: 3,
    exportedAt: new Date().toISOString(),
    bpm: state.bpm,
    swing: state.swing,
    pump: state.pump,
    comp: state.comp,
    masterVol: state.masterVol,
    vinylLevel: state.vinylLevel,
    moodId: state.moodId,
    vinylOn: state.vinylOn,
    songChain: state.songChain,
    chainEnabled: state.chainEnabled,
    trackParams: state.trackParams,
    patterns: state.patterns,
    samples: {
      vox: state.voxMicBuffer
        ? { name: state.voxSampleName || 'VOX', useCustom: state.voxUseMic, audio: serializeAudioBuffer(state.voxMicBuffer) }
        : null,
      smpl: state.smplBuffer
        ? { name: state.smplSampleName || 'SMPL', useCustom: state.smplUseCustom, audio: serializeAudioBuffer(state.smplBuffer) }
        : null
    }
  };

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SOL16_${state.moodId}_${state.bpm}bpm.sol16.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  showLcdMessage('SAVED .SOL16.JSON!');
}

export async function importProjectJson(file) {
  const ctx = initAudio();
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.patterns)) {
      showLcdMessage('INVALID SOL-16 FILE');
      return false;
    }

    state.patterns = normalizePatterns(parsed.patterns);
    if (parsed.trackParams && typeof parsed.trackParams === 'object') {
      CHANNELS.forEach(c => {
        if (parsed.trackParams[c.id]) {
          state.trackParams[c.id] = {
            tone: Number(parsed.trackParams[c.id].tone ?? c.defaultTone),
            decay: Number(parsed.trackParams[c.id].decay ?? c.defaultDecay),
            space: Number(parsed.trackParams[c.id].space ?? c.defaultSpace),
            drive: Number(parsed.trackParams[c.id].drive ?? c.defaultDrive),
            vol: Number(parsed.trackParams[c.id].vol ?? c.defaultVol),
            pan: Number(parsed.trackParams[c.id].pan ?? c.defaultPan)
          };
        }
      });
    }

    if (typeof parsed.bpm === 'number') state.bpm = Math.max(110, Math.min(136, parsed.bpm));
    if (typeof parsed.swing === 'number') state.swing = Math.max(0, Math.min(65, parsed.swing));
    if (typeof parsed.pump === 'number') state.pump = Math.max(0, Math.min(100, parsed.pump));
    if (typeof parsed.comp === 'number') state.comp = Math.max(0, Math.min(100, parsed.comp));
    if (typeof parsed.masterVol === 'number') state.masterVol = Math.max(0, Math.min(100, parsed.masterVol));
    if (typeof parsed.vinylLevel === 'number') state.vinylLevel = Math.max(0, Math.min(100, parsed.vinylLevel));
    if (typeof parsed.moodId === 'string') state.moodId = parsed.moodId;
    if (typeof parsed.vinylOn === 'boolean') state.vinylOn = parsed.vinylOn;
    if (Array.isArray(parsed.songChain) && parsed.songChain.length > 0) {
      state.songChain = parsed.songChain.map(n => Math.max(0, Math.min(PATTERN_COUNT - 1, Number(n) || 0)));
    }
    if (typeof parsed.chainEnabled === 'boolean') state.chainEnabled = parsed.chainEnabled;

    // Restore embedded custom samples if present
    if (parsed.samples && parsed.samples.vox && parsed.samples.vox.audio) {
      state.voxMicBuffer = deserializeAudioBuffer(ctx, parsed.samples.vox.audio);
      state.voxSampleName = parsed.samples.vox.name || 'VOX';
      state.voxUseMic = Boolean(parsed.samples.vox.useCustom);
    }
    if (parsed.samples && parsed.samples.smpl && parsed.samples.smpl.audio) {
      state.smplBuffer = deserializeAudioBuffer(ctx, parsed.samples.smpl.audio);
      state.smplSampleName = parsed.samples.smpl.name || 'SMPL';
      state.smplUseCustom = Boolean(parsed.samples.smpl.useCustom);
    }

    saveState();
    updateVinylAudio();
    updateFxAudioParams();
    updateAllTrackDrives();
    updateAllTrackMix();
    showLcdMessage('PROJECT LOADED!');
    notify('reset');
    return true;
  } catch {
    showLcdMessage('LOAD FAILED');
    return false;
  }
}
