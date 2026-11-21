// Reactive state store for PRISM with localStorage persistence.

import { PRESETS, cloneOptics, getPreset } from './presets.js';
import { SCALES, getScale } from './scales.js';

const STORAGE_KEY = 'prism_optical_bench_v1';

export const FLUX_MODES = ['glass', 'acid', 'glitch', 'void'];
export const WALL_MODES = ['bounce', 'wrap', 'absorb'];
export const EMITTER_RATES = [4, 8, 16, 32];

const initialPreset = PRESETS[0];

export const state = {
  isPlaying: false,
  isHyper: false,
  isWavRecording: false,

  presetIndex: 0,
  customPatch: false,

  selectedTool: 'mirror', // mirror | split | bass | warp
  flux: initialPreset.flux,
  scaleId: initialPreset.scaleId,
  bpm: initialPreset.bpm,
  wallMode: initialPreset.wallMode,
  emitterRate: initialPreset.emitterRate,

  emitter: { ...initialPreset.emitter },
  optics: cloneOptics(initialPreset.optics),

  // Live step clock info for renderer interpolation
  stepIndex: 0,
  lastStepPerfMs: 0,
  stepDurationMs: (60 / initialPreset.bpm / 4) * 1000,

  // Transient status readout
  statusText: '',
  statusUntil: 0,

  // Dragging interaction visual state
  drag: null // { isEmitter, index, item, x, y, offGrid }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(reason = 'all') {
  for (const fn of listeners) {
    try {
      fn(reason);
    } catch (err) {
      console.error('[PRISM store listener]', err);
    }
  }
}

let statusTimer = null;
export function showStatus(msg, durationMs = 2000) {
  state.statusText = msg;
  state.statusUntil = performance.now() + durationMs;
  notify('status');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (performance.now() >= state.statusUntil - 30) {
      state.statusText = '';
      notify('status');
    }
  }, durationMs + 40);
}

export function getIdleReadout() {
  if (state.isWavRecording) return 'REC MASTER .WAV...';
  if (state.isHyper) return `HYPER 2× · ${state.flux.toUpperCase()}`;
  const scale = getScale(state.scaleId);
  if (!state.isPlaying) return `READY · ${scale.short} · ${state.bpm}`;
  return `${state.flux.toUpperCase()} · ${scale.short} · ${state.bpm}`;
}

export function saveState() {
  try {
    const payload = {
      presetIndex: state.presetIndex,
      customPatch: state.customPatch,
      flux: state.flux,
      scaleId: state.scaleId,
      bpm: state.bpm,
      wallMode: state.wallMode,
      emitterRate: state.emitterRate,
      emitter: state.emitter,
      optics: state.optics
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.emitter || !Array.isArray(data.optics)) return false;

    state.presetIndex = Number.isInteger(data.presetIndex) ? data.presetIndex % PRESETS.length : 0;
    state.customPatch = Boolean(data.customPatch);
    state.flux = FLUX_MODES.includes(data.flux) ? data.flux : 'glass';
    state.scaleId = SCALES.some((s) => s.id === data.scaleId) ? data.scaleId : SCALES[0].id;
    state.bpm = Math.max(72, Math.min(168, Number(data.bpm) || 118));
    state.wallMode = WALL_MODES.includes(data.wallMode) ? data.wallMode : 'bounce';
    state.emitterRate = EMITTER_RATES.includes(data.emitterRate) ? data.emitterRate : 8;
    state.emitter = {
      x: Math.max(0, Math.min(11, Number(data.emitter.x) || 0)),
      y: Math.max(0, Math.min(11, Number(data.emitter.y) || 0)),
      dir: ((Number(data.emitter.dir) || 0) % 4 + 4) % 4
    };
    state.optics = data.optics
      .filter((o) => o && ['mirror', 'split', 'bass', 'warp'].includes(o.type))
      .slice(0, 32)
      .map((o) => ({
        x: Math.max(0, Math.min(11, Number(o.x) || 0)),
        y: Math.max(0, Math.min(11, Number(o.y) || 0)),
        type: o.type,
        variant: o.variant ? 1 : 0
      }));
    return true;
  } catch {
    return false;
  }
}

export function loadPreset(index) {
  const preset = getPreset(index);
  state.presetIndex = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
  state.customPatch = false;
  state.flux = preset.flux;
  state.scaleId = preset.scaleId;
  state.bpm = preset.bpm;
  state.wallMode = preset.wallMode;
  state.emitterRate = preset.emitterRate;
  state.emitter = { ...preset.emitter };
  state.optics = cloneOptics(preset.optics);
  saveState();
  showStatus(`PATCH ${preset.name}`);
  notify('preset');
}

export function findOpticAt(x, y) {
  return state.optics.findIndex((o) => o.x === x && o.y === y);
}

export function isEmitterAt(x, y) {
  return state.emitter.x === x && state.emitter.y === y;
}
