import { state, notify } from '../state/store.js';
import { CHANNELS } from '../state/scales.js';
import { initAudio, getAudioNodes, updateFxAudioParams } from './engine.js';
import { triggerChannelSound } from './synths.js';

let schedulerTimer = null;
let nextStepTime = 0;
let scheduleStepIndex = 0;
let lastScheduledStepTime = 0;
let lastScheduledStepIdx = 0;
let onPlayheadCallback = null;
let isFirstBar = true;
let playSessionId = 0;

const LOOKAHEAD_MS = 24;
const SCHEDULE_AHEAD_SEC = 0.11;
const MAX_CATCHUP_SEC = 0.25;

export function setPlayheadListener(fn) {
  onPlayheadCallback = fn;
}

export function getStepDurationSec() {
  const effBpm = state.fx.TAPE ? state.bpm * 0.78 : state.bpm;
  return 60.0 / effBpm / 4.0;
}

function scheduleStep(stepIndex, time) {
  const { audioCtx } = getAudioNodes();

  // Bar 1 pattern switching: manual queue takes priority, otherwise advance Song Chain!
  if (stepIndex === 0) {
    let changed = false;
    if (state.queuedPattern !== null) {
      state.activePattern = state.queuedPattern;
      state.queuedPattern = null;
      changed = true;
    } else if (state.chainEnabled && state.songChain.length > 0) {
      if (isFirstBar) {
        state.chainPos = 0;
      } else {
        state.chainPos = (state.chainPos + 1) % state.songChain.length;
      }
      const nextPat = state.songChain[state.chainPos];
      if (nextPat !== state.activePattern) {
        state.activePattern = nextPat;
      }
      changed = true;
    }
    isFirstBar = false;

    if (changed) {
      setTimeout(() => {
        notify('pattern');
      }, Math.max(0, (time - audioCtx.currentTime) * 1000));
    }
  }

  const effectiveStep = state.fx.RPT
    ? (state.rptAnchorStep + (stepIndex % 2)) % 16
    : stepIndex;

  const pat = state.patterns[state.activePattern];
  CHANNELS.forEach(ch => {
    if (state.mutes[ch.id]) return;
    const st = pat[ch.id] && pat[ch.id][effectiveStep];
    if (st && st.on) {
      triggerChannelSound(ch.id, time, st);
    }
  });

  const session = playSessionId;
  const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
  setTimeout(() => {
    if (!state.isPlaying || session !== playSessionId) return;
    state.currentStep = effectiveStep;
    state.animFrame++;
    if (onPlayheadCallback) onPlayheadCallback(effectiveStep);
  }, delayMs);
}

function advanceStep() {
  const baseDur = getStepDurationSec();
  const swingAmt = (state.swing / 100) * 0.56;
  const isEven = scheduleStepIndex % 2 === 0;
  const dur = isEven ? baseDur * (1 + swingAmt) : baseDur * (1 - swingAmt);

  lastScheduledStepTime = nextStepTime;
  lastScheduledStepIdx = scheduleStepIndex;

  nextStepTime += dur;
  scheduleStepIndex = (scheduleStepIndex + 1) % 16;
}

function schedulerTick() {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx || !state.isPlaying) return;

  const now = audioCtx.currentTime;
  // Resync cleanly after background-tab throttling or lag instead of firing a burst of notes
  if (nextStepTime < now - MAX_CATCHUP_SEC) {
    nextStepTime = now + 0.02;
  }

  let scheduled = 0;
  while (nextStepTime < now + SCHEDULE_AHEAD_SEC && scheduled < 4) {
    scheduleStep(scheduleStepIndex, nextStepTime);
    advanceStep();
    scheduled++;
  }
}

export function startPlayback() {
  const ctx = initAudio();
  updateFxAudioParams();
  if (state.isPlaying) return;

  playSessionId++;
  state.isPlaying = true;
  isFirstBar = true;
  if (state.chainEnabled && state.songChain.length > 0) {
    state.chainPos = 0;
    state.activePattern = state.songChain[0];
  }
  scheduleStepIndex = 0;
  state.currentStep = 0;
  nextStepTime = ctx.currentTime + 0.04;
  schedulerTimer = setInterval(schedulerTick, LOOKAHEAD_MS);
  notify('transport');
  notify('pattern');
}

export function stopPlayback() {
  playSessionId++;
  state.isPlaying = false;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  state.currentStep = -1;
  if (onPlayheadCallback) onPlayheadCallback(-1);
  notify('transport');
}

export function togglePlayback() {
  if (state.isPlaying) stopPlayback();
  else startPlayback();
}

export function getQuantizedStepIndex() {
  const { audioCtx } = getAudioNodes();
  if (!state.isPlaying || !audioCtx) return 0;
  const stepDur = getStepDurationSec();
  const elapsed = audioCtx.currentTime - lastScheduledStepTime;
  if (elapsed > stepDur * 0.55) {
    return (lastScheduledStepIdx + 1) % 16;
  }
  return lastScheduledStepIdx;
}
