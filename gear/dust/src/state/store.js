// Central reactive store for DUST.
// Manages Side A/B pressings, polar dust & smudge marks, needle radius,
// platter physics telemetry, and persistence.

import { createStarterMarks } from './presets.js';
import { getSide, KEYS } from './scales.js';

const STORAGE_KEY = 'dust_vinyl_v1';
const MAX_MARKS = 36;
const TAU = Math.PI * 2;

let idCounter = 1;

export const state = {
  // Transport & Needle
  isSpinning: false,        // True once needle is dropped onto wax
  needleDropped: false,     // Tonearm on wax vs. parked on rest
  groovePos: 0.78,          // 1.0 = outer Detroit wax, 0.0 = inner Jelinek micro-wax
  autoDrift: false,         // Optional slow inward creep like a real record

  // Pressing & Musical Settings
  side: 'A',                // 'A' (Detroit) | 'B' (Jelinek)
  keyId: 'f',               // 'f' | 'eb' | 'g' | 'bb'
  bpm: 120,
  scrubSeed: 1,             // Mutated by platter back-spin / scrub

  // Independent mark collections for Side A and Side B
  sides: {
    A: createStarterMarks('A'),
    B: createStarterMarks('B')
  },

  // Live Turntable Physics (updated at 60fps & consumed by canvas + audio)
  platterAngle: 0,          // Visual angle [0..2π)
  omegaRatio: 0,            // Current angular velocity / nominal ω (0 = stopped, 1 = 33⅓, <0 = backspin)
  isRimHeld: false,         // True while user holds/drags rim or label
  isTonearmHeld: false,     // True while dragging tonearm
  hoverZone: null,          // Visual hover highlight ('brush' | 'tonearm' | etc.)
  kickPulse: 0,             // Decaying visual thump from acoustic kick
  stylusGlow: 0,            // Decaying flash when stylus sweeps a mark
  scrubFlash: 0,            // Decaying amber strobe flash after back-spin scrub
  brushSweep: 0,            // Decaying sweep animation when wiping wax

  // Active gesture preview (while holding to grow a smudge)
  draftMark: null,

  // Recording & Status Readout
  isWavRecording: false,
  statusText: 'DROP NEEDLE · TAP WAX',
  statusUntil: 0,
  needsPressingRebake: true
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(topic = 'all') {
  listeners.forEach((fn) => {
    try {
      fn(topic);
    } catch {
      // Keep UI responsive
    }
  });
}

export function getMarks() {
  return state.sides[state.side];
}

export function showStatus(msg, durationMs = 2200) {
  state.statusText = String(msg).toUpperCase();
  state.statusUntil = performance.now() + durationMs;
  notify('status');
}

export function normalizeAngle(a) {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
}

/**
 * Gently pulls raw tap angle slightly toward a musical 32nd-note pocket
 * (55% pull) so human taps feel tight without sounding robotic.
 */
export function softQuantizeAngle(rawAngle) {
  const a = normalizeAngle(rawAngle);
  const grid = TAU / 32;
  const nearest = Math.round(a / grid) * grid;
  let diff = nearest - a;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return normalizeAngle(a + diff * 0.55);
}

export function addMark({ angle, radius, size = 0.24, smearArc = 0, kind = 'speck' }) {
  const marks = getMarks();
  const mark = {
    id: `m${Date.now().toString(36)}_${idCounter++}`,
    angle: kind === 'speck' ? softQuantizeAngle(angle) : normalizeAngle(angle),
    radius: Math.max(0.06, Math.min(0.96, radius)),
    size: Math.max(0.14, Math.min(1.0, size)),
    smearArc: Math.max(0, Math.min(0.95, smearArc)),
    kind,
    seed: Math.floor(Math.random() * 100000),
    flash: 1.0
  };

  if (marks.length >= MAX_MARKS) {
    marks.shift();
  }
  marks.push(mark);
  saveToLocalStorage();
  notify('marks');
  return mark;
}

export function removeMarkById(id) {
  const marks = getMarks();
  const idx = marks.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  marks.splice(idx, 1);
  saveToLocalStorage();
  notify('marks');
  return true;
}

export function clearCurrentSideMarks() {
  state.sides[state.side] = [];
  state.brushSweep = 1.0;
  saveToLocalStorage();
  showStatus(`BRUSHED SIDE ${state.side} CLEAN`);
  notify('marks');
}

export function restoreCurrentSide() {
  state.sides[state.side] = createStarterMarks(state.side);
  state.groovePos = state.side === 'A' ? 0.78 : 0.30;
  state.brushSweep = 0.7;
  saveToLocalStorage();
  showStatus(`RESTORED SIDE ${state.side}`);
  notify('all');
}

export function setSide(sideId) {
  const next = sideId === 'B' ? 'B' : 'A';
  if (state.side === next) return;
  state.side = next;
  const def = getSide(next);
  state.bpm = def.defaultBpm;
  state.groovePos = next === 'A' ? 0.78 : 0.28;
  state.needsPressingRebake = true;
  saveToLocalStorage();
  showStatus(`FLIPPED · ${def.stamp} ${def.name}`);
  notify('pressing');
}

export function flipSide() {
  setSide(state.side === 'A' ? 'B' : 'A');
}

export function setKey(keyId) {
  if (state.keyId === keyId) return;
  state.keyId = keyId;
  state.needsPressingRebake = true;
  saveToLocalStorage();
  showStatus(`KEY ${keyId.toUpperCase()} · RE-PRESSING`);
  notify('pressing');
}

export function cycleKey() {
  const idx = KEYS.findIndex((k) => k.id === state.keyId);
  const next = KEYS[(idx + 1) % KEYS.length];
  setKey(next.id);
}

export function setBpm(nextBpm) {
  const clamped = Math.max(108, Math.min(134, Math.round(nextBpm)));
  if (clamped === state.bpm) return;
  state.bpm = clamped;
  saveToLocalStorage();
  showStatus(`MOTOR ${clamped} BPM`);
  notify('tempo');
}

export function setGroovePos(pos) {
  const clamped = Math.max(0.02, Math.min(0.98, pos));
  state.groovePos = clamped;
  notify('groove');
}

export function toggleAutoDrift() {
  state.autoDrift = !state.autoDrift;
  saveToLocalStorage();
  showStatus(state.autoDrift ? 'GROOVE: CREEP INWARD' : 'GROOVE: LOCKED LOOP');
  notify('drift');
}

export function bumpScrubSeed() {
  state.scrubSeed = (state.scrubSeed + 1) % 9999;
  state.scrubFlash = 1.0;
  showStatus(`SCRUBBED VARIATION #${state.scrubSeed}`);
  notify('scrub');
}

export function saveToLocalStorage() {
  try {
    const payload = {
      side: state.side,
      keyId: state.keyId,
      bpm: state.bpm,
      groovePos: state.groovePos,
      autoDrift: state.autoDrift,
      scrubSeed: state.scrubSeed,
      sides: {
        A: state.sides.A.map(({ id, angle, radius, size, smearArc, kind, seed }) => ({
          id, angle, radius, size, smearArc, kind, seed
        })),
        B: state.sides.B.map(({ id, angle, radius, size, smearArc, kind, seed }) => ({
          id, angle, radius, size, smearArc, kind, seed
        }))
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore private-mode storage errors
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.side === 'A' || data.side === 'B') state.side = data.side;
    if (typeof data.keyId === 'string') state.keyId = data.keyId;
    if (typeof data.bpm === 'number') state.bpm = Math.max(108, Math.min(134, Math.round(data.bpm)));
    if (typeof data.groovePos === 'number') state.groovePos = Math.max(0.02, Math.min(0.98, data.groovePos));
    if (typeof data.autoDrift === 'boolean') state.autoDrift = data.autoDrift;
    if (typeof data.scrubSeed === 'number') state.scrubSeed = data.scrubSeed;
    if (data.sides?.A && Array.isArray(data.sides.A)) {
      state.sides.A = data.sides.A.slice(0, MAX_MARKS).map((m) => ({ ...m, flash: 0 }));
    }
    if (data.sides?.B && Array.isArray(data.sides.B)) {
      state.sides.B = data.sides.B.slice(0, MAX_MARKS).map((m) => ({ ...m, flash: 0 }));
    }
  } catch {
    // Fallback to clean starter pressings
  }
}
