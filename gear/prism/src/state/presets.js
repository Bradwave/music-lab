// Curated optical constellations & generative mutation algorithms for PRISM.
// Grid is 12x12 (x: 0..11, y: 0..11).
// Directions: 0 = E (+1,0), 1 = S (0,+1), 2 = W (-1,0), 3 = N (0,-1).
// Optic types:
//   mirror: variant 0 = '/', variant 1 = '\'
//   split:  variant 0 = 2-way T-split, variant 1 = 3-way Star
//   bass:   variant 0 = Pass-through recharging lens, variant 1 = 180° retro-bounce
//   warp:   variant 0 = Portal keep-dir, variant 1 = Portal rotate +90°

export const GRID_SIZE = 12;

export const PRESETS = [
  {
    id: 'orbital',
    num: '01',
    name: '01 ORBITAL',
    short: '01 ORBIT',
    flux: 'glass',
    scaleId: 'd_dorian',
    bpm: 118,
    wallMode: 'bounce',
    emitterRate: 8,
    emitter: { x: 1, y: 5, dir: 0 },
    optics: [
      { x: 5, y: 5, type: 'split', variant: 0 },
      { x: 5, y: 2, type: 'mirror', variant: 0 }, // /
      { x: 9, y: 2, type: 'mirror', variant: 1 }, // \
      { x: 9, y: 5, type: 'bass', variant: 0 },   // PASS lens + collision zone
      { x: 9, y: 8, type: 'mirror', variant: 0 }, // /
      { x: 5, y: 8, type: 'mirror', variant: 1 }, // \
      { x: 2, y: 2, type: 'mirror', variant: 1 }, // \
      { x: 2, y: 8, type: 'mirror', variant: 0 }, // /
      { x: 3, y: 5, type: 'bass', variant: 0 }
    ]
  },
  {
    id: 'acid_lab',
    num: '02',
    name: '02 ACID LAB',
    short: '02 ACID',
    flux: 'acid',
    scaleId: 'f_phrygian',
    bpm: 128,
    wallMode: 'bounce',
    emitterRate: 4,
    emitter: { x: 1, y: 6, dir: 0 },
    optics: [
      { x: 4, y: 6, type: 'bass', variant: 0 },
      { x: 7, y: 6, type: 'split', variant: 1 },  // 3-way star
      { x: 10, y: 6, type: 'bass', variant: 1 },  // 180° acid retro-bounce
      { x: 7, y: 2, type: 'mirror', variant: 0 }, // /
      { x: 10, y: 2, type: 'mirror', variant: 1 },// \
      { x: 7, y: 10, type: 'mirror', variant: 1 },// \
      { x: 10, y: 10, type: 'mirror', variant: 0 },// /
      { x: 4, y: 2, type: 'mirror', variant: 1 },
      { x: 4, y: 10, type: 'mirror', variant: 0 }
    ]
  },
  {
    id: 'quantum',
    num: '03',
    name: '03 QUANTUM',
    short: '03 QUANT',
    flux: 'glitch',
    scaleId: 'a_min9',
    bpm: 132,
    wallMode: 'wrap',
    emitterRate: 8,
    emitter: { x: 0, y: 3, dir: 0 },
    optics: [
      { x: 4, y: 3, type: 'split', variant: 0 },
      { x: 4, y: 9, type: 'warp', variant: 1 },
      { x: 8, y: 2, type: 'warp', variant: 0 },
      { x: 9, y: 8, type: 'warp', variant: 1 },
      { x: 2, y: 2, type: 'mirror', variant: 1 },
      { x: 2, y: 7, type: 'bass', variant: 0 },
      { x: 2, y: 10, type: 'mirror', variant: 0 },
      { x: 8, y: 6, type: 'split', variant: 0 },
      { x: 6, y: 5, type: 'mirror', variant: 0 }
    ]
  },
  {
    id: 'cathedral',
    num: '04',
    name: '04 CATHEDRAL',
    short: '04 CATH',
    flux: 'void',
    scaleId: 'c_lydian',
    bpm: 94,
    wallMode: 'absorb',
    emitterRate: 16,
    emitter: { x: 5, y: 10, dir: 3 },
    optics: [
      { x: 5, y: 7, type: 'bass', variant: 0 },
      { x: 5, y: 4, type: 'split', variant: 1 },
      { x: 2, y: 4, type: 'mirror', variant: 1 },
      { x: 2, y: 1, type: 'mirror', variant: 0 },
      { x: 8, y: 4, type: 'mirror', variant: 0 },
      { x: 8, y: 1, type: 'mirror', variant: 1 },
      { x: 8, y: 7, type: 'mirror', variant: 0 },
      { x: 5, y: 1, type: 'warp', variant: 0 },
      { x: 2, y: 8, type: 'warp', variant: 1 },
      { x: 6, y: 8, type: 'mirror', variant: 0 }
    ]
  },
  {
    id: 'collider',
    num: '05',
    name: '05 COLLIDER',
    short: '05 COLLD',
    flux: 'acid',
    scaleId: 'g_minor',
    bpm: 124,
    wallMode: 'bounce',
    emitterRate: 8,
    emitter: { x: 5, y: 1, dir: 1 },
    optics: [
      { x: 5, y: 3, type: 'split', variant: 0 },
      { x: 2, y: 3, type: 'mirror', variant: 0 },
      { x: 2, y: 6, type: 'bass', variant: 0 },
      { x: 2, y: 9, type: 'mirror', variant: 1 },
      { x: 8, y: 3, type: 'mirror', variant: 1 },
      { x: 8, y: 6, type: 'bass', variant: 0 },
      { x: 8, y: 9, type: 'mirror', variant: 0 },
      { x: 5, y: 6, type: 'warp', variant: 1 }
    ]
  },
  {
    id: 'hyperloop',
    num: '06',
    name: '06 HYPERLOOP',
    short: '06 HYPER',
    flux: 'glitch',
    scaleId: 'eb_hirajoshi',
    bpm: 138,
    wallMode: 'wrap',
    emitterRate: 4,
    emitter: { x: 2, y: 5, dir: 0 },
    optics: [
      { x: 5, y: 5, type: 'split', variant: 0 },
      { x: 5, y: 2, type: 'mirror', variant: 0 },
      { x: 9, y: 2, type: 'bass', variant: 1 },
      { x: 5, y: 8, type: 'warp', variant: 1 },
      { x: 9, y: 8, type: 'warp', variant: 0 },
      { x: 9, y: 5, type: 'mirror', variant: 1 },
      { x: 2, y: 8, type: 'bass', variant: 0 },
      { x: 2, y: 2, type: 'mirror', variant: 1 }
    ]
  }
];

