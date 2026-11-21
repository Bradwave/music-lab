// Curated Berlin 3 AM starter reels — each paired with a fitting Night-Arc hour & key.

function makeAnchors(pairs) {
  const arr = Array(16).fill(null);
  for (const [idx, val, accent = true] of pairs) {
    if (idx >= 0 && idx < 16) {
      arr[idx] = { val, accent };
    }
  }
  return arr;
}

export const REEL_PRESETS = [
  {
    id: 'perlon',
    name: 'PERLON',
    bpm: 122,
    keyId: 'f',
    hourId: '03',
    micro: 0.42,
    depth: 0.46,
    drift: 0.34,
    lanes: {
      sub: {
        length: 16,
        pressure: 0.90,
        muted: false,
        seed: 3041,
        anchors: makeAnchors([
          [0, 0], [4, 0], [6, 2], [8, 0], [12, 0], [14, 5], [15, 3, false]
        ])
      },
      cut: {
        length: 11,
        pressure: 0.78,
        muted: false,
        seed: 7109,
        anchors: makeAnchors([
          [2, 0], [4, 1], [7, 2], [9, 3]
        ])
      },
      chd: {
        length: 13,
        pressure: 0.72,
        muted: false,
        seed: 5521,
        anchors: makeAnchors([
          [3, 0], [9, 6], [11, 2, false]
        ])
      },
      air: {
        length: 8,
        pressure: 0.76,
        muted: false,
        seed: 8837,
        anchors: makeAnchors([
          [2, 0], [6, 1]
        ])
      }
    }
  },
  {
    id: 'kreuzbg',
    name: 'KREUZBG',
    bpm: 123,
    keyId: 'c',
    hourId: '01',
    micro: 0.48,
    depth: 0.56,
    drift: 0.40,
    lanes: {
      sub: {
        length: 16,
        pressure: 0.92,
        muted: false,
        seed: 1923,
        anchors: makeAnchors([
          [0, 0], [3, 2], [4, 0], [8, 0], [10, 6], [12, 0], [14, 4]
        ])
      },
      cut: {
        length: 7,
        pressure: 0.80,
        muted: false,
        seed: 4481,
        anchors: makeAnchors([
          [1, 0], [4, 2], [5, 5]
        ])
      },
      chd: {
        length: 16,
        pressure: 0.76,
        muted: false,
        seed: 6103,
        anchors: makeAnchors([
          [3, 0], [11, 2], [14, 4, false]
        ])
      },
      air: {
        length: 12,
        pressure: 0.74,
        muted: false,
        seed: 2917,
        anchors: makeAnchors([
          [2, 0], [6, 2], [10, 1]
        ])
      }
    }
  },
  {
    id: 'tresor',
    name: 'TRESOR',
    bpm: 126,
    keyId: 'd',
    hourId: '05',
    micro: 0.56,
    depth: 0.70,
    drift: 0.46,
    lanes: {
      sub: {
        length: 16,
        pressure: 0.94,
        muted: false,
        seed: 9101,
        anchors: makeAnchors([
          [0, 0], [4, 0], [7, 1, false], [8, 0], [12, 0], [15, 7]
        ])
      },
      cut: {
        length: 5,
        pressure: 0.82,
        muted: false,
        seed: 3329,
        anchors: makeAnchors([
          [1, 6], [3, 0]
        ])
      },
      chd: {
        length: 9,
        pressure: 0.68,
        muted: false,
        seed: 7741,
        anchors: makeAnchors([
          [2, 1], [7, 0]
        ])
      },
      air: {
        length: 16,
        pressure: 0.70,
        muted: false,
        seed: 5113,
        anchors: makeAnchors([
          [2, 0], [6, 0], [10, 1], [14, 3]
        ])
      }
    }
  },
  {
    id: 'blank',
    name: 'BLANK',
    bpm: 120,
    keyId: 'a',
    hourId: '03',
    micro: 0.28,
    depth: 0.42,
    drift: 0.24,
    lanes: {
      sub: {
        length: 16,
        pressure: 0.88,
        muted: false,
        seed: 1009,
        anchors: makeAnchors([
          [0, 0], [4, 0], [8, 0], [12, 0]
        ])
      },
      cut: {
        length: 16,
        pressure: 0.78,
        muted: false,
        seed: 2027,
        anchors: makeAnchors([])
      },
      chd: {
        length: 16,
        pressure: 0.74,
        muted: false,
        seed: 3037,
        anchors: makeAnchors([])
      },
      air: {
        length: 16,
        pressure: 0.74,
        muted: false,
        seed: 4049,
        anchors: makeAnchors([])
      }
    }
  }
];
