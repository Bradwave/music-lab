// Bespoke Berlin 3 AM deep house & microhouse synthesis voices.
// Zero external samples — 100% Web Audio API synthesis.

import { state } from '../state/store.js';
import { getHour, getChordData, getSubMidi, midiToFreq } from '../state/scales.js';
import { initAudio, getAudioNodes, getLaneInput, triggerSidechain } from './engine.js';

function tapePitch() {
  if (!state.fx.FLUT) return 1.0;
  // Subtle tape slowdown + cassette warble flutter
  const wobble = Math.sin(performance.now() * 0.028) * 0.035;
  return 0.84 + wobble;
}

function driftFactor(amount = 0.03) {
  return (1 + (Math.random() * 2 - 1) * amount * (0.2 + state.drift * 0.8)) * tapePitch();
}

// Disconnect all per-voice nodes from persistent buses once the voice's source ends
function cleanupOnEnded(source, nodes) {
  source.onended = () => {
    source.onended = null;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      try {
        node.disconnect();
      } catch {
        // Ignore already-disconnected nodes
      }
    }
  };
}

// ============================================================================
// 1) SUB — Analog 909/808 House Kick + Rolling Deep-House Sub-Bass
// ============================================================================
export function playSub(time, val, opts = {}) {
  const { audioCtx, reverbSend } = getAudioNodes();
  const dest = getLaneInput('sub');
  const isGhost = Boolean(opts.isGhost);
  const vel = (opts.vel ?? 1.0) * (isGhost ? 0.58 : 1.0);
  const depth = state.depth;
  const t = getHour(state.hourId).tone;

  // val 0 = main analog house kick, val 1 = soft muted thump
  if (val <= 1) {
    const isSoft = val === 1 || isGhost;
    const baseFreq = (isSoft ? 49 : (t.subWeight > 1.1 ? 43 : 46)) * tapePitch();
    const dur = (isSoft ? 0.14 : (0.20 + depth * 0.14)) * t.subWeight;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * (isSoft ? 2.1 : 3.1 * t.kickPunch), time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.12, time + 0.038);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vel * (isSoft ? 0.62 : 1.02 * Math.min(1.08, t.subWeight)), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(dest);

    let revTap = null;
    if (depth > 0.45 && !isSoft) {
      revTap = audioCtx.createGain();
      revTap.gain.value = (depth - 0.45) * 0.14 * t.reverbScale;
      gain.connect(revTap);
      revTap.connect(reverbSend);
    }

    cleanupOnEnded(osc, [osc, gain, revTap]);
    osc.start(time);
    osc.stop(time + dur + 0.02);

    // Subtle woody kick transient click
    if (!isSoft) {
      const clickOsc = audioCtx.createOscillator();
      const clickGain = audioCtx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(280 * t.kickPunch * driftFactor(0.04), time);
      clickOsc.frequency.exponentialRampToValueAtTime(84, time + 0.017);
      clickGain.gain.setValueAtTime(vel * 0.25 * t.kickPunch, time);
      clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.019);
      clickOsc.connect(clickGain);
      clickGain.connect(dest);
      cleanupOnEnded(clickOsc, [clickOsc, clickGain]);
      clickOsc.start(time);
      clickOsc.stop(time + 0.022);

      triggerSidechain(time, vel);

      const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
      setTimeout(() => {
        state.kickPulse = Math.max(state.kickPulse, vel);
      }, delayMs);
    }
    return;
  }

  // val 2..7 = Warm rounded deep-house sub-bass note
  const midi = getSubMidi(val, state.keyId, state.hourId);
  const freq = midiToFreq(midi) * driftFactor(0.005);
  const dur = (isGhost ? 0.14 : (0.24 + depth * 0.16)) * t.subWeight;

  const subOsc = audioCtx.createOscillator();
  const bodyOsc = audioCtx.createOscillator();
  const filt = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(freq, time);

  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(freq * 2, time);

  const bodyMix = audioCtx.createGain();
  bodyMix.gain.value = isGhost ? 0.12 : 0.24;

  filt.type = 'lowpass';
  filt.Q.value = 1.6;
  filt.frequency.setValueAtTime(isGhost ? 280 : 620, time);
  filt.frequency.exponentialRampToValueAtTime(160 + depth * 90, time + dur * 0.75);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(vel * 0.62, time + 0.007);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  subOsc.connect(filt);
  bodyOsc.connect(bodyMix);
  bodyMix.connect(filt);
  filt.connect(gain);
  gain.connect(dest);

  cleanupOnEnded(subOsc, [subOsc, bodyOsc, bodyMix, filt, gain]);
  subOsc.start(time);
  bodyOsc.start(time);
  subOsc.stop(time + dur + 0.02);
  bodyOsc.stop(time + dur + 0.02);
}

