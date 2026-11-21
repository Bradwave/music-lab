// Procedural 12-bit "Sampled Jazz-Wax" Pressing Baker for DUST.
// Zero external audio files — renders authentic SP-1200 / Akai S950 style
// stereo micro-record buffers in memory:
//   - Modal vibraphone + Wurlitzer reed + muted horn jazz-house chord buffers
//   - Karplus-Strong plucked upright double-bass buffers
//   - Muffled sampled-record acoustic breakbeat kick & brushed jazz cymbals
//   - Physical modal percussion buffers (kalimba, wood, muted guitar, brush, stylus, glass)

import { getChordMidis, getBassMidi, midiToFreq } from '../state/scales.js';

const TAU = Math.PI * 2;

// Deterministic fast PRNG for reproducible pressing timbre
function makeRand(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * SP-1200 / Akai S950 12-bit vinyl-sampler conditioning:
 * Gentle 2x sample-and-hold warmth + 12-bit TPDF dither quantization +
 * 1-pole warm analog rolloff + transformer tanh glue + peak normalization.
 */
function conditionVintageBuffer(data, sampleRate, opts = {}) {
  const {
    decimate = 2,
    bits = 12,
    lpfHz = 6200,
    drive = 1.28,
    targetPeak = 0.88,
    rand = Math.random
  } = opts;

  const levels = Math.pow(2, bits - 1);
  const rc = 1 / (TAU * lpfHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  let hold = 0;
  let lp = 0;
  let dcX = 0;
  let dcY = 0;
  let peak = 1e-4;

  for (let i = 0; i < data.length; i++) {
    if (i % decimate === 0) {
      // Triangular dither before 12-bit quantization keeps quiet tails velvety
      const dither = (rand() - rand()) / levels;
      hold = Math.round((data[i] + dither) * levels) / levels;
    }
    // Gentle 1-pole analog filter + subtle transformer saturation
    lp += alpha * (hold - lp);
    const sat = Math.tanh(lp * drive) / Math.tanh(drive);

    // 1-pole DC blocker (~18 Hz) so resampled slices never click
    const y = sat - dcX + 0.996 * dcY;
    dcX = sat;
    dcY = y;

    data[i] = y;
    const abs = Math.abs(y);
    if (abs > peak) peak = abs;
  }

  const norm = targetPeak / peak;
  for (let i = 0; i < data.length; i++) {
    data[i] *= norm;
  }
}

/**
 * Bake a single stereo jazz-wax chord hit:
 *   Side A (Detroit): Warm Wurlitzer reed bite + vibraphone mallet + muted brass air
 *   Side B (Jelinek): Glassy modal vibraphone tines + Rhodes-harp micro-pluck + warm wax room
 */
function bakeChordBuffer(ctx, midis, sideId, seed) {
  const sr = ctx.sampleRate;
  const dur = 1.25;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const rand = makeRand(seed);
  const isJelinek = sideId === 'B';

  const noteCount = midis.length;
  const noteGain = 0.52 / Math.sqrt(noteCount);

  for (let n = 0; n < noteCount; n++) {
    const baseFreq = midiToFreq(midis[n]);
    // Gentle analog stereo spread across chord tones
    const pan = noteCount > 1 ? ((n / (noteCount - 1)) * 2 - 1) * 0.56 : 0;
    const gainL = Math.cos(((pan + 1) * Math.PI) / 4) * noteGain;
    const gainR = Math.sin(((pan + 1) * Math.PI) / 4) * noteGain;

    // Slight human jazz strum stagger (0..18ms)
    const startSample = Math.floor((n * (isJelinek ? 0.0022 : 0.0038) + rand() * 0.002) * sr);
    const detuneL = 1 + (rand() - 0.5) * 0.0035;
    const detuneR = 1 + (rand() - 0.5) * 0.0042;
    const ph0 = rand() * TAU;
    const vibRate = 4.6 + rand() * 1.1; // Vibraphone motor fan tremolo
    const f1L = baseFreq * detuneL;
    const f1R = baseFreq * detuneR;

    const decayMain = isJelinek ? (0.48 + rand() * 0.16) : (0.72 + rand() * 0.24);
    const decayOvertone = isJelinek ? 0.11 : 0.085;
    const decayBark = 0.042;

    for (let i = startSample; i < len; i++) {
      const t = (i - startSample) / sr;
      // Soft mallet / felt attack (4-8ms)
      const atk = Math.min(1, t / (isJelinek ? 0.0045 : 0.009));
      const envMain = atk * Math.exp(-t / decayMain);
      const envOver = atk * Math.exp(-t / decayOvertone);
      const envBark = atk * Math.exp(-t / decayBark);

      // Vibraphone fan tremolo gently blooms after attack
      const trem = 1 - (isJelinek ? 0.14 : 0.18) * Math.min(1, t * 3.5) * (0.5 + 0.5 * Math.sin(TAU * vibRate * t));

      const wL = TAU * f1L * t + ph0;
      const wR = TAU * f1R * t + ph0 + 0.22;

      // 1) Modal vibraphone fundamental + classic ~3.98x marimba/vibe bar overtone
      const vibeL = Math.sin(wL) * envMain * trem + Math.sin(wL * 3.98) * envOver * (isJelinek ? 0.34 : 0.18);
      const vibeR = Math.sin(wR) * envMain * trem + Math.sin(wR * 3.98) * envOver * (isJelinek ? 0.34 : 0.18);

      // 2) Wurlitzer 200A reed odd-harmonic warmth (2nd + 3rd + faint 5th)
      const wurlAmt = isJelinek ? 0.22 : 0.44;
      const wurlL = (Math.sin(wL * 2) * 0.28 * envMain + Math.sin(wL * 3) * 0.32 * envBark + Math.sin(wL * 5) * 0.12 * envBark) * wurlAmt;
      const wurlR = (Math.sin(wR * 2) * 0.28 * envMain + Math.sin(wR * 3) * 0.32 * envBark + Math.sin(wR * 5) * 0.12 * envBark) * wurlAmt;

      // 3) Soft muted-horn / Rhodes-air swell on Side A
      let brassL = 0;
      let brassR = 0;
      if (!isJelinek && n >= 1 && n <= 4) {
        const swell = Math.min(1, t / 0.09) * Math.exp(-t / 0.52);
        brassL = Math.sin(wL * 1.5 + Math.sin(wL) * 0.35) * swell * 0.14;
        brassR = Math.sin(wR * 1.5 + Math.sin(wR) * 0.35) * swell * 0.14;
      }

      L[i] += (vibeL + wurlL + brassL) * gainL;
      R[i] += (vibeR + wurlR + brassR) * gainR;
    }
  }

  // Faint baked-in jazz-record room dust + mallet air burst
  let roomL = 0;
  let roomR = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const airEnv = Math.exp(-t / 0.028) * 0.04 + Math.exp(-t / 0.9) * 0.008;
    const nL = (rand() * 2 - 1) * airEnv;
    const nR = (rand() * 2 - 1) * airEnv;
    roomL = roomL * 0.82 + nL * 0.18;
    roomR = roomR * 0.82 + nR * 0.18;
    L[i] += roomL;
    R[i] += roomR;
  }

  // Smooth fade-out at buffer tail
  const fadeSamples = Math.floor(0.06 * sr);
  for (let i = 0; i < fadeSamples; i++) {
    const g = i / fadeSamples;
    L[len - 1 - i] *= g;
    R[len - 1 - i] *= g;
  }

  conditionVintageBuffer(L, sr, {
    decimate: 2,
    bits: 12,
    lpfHz: isJelinek ? 6400 : 4800,
    drive: isJelinek ? 1.2 : 1.42,
    targetPeak: 0.85,
    rand
  });
  conditionVintageBuffer(R, sr, {
    decimate: 2,
    bits: 12,
    lpfHz: isJelinek ? 6400 : 4800,
    drive: isJelinek ? 1.2 : 1.42,
    targetPeak: 0.85,
    rand
  });

  return buf;
}

/**
 * Karplus-Strong Plucked Upright Double-Bass buffer:
 * Warm thumb-pluck excitation + damped waveguide string + wooden body resonance.
 */
function bakeUprightBassBuffer(ctx, midi, seed) {
  const sr = ctx.sampleRate;
  const dur = 0.58;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rand = makeRand(seed);

  const freq = midiToFreq(midi);
  const period = Math.max(24, Math.round(sr / freq));
  const ring = new Float32Array(period);

  // Soft fleshy thumb-pluck excitation (warm low-passed noise + fundamental sine)
  let lpEx = 0;
  for (let i = 0; i < period; i++) {
    const w = rand() * 2 - 1;
    lpEx = lpEx * 0.78 + w * 0.22;
    const bodyFund = Math.sin((TAU * i) / period) * 0.65;
    ring[i] = lpEx * 0.55 + bodyFund;
  }

  // Waveguide loop with realistic upright string damping + wooden body thump
  let ptr = 0;
  let prev = ring[period - 1];
  let body1 = 0;
  let body2 = 0;
  const decay = 0.9928; // Warm woody decay (not metallic guitar sustain)

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const cur = ring[ptr];
    const filtered = (cur * 0.56 + prev * 0.44) * decay;
    ring[ptr] = filtered;
    prev = cur;
    ptr = (ptr + 1) % period;

    // Subtle wooden double-bass fingerboard knock on first 22ms
    const fingerKnock = t < 0.026
      ? Math.sin(TAU * (155 - t * 2400) * t) * Math.exp(-t / 0.008) * 0.28
      : 0;

    // Warm low-mid upright chest resonance
    body1 += 0.055 * (filtered - body1);
    body2 += 0.018 * (filtered - body2);
    const bodyBoost = (body1 - body2) * 0.85;

    const env = Math.min(1, t / 0.0045) * Math.exp(-t / 0.34);
    out[i] = (filtered * 0.82 + bodyBoost + fingerKnock) * env;
  }

  conditionVintageBuffer(out, sr, {
    decimate: 2,
    bits: 12,
    lpfHz: 1150,
    drive: 1.5,
    targetPeak: 0.9,
    rand
  });

  return buf;
}

