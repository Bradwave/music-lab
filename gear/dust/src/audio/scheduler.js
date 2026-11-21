// Sample-accurate angular sweep lookahead scheduler for DUST.
// Integrates continuous platter rotation against AudioContext time so:
//   1) Procedural Detroit/Jelinek backing steps lock to the disc revolution with MPC swing.
//   2) Every polar dust speck & finger smudge fires at the exact millisecond it passes
//      beneath the stylus angle (`STYLUS_ANGLE`), with true turntable pitch/speed coupling.

import { state, getMarks, normalizeAngle, showStatus, notify } from '../state/store.js';
import { getSide, computeFocus } from '../state/scales.js';
import { getNominalOmega } from '../engine/platterPhysics.js';
import { evaluateGrooveStep } from '../engine/grooveGen.js';
import {
  initAudio,
  getAudioNodes,
  updateEngineParams,
  playStylusDropThump
} from './engine.js';
import {
  playDustKick,
  playUprightBass,
  playWaxChordSlice,
  playBrushCymbal,
  playModalPerc,
  playMarkEvent
} from './synths.js';

export const STYLUS_ANGLE = 0.34; // Screen radians (~3:40 o'clock where stylus rests)

const TAU = Math.PI * 2;
const LOOKAHEAD_MS = 24;
const SCHEDULE_AHEAD_SEC = 0.11;
const SLICE_SEC = 0.015; // Integration sub-step for smooth speed changes

let timerId = null;
let scheduledUntilTime = 0;
let audioUnwrappedAngle = 0;
let lastStepIndex = -1;

function scheduleBackingStep(stepIndex, time, pitchFactor) {
  const side = getSide(state.side);
  const gp = state.groovePos;

  // Asymmetric MPC swing on odd 16th notes (wider on outer Detroit groove)
  const stepSec = (60 / state.bpm / 4) / Math.max(0.35, pitchFactor);
  const isOdd16 = stepIndex % 2 === 1;
  const swingAmt = side.swingBase * (0.58 + gp * 0.52);
  const swingSec = isOdd16 ? stepSec * swingAmt : 0;
  const t = time + swingSec;

  const ev = evaluateGrooveStep(stepIndex, {
    sideId: state.side,
    scrubSeed: state.scrubSeed,
    groovePos: gp
  });

  if (ev.kick) {
    playDustKick(t, { vel: ev.kick.vel, ghost: ev.kick.ghost, pitchFactor });
  }
  if (ev.bass) {
    playUprightBass(t, {
      deg: ev.bass.deg,
      vel: ev.bass.vel,
      durScale: ev.bass.durScale,
      pitchFactor
    });
  }
  if (ev.chord) {
    playWaxChordSlice(t, {
      chordIdx: ev.chord.chordIdx,
      vel: ev.chord.vel,
      sliceOffset: ev.chord.sliceOffset,
      dur: ev.chord.dur,
      micro: ev.chord.micro,
      pitchFactor
    });
  }
  if (ev.brush) {
    // Subtle early micro-push on brushed off-beat hats for living groove feel
    const hatNudge = ev.brush.kind === 'hat' ? -0.004 : 0.002;
    playBrushCymbal(Math.max(time, t + hatNudge), {
      kind: ev.brush.kind,
      vel: ev.brush.vel,
      pitchFactor
    });
  }
  if (ev.microTick) {
    playModalPerc(t + 0.004, {
      percIdx: ev.microTick.percIdx,
      vel: ev.microTick.vel,
      pan: ev.microTick.pan,
      pitchFactor,
      cutoff: 3400 + gp * 4800,
      wet: 0.22 + (1 - gp) * 0.25
    });
  }
}

/**
 * Checks whether a target wrapped platter angle `target` falls strictly in `(a0, a1]`
 * along forward clockwise rotation, returning the fractional interpolation `u ∈ (0, 1]` or -1.
 */
function crossingFraction(a0, a1, targetWrapped) {
  const delta = a1 - a0;
  if (delta <= 1e-6) return -1;
  const w0 = normalizeAngle(a0);
  let dist = targetWrapped - w0;
  if (dist <= 0) dist += TAU;
  if (dist > 0 && dist <= delta) {
    return dist / delta;
  }
  return -1;
}