// ============================================================================
// 2) CUT — 8 Organic Microhouse Clicks, Rims, Claps & Foley Percs
// ============================================================================
export function playCut(time, val, opts = {}) {
  const { audioCtx, noiseBuffer, reverbSend } = getAudioNodes();
  const dest = getLaneInput('cut');
  const isGhost = Boolean(opts.isGhost);
  const vel = (opts.vel ?? 1.0) * (isGhost ? 0.54 : 0.92);
  const type = ((Math.round(val) % 8) + 8) % 8;
  const pf = driftFactor(0.045);

  // Subtle stereo scatter for microhouse spaciousness
  const panner = audioCtx.createStereoPanner();
  const basePan = ((type % 2 === 0 ? -1 : 1) * (0.14 + (type * 0.05))) + (Math.random() - 0.5) * 0.3 * state.drift;
  panner.pan.setValueAtTime(Math.max(-0.75, Math.min(0.75, basePan)), time);
  panner.connect(dest);

  // 0: Perlon micro-click (crisp 9ms impulse + resonant woody body)
  if (type === 0) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1750 * pf, time);
    osc.frequency.exponentialRampToValueAtTime(280 * pf, time + 0.011);
    g.gain.setValueAtTime(vel * 0.52, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.014);
    osc.connect(g);
    g.connect(panner);
    cleanupOnEnded(osc, [osc, g, panner]);
    osc.start(time);
    osc.stop(time + 0.018);
    return;
  }

  // 1: Dry woody rimshot
  if (type === 1) {
    const osc = audioCtx.createOscillator();
    const bp = audioCtx.createBiquadFilter();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(490 * pf, time);
    osc.frequency.exponentialRampToValueAtTime(340 * pf, time + 0.025);
    bp.type = 'bandpass';
    bp.frequency.value = 1650 * pf;
    bp.Q.value = 2.6;
    g.gain.setValueAtTime(vel * 0.72, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.036);
    osc.connect(bp);
    bp.connect(g);
    g.connect(panner);
    cleanupOnEnded(osc, [osc, bp, g, panner]);
    osc.start(time);
    osc.stop(time + 0.042);

    // Crisp transient tick layered on top
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3200 * pf;
    hp.Q.value = 1.8;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(vel * 0.28, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(panner);
    cleanupOnEnded(src, [src, hp, ng]);
    src.start(time, Math.random() * 0.8);
    src.stop(time + 0.016);
    return;
  }

  // 2: Tight microhouse clap (3 staggered micro-bursts)
  if (type === 2) {
    const offsets = [0, 0.009, 0.019];
    offsets.forEach((off, idx) => {
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (1350 + idx * 140) * pf;
      bp.Q.value = 1.5;
      const g = audioCtx.createGain();
      const d = idx === 2 ? (isGhost ? 0.045 : 0.085) : 0.014;
      g.gain.setValueAtTime(0.001, time + off);
      g.gain.linearRampToValueAtTime(vel * (idx === 2 ? 0.44 : 0.28), time + off + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, time + off + d);
      src.connect(bp);
      bp.connect(g);
      g.connect(panner);
      cleanupOnEnded(src, idx === 2 ? [src, bp, g, panner] : [src, bp, g]);
      src.start(time + off, Math.random() * 0.8);
      src.stop(time + off + d + 0.01);
    });
    return;
  }

  // 3: Hollow woodblock / clave
  if (type === 3) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920 * pf, time);
    osc.frequency.exponentialRampToValueAtTime(760 * pf, time + 0.032);
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vel * 0.45, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    osc.connect(g);
    g.connect(panner);
    cleanupOnEnded(osc, [osc, g, panner]);
    osc.start(time);
    osc.stop(time + 0.05);
    return;
  }

  // 4: Soft deep minimal conga/tom blip
  if (type === 4) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 * pf, time);
    osc.frequency.exponentialRampToValueAtTime(142 * pf, time + 0.09);
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vel * 0.56, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(g);
    g.connect(panner);
    cleanupOnEnded(osc, [osc, g, panner]);
    osc.start(time);
    osc.stop(time + 0.13);
    return;
  }

  // 5: Crisp vinyl needle / micro-cut tick
  if (type === 5) {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200 * pf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vel * 0.42, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.007);
    src.connect(hp);
    hp.connect(g);
    g.connect(panner);
    cleanupOnEnded(src, [src, hp, g, panner]);
    src.start(time, Math.random() * 0.9);
    src.stop(time + 0.01);
    return;
  }

  // 6: Resonant FM dub ping
  if (type === 6) {
    const carrier = audioCtx.createOscillator();
    const mod = audioCtx.createOscillator();
    const modGain = audioCtx.createGain();
    const g = audioCtx.createGain();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(640 * pf, time);
    mod.type = 'sine';
    mod.frequency.setValueAtTime(1520 * pf, time);
    modGain.gain.setValueAtTime(420, time);
    modGain.gain.exponentialRampToValueAtTime(10, time + 0.04);

    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vel * 0.34, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.065);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(panner);

    const revTap = audioCtx.createGain();
    revTap.gain.value = 0.25 + state.depth * 0.3;
    g.connect(revTap);
    revTap.connect(reverbSend);

    cleanupOnEnded(carrier, [carrier, mod, modGain, g, revTap, panner]);
    carrier.start(time);
    mod.start(time);
    carrier.stop(time + 0.075);
    mod.stop(time + 0.075);
    return;
  }

  // 7: Filtered foley brush / scrape
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2400 * pf, time);
  bp.frequency.exponentialRampToValueAtTime(4800 * pf, time + 0.042);
  bp.Q.value = 3.2;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(vel * 0.34, time + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.048);
  src.connect(bp);
  bp.connect(g);
  g.connect(panner);
  cleanupOnEnded(src, [src, bp, g, panner]);
  src.start(time, Math.random() * 0.8);
  src.stop(time + 0.055);
}

