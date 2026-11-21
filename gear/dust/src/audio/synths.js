// Sampled-Wax & Physical Resonator Voices for DUST.
// Plays from pre-rendered 12-bit Detroit jazz-wax & Karplus-Strong upright bass
// AudioBuffers with true turntable playbackRate pitch/timbre coupling and Focus Band shaping.

import { state } from '../state/store.js';
import { computeFocus } from '../state/scales.js';
import {
  initAudio,
  getAudioNodes,
  acquireVoiceSlot,
  releaseVoiceSlot,
  triggerSidechain
} from './engine.js';

function attachCleanup(source, nodes) {
  source.onended = () => {
    source.onended = null;
    releaseVoiceSlot();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n) continue;
      try {
        n.disconnect();
      } catch {
        // Ignore already-disconnected nodes
      }
    }
  };
}

function clampRate(r) {
  return Math.max(0.38, Math.min(2.15, r));
}

export function playDustKick(time, opts = {}) {
  const { audioCtx, pressing, kickBus, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing || !acquireVoiceSlot()) return;

  const vel = opts.vel ?? 0.92;
  const ghost = Boolean(opts.ghost);
  const pf = clampRate(opts.pitchFactor ?? 1.0);
  const gp = state.groovePos;

  const src = audioCtx.createBufferSource();
  src.buffer = pressing.kick;
  src.playbackRate.setValueAtTime(clampRate((ghost ? 1.07 : 1.0) * (1.06 - gp * 0.08) * pf), time);

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(ghost ? 1200 : (1750 + gp * 1350), time);

  const g = audioCtx.createGain();
  const dur = ghost ? 0.14 : (0.18 + gp * 0.14);
  g.gain.setValueAtTime(vel * (ghost ? 0.56 : 0.95), time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(lp);
  lp.connect(g);
  g.connect(kickBus);

  let rmTap = null;
  if (!ghost && gp > 0.45) {
    rmTap = audioCtx.createGain();
    rmTap.gain.value = (gp - 0.45) * 0.22;
    g.connect(rmTap);
    rmTap.connect(roomSend);
  }

  attachCleanup(src, [src, lp, g, rmTap]);
  src.start(time);
  src.stop(time + dur + 0.02);

  if (!ghost) {
    triggerSidechain(time, vel);
    const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
    setTimeout(() => {
      state.kickPulse = Math.max(state.kickPulse, vel);
    }, delayMs);
  }
}

export function playUprightBass(time, opts = {}) {
  const { audioCtx, pressing, duckBus, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing || !acquireVoiceSlot()) return;

  const deg = ((opts.deg ?? 0) % pressing.basses.length + pressing.basses.length) % pressing.basses.length;
  const vel = opts.vel ?? 0.78;
  const durScale = opts.durScale ?? 0.85;
  const pf = clampRate(opts.pitchFactor ?? 1.0);
  const gp = state.groovePos;

  const src = audioCtx.createBufferSource();
  src.buffer = pressing.basses[deg];
  src.playbackRate.setValueAtTime(clampRate(pf * 0.988), time);
  src.playbackRate.exponentialRampToValueAtTime(pf, time + 0.022);

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(480 + gp * 580, time);
  lp.Q.value = 1.1;

  const dur = Math.min(0.55, 0.24 + durScale * 0.26);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(vel * 0.72, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(lp);
  lp.connect(g);
  g.connect(duckBus);

  let hpRoom = null;
  let rmTap = null;
  if (gp > 0.5) {
    hpRoom = audioCtx.createBiquadFilter();
    hpRoom.type = 'highpass';
    hpRoom.frequency.value = 260;
    rmTap = audioCtx.createGain();
    rmTap.gain.value = (gp - 0.5) * 0.24;
    g.connect(hpRoom);
    hpRoom.connect(rmTap);
    rmTap.connect(roomSend);
  }

  attachCleanup(src, [src, lp, g, hpRoom, rmTap]);
  src.start(time);
  src.stop(time + dur + 0.02);
}

export function playWaxChordSlice(time, opts = {}) {
  const { audioCtx, pressing, duckBus, chorusSend, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing || !acquireVoiceSlot()) return;

  const idx = ((opts.chordIdx ?? 0) % pressing.chords.length + pressing.chords.length) % pressing.chords.length;
  const vel = opts.vel ?? 0.65;
  const sliceOffset = Math.max(0, Math.min(0.65, opts.sliceOffset ?? 0));
  const dur = Math.max(0.055, Math.min(1.15, opts.dur ?? 0.45));
  const micro = Boolean(opts.micro);
  const pf = clampRate(opts.pitchFactor ?? 1.0);
  const gp = state.groovePos;

  const src = audioCtx.createBufferSource();
  src.buffer = pressing.chords[idx];
  src.playbackRate.setValueAtTime(pf, time);

  const filt = audioCtx.createBiquadFilter();
  filt.type = micro ? 'bandpass' : 'lowpass';
  if (micro) {
    filt.frequency.setValueAtTime(850 + gp * 1650, time);
    filt.Q.value = 0.95;
  } else {
    const startCut = 1400 + gp * 4400;
    filt.frequency.setValueAtTime(startCut, time);
    filt.frequency.exponentialRampToValueAtTime(Math.max(480, startCut * 0.46), time + dur * 0.9);
    filt.Q.value = 1.25;
  }

  const env = audioCtx.createGain();
  const atk = micro ? Math.min(0.014, dur * 0.24) : 0.008;
  const relStart = time + Math.max(atk + 0.01, dur * 0.68);
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(vel * (micro ? 0.54 : 0.58), time + atk);
  env.gain.setValueAtTime(vel * (micro ? 0.48 : 0.50), relStart);
  env.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(filt);
  filt.connect(env);
  env.connect(duckBus);

  const chTap = audioCtx.createGain();
  chTap.gain.value = micro ? 0.55 : (0.28 + gp * 0.32);
  env.connect(chTap);
  chTap.connect(chorusSend);

  const rmTap = audioCtx.createGain();
  rmTap.gain.value = micro ? 0.34 : (0.26 + gp * 0.38);
  env.connect(rmTap);
  rmTap.connect(roomSend);

  attachCleanup(src, [src, filt, env, chTap, rmTap]);
  src.start(time, sliceOffset, dur + 0.03);
}

export function playBrushCymbal(time, opts = {}) {
  const { audioCtx, pressing, percBus, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing || !acquireVoiceSlot()) return;

  const isRide = opts.kind === 'ride';
  const vel = opts.vel ?? 0.5;
  const pf = clampRate(opts.pitchFactor ?? 1.0);
  const gp = state.groovePos;

  const src = audioCtx.createBufferSource();
  src.buffer = isRide ? pressing.brushRide : pressing.brushHat;
  src.playbackRate.setValueAtTime(clampRate((0.97 + Math.random() * 0.06) * pf), time);

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4200 + gp * 5200, time);

  const pan = audioCtx.createStereoPanner();
  pan.pan.setValueAtTime(isRide ? 0.24 : -0.18 + (Math.random() - 0.5) * 0.16, time);

  const dur = isRide ? (0.22 + gp * 0.18) : (0.048 + gp * 0.055);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vel * (isRide ? 0.34 : 0.38), time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(lp);
  lp.connect(g);
  g.connect(pan);
  pan.connect(percBus);

  let rmTap = null;
  if (isRide || gp > 0.55) {
    rmTap = audioCtx.createGain();
    rmTap.gain.value = isRide ? 0.32 : 0.14;
    g.connect(rmTap);
    rmTap.connect(roomSend);
  }

  attachCleanup(src, [src, lp, g, pan, rmTap]);
  src.start(time);
  src.stop(time + dur + 0.02);
}

export function playModalPerc(time, opts = {}) {
  const { audioCtx, pressing, percBus, chorusSend, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing || !acquireVoiceSlot()) return;

  const idx = ((opts.percIdx ?? 0) % pressing.modalPercs.length + pressing.modalPercs.length) % pressing.modalPercs.length;
  const vel = opts.vel ?? 0.5;
  const pf = clampRate(opts.pitchFactor ?? 1.0);
  const cut = opts.cutoff ?? 6500;
  const wet = opts.wet ?? 0.2;
  const panVal = opts.pan ?? 0;

  const src = audioCtx.createBufferSource();
  src.buffer = pressing.modalPercs[idx];
  src.playbackRate.setValueAtTime(pf, time);

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.max(450, Math.min(12000, cut)), time);

  const pan = audioCtx.createStereoPanner();
  pan.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, panVal)), time);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vel * 0.58, time);

  src.connect(lp);
  lp.connect(g);
  g.connect(pan);
  pan.connect(percBus);

  let chTap = null;
  let rmTap = null;
  if (wet > 0.08) {
    chTap = audioCtx.createGain();
    chTap.gain.value = wet * 0.65;
    rmTap = audioCtx.createGain();
    rmTap.gain.value = wet * 0.85;
    g.connect(chTap);
    chTap.connect(chorusSend);
    g.connect(rmTap);
    rmTap.connect(roomSend);
  }

  attachCleanup(src, [src, lp, g, pan, chTap, rmTap]);
  src.start(time);
}

