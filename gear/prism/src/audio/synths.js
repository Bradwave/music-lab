// West-Coast Buchla FM, Wavefolded Acid Sub-Bass, Shimmer Prism Bells,
// Super-Nova Collision Chords, and 4-Wall Micro-Percussion for PRISM.

import { state } from '../state/store.js';
import { cellToMidi, cellToBassMidi, cellToChordMidis, midiToHz } from '../state/scales.js';
import {
  getAudioNodes,
  acquireVoiceSlot,
  releaseVoiceSlot,
  triggerSidechainDuck
} from './engine.js';

function cellPan(x) {
  return ((x / 11) * 2 - 1) * 0.72;
}

/**
 * MIRROR HIT: West-Coast Buchla Low-Pass Gate (LPG) + 2-Op FM Pluck.
 */
export function playMirrorVoice(ev, time) {
  const { audioCtx, dryBus, delaySend, reverbSend } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  const hyperPitch = state.isHyper ? 1.0 : 0;
  const midi = cellToMidi(state.scaleId, ev.x, ev.y, ev.octaveShift + hyperPitch);
  const freq = midiToHz(midi);

  // FM harmonic ratio & vactrol decay per FLUX mode
  let modRatio = ev.variant === 0 ? 2.0 : 3.0;
  let modDepth = freq * 1.65;
  let decay = 0.34;
  let cutoffStart = Math.min(7200, freq * 6.5);
  let q = 2.4;
  let delayAmt = 0.28;
  let revAmt = 0.24;

  if (flux === 'acid') {
    modRatio = ev.variant === 0 ? 1.5 : 2.0;
    modDepth = freq * 2.4;
    decay = 0.22;
    cutoffStart = Math.min(6400, freq * 8.0);
    q = 5.5;
    delayAmt = 0.22;
    revAmt = 0.12;
  } else if (flux === 'glitch') {
    modRatio = ev.variant === 0 ? 2.71 : 3.41; // glassy inharmonic bell
    modDepth = freq * 3.1;
    decay = 0.15;
    cutoffStart = Math.min(9500, freq * 10);
    q = 3.8;
    delayAmt = 0.42;
    revAmt = 0.18;
  } else if (flux === 'void') {
    modRatio = 0.5;
    modDepth = freq * 0.85;
    decay = 0.92;
    cutoffStart = Math.min(3200, freq * 3.8);
    q = 1.6;
    delayAmt = 0.46;
    revAmt = 0.65;
  }

  const car = audioCtx.createOscillator();
  const mod = audioCtx.createOscillator();
  const modGain = audioCtx.createGain();
  const lpg = audioCtx.createBiquadFilter();
  const vca = audioCtx.createGain();
  const pan = audioCtx.createStereoPanner();

  car.type = flux === 'acid' ? 'triangle' : 'sine';
  mod.type = 'sine';
  car.frequency.setValueAtTime(freq, time);
  mod.frequency.setValueAtTime(freq * modRatio, time);

  // Snappy FM index decay (glassy/woody transient)
  modGain.gain.setValueAtTime(modDepth * ev.energy, time);
  modGain.gain.exponentialRampToValueAtTime(Math.max(0.5, freq * 0.04), time + decay * 0.55);

  // Buchla vactrol LPG coupled filter + amplitude decay
  lpg.type = 'lowpass';
  lpg.Q.setValueAtTime(q, time);
  lpg.frequency.setValueAtTime(cutoffStart, time);
  lpg.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.95), time + decay);

  const peak = 0.19 * ev.energy;
  vca.gain.setValueAtTime(0.0001, time);
  vca.gain.linearRampToValueAtTime(peak, time + 0.004);
  vca.gain.exponentialRampToValueAtTime(0.0001, time + decay + 0.05);

  pan.pan.setValueAtTime(cellPan(ev.x), time);

  mod.connect(modGain);
  modGain.connect(car.frequency);
  car.connect(lpg);
  lpg.connect(vca);
  vca.connect(pan);
  pan.connect(dryBus);

  const dTap = audioCtx.createGain();
  dTap.gain.value = delayAmt;
  pan.connect(dTap);
  dTap.connect(delaySend);

  const rTap = audioCtx.createGain();
  rTap.gain.value = revAmt;
  pan.connect(rTap);
  rTap.connect(reverbSend);

  const stopAt = time + decay + 0.08;
  car.start(time);
  mod.start(time);
  car.stop(stopAt);
  mod.stop(stopAt);

  car.onended = () => {
    pan.disconnect();
    dTap.disconnect();
    rTap.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * PRISM SPLIT: Shimmering dual-partial crystalline bell / harmonic fan.
 */
export function playSplitVoice(ev, time) {
  const { audioCtx, dryBus, delaySend, reverbSend } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  const baseMidi = cellToMidi(state.scaleId, ev.x, ev.y, ev.octaveShift + (flux === 'void' ? 0 : 1));
  const f1 = midiToHz(baseMidi);
  const f2 = midiToHz(baseMidi + (ev.variant === 1 ? 7 : 12)); // 5th on 3-way star, octave on 2-way

  const decay = flux === 'void' ? 1.1 : flux === 'glitch' ? 0.24 : 0.48;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const fmMod = audioCtx.createOscillator();
  const fmGain = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  const vca = audioCtx.createGain();
  const pan = audioCtx.createStereoPanner();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  fmMod.type = 'sine';

  osc1.frequency.setValueAtTime(f1, time);
  osc2.frequency.setValueAtTime(f2 * 1.003, time);
  fmMod.frequency.setValueAtTime(f1 * (flux === 'glitch' ? 4.21 : 3.5), time);

  fmGain.gain.setValueAtTime(f1 * 1.4, time);
  fmGain.gain.exponentialRampToValueAtTime(1, time + decay * 0.45);

  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(Math.min(7500, f2 * 1.6), time);
  filt.Q.setValueAtTime(1.2, time);

  const peak = 0.14 * ev.energy;
  vca.gain.setValueAtTime(0.0001, time);
  vca.gain.linearRampToValueAtTime(peak, time + 0.006);
  vca.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  pan.pan.setValueAtTime(cellPan(ev.x) * 0.8, time);

  fmMod.connect(fmGain);
  fmGain.connect(osc1.frequency);
  osc1.connect(vca);
  osc2.connect(filt);
  filt.connect(vca);
  vca.connect(pan);
  pan.connect(dryBus);

  const dTap = audioCtx.createGain();
  dTap.gain.value = 0.44;
  pan.connect(dTap);
  dTap.connect(delaySend);

  const rTap = audioCtx.createGain();
  rTap.gain.value = flux === 'void' ? 0.85 : 0.48;
  pan.connect(rTap);
  rTap.connect(reverbSend);

  const stopAt = time + decay + 0.05;
  osc1.start(time);
  osc2.start(time);
  fmMod.start(time);
  osc1.stop(stopAt);
  osc2.stop(stopAt);
  fmMod.stop(stopAt);

  osc1.onended = () => {
    pan.disconnect();
    dTap.disconnect();
    rTap.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * BASS COIL: Buchla Trigonometric Wavefolder + Acid Resonant Sub-Bass.
 */
export function playBassVoice(ev, time) {
  const { audioCtx, bassBus, delaySend, foldCurves } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  let midi = cellToBassMidi(state.scaleId, ev.x, ev.y);
  if (flux === 'void') midi = Math.max(26, midi - 5);
  const freq = midiToHz(midi);

  const decay = flux === 'void' ? 0.82 : flux === 'acid' ? 0.32 : 0.42;

  // Sub anchor sine
  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq * (ev.variant === 1 ? 1.18 : 1.0), time);
  if (ev.variant === 1) {
    // 180° retro-bounce gets a punchy acid pitch glide!
    sub.frequency.exponentialRampToValueAtTime(freq, time + 0.045);
  }

  // Wavefolded harmonic voice
  const body = audioCtx.createOscillator();
  const preFold = audioCtx.createGain();
  const folder = audioCtx.createWaveShaper();
  const lpf = audioCtx.createBiquadFilter();
  const bodyGain = audioCtx.createGain();

  body.type = flux === 'acid' ? 'sawtooth' : 'triangle';
  body.frequency.setValueAtTime(freq, time);
  if (ev.variant === 1) {
    body.frequency.setValueAtTime(freq * 1.25, time);
    body.frequency.exponentialRampToValueAtTime(freq, time + 0.05);
  }

  folder.curve = flux === 'glitch' ? foldCurves.glitch : foldCurves.acid;
  const foldDrive = flux === 'acid' ? 0.92 : flux === 'glitch' ? 1.0 : flux === 'void' ? 0.42 : 0.62;
  preFold.gain.setValueAtTime(foldDrive, time);
  preFold.gain.exponentialRampToValueAtTime(0.18, time + decay * 0.85);

  lpf.type = 'lowpass';
  const startCut = flux === 'acid' ? 2400 : flux === 'glitch' ? 3200 : flux === 'void' ? 520 : 1200;
  const endCut = flux === 'acid' ? 210 : 140;
  lpf.Q.setValueAtTime(flux === 'acid' ? 8.2 : flux === 'glitch' ? 5.0 : 2.5, time);
  lpf.frequency.setValueAtTime(startCut, time);
  lpf.frequency.exponentialRampToValueAtTime(endCut, time + decay * 0.72);

  const subPeak = 0.32 * ev.energy;
  subGain.gain.setValueAtTime(0.0001, time);
  subGain.gain.linearRampToValueAtTime(subPeak, time + 0.005);
  subGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  const bodyPeak = (flux === 'acid' ? 0.24 : 0.16) * ev.energy;
  bodyGain.gain.setValueAtTime(0.0001, time);
  bodyGain.gain.linearRampToValueAtTime(bodyPeak, time + 0.005);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + decay * 0.92);

  sub.connect(subGain);
  subGain.connect(bassBus);

  body.connect(preFold);
  preFold.connect(folder);
  folder.connect(lpf);
  lpf.connect(bodyGain);
  bodyGain.connect(bassBus);

  // Subtle delay throw on acid squelch body only (never sub!)
  const dTap = audioCtx.createGain();
  dTap.gain.value = flux === 'acid' ? 0.22 : 0.1;
  bodyGain.connect(dTap);
  dTap.connect(delaySend);

  triggerSidechainDuck(time, flux === 'void' ? 0.26 : 0.42, 0.15);

  const stopAt = time + decay + 0.05;
  sub.start(time);
  body.start(time);
  sub.stop(stopAt);
  body.stop(stopAt);

  sub.onended = () => {
    subGain.disconnect();
    bodyGain.disconnect();
    dTap.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * WARP PORTAL: Quantum FM pitch-glide laser zing + stereo delay throw.
 */
export function playWarpVoice(ev, time) {
  const { audioCtx, dryBus, delaySend, reverbSend } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  const midi = cellToMidi(state.scaleId, ev.x, ev.y, ev.octaveShift);
  const fStart = midiToHz(midi - (ev.teleported ? 7 : 5));
  const fEnd = midiToHz(midi + (ev.teleported ? 12 : 7));

  const dur = flux === 'void' ? 0.65 : flux === 'glitch' ? 0.2 : 0.34;

  const osc = audioCtx.createOscillator();
  const mod = audioCtx.createOscillator();
  const modGain = audioCtx.createGain();
  const vca = audioCtx.createGain();
  const pan = audioCtx.createStereoPanner();

  osc.type = 'sine';
  mod.type = 'triangle';

  osc.frequency.setValueAtTime(fStart, time);
  osc.frequency.exponentialRampToValueAtTime(fEnd, time + dur * 0.65);

  mod.frequency.setValueAtTime(fStart * 2.5, time);
  mod.frequency.exponentialRampToValueAtTime(fEnd * 1.5, time + dur * 0.65);
  modGain.gain.setValueAtTime(fStart * 1.8, time);
  modGain.gain.exponentialRampToValueAtTime(2, time + dur);

  const peak = 0.15 * ev.energy;
  if (flux === 'glitch') {
    // 3-pulse micro-stutter glitch envelope
    vca.gain.setValueAtTime(0.0001, time);
    for (let k = 0; k < 3; k++) {
      const t0 = time + k * 0.055;
      vca.gain.linearRampToValueAtTime(peak * (1 - k * 0.22), t0 + 0.005);
      vca.gain.exponentialRampToValueAtTime(0.002, t0 + 0.045);
    }
    vca.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  } else {
    vca.gain.setValueAtTime(0.0001, time);
    vca.gain.linearRampToValueAtTime(peak, time + 0.012);
    vca.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  }

  pan.pan.setValueAtTime(cellPan(ev.x), time);

  mod.connect(modGain);
  modGain.connect(osc.frequency);
  osc.connect(vca);
  vca.connect(pan);
  pan.connect(dryBus);

  const dTap = audioCtx.createGain();
  dTap.gain.value = 0.6;
  pan.connect(dTap);
  dTap.connect(delaySend);

  const rTap = audioCtx.createGain();
  rTap.gain.value = 0.52;
  pan.connect(rTap);
  rTap.connect(reverbSend);

  const stopAt = time + dur + 0.05;
  osc.start(time);
  mod.start(time);
  osc.stop(stopAt);
  mod.stop(stopAt);

  osc.onended = () => {
    pan.disconnect();
    dTap.disconnect();
    rTap.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * SUPER-NOVA COLLISION: Lush 3-note glassy FM chord burst + crisp IDM micro-snare snap!
 */
export function playCollisionVoice(ev, time) {
  const { audioCtx, dryBus, percBus, delaySend, reverbSend, noiseBuffer } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  const chord = cellToChordMidis(state.scaleId, ev.x, ev.y, ev.octaveShift);
  const decay = flux === 'void' ? 1.45 : flux === 'glitch' ? 0.34 : 0.72;

  const chordBus = audioCtx.createGain();
  const lpf = audioCtx.createBiquadFilter();
  const pan = audioCtx.createStereoPanner();

  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(flux === 'void' ? 2800 : 6200, time);
  lpf.frequency.exponentialRampToValueAtTime(650, time + decay);
  lpf.Q.setValueAtTime(2.2, time);

  chordBus.gain.setValueAtTime(0.0001, time);
  chordBus.gain.linearRampToValueAtTime(0.16 * ev.energy, time + 0.01);
  chordBus.gain.exponentialRampToValueAtTime(0.0001, time + decay);

  pan.pan.setValueAtTime(cellPan(ev.x) * 0.5, time);

  const oscs = chord.map((midi, idx) => {
    const o = audioCtx.createOscillator();
    o.type = idx === 0 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(midiToHz(midi) * (1 + (idx - 1) * 0.0025), time);
    o.connect(lpf);
    o.start(time + idx * 0.006); // silky micro-strum
    o.stop(time + decay + 0.06);
    return o;
  });

  lpf.connect(chordBus);
  chordBus.connect(pan);
  pan.connect(dryBus);

  const dTap = audioCtx.createGain();
  dTap.gain.value = 0.45;
  pan.connect(dTap);
  dTap.connect(delaySend);

  const rTap = audioCtx.createGain();
  rTap.gain.value = 0.75;
  pan.connect(rTap);
  rTap.connect(reverbSend);

  // Crisp IDM micro-snare / laser snap on collision
  if (noiseBuffer && flux !== 'void') {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(flux === 'glitch' ? 3200 : 1950, time);
    bp.Q.setValueAtTime(1.4, time);
    const snapGain = audioCtx.createGain();
    snapGain.gain.setValueAtTime(0.14 * ev.energy, time);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.095);

    src.connect(bp);
    bp.connect(snapGain);
    snapGain.connect(percBus);
    src.start(time, Math.random() * 1.2, 0.11);
  }

  oscs[0].onended = () => {
    pan.disconnect();
    dTap.disconnect();
    rTap.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * EMITTER PULSE ANCHOR: Warm tuned analog sub-kick heartbeat on laser fire.
 */
export function playEmitterPulse(ev, time) {
  const { audioCtx, bassBus } = getAudioNodes();
  if (!audioCtx || !acquireVoiceSlot()) return;

  const flux = state.flux;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  const startHz = flux === 'acid' ? 148 : flux === 'glitch' ? 175 : 112;
  const endHz = flux === 'void' ? 38 : 45;
  const dur = flux === 'acid' ? 0.22 : flux === 'void' ? 0.34 : 0.18;

  osc.frequency.setValueAtTime(startHz, time);
  osc.frequency.exponentialRampToValueAtTime(endHz, time + 0.042);

  const peak = flux === 'acid' ? 0.34 : flux === 'glitch' ? 0.26 : flux === 'void' ? 0.16 : 0.21;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

  osc.connect(gain);
  gain.connect(bassBus);

  if (flux === 'acid' || flux === 'glitch') {
    triggerSidechainDuck(time, 0.35, 0.13);
  }

  osc.start(time);
  osc.stop(time + dur + 0.03);
  osc.onended = () => {
    gain.disconnect();
    releaseVoiceSlot();
  };
}

/**
 * 4-WALL MICRO-PERCUSSION: Subtle rhythmic IDM kit mapped to N / E / S / W edges.
 */
export function playWallHit(ev, time) {
  const { audioCtx, percBus, noiseBuffer } = getAudioNodes();
  if (!audioCtx || !noiseBuffer || !acquireVoiceSlot()) return;

  const flux = state.flux;
  if (flux === 'void' && !ev.isWrap && Math.random() < 0.45) {
    releaseVoiceSlot();
    return;
  }

  const pan = audioCtx.createStereoPanner();
  pan.pan.setValueAtTime(
    ev.edge === 'W' ? -0.68 : ev.edge === 'E' ? 0.68 : cellPan(ev.x) * 0.5,
    time
  );
  pan.connect(percBus);

  const vel = ev.energy * (flux === 'acid' ? 0.13 : flux === 'glitch' ? 0.12 : 0.085);

  if (ev.edge === 'N' || ev.edge === 'W') {
    // Crisp micro-hat / brushed glass tick
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const filt = audioCtx.createBiquadFilter();
    filt.type = ev.edge === 'N' ? 'highpass' : 'bandpass';
    filt.frequency.setValueAtTime(ev.edge === 'N' ? 7600 : 4400, time);
    filt.Q.setValueAtTime(2.2, time);

    const g = audioCtx.createGain();
    const dur = ev.edge === 'N' ? 0.038 : 0.055;
    g.gain.setValueAtTime(Math.max(0.0001, vel), time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(pan);
    src.start(time, Math.random() * 1.4, dur + 0.01);
    src.onended = () => {
      pan.disconnect();
      releaseVoiceSlot();
    };
  } else {
    // E = Buchla woody rim knock, S = soft low percussive wood-tom
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    const isEast = ev.edge === 'E';
    const f0 = isEast ? 1320 : 190;
    const f1 = isEast ? 860 : 96;
    const dur = isEast ? 0.032 : 0.075;

    osc.frequency.setValueAtTime(f0, time);
    osc.frequency.exponentialRampToValueAtTime(f1, time + dur);

    g.gain.setValueAtTime(Math.max(0.0001, vel * 1.1), time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(g);
    g.connect(pan);
    osc.start(time);
    osc.stop(time + dur + 0.01);
    osc.onended = () => {
      pan.disconnect();
      releaseVoiceSlot();
    };
  }
}

/**
 * Dispatch all simulation events for a single step with micro-strum spread so chords breathe!
 */
export function triggerStepEvents(events, audioTime) {
  let melodicIndex = 0;
  let wallCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type === 'emitter') {
      playEmitterPulse(ev, audioTime);
    } else if (ev.type === 'bass') {
      playBassVoice(ev, audioTime);
    } else if (ev.type === 'mirror') {
      if (melodicIndex < 5) {
        playMirrorVoice(ev, audioTime + melodicIndex * 0.0035);
        melodicIndex++;
      }
    } else if (ev.type === 'split') {
      if (melodicIndex < 6) {
        playSplitVoice(ev, audioTime + melodicIndex * 0.004);
        melodicIndex++;
      }
    } else if (ev.type === 'warp') {
      if (melodicIndex < 6) {
        playWarpVoice(ev, audioTime + melodicIndex * 0.004);
        melodicIndex++;
      }
    } else if (ev.type === 'collision') {
      playCollisionVoice(ev, audioTime + 0.002);
    } else if (ev.type === 'wall') {
      if (wallCount < 2) {
        playWallHit(ev, audioTime + wallCount * 0.005);
        wallCount++;
      }
    }
  }
}

/**
 * Tactile UI audit ping when placing/rotating an optic while paused so the bench always feels alive!
 */
export function playPreviewPing(type, x, y, variant = 0) {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx) return;
  const t = audioCtx.currentTime + 0.01;
  if (type === 'bass') {
    playBassVoice({ x, y, variant, energy: 0.72 }, t);
  } else if (type === 'split') {
    playSplitVoice({ x, y, variant, octaveShift: 0, energy: 0.75 }, t);
  } else if (type === 'warp') {
    playWarpVoice({ x, y, variant, teleported: true, octaveShift: 0, energy: 0.7 }, t);
  } else {
    playMirrorVoice({ x, y, variant, octaveShift: 0, energy: 0.72 }, t);
  }
}