// ============================================================================
// 3) CHD — Parallel Deep House / Dub Techno Minor-9th & 11th Chord Stabs
// ============================================================================
export function playChd(time, val, opts = {}) {
  const { audioCtx, reverbSend, dubSend } = getAudioNodes();
  const dest = getLaneInput('chd');
  const isGhost = Boolean(opts.isGhost);
  const vel = (opts.vel ?? 1.0) * (isGhost ? 0.44 : 0.88);
  const depth = state.depth;
  const hour = getHour(state.hourId);
  const t = hour.tone;
  const chord = getChordData(val, state.keyId, state.hourId);

  // Tight dub stab at low depth, lush blooming chord at high depth, shaped by Night-Arc hour
  const dur = (isGhost ? (0.14 + depth * 0.18) : (0.24 + depth * 0.56)) * t.chordDecay;

  const chordBus = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = (2.2 + depth * 2.4) * (t.chordBright < 0.8 ? 1.25 : 0.92);

  const peakCut = (isGhost
    ? (720 + (1 - depth) * 700)
    : (1150 + (1 - depth) * 1850) * driftFactor(0.08)) * t.chordBright;
  const restCut = (240 + (1 - depth) * 240) * t.chordBright;

  filt.frequency.setValueAtTime(Math.max(150, restCut * 0.8), time);
  filt.frequency.linearRampToValueAtTime(Math.max(240, Math.min(12000, peakCut)), time + 0.012);
  filt.frequency.exponentialRampToValueAtTime(Math.max(150, restCut), time + dur * 0.9);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(vel * 0.36, time + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, time + dur);

  chordBus.connect(filt);
  filt.connect(env);
  env.connect(dest);

  const nodes = [chordBus, filt, env];

  // Extra reverb & dub send for ghost whispers or high depth
  const revTap = audioCtx.createGain();
  revTap.gain.value = (isGhost ? 0.55 : (0.24 + depth * 0.46)) * t.reverbScale;
  env.connect(revTap);
  revTap.connect(reverbSend);
  nodes.push(revTap);

  if (isGhost || depth > 0.35 || t.dubFbBoost > 0.05) {
    const dubTap = audioCtx.createGain();
    dubTap.gain.value = isGhost ? 0.48 : (depth * 0.36 + Math.max(0, t.dubFbBoost));
    env.connect(dubTap);
    dubTap.connect(dubSend);
    nodes.push(dubTap);
  }

  // Synthesize each note in the parallel chord with hour-sculpted waveform & Rhodes bell tine
  let lastOsc = null;
  chord.midis.forEach((midi, idx) => {
    const freq = midiToFreq(midi) * tapePitch();
    const detuneCents = (idx - 2) * 3.8 + (Math.random() - 0.5) * 6 * state.drift;

    const oscA = audioCtx.createOscillator();
    oscA.type = idx === 0 ? 'triangle' : t.chordWave;
    oscA.frequency.setValueAtTime(freq, time);
    oscA.detune.setValueAtTime(detuneCents, time);

    const oscB = audioCtx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.setValueAtTime(freq * (t.octaveLift && idx === chord.midis.length - 1 ? 4 : 2), time);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = (idx === 0 ? 0.32 : 0.22) / Math.sqrt(chord.midis.length);

    const tineGain = audioCtx.createGain();
    tineGain.gain.setValueAtTime((isGhost ? 0.04 : 0.13) * t.tineGain, time);
    tineGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    oscA.connect(voiceGain);
    oscB.connect(tineGain);
    tineGain.connect(voiceGain);
    voiceGain.connect(chordBus);

    nodes.push(oscA, oscB, voiceGain, tineGain);
    lastOsc = oscA;

    oscA.start(time);
    oscB.start(time);
    oscA.stop(time + dur + 0.03);
    oscB.stop(time + dur + 0.03);
  });

  if (lastOsc) {
    cleanupOnEnded(lastOsc, nodes);
  }
}

