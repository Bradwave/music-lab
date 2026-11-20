// Anchor & Echo procedural engine.
// Your solid anchors are sacred — never moved or erased.
// This module deterministically weaves micro-clicks, anticipation ghosts,
// and dub echoes into the negative space around your anchors.

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashLaneAnchors(anchors, length) {
  let h = 2166136261 ^ length;
  for (let i = 0; i < length; i++) {
    const a = anchors[i];
    h = Math.imul(h ^ (a ? (a.val + 17) * (i + 3) : i + 1), 16777619);
  }
  return h >>> 0;
}

/**
 * Computes the deterministic ghost-dust map for a single lane.
 * Shared by both the Audio Scheduler and the Pixel Tape Deck Canvas so
 * every shimmering amber spark you see on the tape is what you hear.
 */
export function computeGhostMap(laneId, lane, micro, driftCycle = 0) {
  const len = lane.length;
  const ghosts = Array(len).fill(null);

  if (micro <= 0.02 || len < 3) return ghosts;

  const anchorIndices = [];
  for (let i = 0; i < len; i++) {
    if (lane.anchors[i]) anchorIndices.push(i);
  }

  // Respect complete silence: if a lane has zero anchors, only whisper faint dust when micro > 0.65
  if (anchorIndices.length === 0 && micro < 0.65) {
    return ghosts;
  }

  const anchorHash = hashLaneAnchors(lane.anchors, len);
  const rand = mulberry32((lane.seed * 73856093) ^ anchorHash ^ (driftCycle * 19349663));

  // Score each empty slot based on microhouse rhythmic grammar relative to user anchors
  const candidates = [];
  for (let i = 0; i < len; i++) {
    if (lane.anchors[i]) continue;

    const prev1 = (i - 1 + len) % len;
    const prev2 = (i - 2 + len) % len;
    const prev3 = (i - 3 + len) % len;
    const next1 = (i + 1) % len;

    let affinity = 0.08 + rand() * 0.24;
    let role = 'dust';
    let refAnchor = null;

    // Pre-transient anticipation right before an anchor (classic house shuffle!)
    if (lane.anchors[next1]) {
      affinity += laneId === 'sub' ? 0.16 : 0.42;
      role = 'pre';
      refAnchor = lane.anchors[next1];
    }

    // Dotted-8th syncopated echo (3 steps after an anchor)
    if (lane.anchors[prev3]) {
      affinity += laneId === 'chd' ? 0.46 : 0.36;
      role = 'echo';
      refAnchor = lane.anchors[prev3];
    }

    // Double-step micro-stutter / answer (2 steps after)
    if (lane.anchors[prev2]) {
      affinity += laneId === 'air' ? 0.34 : 0.22;
      if (!refAnchor) {
        role = 'answer';
        refAnchor = lane.anchors[prev2];
      }
    }

    // Slight penalty right after an anchor so negative space breathes (except crisp micro-clicks on CUT)
    if (lane.anchors[prev1]) {
      affinity -= laneId === 'cut' ? -0.08 : 0.18;
    }

    // On SUB, avoid muddying the downbeat beats if they were intentionally left empty
    if (laneId === 'sub') {
      if (i % 4 === 0) affinity -= 0.45;
      if (i % 4 === 2 || i % 4 === 3) affinity += 0.24;
    }

    // On AIR, favor off-beats & 16th pickup slots
    if (laneId === 'air' && (i % 2 === 1)) {
      affinity += 0.20;
    }

    candidates.push({ idx: i, score: affinity, role, refAnchor });
  }

  // Sort by highest musical affinity and cap count to preserve microhouse negative space
  candidates.sort((a, b) => b.score - a.score);

  const laneCapRatio = {
    sub: 0.24,
    cut: 0.46,
    chd: 0.26,
    air: 0.50
  }[laneId] || 0.35;

  const maxGhosts = Math.max(
    1,
    Math.min(
      candidates.length,
      Math.round(len * laneCapRatio * Math.pow(micro, 0.92))
    )
  );

  // Choose threshold so micro smoothly reveals ghosts one by one
  const threshold = 0.78 - micro * 0.66;
  let placed = 0;

  for (const c of candidates) {
    if (placed >= maxGhosts) break;
    if (c.score < threshold) break;

    // Avoid crowding two ghosts right next to each other on CHD or SUB
    const leftGhost = ghosts[(c.idx - 1 + len) % len];
    const rightGhost = ghosts[(c.idx + 1) % len];
    if ((laneId === 'chd' || laneId === 'sub') && (leftGhost || rightGhost)) {
      continue;
    }

    const r = rand();
    let val = 0;
    let vel = 0.22 + micro * 0.28 + r * 0.14;

    if (laneId === 'sub') {
      // Soft rolling sub-bass ghosts (never harsh kicks)
      const subPool = [1, 2, 3, 5, 6];
      val = subPool[Math.floor(r * subPool.length)];
      vel = 0.24 + micro * 0.24;
    } else if (laneId === 'cut') {
      // Micro-clicks, ticks, wood & foley dust
      const cutPool = [0, 5, 3, 1, 7, 6];
      val = cutPool[Math.floor(r * cutPool.length)];
      vel = 0.20 + micro * 0.34 + (c.role === 'pre' ? -0.05 : 0.04);
    } else if (laneId === 'chd') {
      // Harmonize ghost chord with the nearest anchor (octave/m11 whisper)
      const baseVal = c.refAnchor ? c.refAnchor.val : 0;
      val = r < 0.55 ? baseVal : (baseVal === 0 ? 6 : (baseVal + 2) % 7);
      vel = 0.18 + micro * 0.22;
    } else if (laneId === 'air') {
      // Shuffled hats, ticks & stereo micro-grains
      const airPool = [3, 0, 2, 5, 6, 4];
      val = airPool[Math.floor(r * airPool.length)];
      vel = 0.18 + micro * 0.30;
    }

    ghosts[c.idx] = {
      val,
      vel: Math.max(0.12, Math.min(0.62, vel)),
      role: c.role,
      // Slight subtle probability gate so high-drift ghosts shimmer organically
      prob: Math.min(0.96, 0.52 + micro * 0.44),
      microMs: (rand() - 0.35) * 14 // tiny microhouse timing nudge
    };
    placed++;
  }

  return ghosts;
}

