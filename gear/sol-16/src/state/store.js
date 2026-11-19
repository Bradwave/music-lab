import { CHANNELS } from './scales.js';
import {
  PATTERN_COUNT,
  createDemoPatterns,
  createDefaultTrackParams,
  createEmptyPattern
} from './presets.js';

const STORAGE_KEY = 'sol16_minimal_pwa_v3';

export const state = {
  patterns: createDemoPatterns(),
  trackParams: createDefaultTrackParams(),
  activePattern: 0,
  queuedPattern: null,

  // Song Chain (e.g. [0, 0, 1, 3] => A -> A -> B -> D)
  songChain: [0, 0, 1, 3],
  chainEnabled: false,
  chainPos: 0,

  activeChannel: 'ch',
  selectedBrush: {
    bd: 0,
    pr: 2,
    bs: 0,
    ch: 0,
    vx: 4,
    sm: 0
  },
  mutes: { bd: false, pr: false, bs: false, ch: false, vx: false, sm: false },
  knobBank: 'SOUND', // 'SOUND' (Tone, Decay, Space, Drive) | 'GROOVE' (BPM, Swing, Pump, Comp)
  moodId: 'sunset',
  bpm: 123,
  swing: 34,
  pump: 62, // 0..100 kick sidechain pump
  comp: 42, // 0..100 master bus compression + analog glue drive
  vinylOn: true,
  isPlaying: false,
  isRec: false,
  currentStep: -1,
  fx: { RPT: false, DUB: false, LPF: false, TAPE: false },
  rptAnchorStep: 0,

  // Visual / LCD feedback
  lcdMessage: 'PRESS PLAY TO GROOVE',
  lcdMessageUntil: 0,
  lcdKnobOverlay: null,
  kickPulse: 0,
  animFrame: 0,

  // Custom Samples (VOX melodic sampler & SMPL 8-slice chop sampler)
  voxUseMic: false,
  voxMicBuffer: null,
  voxSampleName: '',

  smplUseCustom: false,
  smplBuffer: null,
  smplSampleName: '',

  isMicRecording: false,
  micTargetChannel: 'vx',
  isWavRecording: false,

  // UI overlays
  drawerOpen: false,
  guideOpen: false,
  copyMode: false
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(reason = 'update') {
  listeners.forEach(fn => fn(reason));
}

export function showLcdMessage(msg, durationMs = 1700) {
  state.lcdMessage = String(msg).toUpperCase();
  state.lcdMessageUntil = performance.now() + durationMs;
}

export function showLcdKnob(label, valueText, norm, durationMs = 1100) {
  state.lcdKnobOverlay = {
    label: String(label).toUpperCase(),
    valueText: String(valueText).toUpperCase(),
    norm: Math.max(0, Math.min(1, norm)),
    until: performance.now() + durationMs
  };
}

export function normalizePatterns(rawPatterns) {
  const demo = createDemoPatterns();
  const out = [];
  for (let i = 0; i < PATTERN_COUNT; i++) {
    const src = Array.isArray(rawPatterns) && rawPatterns[i] ? rawPatterns[i] : null;
    const pat = createEmptyPattern();
    CHANNELS.forEach(c => {
      if (src && Array.isArray(src[c.id]) && src[c.id].length === 16) {
        pat[c.id] = src[c.id].map(s => ({
          on: Boolean(s && s.on),
          note: Number(s && s.note) || 0,
          accent: s && s.accent === 0 ? 0 : 1
        }));
      } else if (demo[i] && demo[i][c.id]) {
        pat[c.id] = demo[i][c.id];
      }
    });
    out.push(pat);
  }
  return out;
}

export function saveState() {
  try {
    const payload = {
      patterns: state.patterns,
      trackParams: state.trackParams,
      songChain: state.songChain,
      chainEnabled: state.chainEnabled,
      bpm: state.bpm,
      swing: state.swing,
      pump: state.pump,
      comp: state.comp,
      moodId: state.moodId,
      vinylOn: state.vinylOn
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('sol16_minimal_pwa_v2');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.patterns)) {
      state.patterns = normalizePatterns(parsed.patterns);
    }
    if (parsed.trackParams && typeof parsed.trackParams === 'object') {
      CHANNELS.forEach(c => {
        if (parsed.trackParams[c.id]) {
          state.trackParams[c.id] = {
            tone: Number(parsed.trackParams[c.id].tone ?? c.defaultTone),
            decay: Number(parsed.trackParams[c.id].decay ?? c.defaultDecay),
            space: Number(parsed.trackParams[c.id].space ?? c.defaultSpace),
            drive: Number(parsed.trackParams[c.id].drive ?? c.defaultDrive)
          };
        }
      });
    }
    if (Array.isArray(parsed.songChain) && parsed.songChain.length > 0) {
      state.songChain = parsed.songChain.map(n => Math.max(0, Math.min(PATTERN_COUNT - 1, Number(n) || 0)));
    }
    if (typeof parsed.chainEnabled === 'boolean') state.chainEnabled = parsed.chainEnabled;
    if (typeof parsed.bpm === 'number') state.bpm = Math.max(110, Math.min(136, parsed.bpm));
    if (typeof parsed.swing === 'number') state.swing = Math.max(0, Math.min(65, parsed.swing));
    if (typeof parsed.pump === 'number') state.pump = Math.max(0, Math.min(100, parsed.pump));
    if (typeof parsed.comp === 'number') state.comp = Math.max(0, Math.min(100, parsed.comp));
    if (typeof parsed.moodId === 'string') state.moodId = parsed.moodId;
    if (typeof parsed.vinylOn === 'boolean') state.vinylOn = parsed.vinylOn;
  } catch {
    // Fallback cleanly to demo defaults
  }
}

export function resetAllToDemo() {
  state.patterns = createDemoPatterns();
  state.trackParams = createDefaultTrackParams();
  state.songChain = [0, 0, 1, 3];
  state.chainEnabled = false;
  state.chainPos = 0;
  state.bpm = 123;
  state.swing = 34;
  state.pump = 62;
  state.comp = 42;
  state.moodId = 'sunset';
  state.vinylOn = true;
  state.activePattern = 0;
  state.queuedPattern = null;
  state.mutes = { bd: false, pr: false, bs: false, ch: false, vx: false, sm: false };
  saveState();
  notify('reset');
}

export function clearActiveChannel() {
  const empty = createEmptyPattern();
  state.patterns[state.activePattern][state.activeChannel] = empty[state.activeChannel];
  saveState();
  notify('grid');
}

export function clearActivePattern() {
  state.patterns[state.activePattern] = createEmptyPattern();
  saveState();
  notify('pattern');
}

export function clearAllPatterns() {
  state.patterns = Array.from({ length: PATTERN_COUNT }, () => createEmptyPattern());
  state.songChain = [];
  state.chainEnabled = false;
  state.chainPos = 0;
  saveState();
  notify('reset');
}
