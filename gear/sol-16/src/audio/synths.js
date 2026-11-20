import { state } from '../state/store.js';
import { getMood, midiToFreq, KICK_BRUSHES } from '../state/scales.js';
import { getAudioNodes, getTrackInput, triggerSidechain } from './engine.js';

function getTapePitchFactor() {
  return state.fx.TAPE ? 0.83 : 1.0;
}

// 1) WARM ANALOG HOUSE KICK (TONE = warmth/punch, DECAY = length, SPACE = room tail, DRIVE = crunch/comp)
function playKick(time, step, params) {
  const { audioCtx, reverbSend } = getAudioNodes();
  const drumBus = getTrackInput('bd');
  const brush = KICK_BRUSHES[step.note % KICK_BRUSHES.length] || KICK_BRUSHES[0];
  const accentScale = step.accent ? 1.0 : 0.56;
  const { tone, decay: decParam, space } = params;

  const baseFreq = typeof step.midi === 'number'
    ? Math.max(32, Math.min(140, midiToFreq(step.midi - 12))) * getTapePitchFactor()
    : (47 * Math.pow(2, brush.pitch / 12)) * getTapePitchFactor();
  const dur = 0.13 + decParam * 0.36;
  const vel = brush.vol * accentScale;

  const osc = audioCtx.createOscillator();
  const filt = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq * (2.8 + brush.punch * 0.6), time);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.14, time + 0.042);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, time + dur);

  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(180 + tone * 1500, time);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(vel * 1.02, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(drumBus);

  // Subtle house room ambience when SPACE > 0.15
  if (space > 0.15) {
    const revTap = audioCtx.createGain();
    revTap.gain.value = (space - 0.15) * 0.25;
    gain.connect(revTap);
    revTap.connect(reverbSend);
  }

  osc.start(time);
  osc.stop(time + dur + 0.03);

  // Soft woody transient click
  const clickOsc = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  clickOsc.type = 'triangle';
  clickOsc.frequency.setValueAtTime(290 * getTapePitchFactor(), time);
  clickOsc.frequency.exponentialRampToValueAtTime(88, time + 0.018);

  clickGain.gain.setValueAtTime(vel * (0.09 + tone * brush.punch * 0.3), time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

  clickOsc.connect(clickGain);
  clickGain.connect(drumBus);
  clickOsc.start(time);
  clickOsc.stop(time + 0.024);

  triggerSidechain(time, vel);
  const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
  setTimeout(() => { state.kickPulse = Math.max(state.kickPulse, vel); }, delayMs);
}

// 2) ORGANIC MICROHOUSE PERCUSSION (6 flavors: HAT, OPEN, SHAK, CLAP, RIM, CONG)
function playPerc(time, step, params) {
  const { audioCtx, dubSend, reverbSend, noiseBuffer } = getAudioNodes();
  const drumBus = getTrackInput('pr');
  const typeIdx = step.note % 6;
  const accentScale = step.accent ? 1.0 : 0.58;
  const { tone, decay: decParam, space } = params;
  const pf = getTapePitchFactor() * (0.985 + Math.random() * 0.03);

  if (typeIdx === 0 || typeIdx === 1) {
    const isOpen = typeIdx === 1;
    const dur = isOpen ? (0.11 + decParam * 0.36) : (0.022 + decParam * 0.08);
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = pf;

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime((4400 + tone * 4500) * pf, time);

    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(8800 * pf, time);
    bp.Q.value = 1.0;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(accentScale * (isOpen ? 0.36 : 0.32), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(drumBus);

    if (space > 0.25 || state.fx.DUB) {
      const s = audioCtx.createGain();
      s.gain.value = space * 0.4;
      gain.connect(s);
      s.connect(reverbSend);
      if (space > 0.55 || state.fx.DUB) s.connect(dubSend);
    }

    src.start(time, Math.random() * 0.8);
    src.stop(time + dur + 0.02);
    return;
  }

  if (typeIdx === 2) {
    const dur = 0.04 + decParam * 0.11;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = pf;

    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((3000 + tone * 3900) * pf, time);
    bp.Q.value = 1.9;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(accentScale * 0.28, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(drumBus);

    src.start(time, Math.random() * 0.8);
    src.stop(time + dur + 0.02);
    return;
  }

  if (typeIdx === 3) {
    const tailDur = 0.08 + decParam * 0.24;
    const offsets = [0, 0.011, 0.023];
    offsets.forEach((off, idx) => {
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;

      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime((1000 + tone * 1550) * pf, time + off);
      bp.Q.value = 1.25;

      const g = audioCtx.createGain();
      const isLast = idx === offsets.length - 1;
      const d = isLast ? tailDur : 0.017;
      g.gain.setValueAtTime(0.001, time + off);
      g.gain.linearRampToValueAtTime(accentScale * (isLast ? 0.48 : 0.34), time + off + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, time + off + d);

      src.connect(bp);
      bp.connect(g);
      g.connect(drumBus);
      if (isLast) {
        const rev = audioCtx.createGain();
        rev.gain.value = 0.12 + space * 0.65;
        g.connect(rev);
        rev.connect(reverbSend);
        if (space > 0.5 || state.fx.DUB) rev.connect(dubSend);
      }

      src.start(time + off, Math.random() * 0.8);
      src.stop(time + off + d + 0.02);
    });
    return;
  }

  if (typeIdx === 4) {
    const dur = 0.04 + decParam * 0.13;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const f1 = (680 + tone * 340) * pf;
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(f1, time);
    osc1.frequency.exponentialRampToValueAtTime(f1 * 0.86, time + dur);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f1 * 2.12, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(accentScale * 0.36, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(drumBus);

    const dubTap = audioCtx.createGain();
    dubTap.gain.value = 0.15 + space * 0.68;
    gain.connect(dubTap);
    dubTap.connect(dubSend);
    dubTap.connect(reverbSend);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.02);
    osc2.stop(time + dur + 0.02);
    return;
  }

  // 5: Warm Tuned Latin Conga
  const dur = 0.09 + decParam * 0.26;
  const osc = audioCtx.createOscillator();
  const filt = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  const root = (155 + tone * 95) * pf;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(root * 1.55, time);
  osc.frequency.exponentialRampToValueAtTime(root, time + 0.048);

  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(420 + tone * 1100, time);
  filt.Q.value = 1.4;

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(accentScale * 0.52, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filt);
  filt.connect(gain);
  gain.connect(drumBus);

  const send = audioCtx.createGain();
  send.gain.value = 0.1 + space * 0.62;
  gain.connect(send);
  send.connect(reverbSend);
  if (space > 0.4 || state.fx.DUB) send.connect(dubSend);

  osc.start(time);
  osc.stop(time + dur + 0.03);

  const slap = audioCtx.createBufferSource();
  slap.buffer = noiseBuffer;
  const slapBp = audioCtx.createBiquadFilter();
  slapBp.type = 'bandpass';
  slapBp.frequency.value = 1400 * pf;
  slapBp.Q.value = 1.6;
  const slapG = audioCtx.createGain();
  slapG.gain.setValueAtTime(accentScale * 0.14, time);
  slapG.gain.exponentialRampToValueAtTime(0.001, time + 0.018);
  slap.connect(slapBp);
  slapBp.connect(slapG);
  slapG.connect(drumBus);
  slap.start(time, Math.random() * 0.6);
  slap.stop(time + 0.025);
}

// 3) DEEP WARM SUB / FM HOUSE ORGAN BASS (TONE, DECAY, SPACE, DRIVE)
function playBass(time, step, params) {
  const { audioCtx, dubSend, reverbSend } = getAudioNodes();
  const duckBus = getTrackInput('bs');
  const mood = getMood(state.moodId);
  const midi = typeof step.midi === 'number'
    ? step.midi
    : mood.bassMidi[step.note % mood.bassMidi.length];
  const freq = midiToFreq(midi) * getTapePitchFactor();
  const accentScale = step.accent ? 1.0 : 0.68;
  const { tone, decay: decParam, space } = params;
  const dur = 0.11 + decParam * 0.48;

  const carrier = audioCtx.createOscillator();
  const mod = audioCtx.createOscillator();
  const modGain = audioCtx.createGain();
  const sub = audioCtx.createOscillator();
  const filt = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  carrier.type = 'triangle';
  carrier.frequency.setValueAtTime(freq, time);

  mod.type = 'sine';
  mod.frequency.setValueAtTime(freq * 2, time);
  modGain.gain.setValueAtTime(freq * (0.2 + tone * 1.55), time);
  modGain.gain.exponentialRampToValueAtTime(1, time + 0.095);

  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq, time);

  filt.type = 'lowpass';
  const cutoff = 150 + tone * 1250;
  filt.frequency.setValueAtTime(cutoff * 2.1, time);
  filt.frequency.exponentialRampToValueAtTime(cutoff, time + 0.095);
  filt.Q.value = 1.5;

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(accentScale * 0.62, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(filt);
  sub.connect(filt);
  filt.connect(gain);
  gain.connect(duckBus);

  // Optional dub bass bounce via SPACE knob (high-passed so sub stays clean!)
  if (space > 0.2) {
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;
    const s = audioCtx.createGain();
    s.gain.value = (space - 0.2) * 0.5;
    gain.connect(hp);
    hp.connect(s);
    s.connect(dubSend);
    s.connect(reverbSend);
  }

  carrier.start(time);
  mod.start(time);
  sub.start(time);
  carrier.stop(time + dur + 0.03);
  mod.stop(time + dur + 0.03);
  sub.stop(time + dur + 0.03);
}

// 4) LUSH RHODES / JUNO-60 DEEP HOUSE CHORDS (TONE, DECAY, SPACE, DRIVE)
function playChord(time, step, params) {
  const { audioCtx, dubSend, reverbSend } = getAudioNodes();
  const duckBus = getTrackInput('ch');
  const mood = getMood(state.moodId);
  const notes = Array.isArray(step.notes) && step.notes.length > 0
    ? step.notes
    : (typeof step.midi === 'number'
      ? [step.midi]
      : mood.chords[step.note % mood.chords.length].notes);
  const accentScale = step.accent ? 1.0 : 0.62;
  const { tone, decay: decParam, space } = params;
  const dur = 0.14 + decParam * 0.92;
  const pf = getTapePitchFactor();

  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass';
  const baseCut = 300 + tone * 2800;
  filt.frequency.setValueAtTime(baseCut * 1.95, time);
  filt.frequency.exponentialRampToValueAtTime(baseCut, time + 0.14 + decParam * 0.12);
  filt.Q.value = 1.3;

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(accentScale * 0.36, time + 0.016);
  env.gain.exponentialRampToValueAtTime(0.001, time + dur);

  filt.connect(env);
  env.connect(duckBus);

  const sendDub = audioCtx.createGain();
  sendDub.gain.value = space * 0.68;
  env.connect(sendDub);
  sendDub.connect(dubSend);

  const sendRev = audioCtx.createGain();
  sendRev.gain.value = space * 0.85;
  env.connect(sendRev);
  sendRev.connect(reverbSend);

  const perVoiceGain = notes.length === 1 ? 0.52 : Math.min(0.32, 1.15 / notes.length);
  notes.forEach((m, idx) => {
    const f = midiToFreq(m) * pf;
    const oscA = audioCtx.createOscillator();
    const oscB = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();

    oscA.type = 'triangle';
    oscA.frequency.setValueAtTime(f, time);
    oscA.detune.value = idx % 2 === 0 ? -5 : 5;

    oscB.type = 'sawtooth';
    oscB.frequency.setValueAtTime(f, time);
    oscB.detune.value = idx % 2 === 0 ? 7 : -7;

    noteGain.gain.value = perVoiceGain;
    oscA.connect(noteGain);
    oscB.connect(noteGain);
    noteGain.connect(filt);

    oscA.start(time);
    oscB.start(time);
    oscA.stop(time + dur + 0.04);
    oscB.stop(time + dur + 0.04);
  });
}

// 5) DREAMY VOCAL CHOPS (Formant Synth OR Pitched Melodic Audio Sample)
function playVox(time, step, params) {
  const { audioCtx, dubSend, reverbSend, noiseBuffer } = getAudioNodes();
  const duckBus = getTrackInput('vx');
  const mood = getMood(state.moodId);
  const midi = typeof step.midi === 'number'
    ? step.midi
    : mood.voxMidi[step.note % mood.voxMidi.length];
  const accentScale = step.accent ? 1.0 : 0.62;
  const { tone, decay: decParam, space } = params;
  const dur = 0.1 + decParam * 0.56;
  const pf = getTapePitchFactor();

  // Mode A: User's Imported Audio or Mic Sample pitched across the scale
  if (state.voxUseMic && state.voxMicBuffer) {
    const src = audioCtx.createBufferSource();
    src.buffer = state.voxMicBuffer;
    const semitones = midi - mood.voxMidi[0];
    src.playbackRate.setValueAtTime(Math.pow(2, semitones / 12) * pf, time);

    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(650 + tone * 7200, time);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(accentScale * 0.82, time + 0.01);
    gain.gain.setValueAtTime(accentScale * 0.82, time + Math.max(0.02, dur - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(duckBus);

    const sDub = audioCtx.createGain();
    sDub.gain.value = space * 0.72;
    gain.connect(sDub);
    sDub.connect(dubSend);
    sDub.connect(reverbSend);

    src.start(time);
    src.stop(time + dur + 0.03);
    return;
  }

  // Mode B: Warm Breathy Formant Choir Chop
  const freq = midiToFreq(midi) * pf;
  const osc = audioCtx.createOscillator();
  const oscSub = audioCtx.createOscillator();
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);

  oscSub.type = 'triangle';
  oscSub.frequency.setValueAtTime(freq, time);
  oscSub.detune.value = 6;

  lfo.frequency.value = 5.2;
  lfoGain.gain.value = 4.2;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  const preLp = audioCtx.createBiquadFilter();
  preLp.type = 'lowpass';
  preLp.frequency.setValueAtTime(2800, time);

  osc.connect(preLp);
  oscSub.connect(preLp);

  const air = audioCtx.createBufferSource();
  air.buffer = noiseBuffer;
  const airGain = audioCtx.createGain();
  airGain.gain.value = 0.08;
  air.connect(airGain);
  airGain.connect(preLp);

  const vowels = [
    [320, 780, 2250],
    [480, 980, 2380],
    [710, 1140, 2480],
    [520, 1800, 2460]
  ];
  const vPos = tone * (vowels.length - 1);
  const vIdx = Math.min(vowels.length - 2, Math.floor(vPos));
  const vFrac = vPos - vIdx;

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(accentScale * 0.52, time + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, time + dur);

  for (let f = 0; f < 3; f++) {
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    const fHz = vowels[vIdx][f] + (vowels[vIdx + 1][f] - vowels[vIdx][f]) * vFrac;
    bp.frequency.setValueAtTime(fHz, time);
    bp.Q.value = f === 0 ? 5.2 : 6.6;

    const fg = audioCtx.createGain();
    fg.gain.value = f === 0 ? 0.92 : (f === 1 ? 0.62 : 0.30);

    preLp.connect(bp);
    bp.connect(fg);
    fg.connect(env);
  }

  env.connect(duckBus);

  const vDub = audioCtx.createGain();
  vDub.gain.value = space * 0.72;
  env.connect(vDub);
  vDub.connect(dubSend);

  const vRev = audioCtx.createGain();
  vRev.gain.value = space * 0.88;
  env.connect(vRev);
  vRev.connect(reverbSend);

  osc.start(time);
  oscSub.start(time);
  lfo.start(time);
  air.start(time, Math.random() * 0.8);

  osc.stop(time + dur + 0.04);
  oscSub.stop(time + dur + 0.04);
  lfo.stop(time + dur + 0.04);
  air.stop(time + dur + 0.04);
}

// 6) SMPL TRACK: 8-SLICE AUDIO CHOP SAMPLER OR 8 WARM ORGANIC HOUSE TEXTURES
function playSmpl(time, step, params) {
  const { audioCtx, dubSend, reverbSend, noiseBuffer } = getAudioNodes();
  const duckBus = getTrackInput('sm');
  const mood = getMood(state.moodId);
  const idx = step.note % 8;
  const accentScale = step.accent ? 1.0 : 0.6;
  const { tone, decay: decParam, space } = params;
  const pf = getTapePitchFactor();

  // Mode A: Custom Imported / Mic Audio auto-sliced into 8 playable chops (S1..S8)
  // OR pitched chromatically from slice 0 when played via Piano Keys!
  if (state.smplUseCustom && state.smplBuffer) {
    const buf = state.smplBuffer;
    const isChromatic = typeof step.midi === 'number';
    const sliceDur = buf.duration / 8;
    const startOffset = isChromatic ? 0 : idx * sliceDur;
    const rate = isChromatic ? Math.pow(2, (step.midi - 60) / 12) * pf : pf;
    const playDur = Math.max(0.06, Math.min(buf.duration - startOffset, 0.08 + decParam * Math.max(0.45, sliceDur * 1.4)));

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, time);

    // DJ-style Tone filter: left = warm lowpass, right = airy highpass/bright
    const filt = audioCtx.createBiquadFilter();
    if (tone < 0.5) {
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(420 + (tone * 2) * 11000, time);
    } else {
      filt.type = 'highpass';
      filt.frequency.setValueAtTime(40 + ((tone - 0.5) * 2) * 2400, time);
    }

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(accentScale * 0.84, time + 0.008);
    gain.gain.setValueAtTime(accentScale * 0.84, time + Math.max(0.02, playDur - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.001, time + playDur);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(duckBus);

    const sSend = audioCtx.createGain();
    sSend.gain.value = space * 0.72;
    gain.connect(sSend);
    sSend.connect(dubSend);
    sSend.connect(reverbSend);

    src.start(time, startOffset, playDur + 0.02);
    return;
  }

  // Mode B: 8 Built-In Sofia Kourtesis / Organic Microhouse Textures (always in key!)
  const rootMidi = mood.voxMidi[0];
  const scaleMidi = [
    rootMidi + 12,      // 0: MARIM (root octave)
    mood.voxMidi[4],    // 1: PLUCK (5th)
    mood.voxMidi[2] + 12, // 2: BELL (minor 3rd up)
    mood.voxMidi[0],    // 3: STAB (warm brass root)
    0,                  // 4: TAMB
    mood.voxMidi[6] + 12, // 5: WOOD kalimba
    mood.voxMidi[4] + 12, // 6: SHIM glass shimmer
    mood.voxMidi[0] + 7 // 7: AIR warm breath chord
  ];

  const outGain = audioCtx.createGain();
  outGain.connect(duckBus);

  const send = audioCtx.createGain();
  send.gain.value = 0.18 + space * 0.72;
  outGain.connect(send);
  send.connect(dubSend);
  send.connect(reverbSend);

  if (idx === 4) {
    // 4: TAMB (Crisp Organic Tambourine)
    const dur = 0.08 + decParam * 0.22;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((6200 + tone * 3500) * pf, time);
    bp.Q.value = 2.4;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(accentScale * 0.34, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(outGain);
    src.start(time, Math.random() * 0.7);
    src.stop(time + dur + 0.02);
    return;
  }

  if (idx === 7) {
    // 7: AIR (Dreamy filtered beach/breath pad wash)
    const dur = 0.28 + decParam * 0.75;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime((900 + tone * 2400) * pf, time);
    bp.Q.value = 3.2;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(accentScale * 0.24, time + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(outGain);
    src.start(time, Math.random() * 0.7);
    src.stop(time + dur + 0.03);
    return;
  }

  // Pitched organic instruments (MARIM, PLUCK, BELL, STAB, WOOD, SHIM)
  const f = midiToFreq(typeof step.midi === 'number' ? step.midi : scaleMidi[idx]) * pf;
  const dur = (idx === 0 || idx === 5 ? 0.14 : 0.22) + decParam * 0.55;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const filt = audioCtx.createBiquadFilter();
  const g = audioCtx.createGain();

  if (idx === 0 || idx === 5) {
    // MARIM / WOOD Kalimba: warm woody sine + 4x harmonic ping
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f, time);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f * (idx === 0 ? 4 : 2.98), time);
    const o2g = audioCtx.createGain();
    o2g.gain.setValueAtTime(0.28, time);
    o2g.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    osc2.connect(o2g);
    o2g.connect(filt);
  } else if (idx === 1) {
    // PLUCK: Nylon guitar pluck
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(f, time);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(f, time);
    osc2.detune.value = 4;
    osc2.connect(filt);
  } else if (idx === 2 || idx === 6) {
    // BELL / SHIM: Sunlit FM chime
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f, time);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f * (idx === 2 ? 2.5 : 3.01), time);
    const fmG = audioCtx.createGain();
    fmG.gain.setValueAtTime(f * (0.4 + tone * 1.1), time);
    fmG.gain.exponentialRampToValueAtTime(1, time + dur * 0.5);
    osc2.connect(fmG);
    fmG.connect(osc1.frequency);
  } else {
    // STAB: Warm muted analog brass stab
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(f, time);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(f * 1.498, time); // warm 5th
    osc2.connect(filt);
  }

  filt.type = 'lowpass';
  const cut = 520 + tone * 3600;
  filt.frequency.setValueAtTime(cut * 1.8, time);
  filt.frequency.exponentialRampToValueAtTime(cut, time + 0.12);
  filt.Q.value = 1.4;

  g.gain.setValueAtTime(0.001, time);
  g.gain.linearRampToValueAtTime(accentScale * 0.42, time + (idx === 3 ? 0.024 : 0.006));
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc1.connect(filt);
  filt.connect(g);
  g.connect(outGain);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + dur + 0.04);
  osc2.stop(time + dur + 0.04);
}

export function triggerChannelSound(chId, time, step) {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx) return;
  const params = state.trackParams[chId] || { tone: 0.55, decay: 0.5, space: 0.5, drive: 0.2 };
  switch (chId) {
    case 'bd': playKick(time, step, params); break;
    case 'pr': playPerc(time, step, params); break;
    case 'bs': playBass(time, step, params); break;
    case 'ch': playChord(time, step, params); break;
    case 'vx': playVox(time, step, params); break;
    case 'sm': playSmpl(time, step, params); break;
  }
}

// Expressive chromatic note playback for the integrated Minimal Piano Keyboard
export function triggerPianoNote(chId, midiNote, time) {
  const { audioCtx } = getAudioNodes();
  if (!audioCtx) return;
  const t = time ?? audioCtx.currentTime;
  if (chId === 'pr') {
    triggerChannelSound('pr', t, { on: true, note: Math.abs(midiNote) % 6, accent: 1 });
    return;
  }
  const adjustedMidi = chId === 'bs' ? Math.max(24, midiNote - 12) : midiNote;
  triggerChannelSound(chId, t, {
    on: true,
    note: state.selectedBrush[chId] || 0,
    accent: 1,
    midi: adjustedMidi
  });
}
