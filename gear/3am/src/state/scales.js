// Musical vocabulary for 3AM:
// Independent Keys (root pitch) + Night-Arc Mood Hours (01:00, 03:00, 05:00, 07:00)
// that transform harmonic color, chord voicings, synth timbre, and dub space in one tap.

export const LANES = [
  { id: 'sub', name: 'SUB', keyHint: 'A', defaultVal: 0, desc: 'Kick & rolling sub-bass' },
  { id: 'cut', name: 'CUT', keyHint: 'S', defaultVal: 0, desc: 'Micro-clicks, rims & foley' },
  { id: 'chd', name: 'CHD', keyHint: 'D', defaultVal: 0, desc: 'Parallel deep & dub chords' },
  { id: 'air', name: 'AIR', keyHint: 'F', defaultVal: 0, desc: 'Shuffled hats & grain dust' }
];

export const KEYS = [
  { id: 'f',  label: 'KEY F',  short: 'F',  bassRoot: 41, chordRoot: 53 }, // F2 / F3
  { id: 'c',  label: 'KEY C',  short: 'C',  bassRoot: 36, chordRoot: 48 }, // C2 / C3
  { id: 'd',  label: 'KEY D',  short: 'D',  bassRoot: 38, chordRoot: 50 }, // D2 / D3
  { id: 'a',  label: 'KEY A',  short: 'A',  bassRoot: 45, chordRoot: 57 }, // A2 / A3
  { id: 'g',  label: 'KEY G',  short: 'G',  bassRoot: 43, chordRoot: 55 }, // G2 / G3
  { id: 'eb', label: 'KEY Eb', short: 'Eb', bassRoot: 39, chordRoot: 51 }  // Eb2 / Eb3
];

const CHROMATIC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 4 Night-Arc Mood / Tone profiles — shift harmony + timbre without moving your anchors
export const HOURS = [
  {
    id: '01',
    label: '01:00',
    tag: 'WARM',
    desc: 'Warm soulful deep house · Rhodes bell & lush Dorian 9ths',
    scale: [0, 2, 3, 5, 7, 9, 10, 12], // Dorian
    subOffsets: [0, 0, 0, 3, 5, 7, 9, 12],
    chords: [
      { suffix: 'm9',   rootOff: 0,  intervals: [0, 3, 7, 10, 14] },
      { suffix: 'm11',  rootOff: 2,  intervals: [2, 5, 9, 12, 17] },
      { suffix: 'M9',   rootOff: 3,  intervals: [3, 7, 10, 14, 17] },
      { suffix: '13',   rootOff: 5,  intervals: [5, 9, 12, 15, 21] },
      { suffix: 'm9',   rootOff: 7,  intervals: [7, 10, 14, 17, 21] },
      { suffix: '6/9',  rootOff: 10, intervals: [-2, 2, 5, 7, 12] },
      { suffix: 'm11',  rootOff: 0,  intervals: [0, 3, 5, 10, 14] },
      { suffix: 'M9+',  rootOff: 3,  intervals: [15, 19, 22, 26, 29] }
    ],
    tone: {
      chordBright: 1.28,
      tineGain: 1.55,
      chordDecay: 1.15,
      chordWave: 'triangle',
      subWeight: 0.96,
      kickPunch: 1.16,
      dubDark: 1.22,
      dubFbBoost: -0.04,
      reverbScale: 0.92,
      satDrive: 3.4,
      airBright: 1.14,
      octaveLift: false
    }
  },
  {
    id: '03',
    label: '03:00',
    tag: 'MICRO',
    desc: 'Berlin 3 AM microhouse · tight woody clicks & dark minor-9th stabs',
    scale: [0, 2, 3, 5, 7, 8, 10, 12], // Natural Minor
    subOffsets: [0, 0, 0, 3, 5, 7, 10, 12],
    chords: [
      { suffix: 'm9',   rootOff: 0,  intervals: [0, 3, 7, 10, 14] },
      { suffix: 'm9',   rootOff: 5,  intervals: [5, 8, 12, 15, 19] },
      { suffix: 'M9',   rootOff: 3,  intervals: [3, 7, 10, 14, 17] },
      { suffix: 'm7',   rootOff: 7,  intervals: [7, 10, 14, 17] },
      { suffix: 'M7',   rootOff: 8,  intervals: [8, 12, 15, 19] },
      { suffix: '9s',   rootOff: 10, intervals: [-2, 3, 5, 10] },
      { suffix: 'm11',  rootOff: 0,  intervals: [0, 3, 5, 10, 14] },
      { suffix: 'm9+',  rootOff: 0,  intervals: [12, 15, 19, 22, 26] }
    ],
    tone: {
      chordBright: 1.0,
      tineGain: 1.0,
      chordDecay: 1.0,
      chordWave: 'sawtooth',
      subWeight: 1.0,
      kickPunch: 1.0,
      dubDark: 1.0,
      dubFbBoost: 0.0,
      reverbScale: 1.0,
      satDrive: 4.5,
      airBright: 1.0,
      octaveLift: false
    }
  },
  {
    id: '05',
    label: '05:00',
    tag: 'ABYSS',
    desc: 'Hypnotic 5 AM dub abyss · Phrygian tension, heavy sub & deep tape feedback',
    scale: [0, 1, 3, 5, 7, 8, 10, 12], // Phrygian
    subOffsets: [0, 0, 0, 1, 5, 7, 8, 12],
    chords: [
      { suffix: 'm7',   rootOff: 0,  intervals: [0, 3, 7, 10] },
      { suffix: 'M7',   rootOff: 1,  intervals: [1, 5, 8, 12] },
      { suffix: 'sus2', rootOff: 0,  intervals: [0, 2, 7, 12] },
      { suffix: 'm7b',  rootOff: 5,  intervals: [5, 8, 12, 15] },
      { suffix: '5th',  rootOff: 7,  intervals: [7, 12, 14, 19] },
      { suffix: 'b2m',  rootOff: 1,  intervals: [1, 7, 10, 13] },
      { suffix: 'm11',  rootOff: 0,  intervals: [0, 3, 5, 10, 12] },
      { suffix: 'dub',  rootOff: 10, intervals: [-2, 3, 7, 10] }
    ],
    tone: {
      chordBright: 0.62,
      tineGain: 0.30,
      chordDecay: 1.42,
      chordWave: 'sawtooth',
      subWeight: 1.24,
      kickPunch: 0.86,
      dubDark: 0.68,
      dubFbBoost: 0.13,
      reverbScale: 1.38,
      satDrive: 7.8,
      airBright: 0.72,
      octaveLift: false
    }
  },
  {
    id: '07',
    label: '07:00',
    tag: 'DAWN',
    desc: 'Afterhours morning light · lifted major-9th & 6/9 shimmer, airy highs',
    scale: [0, 2, 4, 5, 7, 9, 11, 12], // Major / Lydian-leaning warmth
    subOffsets: [0, 0, 0, 4, 5, 7, 9, 12],
    chords: [
      { suffix: 'M9',   rootOff: 0,  intervals: [0, 4, 7, 11, 14] },
      { suffix: '6/9',  rootOff: 5,  intervals: [5, 9, 12, 14, 19] },
      { suffix: 'm9',   rootOff: 9,  intervals: [9, 12, 16, 19, 23] },
      { suffix: 'm11',  rootOff: 2,  intervals: [2, 5, 9, 12, 17] },
      { suffix: 'add9', rootOff: 7,  intervals: [7, 11, 14, 19, 21] },
      { suffix: 'M7#',  rootOff: 5,  intervals: [5, 9, 11, 16, 19] },
      { suffix: 'M9+',  rootOff: 0,  intervals: [12, 16, 19, 23, 26] },
      { suffix: 'air',  rootOff: 7,  intervals: [14, 19, 23, 26, 31] }
    ],
    tone: {
      chordBright: 1.58,
      tineGain: 1.85,
      chordDecay: 1.28,
      chordWave: 'triangle',
      subWeight: 0.88,
      kickPunch: 0.94,
      dubDark: 1.44,
      dubFbBoost: 0.04,
      reverbScale: 1.28,
      satDrive: 2.6,
      airBright: 1.34,
      octaveLift: true
    }
  }
];