export function cloneOptics(list) {
  return list.map((o) => ({ x: o.x, y: o.y, type: o.type, variant: o.variant || 0 }));
}

export function getPreset(index) {
  return PRESETS[((index % PRESETS.length) + PRESETS.length) % PRESETS.length];
}

/**
 * Musically mutate the current optical circuit without breaking it:
 * flips 1-2 optics, shifts or adds a prism/mirror along active lines.
 */
export function createMutatedOptics(emitter, optics) {
  const next = cloneOptics(optics);
  const occupied = new Set([`${emitter.x},${emitter.y}`]);
  for (const o of next) occupied.add(`${o.x},${o.y}`);

  // 1. Flip 1-2 existing optics' variants
  const flipCount = Math.min(next.length, 1 + Math.floor(Math.random() * 2));
  for (let i = 0; i < flipCount; i++) {
    const idx = Math.floor(Math.random() * next.length);
    next[idx].variant = next[idx].variant ? 0 : 1;
  }

  // 2. Either nudge one optic along its row/column OR add a fresh optic aligned with existing ones
  if (next.length >= 6 && Math.random() < 0.55) {
    const idx = Math.floor(Math.random() * next.length);
    const o = next[idx];
    const axis = Math.random() < 0.5 ? 'x' : 'y';
    const delta = Math.random() < 0.5 ? -1 : 1;
    const nx = axis === 'x' ? Math.max(1, Math.min(GRID_SIZE - 2, o.x + delta)) : o.x;
    const ny = axis === 'y' ? Math.max(1, Math.min(GRID_SIZE - 2, o.y + delta)) : o.y;
    const key = `${nx},${ny}`;
    if (!occupied.has(key)) {
      occupied.delete(`${o.x},${o.y}`);
      o.x = nx;
      o.y = ny;
      occupied.add(key);
    }
  } else if (next.length < 13) {
    // Align new piece with either emitter or an existing piece so rays actually hit it!
    const anchor = next.length > 0 && Math.random() < 0.7
      ? next[Math.floor(Math.random() * next.length)]
      : emitter;
    const alignRow = Math.random() < 0.5;
    for (let tries = 0; tries < 10; tries++) {
      const nx = alignRow ? 1 + Math.floor(Math.random() * (GRID_SIZE - 2)) : anchor.x;
      const ny = alignRow ? anchor.y : 1 + Math.floor(Math.random() * (GRID_SIZE - 2));
      const key = `${nx},${ny}`;
      if (!occupied.has(key)) {
        const types = ['mirror', 'mirror', 'split', 'bass', 'warp'];
        const type = types[Math.floor(Math.random() * types.length)];
        next.push({ x: nx, y: ny, type, variant: Math.random() < 0.5 ? 0 : 1 });
        break;
      }
    }
  } else if (next.length > 10) {
    next.splice(Math.floor(Math.random() * next.length), 1);
  }

  return next;
}

