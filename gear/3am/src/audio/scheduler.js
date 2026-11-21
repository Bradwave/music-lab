// Sample-accurate polyrhythmic 16th-note lookahead scheduler for 3AM.
// Supports independent loop lengths (3..16) per magnetic tape lane,
// Anchor & Echo ghost triggers, micro-timing swing, and live Tap-In recording.

import { state, refreshGhostMaps, setAnchor, showStatus, notify } from '../state/store.js';
import { LANES, getValueLabel } from '../state/scales.js';
import {
  initAudio,
  getAudioNodes,
  updateAudioParams,
  updateDriftFilters,
  triggerSliceGate,
  resetMasterGate
} from './engine.js';
import { triggerLaneVoice, auditionLane } from './synths.js';

let timerId = null;
let nextNoteTime = 0;
let stepDurationSec = 0.125;
let playSessionId = 0;

const LOOKAHEAD_MS = 24;
const SCHEDULE_AHEAD_SEC = 0.11;
const MAX_CATCHUP_SEC = 0.25;

function scheduleTick(tick, time) {
  const { audioCtx } = getAudioNodes();
  stepDurationSec = (60 / state.bpm / 4) * (state.fx.FLUT ? 1.18 : 1.0);

  if (state.fx.SLICE) {
    triggerSliceGate(time, stepDurationSec);
  }

  // Asymmetric house swing on odd 16th-note subdivisions
  const isOffSixteenth = tick % 2 === 1;
  const swingSec = isOffSixteenth ? stepDurationSec * (state.drift * 0.44) : 0;

  // Gentle 16-bar filter breathing (updated quarterly only when DRIFT > 0)
  if (tick % 4 === 0 && state.drift > 0.01) {
    const phaseMod = (tick / 256) * Math.PI * 2;
    updateDriftFilters(phaseMod, time);
  }

  // Every 8 bars (128 ticks), if DRIFT > 0.42, slowly evolve subtle ghost sparks
  if (tick > 0 && tick % 128 === 0 && state.drift > 0.42) {
    state.driftCycle = (state.driftCycle + 1) % 64;
    refreshGhostMaps();
  }

  const uiUpdates = [];

  for (const laneDef of LANES) {
    const id = laneDef.id;
    const lane = state.lanes[id];
    const stepIdx = tick % lane.length;

    const anchor = lane.anchors[stepIdx];
    const ghost = state.ghostMaps[id]?.[stepIdx] || null;

    let firedType = null;
    let firedGhostSlot = -1;

    if (!lane.muted && lane.pressure > 0.02) {
      if (anchor) {
        // Tiny human micro-timing feel (never sloppy on SUB downbeats)
        const jitterSec = id === 'sub' && anchor.val === 0
          ? 0
          : ((Math.random() - 0.5) * 0.008 * state.drift);
        const hitTime = Math.max(audioCtx.currentTime, time + swingSec + jitterSec);
        triggerLaneVoice(id, hitTime, anchor.val, {
          vel: anchor.accent ? 1.0 : 0.72,
          isGhost: false
        });
        firedType = 'anchor';
      } else if (ghost) {
        // Probability gate scales smoothly with DRIFT (at 0 drift, ghosts are 100% locked)
        const passProb = state.drift < 0.08 ? 1.0 : ghost.prob;
        if (Math.random() <= passProb) {
          const microSec = (ghost.microMs / 1000) * (0.35 + state.drift * 0.65);
          const hitTime = Math.max(audioCtx.currentTime, time + swingSec + microSec);
          triggerLaneVoice(id, hitTime, ghost.val, {
            vel: ghost.vel,
            isGhost: true
          });
          firedType = 'ghost';
          firedGhostSlot = stepIdx;
        }
      }
    }

    uiUpdates.push({ id, stepIdx, firedType, firedGhostSlot });
  }

  // Sync visual playhead & flash sparks for all 4 lanes with a single timer per tick
  const session = playSessionId;
  const delayMs = Math.max(0, (time + swingSec - audioCtx.currentTime) * 1000);
  setTimeout(() => {
    if (!state.isPlaying || session !== playSessionId) return;
    for (let i = 0; i < uiUpdates.length; i++) {
      const u = uiUpdates[i];
      state.laneStep[u.id] = u.stepIdx;
      if (u.firedType) {
        state.laneFlash[u.id] = u.firedType === 'anchor' ? 1.0 : 0.72;
        state.laneFlashType[u.id] = u.firedType;
        if (u.firedGhostSlot >= 0) {
          state.laneLastGhostHit[u.id] = u.firedGhostSlot;
        }
      }
    }
  }, delayMs);
}

