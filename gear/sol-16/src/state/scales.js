// Musical scales, chord voicings & track brush definitions tailored for Deep House / Microhouse

export const CHANNELS = [
  { id: 'bd', name: 'KICK',  defaultTone: 0.58, defaultDecay: 0.48, defaultSpace: 0.12 },
  { id: 'pr', name: 'PERC',  defaultTone: 0.68, defaultDecay: 0.45, defaultSpace: 0.36 },
  { id: 'bs', name: 'BASS',  defaultTone: 0.48, defaultDecay: 0.52, defaultSpace: 0.18 },
  { id: 'ch', name: 'CHORD', defaultTone: 0.56, defaultDecay: 0.60, defaultSpace: 0.58 },
  { id: 'vx', name: 'VOX',   defaultTone: 0.52, defaultDecay: 0.50, defaultSpace: 0.66 },
  { id: 'sm', name: 'SMPL',  defaultTone: 0.62, defaultDecay: 0.55, defaultSpace: 0.54 }
];

// Kick styles (4 tactile brushes)
export const KICK_BRUSHES = [
  { id: 0, label: 'MAIN',  pitch: 0,  vol: 0.94, punch: 0.62 },
  { id: 1, label: 'WARM',  pitch: -2, vol: 0.84, punch: 0.35 },
  { id: 2, label: 'GHOST', pitch: -1, vol: 0.44, punch: 0.25 },
  { id: 3, label: 'PUNCH', pitch: 2,  vol: 0.98, punch: 0.85 }
];

// 6 organic Sofia Kourtesis / microhouse percussion flavors
export const PERC_BRUSHES = [
  { id: 0, label: 'HAT',  full: 'CLOSED HAT' },
  { id: 1, label: 'OPEN', full: 'OPEN HAT' },
  { id: 2, label: 'SHAK', full: 'SHAKER' },
  { id: 3, label: 'CLAP', full: 'HOUSE CLAP' },
  { id: 4, label: 'RIM',  full: 'WOOD RIM' },
  { id: 5, label: 'CONG', full: 'WARM CONGA' }
];

// 8 built-in warm organic textures for SMPL track (replaced by S1..S8 chops when user loads audio!)
export const SMPL_BUILTINS = [
  { id: 0, label: 'MARIM', full: 'WARM MARIMBA' },
  { id: 1, label: 'PLUCK', full: 'NYLON PLUCK' },
  { id: 2, label: 'BELL',  full: 'SUNLIT BELL' },
  { id: 3, label: 'STAB',  full: 'BRASS STAB' },
  { id: 4, label: 'TAMB',  full: 'TAMBOURINE' },
  { id: 5, label: 'WOOD',  full: 'KALIMBA WOOD' },
  { id: 6, label: 'SHIM',  full: 'GLASS SHIMMER' },
  { id: 7, label: 'AIR',   full: 'WARM BREATH' }
];

export const SMPL_CHOP_LABELS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