/**
 * Generate a fresh, guaranteed-playable geometric optical constellation!
 */
export function generateRandomConstellation() {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 }
  ];

  // Place emitter near a clean interior edge pointing inward
  const edge = Math.floor(Math.random() * 4);
  let emitter;
  if (edge === 0) emitter = { x: 1, y: 3 + Math.floor(Math.random() * 6), dir: 0 };
  else if (edge === 1) emitter = { x: 3 + Math.floor(Math.random() * 6), y: 1, dir: 1 };
  else if (edge === 2) emitter = { x: 10, y: 3 + Math.floor(Math.random() * 6), dir: 2 };
  else emitter = { x: 3 + Math.floor(Math.random() * 6), y: 10, dir: 3 };

  const optics = [];
  const occupied = new Set([`${emitter.x},${emitter.y}`]);

  const place = (x, y, type, variant) => {
    if (x < 1 || x > GRID_SIZE - 2 || y < 1 || y > GRID_SIZE - 2) return false;
    const k = `${x},${y}`;
    if (occupied.has(k)) return false;
    occupied.add(k);
    optics.push({ x, y, type, variant });
    return true;
  };

  // First hit in emitter line: a Bass lens + a Splitter!
  const d = dirs[emitter.dir];
  const dist1 = 2 + Math.floor(Math.random() * 2);
  const dist2 = dist1 + 2 + Math.floor(Math.random() * 3);

  const bx = Math.max(1, Math.min(10, emitter.x + d.dx * dist1));
  const by = Math.max(1, Math.min(10, emitter.y + d.dy * dist1));
  place(bx, by, 'bass', 0);

  const sx = Math.max(2, Math.min(9, emitter.x + d.dx * dist2));
  const sy = Math.max(2, Math.min(9, emitter.y + d.dy * dist2));
  place(sx, sy, 'split', Math.random() < 0.35 ? 1 : 0);

  // Place mirrors on the perpendicular arms from the splitter to close loops
  const perp1 = dirs[(emitter.dir + 1) % 4];
  const perp2 = dirs[(emitter.dir + 3) % 4];
  const span1 = 2 + Math.floor(Math.random() * 3);
  const span2 = 2 + Math.floor(Math.random() * 3);

  const m1x = Math.max(1, Math.min(10, sx + perp1.dx * span1));
  const m1y = Math.max(1, Math.min(10, sy + perp1.dy * span1));
  place(m1x, m1y, 'mirror', Math.random() < 0.5 ? 0 : 1);

  const m2x = Math.max(1, Math.min(10, sx + perp2.dx * span2));
  const m2y = Math.max(1, Math.min(10, sy + perp2.dy * span2));
  place(m2x, m2y, 'mirror', Math.random() < 0.5 ? 0 : 1);

  // Add corner return mirrors + a pair of warp portals or second bass coil
  const useWarp = Math.random() < 0.65;
  const extras = 4;
  for (let i = 0; i < extras; i++) {
    const ref = optics[Math.floor(Math.random() * optics.length)] || emitter;
    const alignX = Math.random() < 0.5;
    const x = alignX ? ref.x : 1 + Math.floor(Math.random() * 10);
    const y = alignX ? 1 + Math.floor(Math.random() * 10) : ref.y;
    const type = useWarp && i >= 2 ? 'warp' : i === 0 ? 'bass' : 'mirror';
    place(x, y, type, Math.random() < 0.5 ? 0 : 1);
  }

  return { emitter, optics };
}