// ============================================================================
// 4) AIR — Crisp Shuffled Hats, Shakers & Stereo Micro-Dust Grains
// ============================================================================
export function playAir(time, val, opts = {}) {
  const { audioCtx, noiseBuffer, reverbSend } = getAudioNodes();
  const dest = getLaneInput('air');
  const isGhost = Boolean(opts.isGhost);
  const vel = (opts.vel ?? 1.0) * (isGhost ? 0.48 : 0.85);
  const type = ((Math.round(val) % 8) + 8) % 8;
  const pf = driftFactor(0.05);

  const panner = audioCtx.createStereoPanner();
  const panPos = (Math.random() * 2 - 1) * (isGhost ? 0.65 : 0.28) * (0.35 + state.drift * 0.65);
  panner.pan.setValueAtTime(panPos, time);
  panner.connect(dest);

  // 0: Tight closed 909 hat | 1: Airy open hat | 2: Crisp shaker | 3: Micro-tick
  // 4: Reverse breath puff | 5: Stereo metallic grain | 6: Dust sparkle | 7: Ride shimmer
  if (type === 5) {
    // Ultra-short metallic FM grain
    const osc = audioCtx.createOscillator();
    const bp = audioCtx.createBiquadFilter();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(4200 * pf, time);
    bp.type = 'highpass';
    bp.frequency.value = 6200;
    g.gain.setValueAtTime(vel * 0.18, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.016);
    osc.connect(bp);
    bp.connect(g);
    g.connect(panner);
    cleanupOnEnded(osc, [osc, bp, g, panner]);
    osc.start(time);
    osc.stop(time + 0.02);
    return;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = pf;

  const hp = audioCtx.createBiquadFilter();
  hp.type = type === 2 || type === 4 ? 'bandpass' : 'highpass';
  const freqMap = [6800, 5600, 4800, 8400, 3200, 7000, 6200, 7400];
  hp.frequency.setValueAtTime(freqMap[type] * pf, time);
  if (hp.type === 'bandpass') hp.Q.value = 1.4;

  const g = audioCtx.createGain();
  const durMap = [0.032, 0.21, 0.058, 0.011, 0.085, 0.02, 0.024, 0.28];
  const dur = durMap[type] * (isGhost ? 0.72 : 1.0);
  const atk = type === 4 ? dur * 0.65 : type === 2 ? 0.012 : 0.002;

  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(vel * (type === 1 || type === 7 ? 0.28 : 0.34), time + atk);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  src.connect(hp);
  hp.connect(g);
  g.connect(panner);

  let revTap = null;
  if ((type === 1 || type === 4 || type === 7) && state.depth > 0.25) {
    revTap = audioCtx.createGain();
    revTap.gain.value = 0.22 + state.depth * 0.3;
    g.connect(revTap);
    revTap.connect(reverbSend);
  }

  cleanupOnEnded(src, [src, hp, g, revTap, panner]);
  src.start(time, Math.random() * 0.85);
  src.stop(time + dur + 0.02);
}

export function triggerLaneVoice(laneId, time, val, opts = {}) {
  if (laneId === 'sub') playSub(time, val, opts);
  else if (laneId === 'cut') playCut(time, val, opts);
  else if (laneId === 'chd') playChd(time, val, opts);
  else if (laneId === 'air') playAir(time, val, opts);
}

export function auditionLane(laneId, val) {
  const ctx = initAudio();
  const now = ctx.currentTime + 0.005;
  triggerLaneVoice(laneId, now, val, { vel: 0.95, isGhost: false });
}