/**
 * Muffled Sampled-Record Acoustic Breakbeat Kick:
 * Warm low-mid chest + felt beater knock + tiny vintage room-mic tail + brushed snare sympathy.
 */
function bakeAcousticKickBuffer(ctx) {
  const sr = ctx.sampleRate;
  const dur = 0.34;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rand = makeRand(9091);

  let phase = 0;
  let beaterPhase = 0;
  let roomLp = 0;
  let wireBp = 0;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Soft acoustic drum-skin pitch contour (warmer & rounder than 909)
    const f = 49 + 96 * Math.exp(-t / 0.022) + 22 * Math.exp(-t / 0.075);
    phase += (TAU * f) / sr;
    const skin = Math.sin(phase) * Math.min(1, t / 0.003) * Math.exp(-t / 0.135);

    // Felt beater woody chest knock (~175 Hz)
    beaterPhase += (TAU * (175 - 45 * Math.min(1, t * 28))) / sr;
    const knock = Math.sin(beaterPhase) * Math.exp(-t / 0.016) * 0.34;

    // Warm dusty room-mic ambience + whisper of snare wire sympathy
    const n = rand() * 2 - 1;
    roomLp = roomLp * 0.88 + n * 0.12;
    wireBp = wireBp * 0.52 + (n - roomLp) * 0.48;
    const roomEnv = Math.exp(-t / 0.062) * 0.16;
    const wireEnv = Math.exp(-t / 0.032) * 0.055;

    out[i] = skin * 0.96 + knock + roomLp * roomEnv + wireBp * wireEnv;
  }

  conditionVintageBuffer(out, sr, {
    decimate: 2,
    bits: 12,
    lpfHz: 2400,
    drive: 1.55,
    targetPeak: 0.94,
    rand
  });

  return buf;
}

