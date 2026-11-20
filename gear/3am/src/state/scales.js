// Musical vocabulary for 3AM: nocturnal deep-house moods, parallel minor-9/11 chords & lane specs.

export const LANES = [
  { id: 'sub', name: 'SUB', keyHint: 'A', defaultVal: 0, desc: 'Kick & rolling sub-bass' },
  { id: 'cut', name: 'CUT', keyHint: 'S', defaultVal: 0, desc: 'Micro-clicks, rims & foley' },
  { id: 'chd', name: 'CHD', keyHint: 'D', defaultVal: 0, desc: 'Parallel deep & dub chords' },
  { id: 'air', name: 'AIR', keyHint: 'F', defaultVal: 0, desc: 'Shuffled hats & grain dust' }
];

export const MOODS = [
  {
    id: 'fdor',
    label: 'F DOR',
    name: 'F Dorian',
    bassRoot: 41,  // F2
    chordRoot: 53, // F3
    scale: [0, 2, 3, 5, 7, 9, 10, 12],
    noteNames: ['F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb', 'F+'],
    chords: [
      { label: 'Fm9',   intervals: [0, 3, 7, 10, 14] },
      { label: 'Gm11',  intervals: [2, 5, 9, 12, 17] },
      { label: 'AbM9',  intervals: [3, 7, 10, 14, 15] },
      { label: 'Bbm9',  intervals: [5, 8, 12, 15, 19] },
      { label: 'Cm9',   intervals: [7, 10, 14, 17, 21] },
      { label: 'EbM9',  intervals: [-2, 2, 5, 9, 12] },
      { label: 'Fm11',  intervals: [0, 3, 5, 10, 14] },
      { label: 'Fm9+',  intervals: [12, 15, 19, 22, 26] }
    ]
  },
  {
    id: 'cmin',
    label: 'C MIN',
    name: 'C Minor',
    bassRoot: 36,  // C2
    chordRoot: 48, // C3
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    noteNames: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb', 'C+'],
    chords: [
      { label: 'Cm9',   intervals: [0, 3, 7, 10, 14] },
      { label: 'Fm9',   intervals: [5, 8, 12, 15, 19] },
      { label: 'EbM9',  intervals: [3, 7, 10, 14, 17] },
      { label: 'Gm7',   intervals: [7, 10, 14, 17] },
      { label: 'AbM7',  intervals: [8, 12, 15, 19] },
      { label: 'Bb9s',  intervals: [10, 15, 17, 22] },
      { label: 'Cm11',  intervals: [0, 3, 5, 10, 14] },
      { label: 'Cm9+',  intervals: [12, 15, 19, 22, 26] }
    ]
  },
  {
    id: 'ddor',
    label: 'D DOR',
    name: 'D Dorian',
    bassRoot: 38,  // D2
    chordRoot: 50, // D3
    scale: [0, 2, 3, 5, 7, 9, 10, 12],
    noteNames: ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D+'],
    chords: [
      { label: 'Dm9',   intervals: [0, 3, 7, 10, 14] },
      { label: 'Em7',   intervals: [2, 5, 9, 12] },
      { label: 'FM9',   intervals: [3, 7, 10, 14, 17] },
      { label: 'G9',    intervals: [5, 9, 12, 15, 19] },
      { label: 'Am9',   intervals: [7, 10, 14, 17, 21] },
      { label: 'CM9',   intervals: [-2, 2, 5, 9, 12] },
      { label: 'Dm11',  intervals: [0, 3, 5, 10, 14] },
      { label: 'Dm9+',  intervals: [12, 15, 19, 22, 26] }
    ]
  },
  {
    id: 'amin',
    label: 'A MIN',
    name: 'A Minor',
    bassRoot: 45,  // A2
    chordRoot: 57, // A3
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    noteNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A+'],
    chords: [
      { label: 'Am9',   intervals: [0, 3, 7, 10, 14] },
      { label: 'Dm9',   intervals: [5, 8, 12, 15, 19] },
      { label: 'CM9',   intervals: [3, 7, 10, 14, 17] },
      { label: 'Em7',   intervals: [7, 10, 14, 17] },
      { label: 'FM7',   intervals: [8, 12, 15, 19] },
      { label: 'G6/9',  intervals: [10, 14, 17, 19, 24] },
      { label: 'Am11',  intervals: [0, 3, 5, 10, 14] },
      { label: 'Am9+',  intervals: [12, 15, 19, 22, 26] }
    ]
  }
];

export const CUT_LABELS = ['CLK', 'RIM', 'CLP', 'WOD', 'TOM', 'TIK', 'PNG', 'BRS'];
export const AIR_LABELS = ['HAT', 'OPN', 'SHK', 'MIC', 'PUF', 'GRN', 'DST', 'SHM'];

export function getMood(moodId) {
  return MOODS.find(m => m.id === moodId) || MOODS[0];
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getSubMidi(val, moodId) {
  const mood = getMood(moodId);
  // val 0 = main kick, val 1 = low muted thump, val 2..7 = scale sub-bass notes
  const scaleOffsets = [0, 0, 0, 3, 5, 7, 10, 12];
  return mood.bassRoot + (scaleOffsets[val] ?? 0);
}

export function getValueLabel(laneId, val, moodId) {
  const v = Math.max(0, Math.min(7, Math.round(val)));
  const mood = getMood(moodId);
  if (laneId === 'sub') {
    if (v === 0) return 'KCK';
    if (v === 1) return 'THP';
    const noteMap = [0, 0, 0, 2, 3, 4, 6, 7];
    return `SUB ${mood.noteNames[noteMap[v]]}`;
  }
  if (laneId === 'cut') return CUT_LABELS[v] || 'CLK';
  if (laneId === 'chd') return mood.chords[v]?.label || 'm9';
  if (laneId === 'air') return AIR_LABELS[v] || 'HAT';
  return String(v);
}