function advanceSlice(t0, dt, ctxNow) {
  const omegaRatio = state.omegaRatio;
  // When braked or spinning backward, do not fire forward step/mark triggers
  if (omegaRatio <= 0.08 || !state.needleDropped) {
    return;
  }

  const nomOmega = getNominalOmega(state.bpm);
  const dAngle = nomOmega * omegaRatio * dt;
  const a0 = audioUnwrappedAngle;
  const a1 = a0 + dAngle;
  audioUnwrappedAngle = a1;

  const pitchFactor = Math.max(0.42, Math.min(2.05, omegaRatio));

  // 1) Check 16th-note backing step boundaries
  const stepWidth = TAU / 16;
  const s0 = Math.floor(a0 / stepWidth);
  const s1 = Math.floor(a1 / stepWidth);
  for (let s = s0 + 1; s <= s1; s++) {
    if (s <= lastStepIndex) continue;
    lastStepIndex = s;
    const boundaryAngle = s * stepWidth;
    const frac = Math.max(0, Math.min(1, (boundaryAngle - a0) / dAngle));
    const evTime = t0 + frac * dt;
    scheduleBackingStep(s, evTime, pitchFactor);
  }

  // 2) Check polar dust specks & finger smudges sweeping beneath STYLUS_ANGLE
  const marks = getMarks();
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    // Mark hits stylus when platterAngle ≡ STYLUS_ANGLE - mark.angle (mod 2π)
    const triggerPlatterAngle = normalizeAngle(STYLUS_ANGLE - mark.angle);
    const frac = crossingFraction(a0, a1, triggerPlatterAngle);
    if (frac >= 0) {
      const evTime = t0 + frac * dt;
      const fired = playMarkEvent(evTime, mark, pitchFactor);
      if (fired) {
        const focus = computeFocus(mark.radius, state.groovePos);
        const delayMs = Math.max(0, (evTime - ctxNow) * 1000);
        setTimeout(() => {
          mark.flash = Math.max(mark.flash, 0.35 + focus * 0.65);
          state.stylusGlow = Math.max(state.stylusGlow, 0.3 + focus * 0.7);
        }, delayMs);
      }
    }
  }
}

function schedulerTick() {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx) return;

  updateEngineParams();

  const now = audioCtx.currentTime;
  // Catch up cleanly if browser tab was backgrounded
  if (scheduledUntilTime < now - 0.12) {
    scheduledUntilTime = now;
    audioUnwrappedAngle = Math.floor(audioUnwrappedAngle / TAU) * TAU + state.platterAngle;
    lastStepIndex = Math.floor(audioUnwrappedAngle / (TAU / 16));
  }

  // Gently sync visual platter angle to audio angle when free-spinning so visuals never drift
  if (!state.isRimHeld && state.needleDropped && state.omegaRatio > 0.25) {
    const wrappedAudio = normalizeAngle(audioUnwrappedAngle - (scheduledUntilTime - now) * getNominalOmega() * state.omegaRatio);
    let err = wrappedAudio - state.platterAngle;
    if (err > Math.PI) err -= TAU;
    if (err < -Math.PI) err += TAU;
    if (Math.abs(err) < 0.8) {
      state.platterAngle = normalizeAngle(state.platterAngle + err * 0.22);
    }
  } else if (state.isRimHeld) {
    // While user is physically scratching/holding the rim, keep audio angle anchored to hand
    const baseRevs = Math.floor(audioUnwrappedAngle / TAU) * TAU;
    audioUnwrappedAngle = baseRevs + state.platterAngle;
    lastStepIndex = Math.floor(audioUnwrappedAngle / (TAU / 16));
  }

  const horizon = now + SCHEDULE_AHEAD_SEC;
  while (scheduledUntilTime < horizon) {
    const dt = Math.min(SLICE_SEC, horizon - scheduledUntilTime);
    advanceSlice(scheduledUntilTime, dt, now);
    scheduledUntilTime += dt;
  }
}

export function dropNeedle(targetGroovePos = null) {
  const ctx = initAudio();
  if (typeof targetGroovePos === 'number') {
    state.groovePos = Math.max(0.02, Math.min(0.98, targetGroovePos));
  }

  const wasDropped = state.needleDropped;
  state.needleDropped = true;
  state.isSpinning = true;

  if (!wasDropped) {
    playStylusDropThump();
    state.omegaRatio = Math.max(state.omegaRatio, 0.28);
    audioUnwrappedAngle = state.platterAngle;
    lastStepIndex = Math.floor(audioUnwrappedAngle / (TAU / 16)) - 1;
    scheduledUntilTime = ctx.currentTime + 0.025;

    if (!timerId) {
      timerId = setInterval(schedulerTick, LOOKAHEAD_MS);
    }
    showStatus(`NEEDLE ON WAX · SIDE ${state.side}`);
    notify('transport');
  }
}

export function liftNeedle() {
  if (!state.needleDropped && !state.isSpinning) return;
  state.needleDropped = false;
  state.isSpinning = false;
  updateEngineParams();
  showStatus('NEEDLE PARKED');
  notify('transport');
}

export function toggleNeedle() {
  if (state.needleDropped) {
    liftNeedle();
  } else {
    dropNeedle();
  }
}

export function stopSchedulerCompletely() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  state.needleDropped = false;
  state.isSpinning = false;
  updateEngineParams();
}
