// Musical scales & spatial pitch mapping for PRISM.
// Grid X maps horizontally across scale degrees; Y maps octave/register (higher Y = higher pitch).

export const SCALES = [
  {
    id: 'd_dorian',
    name: 'D DORIAN',
    short: 'D DOR',
    rootMidi: 50, // D3
    bassMidi: 38, // D2
    intervals: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19]
  },
  {
    id: 'f_phrygian',
    name: 'F PHRYGIAN',
    short: 'F PHR',
    rootMidi: 53, // F3
    bassMidi: 41, // F2
    intervals: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19]
  },
  {
    id: 'a_min9',
    name: 'A MINOR 9',
    short: 'A MIN9',
    rootMidi: 45, // A2
    bassMidi: 33, // A1
    intervals: [0, 2, 3, 7, 10, 12, 14, 15, 19, 22, 24, 26]
  },
  {
    id: 'c_lydian',
    name: 'C LYDIAN',
    short: 'C LYD',
    rootMidi: 48, // C3
    bassMidi: 36, // C2
    intervals: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19]
  },
  {
    id: 'g_minor',
    name: 'G MINOR',
    short: 'G MIN',
    rootMidi: 43, // G2
    bassMidi: 31, // G1
    intervals: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19]
  },
  {
    id: 'eb_hirajoshi',
    name: 'Eb JAPANESE',
    short: 'Eb JPN',
    rootMidi: 51, // Eb3
    bassMidi: 39, // Eb2
    intervals: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20, 24, 26]
  }
];

export function getScale(id) {
  return SCALES.find((s) => s.id === id) || SCALES[0];
}

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Map a grid cell (x: 0..11, y: 0..11) + pulse octaveShift to a musical MIDI note.
 * Higher on the bench (smaller y) = brighter / higher octave.
 */
export function cellToMidi(scaleId, x, y, octaveShift = 0) {
  const scale = getScale(scaleId);
  const idx = ((x % scale.intervals.length) + scale.intervals.length) % scale.intervals.length;
  // Invert Y so top of optical bench is higher pitch, bottom is warmer/lower
  const yOctave = y <= 3 ? 12 : y >= 8 ? -12 : 0;
  const shiftSemi = Math.max(-1, Math.min(2, octaveShift)) * 12;
  const midi = scale.rootMidi + scale.intervals[idx] + yOctave + shiftSemi;
  return Math.max(36, Math.min(96, midi));
}

/**
 * Map a Bass Coil position to a grounded low-end scale degree.
 */
export function cellToBassMidi(scaleId, x, y) {
  const scale = getScale(scaleId);
  // Favor root, fifth, fourth, minor third / seventh for strong harmonic anchor
  const bassDegrees = [0, 0, 2, 3, 4, 4, 6, 0, 4, 3, 2, 0];
  const deg = bassDegrees[((x + y) % bassDegrees.length + bassDegrees.length) % bassDegrees.length];
  const semi = scale.intervals[deg % scale.intervals.length] % 12;
  return Math.max(28, Math.min(52, scale.bassMidi + semi));
}

/**
 * Build a 3-note lush chord for Super-Nova beam collisions.
 */
export function cellToChordMidis(scaleId, x, y, octaveShift = 0) {
  const scale = getScale(scaleId);
  const len = scale.intervals.length;
  const baseIdx = ((x + (11 - y)) % 7 + 7) % 7;
  const oct = Math.max(-1, Math.min(1, octaveShift)) * 12;
  const n0 = scale.rootMidi + scale.intervals[baseIdx % len] + oct;
  const n1 = scale.rootMidi + scale.intervals[(baseIdx + 2) % len] + oct;
  const n2 = scale.rootMidi + scale.intervals[(baseIdx + 4) % len] + oct + 12;
  return [n0, n1, n2].map((m) => Math.max(40, Math.min(96, m)));
}