function schedulerLoop() {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx || !state.isPlaying) return;

  const now = audioCtx.currentTime;
  // Resync cleanly after background-tab throttling or lag instead of firing a burst of notes
  if (nextNoteTime < now - MAX_CATCHUP_SEC) {
    nextNoteTime = now + 0.02;
  }

  let scheduled = 0;
  while (nextNoteTime < now + SCHEDULE_AHEAD_SEC && scheduled < 4) {
    scheduleTick(state.globalTick, nextNoteTime);
    stepDurationSec = (60 / state.bpm / 4) * (state.fx.FLUT ? 1.18 : 1.0);
    nextNoteTime += stepDurationSec;
    state.globalTick++;
    scheduled++;
  }
}

export function startPlayback() {
  const ctx = initAudio();
  if (state.isPlaying) return;

  playSessionId++;
  state.isPlaying = true;
  state.globalTick = 0;
  for (const l of LANES) {
    state.laneStep[l.id] = 0;
  }
  nextNoteTime = ctx.currentTime + 0.04;
  updateAudioParams(0);

  timerId = setInterval(schedulerLoop, LOOKAHEAD_MS);
  showStatus('TAPE ROLLING');
  notify('transport');
}

export function stopPlayback() {
  if (!state.isPlaying) return;
  playSessionId++;
  state.isPlaying = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  for (const l of LANES) {
    state.laneStep[l.id] = -1;
    state.laneDubThrow[l.id] = false;
  }
  state.fx.WASH = false;
  state.fx.SUBM = false;
  state.fx.FLUT = false;
  state.fx.SLICE = false;
  resetMasterGate();
  updateAudioParams(0);
  showStatus('STOPPED');
  notify('transport');
}

export function togglePlayback() {
  if (state.isPlaying) stopPlayback();
  else startPlayback();
}

/**
 * Live Tap-In Anchor: punch your own rhythm straight onto a moving magnetic tape!
 */
export function tapAnchorOnLane(laneId) {
  initAudio();
  const lane = state.lanes[laneId];
  if (!lane) return;

  // Choose sensible musical default value (or reuse last touched value on that lane)
  let val = 0;
  if (laneId === 'chd') {
    const existing = lane.anchors.filter(Boolean);
    const pool = [0, 1, 2, 4, 6];
    val = pool[existing.length % pool.length];
  } else if (laneId === 'cut') {
    const existing = lane.anchors.filter(Boolean);
    const pool = [0, 1, 2, 3, 5];
    val = pool[existing.length % pool.length];
  } else if (laneId === 'sub') {
    const step = Math.max(0, state.laneStep.sub);
    val = step % 4 === 0 ? 0 : 2;
  } else if (laneId === 'air') {
    val = 0;
  }

  auditionLane(laneId, val);
  state.laneFlash[laneId] = 1.0;
  state.laneFlashType[laneId] = 'anchor';

  if (state.isPlaying && state.isTapRec) {
    const step = state.laneStep[laneId] >= 0 ? state.laneStep[laneId] : 0;
    setAnchor(laneId, step, { val, accent: true });
    showStatus(`TAP ${laneId.toUpperCase()} @${step + 1} ${getValueLabel(laneId, val, state.keyId, state.hourId)}`);
  }
}
