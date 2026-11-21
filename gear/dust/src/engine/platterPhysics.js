// Turntable motor & platter physics for DUST.
// 1 full revolution = 1 bar (4 beats), which at 120-133 BPM equals 30-33.3 RPM.
// Handles smooth direct-drive torque spin-up/down, rim pitch-bending, braking,
// and counter-clockwise back-spin scrub detection.

import { state, normalizeAngle, bumpScrubSeed } from '../state/store.js';

const TAU = Math.PI * 2;

let backspinAccum = 0;
let scrubCooldownUntil = 0;
let rimTargetRatio = 1.0;

export function getNominalOmega(bpm = state.bpm) {
  const barSec = (60 / bpm) * 4;
  return TAU / barSec;
}

export function applyRimDrag(deltaRad, dtSec) {
  const dt = Math.max(0.008, Math.min(0.05, dtSec));
  const nom = getNominalOmega();
  const instRatio = deltaRad / (nom * dt);

  const clamped = Math.max(-2.6, Math.min(2.2, instRatio));
  rimTargetRatio = rimTargetRatio * 0.42 + clamped * 0.58;
  state.omegaRatio = rimTargetRatio;

  if (deltaRad < -0.004) {
    backspinAccum += -deltaRad;
    const now = performance.now();
    if (backspinAccum > 0.85 && now > scrubCooldownUntil) {
      backspinAccum = 0;
      scrubCooldownUntil = now + 750;
      bumpScrubSeed();
      return { scrubbed: true };
    }
  } else if (deltaRad > 0.02) {
    backspinAccum = Math.max(0, backspinAccum - deltaRad * 0.6);
  }

  return { scrubbed: false };
}

export function beginRimHold() {
  state.isRimHeld = true;
  rimTargetRatio = state.omegaRatio * 0.45;
  backspinAccum = 0;
}

export function endRimHold() {
  state.isRimHeld = false;
  backspinAccum = 0;
}

export function stepPlatterPhysics(dtSec) {
  const dt = Math.max(0.001, Math.min(0.05, dtSec));
  const nom = getNominalOmega();

  if (state.isRimHeld) {
    rimTargetRatio *= Math.exp(-dt * 11);
    state.omegaRatio += (rimTargetRatio - state.omegaRatio) * Math.min(1, dt * 16);
  } else if (state.isSpinning && state.needleDropped) {
    const torque = state.omegaRatio < 0 ? 7.5 : 5.2;
    state.omegaRatio += (1.0 - state.omegaRatio) * Math.min(1, dt * torque);
    if (Math.abs(1.0 - state.omegaRatio) < 0.001) state.omegaRatio = 1.0;
  } else {
    state.omegaRatio *= Math.exp(-dt * 6.5);
    if (Math.abs(state.omegaRatio) < 0.002) state.omegaRatio = 0;
  }

  state.platterAngle = normalizeAngle(state.platterAngle + nom * state.omegaRatio * dt);

  if (state.autoDrift && state.isSpinning && state.needleDropped && !state.isTonearmHeld && state.omegaRatio > 0.2) {
    const nextPos = state.groovePos - dt * 0.0042 * state.omegaRatio;
    state.groovePos = Math.max(0.05, nextPos);
  }

  state.kickPulse *= Math.exp(-dt * 10);
  if (state.kickPulse < 0.004) state.kickPulse = 0;

  state.stylusGlow *= Math.exp(-dt * 9);
  if (state.stylusGlow < 0.004) state.stylusGlow = 0;

  state.scrubFlash *= Math.exp(-dt * 4.5);
  if (state.scrubFlash < 0.004) state.scrubFlash = 0;

  state.brushSweep *= Math.exp(-dt * 3.8);
  if (state.brushSweep < 0.004) state.brushSweep = 0;
}