/**
 * Generates a fresh, sparse, musical anchor skeleton for ONE lane only
 * when the user taps SEED on that lane.
 */
export function generateLaneSkeleton(laneId, length, seed) {
  const rand = mulberry32(seed);
  const arr = Array(16).fill(null);

  if (laneId === 'sub') {
    // Classic 4/4 kick anchor + 1-3 rolling sub-bass notes
    for (let i = 0; i < length; i += 4) {
      arr[i] = { val: 0, accent: true };
    }
    const subSlots = [2, 3, 6, 7, 10, 11, 14, 15].filter(s => s < length && !arr[s]);
    const subNotes = [2, 3, 4, 5, 6, 7];
    const count = 2 + Math.floor(rand() * 2);
    for (let n = 0; n < count && subSlots.length; n++) {
      const pickIdx = Math.floor(rand() * subSlots.length);
      const slot = subSlots.splice(pickIdx, 1)[0];
      arr[slot] = {
        val: subNotes[Math.floor(rand() * subNotes.length)],
        accent: n === 0
      };
    }
    return arr;
  }

  if (laneId === 'cut') {
    const count = Math.max(2, Math.min(5, Math.round(length * 0.28)));
    const voices = [0, 1, 2, 3, 4, 5, 6, 7];
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < 40) {
      guard++;
      const slot = Math.floor(rand() * length);
      if (arr[slot]) continue;
      // Prefer off-beat syncopation
      if (slot % 4 === 0 && rand() < 0.7) continue;
      arr[slot] = {
        val: voices[Math.floor(rand() * voices.length)],
        accent: rand() < 0.75
      };
      placed++;
    }
    return arr;
  }

  if (laneId === 'chd') {
    // Sparse 2-3 dub/deep house chord anchors
    const count = length <= 7 ? 2 : (2 + (rand() < 0.45 ? 1 : 0));
    const chordPool = [0, 1, 2, 4, 5, 6];
    const rootChord = chordPool[Math.floor(rand() * 2)]; // 0 or 1
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < 40) {
      guard++;
      const slot = Math.floor(rand() * length);
      if (arr[slot]) continue;
      // Avoid adjacent chord clumps
      if (arr[(slot - 1 + length) % length] || arr[(slot + 1) % length]) continue;
      // Favor syncopated positions (3, 6, 9, 10, 11, 14)
      if (slot % 4 === 0 && rand() < 0.65) continue;
      arr[slot] = {
        val: placed === 0 ? rootChord : chordPool[Math.floor(rand() * chordPool.length)],
        accent: placed < 2
      };
      placed++;
    }
    return arr;
  }

  // AIR: offbeat hats + occasional shaker/open hat
  for (let i = 2; i < length; i += 4) {
    arr[i] = { val: rand() < 0.25 ? 1 : 0, accent: true };
  }
  if (length >= 6 && rand() < 0.7) {
    const extra = Math.floor(rand() * length);
    if (!arr[extra]) {
      arr[extra] = { val: rand() < 0.5 ? 2 : 3, accent: false };
    }
  }
  return arr;
}
