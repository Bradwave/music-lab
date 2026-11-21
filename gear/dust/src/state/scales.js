// Musical vocabulary for DUST:
// Smoky Detroit jazz-house & Jan Jelinek loop-finding chord clusters,
// upright bass scales, and Focus Band radial mapping.

export const KEYS = [
  { id: 'f',  label: 'F',  bassRoot: 41, chordRoot: 53 }, // F2 / F3
  { id: 'eb', label: 'Eb', bassRoot: 39, chordRoot: 51 }, // Eb2 / Eb3
  { id: 'g',  label: 'G',  bassRoot: 43, chordRoot: 55 }, // G2 / G3
  { id: 'bb', label: 'Bb', bassRoot: 46, chordRoot: 58 }  // Bb2 / Bb3
];

export const SIDES = {
  A: {
    id: 'A',
    name: 'DETROIT',
    stamp: 'SIDE A',
    subtitle: 'JAZZ WAX',
    defaultBpm: 120,
    // Smoky jazz-house voicings (Moodymann / Theo Parrish / St Germain)
    chords: [
      { name: 'm11',     intervals: [0, 3, 7, 10, 14, 17] },
      { name: 'Maj7#11', intervals: [3, 7, 10, 14, 17, 21] },
      { name: '13sus4',  intervals: [5, 10, 12, 15, 19, 21] },
      { name: '6/9',     intervals: [0, 4, 7, 9, 14] },
      { name: 'm9',      intervals: [7, 10, 14, 17, 21] },
      { name: 'dom9',    intervals: [-2, 2, 5, 8, 12] }
    ],
    bassIntervals: [0, 0, 3, 5, 7, 10, 12, 14],
    swingBase: 0.34,      // Wide MPC-style pocket
    phaserMix: 0.42,
    chorusMix: 0.34,
    roomMix: 0.38
  },
  B: {
    id: 'B',
    name: 'JELINEK',
    stamp: 'SIDE B',
    subtitle: 'MICRO WAX',
    defaultBpm: 124,
    // Hypnotic quartal & suspended clusters (Loop-Finding-Jazz-Records)
    chords: [
      { name: 'quartal', intervals: [0, 5, 10, 15, 19] },
      { name: 'sus2/9',  intervals: [2, 7, 12, 14, 19] },
      { name: 'm11-4',   intervals: [5, 10, 14, 17, 22] },
      { name: '6/9',     intervals: [3, 7, 10, 12, 17] },
      { name: 'add9',    intervals: [7, 11, 14, 19, 21] },
      { name: 'glass9',  intervals: [-2, 3, 7, 12, 17] }
    ],
    bassIntervals: [0, 0, 2, 5, 7, 10, 12, 15],
    swingBase: 0.24,      // Tighter hypnotic micro-shuffle
    phaserMix: 0.28,
    chorusMix: 0.48,
    roomMix: 0.26
  }
};

export function getKey(keyId) {
  return KEYS.find((k) => k.id === keyId) || KEYS[0];
}

export function getSide(sideId) {
  return SIDES[sideId] || SIDES.A;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getChordMidis(sideId, keyId, chordIdx) {
  const side = getSide(sideId);
  const key = getKey(keyId);
  const chord = side.chords[((chordIdx % side.chords.length) + side.chords.length) % side.chords.length];
  return chord.intervals.map((iv) => key.chordRoot + iv);
}

export function getBassMidi(sideId, keyId, degIdx) {
  const side = getSide(sideId);
  const key = getKey(keyId);
  const arr = side.bassIntervals;
  const iv = arr[((degIdx % arr.length) + arr.length) % arr.length];
  return key.bassRoot + iv;
}

/**
 * Focus Band attenuation curve:
 * Marks near the needle's current radius (`groovePos`) play crisp & loud (`~1.0`),
 * while distant marks smoothly attenuate and sink into phased/chorused wax reverb.
 */
export function computeFocus(markRadius, groovePos) {
  const dist = Math.abs(markRadius - groovePos);
  const sigma = 0.24;
  return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

export function getZoneLabel(groovePos, sideId) {
  if (groovePos >= 0.68) {
    return sideId === 'A' ? 'OUTER · DETROIT WAX' : 'OUTER · WARM LOOPS';
  }
  if (groovePos >= 0.34) {
    return sideId === 'A' ? 'MID · JAZZ POCKET' : 'MID · PHASE DRIFT';
  }
  return sideId === 'A' ? 'INNER · STRIPPED MICRO' : 'INNER · LOCKED GROOVE';
}