// 4 House Moods / Scales — every note & chord is guaranteed lush & in-key
export const MOODS = [
  {
    id: 'sunset',
    name: 'SUNSET',
    keyLabel: 'F DORIAN',
    vibe: 'Warm sunlit house',
    scaleNames: ['F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb', 'F+'],
    bassMidi:   [41, 43, 44, 46, 48, 50, 51, 53],
    voxMidi:    [53, 55, 56, 58, 60, 62, 63, 65],
    chords: [
      { name: 'Fm9',  notes: [53, 56, 60, 63, 67] },
      { name: 'Gm7',  notes: [55, 58, 62, 65] },
      { name: 'AbM7', notes: [56, 60, 63, 67] },
      { name: 'Bb9',  notes: [58, 62, 65, 68, 72] },
      { name: 'Cm7',  notes: [60, 63, 67, 70] },
      { name: 'Dm7',  notes: [62, 65, 69, 72] },
      { name: 'EbM7', notes: [63, 67, 70, 74] },
      { name: 'Fm11', notes: [53, 60, 63, 67, 70] }
    ]
  },
  {
    id: 'midnight',
    name: 'MIDNIGHT',
    keyLabel: 'C MINOR',
    vibe: 'Deep late-night house',
    scaleNames: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb', 'C+'],
    bassMidi:   [36, 38, 39, 41, 43, 44, 46, 48],
    voxMidi:    [48, 50, 51, 53, 55, 56, 58, 60],
    chords: [
      { name: 'Cm9',  notes: [48, 51, 55, 58, 62] },
      { name: 'Dm7',  notes: [50, 53, 57, 60] },
      { name: 'EbM7', notes: [51, 55, 58, 62] },
      { name: 'Fm9',  notes: [53, 56, 60, 63, 67] },
      { name: 'Gm7',  notes: [55, 58, 62, 65] },
      { name: 'AbM7', notes: [56, 60, 63, 67] },
      { name: 'Bb9',  notes: [58, 62, 65, 68, 72] },
      { name: 'Cm11', notes: [48, 55, 58, 62, 65] }
    ]
  },
  {
    id: 'palma',
    name: 'PALMA',
    keyLabel: 'D DORIAN',
    vibe: 'Balearic microhouse',
    scaleNames: ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D+'],
    bassMidi:   [38, 40, 41, 43, 45, 47, 48, 50],
    voxMidi:    [50, 52, 53, 55, 57, 59, 60, 62],
    chords: [
      { name: 'Dm9',  notes: [50, 53, 57, 60, 64] },
      { name: 'Em7',  notes: [52, 55, 59, 62] },
      { name: 'FM7',  notes: [53, 57, 60, 64] },
      { name: 'G9',   notes: [55, 59, 62, 65, 69] },
      { name: 'Am7',  notes: [57, 60, 64, 67] },
      { name: 'Bm7',  notes: [59, 62, 66, 69] },
      { name: 'CM7',  notes: [60, 64, 67, 71] },
      { name: 'Dm11', notes: [50, 57, 60, 64, 67] }
    ]
  },
  {
    id: 'velvet',
    name: 'VELVET',
    keyLabel: 'A MINOR',
    vibe: 'Dreamy deep minimal',
    scaleNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A+'],
    bassMidi:   [33, 35, 36, 38, 40, 41, 43, 45],
    voxMidi:    [57, 59, 60, 62, 64, 65, 67, 69],
    chords: [
      { name: 'Am9',  notes: [57, 60, 64, 67, 71] },
      { name: 'Bm7',  notes: [59, 62, 66, 69] },
      { name: 'CM7',  notes: [60, 64, 67, 71] },
      { name: 'Dm9',  notes: [50, 53, 57, 60, 64] },
      { name: 'Em7',  notes: [52, 55, 59, 62] },
      { name: 'FM7',  notes: [53, 57, 60, 64] },
      { name: 'G6',   notes: [55, 59, 62, 64] },
      { name: 'Am11', notes: [57, 64, 67, 71, 74] }
    ]
  }
];

export const LIVE_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

export function getMood(moodId) {
  return MOODS.find(m => m.id === moodId) || MOODS[0];
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getBrushList(chId, moodId, smplUseCustom = false) {
  const mood = getMood(moodId);
  if (chId === 'bd') {
    return KICK_BRUSHES.map(b => ({ note: b.id, label: b.label }));
  }
  if (chId === 'pr') {
    return PERC_BRUSHES.map(b => ({ note: b.id, label: b.label }));
  }
  if (chId === 'ch') {
    return mood.chords.map((c, idx) => ({ note: idx, label: c.name }));
  }
  if (chId === 'vx') {
    return mood.scaleNames.slice(0, 7).map((n, idx) => ({ note: idx, label: n }));
  }
  if (chId === 'sm') {
    if (smplUseCustom) {
      return SMPL_CHOP_LABELS.map((lbl, idx) => ({ note: idx, label: lbl }));
    }
    return SMPL_BUILTINS.map(b => ({ note: b.id, label: b.label }));
  }
  return mood.scaleNames.map((n, idx) => ({ note: idx, label: n }));
}

export function getStepLabel(chId, noteIdx, moodId, smplUseCustom = false) {
  const mood = getMood(moodId);
  if (chId === 'bd') {
    const b = KICK_BRUSHES[noteIdx % KICK_BRUSHES.length];
    return b ? b.label : 'MAIN';
  }
  if (chId === 'pr') {
    const b = PERC_BRUSHES[noteIdx % PERC_BRUSHES.length];
    return b ? b.label : 'HAT';
  }
  if (chId === 'ch') {
    const c = mood.chords[noteIdx % mood.chords.length];
    return c ? c.name : 'Fm9';
  }
  if (chId === 'sm') {
    if (smplUseCustom) return SMPL_CHOP_LABELS[noteIdx % SMPL_CHOP_LABELS.length];
    const b = SMPL_BUILTINS[noteIdx % SMPL_BUILTINS.length];
    return b ? b.label : 'MARIM';
  }
  return mood.scaleNames[noteIdx % mood.scaleNames.length] || 'F';
}