export const CUT_LABELS = ['CLK', 'RIM', 'CLP', 'WOD', 'TOM', 'TIK', 'PNG', 'BRS'];
export const AIR_LABELS = ['HAT', 'OPN', 'SHK', 'MIC', 'PUF', 'GRN', 'DST', 'SHM'];

export function getKey(keyId) {
  return KEYS.find(k => k.id === keyId) || KEYS[0];
}

export function getHour(hourId) {
  return HOURS.find(h => h.id === hourId) || HOURS[1]; // default 03:00
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getSubMidi(val, keyId, hourId) {
  const key = getKey(keyId);
  const hour = getHour(hourId);
  const v = Math.max(0, Math.min(7, Math.round(val)));
  return key.bassRoot + (hour.subOffsets[v] ?? 0);
}

export function getChordData(val, keyId, hourId) {
  const key = getKey(keyId);
  const hour = getHour(hourId);
  const idx = ((Math.round(val) % hour.chords.length) + hour.chords.length) % hour.chords.length;
  const spec = hour.chords[idx];
  const rootMidi = key.chordRoot;
  const noteName = CHROMATIC_NAMES[((rootMidi + spec.rootOff) % 12 + 12) % 12];
  return {
    label: `${noteName}${spec.suffix}`,
    midis: spec.intervals.map(semi => rootMidi + semi)
  };
}

export function getValueLabel(laneId, val, keyId, hourId) {
  const v = Math.max(0, Math.min(7, Math.round(val)));
  if (laneId === 'sub') {
    if (v === 0) return 'KCK';
    if (v === 1) return 'THP';
    const midi = getSubMidi(v, keyId, hourId);
    const note = CHROMATIC_NAMES[((midi % 12) + 12) % 12];
    return `SUB ${note}`;
  }
  if (laneId === 'cut') return CUT_LABELS[v] || 'CLK';
  if (laneId === 'chd') return getChordData(v, keyId, hourId).label;
  if (laneId === 'air') return AIR_LABELS[v] || 'HAT';
  return String(v);
}