/**
 * Brushed Jazz Cymbal / Vinyl Shaker buffers (metallic modal bands + silky brush noise).
 */
function bakeBrushCymbalBuffer(ctx, isRide = false) {
  const sr = ctx.sampleRate;
  const dur = isRide ? 0.44 : 0.13;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const rand = makeRand(isRide ? 7731 : 7717);

  // Bronze cymbal inharmonic modal partials
  const ratios = isRide
    ? [3120, 4290, 5680, 6910, 8450, 10200]
    : [4650, 6120, 7490, 8920, 10450];
  const phases = ratios.map(() => rand() * TAU);

  let hpPrev = 0;
  let xPrev = 0;

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const atk = Math.min(1, t / (isRide ? 0.011 : 0.008));
    const env = atk * Math.exp(-t / (isRide ? 0.145 : 0.036));

    // Silky high-passed brush sweep
    const raw = rand() * 2 - 1;
    const hp = 0.72 * (hpPrev + raw - xPrev);
    hpPrev = hp;
    xPrev = raw;

    let metal = 0;
    for (let m = 0; m < ratios.length; m++) {
      phases[m] += (TAU * ratios[m]) / sr;
      metal += Math.sin(phases[m]) * (1 / (m + 1.4));
    }

    out[i] = (hp * 0.62 + metal * (isRide ? 0.28 : 0.16)) * env;
  }

  conditionVintageBuffer(out, sr, {
    decimate: 2,
    bits: 12,
    lpfHz: isRide ? 9800 : 8800,
    drive: 1.15,
    targetPeak: 0.82,
    rand
  });

  return buf;
}