function playSkippingGrooveSpeck(time, mark, focus, pitchFactor) {
  const { audioCtx, pressing, duckBus, chorusSend, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing) return;

  const chordIdx = mark.seed % pressing.chords.length;
  const repeats = 2 + (mark.seed % 3);
  const grainDur = 0.036 + mark.size * 0.042;
  const sliceOff = 0.04 + (mark.radius * 0.34);
  const baseVol = 0.16 + Math.pow(focus, 1.3) * 0.64;
  const cutoff = 680 + Math.pow(focus, 1.45) * 7600;
  const radiusPitch = mark.radius > 0.72 ? 1.0 : (mark.radius > 0.38 ? 1.122 : 1.335);
  const rate = clampRate(radiusPitch * pitchFactor);

  for (let r = 0; r < repeats; r++) {
    if (!acquireVoiceSlot()) break;
    const t0 = time + r * (grainDur * 0.92);
    const decayVel = baseVol * Math.pow(0.74, r);

    const src = audioCtx.createBufferSource();
    src.buffer = pressing.chords[chordIdx];
    src.playbackRate.setValueAtTime(rate, t0);

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t0);
    lp.Q.value = 1.4;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.001, t0);
    env.gain.linearRampToValueAtTime(decayVel * 0.56, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + grainDur);

    const pan = audioCtx.createStereoPanner();
    pan.pan.setValueAtTime(((mark.seed % 2 === 0 ? -1 : 1) * 0.35) + (r - 1) * 0.18, t0);

    src.connect(lp);
    lp.connect(env);
    env.connect(pan);
    pan.connect(duckBus);

    const wetAmt = 0.25 + (1 - focus) * 0.72;
    const chTap = audioCtx.createGain();
    chTap.gain.value = wetAmt * 0.7;
    const rmTap = audioCtx.createGain();
    rmTap.gain.value = wetAmt * 0.65;
    env.connect(chTap);
    chTap.connect(chorusSend);
    env.connect(rmTap);
    rmTap.connect(roomSend);

    attachCleanup(src, [src, lp, env, pan, chTap, rmTap]);
    src.start(t0, sliceOff, grainDur + 0.02);
  }
}

