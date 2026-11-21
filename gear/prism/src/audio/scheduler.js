// Lookahead Web Audio step scheduler for PRISM.
// Synchronizes the 12x12 optical light simulation to a tight 16th-note clock
// (with instant 2x light-speed jump when HYPER is held!).

import { state, notify } from '../state/store.js';
import { advanceOpticalStep, resetSim } from '../engine/opticsSim.js';
import { initAudio, getAudioNodes, updateEngineParams } from './engine.js';
import { triggerStepEvents } from './synths.js';

const LOOKAHEAD_MS = 16;
const SCHEDULE_AHEAD_SEC = 0.032;

let timerId = null;
let nextStepTime = 0;

function getStepDurationSec() {
  const base16th = 60 / state.bpm / 4;
  return state.isHyper ? base16th * 0.5 : base16th;
}

function schedulerTick() {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx || !state.isPlaying) return;

  // Recover gracefully if tab was backgrounded
  if (nextStepTime < audioCtx.currentTime - 0.18) {
    nextStepTime = audioCtx.currentTime + 0.02;
  }

  while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
    const stepDur = getStepDurationSec();
    // Subtle 8% swing on odd 16th notes in normal speed for extra human bounce
    const swingOffset = (!state.isHyper && (state.stepIndex % 2 === 1)) ? stepDur * 0.075 : 0;
    const scheduledTime = nextStepTime + swingOffset;

    const events = advanceOpticalStep(state.stepIndex);
    triggerStepEvents(events, scheduledTime);

    // Sync renderer sub-step interpolation smoothly across [0..1]
    state.lastStepPerfMs = performance.now();
    state.stepDurationMs = stepDur * 1000;

    state.stepIndex = (state.stepIndex + 1) % 4096;
    nextStepTime += stepDur;
  }
}

export function startTransport() {
  const ctx = initAudio();
  updateEngineParams();
  if (state.isPlaying) return;

  state.isPlaying = true;
  state.stepIndex = 0;
  resetSim();

  nextStepTime = ctx.currentTime + 0.025;
  state.stepDurationMs = getStepDurationSec() * 1000;
  state.lastStepPerfMs = performance.now();

  schedulerTick();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(schedulerTick, LOOKAHEAD_MS);

  notify('transport');
}

export function stopTransport() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  state.isHyper = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  updateEngineParams();
  notify('transport');
}

export function toggleTransport() {
  if (state.isPlaying) {
    stopTransport();
  } else {
    startTransport();
  }
}

export function setHyperMode(active) {
  if (state.isHyper === active) return;
  state.isHyper = active;
  if (active && !state.isPlaying) {
    startTransport();
  }
  updateEngineParams();
  notify('hyper');
}