/**
 * 6 Physical / Vinyl Modal Micro-Percussion Buffers for Dust Specks:
 *   0: Kalimba / Vibe tine ping
 *   1: Woody marimba / hollow clave
 *   2: Muted jazz-guitar dead chuck
 *   3: Brushed jazz snare ghost tap
 *   4: Stylus needle bump / vinyl pop
 *   5: Resonant glass / bell overtone
 */
function bakeModalPercBuffers(ctx) {
  const sr = ctx.sampleRate;
  const buffers = [];

  // 0: Kalimba / vibraphone tine ping
  {
    const len = Math.floor(sr * 0.24);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3101);
    const f0 = 698.46; // F5
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const atk = Math.min(1, t / 0.002);
      const s =
        Math.sin(TAU * f0 * t) * Math.exp(-t / 0.085) +
        Math.sin(TAU * f0 * 2.76 * t) * Math.exp(-t / 0.022) * 0.42 +
        Math.sin(TAU * f0 * 5.4 * t) * Math.exp(-t / 0.009) * 0.18;
      d[i] = s * atk;
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 7000, drive: 1.2, targetPeak: 0.86, rand });
    buffers.push(buf);
  }

  // 1: Woody marimba / hollow clave knock
  {
    const len = Math.floor(sr * 0.14);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3102);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = 520 * (1 + 0.18 * Math.exp(-t / 0.006));
      const s =
        Math.sin(TAU * f * t) * Math.exp(-t / 0.032) +
        Math.sin(TAU * f * 3.92 * t) * Math.exp(-t / 0.008) * 0.35;
      d[i] = s * Math.min(1, t / 0.0015);
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 5200, drive: 1.35, targetPeak: 0.88, rand });
    buffers.push(buf);
  }

  // 2: Muted jazz-guitar dead chuck (short strummed chord scrape)
  {
    const len = Math.floor(sr * 0.11);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3103);
    const strings = [196, 261.6, 329.6, 440];
    for (let sIdx = 0; sIdx < strings.length; sIdx++) {
      const start = Math.floor(sIdx * 0.0045 * sr);
      const f = strings[sIdx];
      let lp = 0;
      for (let i = start; i < len; i++) {
        const t = (i - start) / sr;
        const n = (rand() * 2 - 1) * Math.exp(-t / 0.011);
        lp = lp * 0.6 + n * 0.4;
        d[i] += (Math.sin(TAU * f * t) * Math.exp(-t / 0.022) * 0.45 + lp * 0.55) * 0.45;
      }
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 3800, drive: 1.45, targetPeak: 0.86, rand });
    buffers.push(buf);
  }

  // 3: Brushed jazz snare ghost tap
  {
    const len = Math.floor(sr * 0.15);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3104);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const n = rand() * 2 - 1;
      lp = lp * 0.55 + n * 0.45;
      const head = Math.sin(TAU * 215 * t) * Math.exp(-t / 0.028) * 0.34;
      const brush = (n - lp * 0.5) * Math.min(1, t / 0.006) * Math.exp(-t / 0.042) * 0.72;
      d[i] = head + brush;
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 6800, drive: 1.3, targetPeak: 0.86, rand });
    buffers.push(buf);
  }

  // 4: Stylus needle bump / tactile vinyl pop
  {
    const len = Math.floor(sr * 0.09);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3105);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const bump = Math.sin(TAU * (120 + 180 * Math.exp(-t / 0.007)) * t) * Math.exp(-t / 0.018) * 0.75;
      const tick = t < 0.003 ? (rand() * 2 - 1) * (1 - t / 0.003) * 0.95 : 0;
      d[i] = bump + tick;
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 5600, drive: 1.4, targetPeak: 0.88, rand });
    buffers.push(buf);
  }

  // 5: Resonant hollow glass / harmonic bell
  {
    const len = Math.floor(sr * 0.30);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const rand = makeRand(3106);
    const f0 = 1046.5;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const atk = Math.min(1, t / 0.004);
      const s =
        Math.sin(TAU * f0 * t) * Math.exp(-t / 0.12) * 0.65 +
        Math.sin(TAU * f0 * 2.01 * t) * Math.exp(-t / 0.07) * 0.25 +
        Math.sin(TAU * f0 * 3.04 * t) * Math.exp(-t / 0.03) * 0.12;
      d[i] = s * atk;
    }
    conditionVintageBuffer(d, sr, { decimate: 2, bits: 12, lpfHz: 7500, drive: 1.15, targetPeak: 0.82, rand });
    buffers.push(buf);
  }

  return buffers;
}

