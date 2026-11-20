// Reactive state store for 3AM (Berlin 3 AM 4-Track Tape Loom).

import { LANES, MOODS } from './scales.js';
import { REEL_PRESETS } from './presets.js';
import { computeGhostMap, generateLaneSkeleton } from '../engine/anchorEcho.js';

const STORAGE_KEY = '3am_state_v1';

function clonePreset(preset) {
  return JSON.parse(JSON.stringify(preset));
}

function createInitialState() {
  const p = clonePreset(REEL_PRESETS[0]);
  return {
    reelIndex: 0,
    reelName: p.name,
    bpm: p.bpm,
    moodId: p.moodId,
    micro: p.micro,
    depth: p.depth,
    drift: p.drift,
    lanes: p.lanes,

    // Live runtime flags (not persisted)
    isPlaying: false,
    isTapRec: false,
    isWavRecording: false,
    activeLane: 'chd',
    globalTick: 0,
    driftCycle: 0,

    // Per-lane live playhead & visual pulse telemetry
    laneStep: { sub: -1, cut: -1, chd: -1, air: -1 },
    laneFlash: { sub: 0, cut: 0, chd: 0, air: 0 },
    laneFlashType: { sub: 'anchor', cut: 'anchor', chd: 'anchor', air: 'anchor' },
    laneDubThrow: { sub: false, cut: false, chd: false, air: false },
    laneLastGhostHit: { sub: -1, cut: -1, chd: -1, air: -1 },
    kickPulse: 0,

    // Cached deterministic ghost maps
    ghostMaps: { sub: [], cut: [], chd: [], air: [] },

    // Header LCD feedback message
    statusText: '',
    statusUntil: 0
  };
}

export const state = createInitialState();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(topic = 'all') {
  for (const fn of listeners) {
    try {
      fn(topic);
    } catch (err) {
      console.error('Subscriber error:', err);
    }
  }
}

export function showStatus(text, durationMs = 1500) {
  state.statusText = String(text).toUpperCase();
  state.statusUntil = performance.now() + durationMs;
}

export function refreshGhostMaps() {
  for (const laneDef of LANES) {
    const id = laneDef.id;
    state.ghostMaps[id] = computeGhostMap(id, state.lanes[id], state.micro, state.driftCycle);
  }
}

export function saveToLocalStorage() {
  try {
    const payload = {
      reelIndex: state.reelIndex,
      reelName: state.reelName,
      bpm: state.bpm,
      moodId: state.moodId,
      micro: state.micro,
      depth: state.depth,
      drift: state.drift,
      lanes: state.lanes
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.lanes || !data.lanes.sub) return false;

    state.reelIndex = typeof data.reelIndex === 'number' ? data.reelIndex : 0;
    state.reelName = data.reelName || 'CUSTOM';
    state.bpm = clamp(data.bpm ?? 122, 112, 132);
    state.moodId = MOODS.some(m => m.id === data.moodId) ? data.moodId : 'fdor';
    state.micro = clamp(data.micro ?? 0.42, 0, 1);
    state.depth = clamp(data.depth ?? 0.46, 0, 1);
    state.drift = clamp(data.drift ?? 0.34, 0, 1);

    for (const laneDef of LANES) {
      const src = data.lanes[laneDef.id];
      if (!src) continue;
      state.lanes[laneDef.id] = {
        length: clamp(Math.round(src.length ?? 16), 3, 16),
        pressure: clamp(src.pressure ?? 0.8, 0, 1),
        muted: Boolean(src.muted),
        seed: Number(src.seed) || 1000,
        anchors: Array.from({ length: 16 }, (_, idx) => {
          const a = src.anchors?.[idx];
          if (!a) return null;
          return { val: clamp(Math.round(a.val ?? 0), 0, 7), accent: a.accent !== false };
        })
      };
    }
    refreshGhostMaps();
    return true;
  } catch {
    return false;
  }
}

export function loadReelPreset(index) {
  const preset = REEL_PRESETS[index % REEL_PRESETS.length];
  if (!preset) return;
  const copy = clonePreset(preset);
  state.reelIndex = index % REEL_PRESETS.length;
  state.reelName = copy.name;
  state.bpm = copy.bpm;
  state.moodId = copy.moodId;
  state.micro = copy.micro;
  state.depth = copy.depth;
  state.drift = copy.drift;
  state.lanes = copy.lanes;
  state.driftCycle = 0;
  refreshGhostMaps();
  saveToLocalStorage();
  showStatus(`REEL: ${copy.name}`);
  notify('preset');
}

export function cycleMood() {
  const idx = MOODS.findIndex(m => m.id === state.moodId);
  const next = MOODS[(idx + 1) % MOODS.length];
  state.moodId = next.id;
  saveToLocalStorage();
  showStatus(`KEY: ${next.label}`);
  notify('mood');
}

