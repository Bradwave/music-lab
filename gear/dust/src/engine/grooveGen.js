// Deterministic Detroit Jazz-Wax & Jan Jelinek Micro-Wax backing groove engine.
// Leaves generous negative space so every dust speck & finger smudge placed on the
// platter shines as a co-star. Morphs smoothly with needle radius (`groovePos`)
// and mutates cleanly when the user back-spins / scrubs the platter (`scrubSeed`).

function mulberry32(seed) {
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
 * Computes all procedural backing events for a single 16th-note step (`tick`),
 * continuously shaped by `groovePos` (1.0 = outer Detroit jazz-house, 0.0 = inner Jelinek micro-wax).
 */
export function evaluateGrooveStep(tick, { sideId, scrubSeed, groovePos }) {
  const step16 = ((tick % 16) + 16) % 16;
  const bar = Math.floor(tick / 16);
  const phraseBar = bar % 4;
  const isSideB = sideId === 'B';

  // Stable pattern seed for the current scrubSeed + side
  const patRand = mulberry32((scrubSeed * 2654435761) ^ (isSideB ? 0x9e3779b9 : 0x517cc1b7));

  // Choose two chord indices for the bar's call-and-response progression
  const chordA = Math.floor(patRand() * 3);         // 0..2
  const chordB = 2 + Math.floor(patRand() * 4);     // 2..5
  const chordC = Math.floor(patRand() * 6);
  const bassAlt1 = 2 + Math.floor(patRand() * 3);   // 2..4 (m3, 4th, 5th)
  const bassAlt2 = 4 + Math.floor(patRand() * 3);   // 4..6 (5th, b7, oct)
  const chordSyncSlot = patRand() < 0.5 ? 6 : 10;
  const bassBounceSlot = patRand() < 0.5 ? 3 : 7;

  // Per-tick subtle probability RNG
  const stepRand = mulberry32((tick * 73856093) ^ (scrubSeed * 19349663) ^ (isSideB ? 911 : 103));

  const events = {
    kick: null,
    bass: null,
    chord: null,
    brush: null,
    microTick: null
  };

  // =========================================================================
  // 1) DUSTY ACOUSTIC BREAKBEAT KICK (4/4 anchor + breathing dropout)
  // =========================================================================
  const isDropBeat = (bar % 8 === 7) && step16 === 12 && groovePos < 0.48;
  if (step16 % 4 === 0 && !isDropBeat) {
    const downAccent = step16 === 0 ? 1.0 : (step16 === 8 ? 0.94 : 0.88);
    // Slightly tighter / softer kick on innermost locked micro-groove
    const vel = downAccent * (0.78 + groovePos * 0.22);
    events.kick = { vel, ghost: false };
  } else if (step16 === 14 && groovePos > 0.58 && phraseBar % 2 === 1 && stepRand() < 0.55) {
    // Classic Detroit MPC pickup ghost kick
    events.kick = { vel: 0.42, ghost: true };
  }

  // =========================================================================
  // 2) KARPLUS-STRONG PLUCKED UPRIGHT DOUBLE-BASS
  // =========================================================================
  // Outer groove = bouncing jazz-house upright pocket; Inner groove = tight 2-note ostinato
  if (step16 === 2 && (groovePos > 0.22 || phraseBar % 2 === 0)) {
    events.bass = { deg: 0, vel: 0.78, durScale: 0.72 + groovePos * 0.35 };
  } else if (step16 === bassBounceSlot && groovePos > 0.42) {
    events.bass = { deg: bassAlt1, vel: 0.66, durScale: 0.62 + groovePos * 0.28 };
  } else if (step16 === 10) {
    const deg = groovePos < 0.35 ? 0 : (phraseBar === 3 ? bassAlt2 : bassAlt1);
    events.bass = { deg, vel: 0.84, durScale: 0.75 + groovePos * 0.3 };
  } else if (step16 === 14 && groovePos > 0.32 && (phraseBar % 2 === 1 || stepRand() < 0.45)) {
    events.bass = { deg: phraseBar === 3 ? bassAlt2 : 2, vel: 0.64, durScale: 0.55 + groovePos * 0.25 };
  } else if (step16 === 6 && isSideB && groovePos < 0.5 && stepRand() < 0.5) {
    events.bass = { deg: 1, vel: 0.52, durScale: 0.48 };
  }

  // =========================================================================
  // 3) SAMPLED JAZZ-WAX CHORD SLICES (Outer = lush hits, Inner = Jelinek micro-slices)
  // =========================================================================
  const poly7 = tick % 7;
  const poly11 = tick % 11;

  if (groovePos >= 0.48) {
    // Outer / Mid Detroit Jazz-House: warm sampled chord chops with generous breathing room
    if (step16 === 0 && (phraseBar === 0 || phraseBar === 2)) {
      events.chord = {
        chordIdx: phraseBar === 0 ? chordA : chordB,
        vel: 0.74,
        sliceOffset: 0.0,
        dur: 0.38 + groovePos * 0.52,
        micro: false
      };
    } else if (step16 === chordSyncSlot && (phraseBar % 2 === 0 || stepRand() < 0.62)) {
      events.chord = {
        chordIdx: phraseBar === 2 ? chordC : chordB,
        vel: 0.64,
        sliceOffset: (1 - groovePos) * 0.14,
        dur: 0.24 + groovePos * 0.36,
        micro: false
      };
    } else if (step16 === 14 && phraseBar === 3 && stepRand() < 0.7) {
      events.chord = {
        chordIdx: chordC,
        vel: 0.54,
        sliceOffset: 0.08,
        dur: 0.22 + groovePos * 0.24,
        micro: false
      };
    }
  } else {
    // Inner Jelinek Micro-Wax: hypnotic polyrhythmic 7/11 mid-buffer micro-slices!
    if (poly7 === 0 || (poly11 === 4 && stepRand() < 0.68)) {
      const idx = poly7 === 0 ? (phraseBar % 2 === 0 ? chordA : chordB) : chordC;
      events.chord = {
        chordIdx: idx,
        vel: poly7 === 0 ? 0.56 : 0.40,
        // Pull from deeper inside the jazz-record sustain tail for silky Jelinek loop texture
        sliceOffset: 0.12 + stepRand() * 0.32,
        dur: 0.065 + groovePos * 0.18 + stepRand() * 0.05,
        micro: true
      };
    }
  }

  // =========================================================================
  // 4) BRUSHED JAZZ CYMBALS & POLYRYTHMIC MICRO-DUST TICKS
  // =========================================================================
  if (step16 % 4 === 2) {
    // Off-beat brushed jazz hat (warmer & wider on outer groove, crisper inward)
    events.brush = {
      kind: groovePos > 0.65 && step16 === 10 && phraseBar % 2 === 1 ? 'ride' : 'hat',
      vel: 0.44 + groovePos * 0.24
    };
  } else if (groovePos > 0.55 && (step16 === 4 || step16 === 12) && stepRand() < 0.65) {
    // Subtle brushed snare ghost on beats 2 & 4
    events.microTick = {
      percIdx: 3, // brushed snare ghost tap
      vel: 0.32 + groovePos * 0.16,
      pan: 0.14
    };
  } else if (tick % 5 === 2 && stepRand() < (0.28 + (1 - groovePos) * 0.32)) {
    // Subtle 5-step polyrhythmic vinyl/modal micro-dust
    events.microTick = {
      percIdx: isSideB ? (stepRand() < 0.5 ? 4 : 0) : (stepRand() < 0.5 ? 2 : 3),
      vel: 0.18 + (1 - groovePos) * 0.18,
      pan: (stepRand() - 0.5) * 0.72
    };
  } else if (tick % 13 === 5 && stepRand() < 0.55) {
    // Rare 13-step jazz harmonic shimmer
    events.microTick = {
      percIdx: 5,
      vel: 0.20,
      pan: (stepRand() - 0.5) * 0.8
    };
  }

  return events;
}