/**
 * Stereo warm vinyl surface rumble + gentle organic crackle loop (4.0s).
 */
export function bakeVinylBedBuffer(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 4.0);
  const buf = ctx.createBuffer(2, len, sr);
  const rand = makeRand(3333);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let brown = 0;
    let hiss = 0;
    let popVal = 0;
    for (let i = 0; i < len; i++) {
      const w = rand() * 2 - 1;
      brown = brown * 0.985 + w * 0.015;
      hiss = hiss * 0.84 + w * 0.16;

      // Occasional warm microscopic vinyl dust ticks
      if (rand() < 0.00028) {
        popVal = (rand() * 2 - 1) * (0.14 + rand() * 0.22);
      } else {
        popVal *= 0.62;
      }

      d[i] = brown * 0.22 + hiss * 0.018 + popVal;
    }
  }
  return buf;
}

// Pressing cache so we only re-bake pitched chords & bass when Side or Key changes
let cachedStatic = null;
let cachedPressing = null;
let cachedSignature = '';

export function ensurePressing(ctx, sideId, keyId) {
  if (!cachedStatic) {
    cachedStatic = {
      kick: bakeAcousticKickBuffer(ctx),
      brushHat: bakeBrushCymbalBuffer(ctx, false),
      brushRide: bakeBrushCymbalBuffer(ctx, true),
      modalPercs: bakeModalPercBuffers(ctx),
      vinylBed: bakeVinylBedBuffer(ctx)
    };
  }

  const sig = `${sideId}:${keyId}`;
  if (!cachedPressing || cachedSignature !== sig) {
    const chords = [];
    for (let i = 0; i < 6; i++) {
      const midis = getChordMidis(sideId, keyId, i);
      chords.push(bakeChordBuffer(ctx, midis, sideId, (sideId === 'B' ? 5000 : 1000) + i * 97 + keyId.charCodeAt(0) * 13));
    }

    const basses = [];
    for (let i = 0; i < 8; i++) {
      const midi = getBassMidi(sideId, keyId, i);
      basses.push(bakeUprightBassBuffer(ctx, midi, 8000 + i * 71 + keyId.charCodeAt(0) * 17));
    }

    cachedPressing = { chords, basses };
    cachedSignature = sig;
  }

  return {
    ...cachedStatic,
    ...cachedPressing
  };
}
