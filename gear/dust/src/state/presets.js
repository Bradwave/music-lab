// Curated Side A / Side B starter pressings for DUST.
// Marks live in polar coordinates on the vinyl surface:
//   angle:    [0..2π) rhythmic phase around the 1-bar disc
//   radius:   [0..1]  0 = inner runout groove, 1 = outer edge
//   size:     [0..1]  small = crisp speck, large = blooming smudge cloud
//   smearArc: radians of angular smear (0 for crisp dust speck)
//   kind:     'speck' | 'smudge'
//   seed:     deterministic voice/timbre salt

const TAU = Math.PI * 2;
const stepAngle = (step16) => ((step16 % 16) / 16) * TAU;

export function createStarterMarks(sideId) {
  if (sideId === 'B') {
    // Side B: Jelinek Locked-Groove Micro-Wax
    return [
      { id: 'b1', angle: stepAngle(2.0),  radius: 0.22, size: 0.24, smearArc: 0.00, kind: 'speck',  seed: 101, flash: 0 },
      { id: 'b2', angle: stepAngle(6.0),  radius: 0.30, size: 0.72, smearArc: 0.34, kind: 'smudge', seed: 204, flash: 0 },
      { id: 'b3', angle: stepAngle(9.5),  radius: 0.16, size: 0.18, smearArc: 0.00, kind: 'speck',  seed: 317, flash: 0 },
      { id: 'b4', angle: stepAngle(11.0), radius: 0.56, size: 0.30, smearArc: 0.00, kind: 'speck',  seed: 409, flash: 0 },
      { id: 'b5', angle: stepAngle(14.0), radius: 0.76, size: 0.80, smearArc: 0.42, kind: 'smudge', seed: 512, flash: 0 }
    ];
  }

  // Side A: Detroit Dusty Jazz-House
  return [
    { id: 'a1', angle: stepAngle(3.0),  radius: 0.82, size: 0.76, smearArc: 0.38, kind: 'smudge', seed: 17,  flash: 0 },
    { id: 'a2', angle: stepAngle(6.5),  radius: 0.66, size: 0.24, smearArc: 0.00, kind: 'speck',  seed: 43,  flash: 0 },
    { id: 'a3', angle: stepAngle(10.0), radius: 0.48, size: 0.28, smearArc: 0.00, kind: 'speck',  seed: 89,  flash: 0 },
    { id: 'a4', angle: stepAngle(13.5), radius: 0.78, size: 0.22, smearArc: 0.00, kind: 'speck',  seed: 131, flash: 0 },
    { id: 'a5', angle: stepAngle(14.5), radius: 0.24, size: 0.64, smearArc: 0.28, kind: 'smudge', seed: 197, flash: 0 }
  ];
}