function playGranularSmudgeCloud(time, mark, focus, pitchFactor) {
  const { audioCtx, pressing, duckBus, chorusSend, roomSend } = getAudioNodes();
  if (!audioCtx || !pressing) return;

  const chordIdx = (Math.floor(mark.radius * 5.99) + mark.seed) % pressing.chords.length;
  const grainCount = mark.smearArc > 0.35 || mark.size > 0.72 ? 3 : 2;
  const totalSpread = 0.04 + mark.smearArc * 0.22 + mark.size * 0.09;
  const baseDur = 0.22 + mark.size * 0.56;
  const baseVol = 0.14 + Math.pow(focus, 1.25) * 0.66;
  const cutoff = 520 + Math.pow(focus, 1.4) * 5800;

  const pitchPool = mark.radius < 0.34 ? [1.0, 1.498, 2.0] : (mark.radius < 0.68 ? [1.0, 1.0, 1.498] : [1.0, 0.75, 1.0]);

  for (let gIdx = 0; gIdx < grainCount; gIdx++) {
    if (!acquireVoiceSlot()) break;
    const frac = grainCount > 1 ? gIdx / (grainCount - 1) : 0;
    const t0 = time + frac * totalSpread;
    const dur = baseDur * (0.85 + frac * 0.25);
    const sliceOff = 0.02 + frac * 0.22 + (mark.radius * 0.12);
    const rate = clampRate(pitchPool[gIdx % pitchPool.length] * (1 + (gIdx - 1) * 0.005) * pitchFactor);

    const src = audioCtx.createBufferSource();
    src.buffer = pressing.chords[chordIdx];
    src.playbackRate.setValueAtTime(rate, t0);

    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff * (1.2 - frac * 0.25), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(320, cutoff * 0.45), t0 + dur);
    lp.Q.value = 1.65;

    const env = audioCtx.createGain();
    const peak = (baseVol * 0.48) / Math.sqrt(grainCount);
    env.gain.setValueAtTime(0.001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + dur * 0.24);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    const pan = audioCtx.createStereoPanner();
    pan.pan.setValueAtTime((frac * 2 - 1) * 0.55, t0);

    src.connect(lp);
    lp.connect(env);
    env.connect(pan);
    pan.connect(duckBus);

    const wetAmt = 0.45 + mark.size * 0.35 + (1 - focus) * 0.55;
    const chTap = audioCtx.createGain();
    chTap.gain.value = wetAmt * 0.72;
    const rmTap = audioCtx.createGain();
    rmTap.gain.value = wetAmt * 0.80;
    env.connect(chTap);
    chTap.connect(chorusSend);
    env.connect(rmTap);
    rmTap.connect(roomSend);

    attachCleanup(src, [src, lp, env, pan, chTap, rmTap]);
    src.start(t0, sliceOff, dur + 0.03);
  }
}