export function toggleMute(laneId) {
  const lane = state.lanes[laneId];
  if (!lane) return;
  lane.muted = !lane.muted;
  saveToLocalStorage();
  showStatus(`${laneId.toUpperCase()} ${lane.muted ? 'MUTE' : 'ON'}`);
  notify('lane');
}

export function setLaneLength(laneId, nextLen) {
  const lane = state.lanes[laneId];
  if (!lane) return;
  const clamped = clamp(Math.round(nextLen), 3, 16);
  if (clamped === lane.length) return;
  lane.length = clamped;
  refreshGhostMaps();
  saveToLocalStorage();
  showStatus(`${laneId.toUpperCase()} LEN ${clamped}`);
  notify('lane');
}

export function setLanePressure(laneId, pressure) {
  const lane = state.lanes[laneId];
  if (!lane) return;
  lane.pressure = clamp(pressure, 0, 1);
  saveToLocalStorage();
  showStatus(`${laneId.toUpperCase()} HEAD ${Math.round(lane.pressure * 100)}%`);
  notify('audio');
}

export function setAnchor(laneId, stepIdx, anchorObj) {
  const lane = state.lanes[laneId];
  if (!lane || stepIdx < 0 || stepIdx >= 16) return;
  lane.anchors[stepIdx] = anchorObj;
  refreshGhostMaps();
  saveToLocalStorage();
  notify('lane');
}

export function slipLanePhase(laneId, dir) {
  const lane = state.lanes[laneId];
  if (!lane || !dir) return;
  const len = lane.length;
  const slice = lane.anchors.slice(0, len);
  if (dir > 0) {
    const last = slice.pop();
    slice.unshift(last);
  } else {
    const first = slice.shift();
    slice.push(first);
  }
  for (let i = 0; i < len; i++) {
    lane.anchors[i] = slice[i];
  }
  refreshGhostMaps();
  saveToLocalStorage();
  showStatus(`${laneId.toUpperCase()} SLIP ${dir > 0 ? '+1' : '-1'}`);
  notify('lane');
}

export function seedSingleLane(laneId) {
  const lane = state.lanes[laneId];
  if (!lane) return;
  lane.seed = (lane.seed + 137 + Math.floor(Math.random() * 900)) % 99991;
  lane.anchors = generateLaneSkeleton(laneId, lane.length, lane.seed);
  lane.muted = false;
  refreshGhostMaps();
  saveToLocalStorage();
  showStatus(`SEEDED ${laneId.toUpperCase()}`);
  notify('lane');
}

export function clearSingleLane(laneId) {
  const lane = state.lanes[laneId];
  if (!lane) return;
  lane.anchors = Array(16).fill(null);
  refreshGhostMaps();
  saveToLocalStorage();
  showStatus(`CLEARED ${laneId.toUpperCase()}`);
  notify('lane');
}

export function exportReelJson() {
  const data = {
    format: '3am-reel',
    version: 1,
    reelName: state.reelName,
    bpm: state.bpm,
    moodId: state.moodId,
    micro: state.micro,
    depth: state.depth,
    drift: state.drift,
    lanes: state.lanes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `3AM_${state.reelName.toLowerCase()}_${state.bpm}bpm.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus('SAVED REEL .JSON');
}

export function importReelJson(text) {
  try {
    const data = JSON.parse(text);
    if (!data || !data.lanes || !data.lanes.sub) {
      showStatus('INVALID REEL FILE');
      return false;
    }
    state.reelName = String(data.reelName || 'IMPORT').slice(0, 8).toUpperCase();
    state.bpm = clamp(data.bpm ?? 122, 112, 132);
    state.moodId = MOODS.some(m => m.id === data.moodId) ? data.moodId : 'fdor';
    state.micro = clamp(data.micro ?? 0.4, 0, 1);
    state.depth = clamp(data.depth ?? 0.45, 0, 1);
    state.drift = clamp(data.drift ?? 0.3, 0, 1);
    for (const laneDef of LANES) {
      const src = data.lanes[laneDef.id];
      if (!src) continue;
      state.lanes[laneDef.id] = {
        length: clamp(Math.round(src.length ?? 16), 3, 16),
        pressure: clamp(src.pressure ?? 0.8, 0, 1),
        muted: Boolean(src.muted),
        seed: Number(src.seed) || 1000,
        anchors: Array.from({ length: 16 }, (_, idx) => {
          const a = src.anchors?.[idx];
          return a ? { val: clamp(Math.round(a.val ?? 0), 0, 7), accent: a.accent !== false } : null;
        })
      };
    }
    refreshGhostMaps();
    saveToLocalStorage();
    showStatus(`LOADED: ${state.reelName}`);
    notify('preset');
    return true;
  } catch {
    showStatus('LOAD FAILED');
    return false;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Initialize ghost maps on boot
refreshGhostMaps();
