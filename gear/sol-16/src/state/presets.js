import { CHANNELS } from './scales.js';

export const PATTERN_COUNT = 8;
export const PATTERN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const PATTERN_NAMES = [
  'LA PERLA',
  'BREAK',
  'MICRO',
  'SUNRISE',
  'SLOT E',
  'SLOT F',
  'SLOT G',
  'SLOT H'
];

export function makeStep(on = false, note = 0, accent = 1) {
  return { on, note, accent };
}

export function createEmptyPattern() {
  const pat = {};
  CHANNELS.forEach(c => {
    pat[c.id] = Array.from({ length: 16 }, () => makeStep(false, 0, 1));
  });
  return pat;
}

export function createDefaultTrackParams() {
  const params = {};
  CHANNELS.forEach(c => {
    params[c.id] = {
      tone: c.defaultTone,
      decay: c.defaultDecay,
      space: c.defaultSpace
    };
  });
  return params;
}

export function createDemoPatterns() {
  const patterns = Array.from({ length: PATTERN_COUNT }, () => createEmptyPattern());

  // --- PATTERN A: "LA PERLA" — Sunlit 123 BPM Deep House ---
  const pA = patterns[0];
  [0, 4, 8, 12].forEach(i => { pA.bd[i] = makeStep(true, 0, 1); });
  pA.bd[15] = makeStep(true, 2, 0);

  pA.pr[1]  = makeStep(true, 2, 0);
  pA.pr[2]  = makeStep(true, 1, 1);
  pA.pr[3]  = makeStep(true, 5, 0);
  pA.pr[4]  = makeStep(true, 3, 1);
  pA.pr[5]  = makeStep(true, 4, 1);
  pA.pr[6]  = makeStep(true, 0, 1);
  pA.pr[7]  = makeStep(true, 2, 0);
  pA.pr[9]  = makeStep(true, 2, 0);
  pA.pr[10] = makeStep(true, 1, 1);
  pA.pr[11] = makeStep(true, 5, 1);
  pA.pr[12] = makeStep(true, 3, 1);
  pA.pr[13] = makeStep(true, 4, 0);
  pA.pr[14] = makeStep(true, 0, 1);
  pA.pr[15] = makeStep(true, 2, 1);

  pA.bs[0]  = makeStep(true, 0, 1);
  pA.bs[3]  = makeStep(true, 0, 0);
  pA.bs[6]  = makeStep(true, 2, 1);
  pA.bs[10] = makeStep(true, 3, 1);
  pA.bs[12] = makeStep(true, 4, 1);
  pA.bs[14] = makeStep(true, 6, 0);

  pA.ch[0]  = makeStep(true, 0, 1);
  pA.ch[3]  = makeStep(true, 0, 0);
  pA.ch[6]  = makeStep(true, 2, 1);
  pA.ch[11] = makeStep(true, 3, 1);
  pA.ch[14] = makeStep(true, 6, 0);

  pA.vx[2]  = makeStep(true, 4, 1);
  pA.vx[5]  = makeStep(true, 6, 0);
  pA.vx[8]  = makeStep(true, 0, 1);
  pA.vx[13] = makeStep(true, 2, 1);

  // Organic marimba/tambourine accents on SMPL
  pA.sm[3]  = makeStep(true, 0, 1); // MARIM
  pA.sm[7]  = makeStep(true, 4, 0); // TAMB
  pA.sm[11] = makeStep(true, 1, 1); // PLUCK
  pA.sm[15] = makeStep(true, 5, 0); // WOOD

  // --- PATTERN B: "BREAK" — Lush Sunlit Breakdown ---
  const pB = patterns[1];
  pB.bd[0]  = makeStep(true, 1, 1);
  pB.bd[8]  = makeStep(true, 1, 0);

  [1, 3, 5, 7, 9, 11, 13, 15].forEach((s, idx) => {
    pB.pr[s] = makeStep(true, 2, idx % 2);
  });
  pB.pr[2]  = makeStep(true, 5, 1);
  pB.pr[6]  = makeStep(true, 4, 1);
  pB.pr[10] = makeStep(true, 5, 1);
  pB.pr[14] = makeStep(true, 1, 0);

  pB.bs[0]  = makeStep(true, 0, 1);
  pB.bs[8]  = makeStep(true, 2, 1);

  pB.ch[0]  = makeStep(true, 0, 1);
  pB.ch[4]  = makeStep(true, 4, 1);
  pB.ch[8]  = makeStep(true, 2, 1);
  pB.ch[12] = makeStep(true, 3, 1);

  pB.vx[4]  = makeStep(true, 6, 1);
  pB.vx[12] = makeStep(true, 4, 1);

  pB.sm[0]  = makeStep(true, 6, 0); // SHIM
  pB.sm[6]  = makeStep(true, 2, 1); // BELL
  pB.sm[14] = makeStep(true, 7, 0); // AIR

  // --- PATTERN C: "MICRO" — Hypnotic Minimal Microhouse ---
  const pC = patterns[2];
  [0, 4, 8, 12].forEach(i => { pC.bd[i] = makeStep(true, 3, 1); });

  pC.pr[2]  = makeStep(true, 0, 1);
  pC.pr[3]  = makeStep(true, 4, 0);
  pC.pr[4]  = makeStep(true, 3, 0);
  pC.pr[6]  = makeStep(true, 1, 0);
  pC.pr[7]  = makeStep(true, 5, 1);
  pC.pr[10] = makeStep(true, 0, 1);
  pC.pr[12] = makeStep(true, 3, 1);
  pC.pr[14] = makeStep(true, 4, 1);
  pC.pr[15] = makeStep(true, 0, 0);

  pC.bs[2]  = makeStep(true, 0, 1);
  pC.bs[5]  = makeStep(true, 0, 0);
  pC.bs[7]  = makeStep(true, 3, 1);
  pC.bs[10] = makeStep(true, 0, 1);
  pC.bs[14] = makeStep(true, 6, 1);

  pC.ch[2]  = makeStep(true, 7, 1);
  pC.ch[9]  = makeStep(true, 2, 0);
  pC.ch[14] = makeStep(true, 4, 1);

  pC.vx[6]  = makeStep(true, 4, 0);
  pC.vx[11] = makeStep(true, 2, 1);

  pC.sm[1]  = makeStep(true, 5, 0); // WOOD
  pC.sm[5]  = makeStep(true, 0, 0); // MARIM
  pC.sm[9]  = makeStep(true, 5, 1); // WOOD
  pC.sm[13] = makeStep(true, 1, 1); // PLUCK

  // --- PATTERN D: "SUNRISE" — Uplifting Euphoric Lift ---
  const pD = patterns[3];
  [0, 4, 8, 12].forEach(i => { pD.bd[i] = makeStep(true, 0, 1); });
  pD.bd[14] = makeStep(true, 2, 0);

  [2, 6, 10, 14].forEach(i => { pD.pr[i] = makeStep(true, 1, 1); });
  pD.pr[4]  = makeStep(true, 3, 1);
  pD.pr[12] = makeStep(true, 3, 1);
  [1, 5, 9, 13].forEach(i => { pD.pr[i] = makeStep(true, 2, 0); });
  pD.pr[7]  = makeStep(true, 5, 1);
  pD.pr[15] = makeStep(true, 5, 1);

  pD.bs[0]  = makeStep(true, 2, 1);
  pD.bs[3]  = makeStep(true, 2, 0);
  pD.bs[6]  = makeStep(true, 3, 1);
  pD.bs[8]  = makeStep(true, 4, 1);
  pD.bs[11] = makeStep(true, 6, 0);
  pD.bs[14] = makeStep(true, 7, 1);

  pD.ch[0]  = makeStep(true, 2, 1);
  pD.ch[3]  = makeStep(true, 2, 0);
  pD.ch[6]  = makeStep(true, 3, 1);
  pD.ch[10] = makeStep(true, 7, 1);
  pD.ch[14] = makeStep(true, 6, 1);

  pD.vx[0]  = makeStep(true, 4, 1);
  pD.vx[6]  = makeStep(true, 6, 1);
  pD.vx[10] = makeStep(true, 2, 0);
  pD.vx[14] = makeStep(true, 4, 1);

  pD.sm[2]  = makeStep(true, 4, 1); // TAMB
  pD.sm[6]  = makeStep(true, 3, 0); // STAB
  pD.sm[10] = makeStep(true, 4, 1); // TAMB
  pD.sm[12] = makeStep(true, 2, 1); // BELL

  return patterns;
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function generateTrackGroove(chId) {
  const steps = Array.from({ length: 16 }, () => makeStep(false, 0, 1));

  if (chId === 'bd') {
    const templates = [
      () => {
        [0, 4, 8, 12].forEach(i => { steps[i] = makeStep(true, 0, 1); });
        if (Math.random() > 0.35) steps[pick([14, 15])] = makeStep(true, 2, 0);
      },
      () => {
        [0, 4, 8, 12].forEach(i => { steps[i] = makeStep(true, 1, 1); });
        steps[7] = makeStep(true, 2, 0);
      },
      () => {
        [0, 4, 10, 12].forEach(i => { steps[i] = makeStep(true, 0, 1); });
        steps[15] = makeStep(true, 2, 0);
      }
    ];
    pick(templates)();
    return steps;
  }

  if (chId === 'pr') {
    steps[4] = makeStep(true, 3, 1);
    steps[12] = makeStep(true, 3, 1);
    [2, 6, 10, 14].forEach(i => {
      steps[i] = makeStep(true, Math.random() > 0.4 ? 1 : 0, Math.random() > 0.3 ? 1 : 0);
    });
    [1, 3, 5, 7, 9, 11, 13, 15].forEach(i => {
      if (Math.random() > 0.32) {
        steps[i] = makeStep(true, pick([2, 2, 4, 5, 0]), Math.random() > 0.55 ? 1 : 0);
      }
    });
    return steps;
  }

  if (chId === 'bs') {
    const rhythms = [
      [0, 3, 6, 10, 14],
      [0, 2, 6, 8, 11, 14],
      [2, 5, 7, 10, 14],
      [0, 3, 8, 10, 12, 15]
    ];
    const pool = [0, 0, 0, 2, 3, 4, 6];
    pick(rhythms).forEach((s, idx) => {
      steps[s] = makeStep(true, idx === 0 ? 0 : pick(pool), idx % 3 === 1 ? 0 : 1);
    });
    return steps;
  }

  if (chId === 'ch') {
    const chordRhythms = [
      [0, 3, 6, 11, 14],
      [0, 6, 10, 14],
      [0, 4, 11, 14],
      [2, 6, 11, 15]
    ];
    const chords = [0, 0, 2, 3, 4, 6, 7];
    pick(chordRhythms).forEach((s, idx) => {
      steps[s] = makeStep(true, idx === 0 ? pick([0, 7]) : pick(chords), idx === 1 ? 0 : 1);
    });
    return steps;
  }

  if (chId === 'sm') {
    const slots = [1, 3, 5, 7, 9, 11, 13, 15];
    const pickedSlots = slots.filter(() => Math.random() > 0.48);
    if (pickedSlots.length < 2) pickedSlots.push(3, 11);
    pickedSlots.forEach((s, idx) => {
      steps[s] = makeStep(true, idx % 8 === 0 ? pick([0, 1, 2, 3]) : Math.floor(Math.random() * 8), Math.random() > 0.4 ? 1 : 0);
    });
    return steps;
  }

  // VOX
  const voxSlots = [2, 5, 7, 8, 11, 13, 15];
  const voxNotes = [0, 2, 3, 4, 6];
  let count = 0;
  voxSlots.forEach(s => {
    if (Math.random() > 0.52 && count < 4) {
      steps[s] = makeStep(true, pick(voxNotes), Math.random() > 0.4 ? 1 : 0);
      count++;
    }
  });
  if (count === 0) {
    steps[2] = makeStep(true, 4, 1);
    steps[11] = makeStep(true, 2, 1);
  }
  return steps;
}