export function playMarkEvent(time, mark, pitchFactor = 1.0, forcedFocus = null) {
  const focus = forcedFocus !== null ? forcedFocus : computeFocus(mark.radius, state.groovePos);
  if (focus < 0.065) return false;

  if (mark.kind === 'smudge') {
    playGranularSmudgeCloud(time, mark, focus, pitchFactor);
    return true;
  }

  if (mark.seed % 3 === 0) {
    playSkippingGrooveSpeck(time, mark, focus, pitchFactor);
    return true;
  }

  let percIdx;
  if (mark.radius < 0.34) {
    percIdx = [0, 4, 5][mark.seed % 3];
  } else if (mark.radius < 0.68) {
    percIdx = [1, 2, 0][mark.seed % 3];
  } else {
    percIdx = [2, 3, 1][mark.seed % 3];
  }

  const radiusPitch = 1.24 - mark.radius * 0.42;
  const vel = 0.14 + Math.pow(focus, 1.35) * 0.74;
  const cutoff = 720 + Math.pow(focus, 1.35) * 8600;
  const wet = 0.12 + mark.size * 0.35 + (1 - focus) * 0.62;
  const pan = Math.sin(mark.seed) * 0.58;

  playModalPerc(time, {
    percIdx,
    vel,
    pitchFactor: clampRate(radiusPitch * pitchFactor),
    cutoff,
    wet,
    pan
  });
  return true;
}

export function auditionMark(mark) {
  const ctx = initAudio();
  const now = ctx.currentTime + 0.005;
  const focus = Math.max(0.42, computeFocus(mark.radius, state.groovePos));
  playMarkEvent(now, mark, Math.max(0.75, Math.abs(state.omegaRatio) || 1.0), focus);
}
