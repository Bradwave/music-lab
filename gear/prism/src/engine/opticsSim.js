// 12x12 Laser Optical Simulation Engine for PRISM.
// Deterministic step-synchronized beam physics with energy decay,
// 90° mirrors, 2/3-way prism splitters, bass coils (pass/180°),
// paired quantum warp portals, toroidal wrap / bounce walls, and beam collisions.

import { GRID_SIZE } from '../state/presets.js';
import { state } from '../state/store.js';

export const DIRS = [
  { dx: 1, dy: 0, edge: 'E' },  // 0: East
  { dx: 0, dy: 1, edge: 'S' },  // 1: South
  { dx: -1, dy: 0, edge: 'W' }, // 2: West
  { dx: 0, dy: -1, edge: 'N' }  // 3: North
];

const MAX_PULSES = 14;
const INITIAL_ENERGY = 11;
const MAX_RECHARGES = 1;
const MAX_SPLIT_GEN = 2;

let nextPulseId = 1;
let lastCollisionStep = -10;

export const sim = {
  pulses: [],
  nodeFlashes: new Map(), // "x,y" -> { intensity, color }
  wallFlashes: [],        // { edge, pos, life, color }
  shockwaves: [],         // { x, y, age, duration, maxR, color, isNova }
  sparks: [],             // { x, y, vx, vy, life, maxLife, color }
  portalArcs: [],         // { x1, y1, x2, y2, life, color }
  emitterFlash: 0,
  lastCollisionCount: 0
};

export function resetSim() {
  sim.pulses = [];
  sim.nodeFlashes.clear();
  sim.wallFlashes = [];
  sim.shockwaves = [];
  sim.sparks = [];
  sim.portalArcs = [];
  sim.emitterFlash = 0;
  sim.lastCollisionCount = 0;
  lastCollisionStep = -10;
}

function flashNode(x, y, color, intensity = 1) {
  sim.nodeFlashes.set(`${x},${y}`, { intensity, color });
}

function spawnShockwave(x, y, color, maxR = 1.6, duration = 0.34, isNova = false) {
  if (sim.shockwaves.length > 28) sim.shockwaves.shift();
  sim.shockwaves.push({ x, y, age: 0, duration, maxR, color, isNova });
}

function spawnSparks(x, y, color, count = 6, speed = 2.8) {
  for (let i = 0; i < count; i++) {
    if (sim.sparks.length > 90) sim.sparks.shift();
    const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const sp = speed * (0.55 + Math.random() * 0.75);
    sim.sparks.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 1,
      maxLife: 0.22 + Math.random() * 0.2,
      color
    });
  }
}

function spawnWallFlash(edge, pos, color) {
  if (sim.wallFlashes.length > 24) sim.wallFlashes.shift();
  sim.wallFlashes.push({ edge, pos, life: 1, color });
}

function makePulse(x, y, dir, energy, hue = 'cyan', octaveShift = 0, prevX = x, prevY = y, recharges = 0, splitGen = 0) {
  return {
    id: nextPulseId++,
    x,
    y,
    prevX,
    prevY,
    dir,
    energy,
    maxEnergy: INITIAL_ENERGY,
    hue,
    octaveShift,
    recharges,
    splitGen,
    wrapped: false,
    wallBounceEdge: null,
    justTeleported: false,
    novaBoost: 0,
    trail: [{ x: prevX, y: prevY, hue, wrapped: false }]
  };
}

function reflectMirror(dir, variant) {
  // variant 0 = '/' : E(0)<->N(3), W(2)<->S(1)
  // variant 1 = '\' : E(0)<->S(1), W(2)<->N(3)
  if (variant === 0) {
    return dir === 0 ? 3 : dir === 3 ? 0 : dir === 2 ? 1 : 2;
  }
  return dir === 0 ? 1 : dir === 1 ? 0 : dir === 2 ? 3 : 2;
}

function buildOpticMap() {
  const map = new Map();
  for (let i = 0; i < state.optics.length; i++) {
    const o = state.optics[i];
    map.set(`${o.x},${o.y}`, o);
  }
  return map;
}

function getSortedWarps() {
  return state.optics
    .filter((o) => o.type === 'warp')
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/**
 * Advance the optical chamber by exactly 1 musical step (16th-note, or 32nd during HYPER).
 * Returns an array of musical events to be triggered at the scheduled Web Audio timestamp.
 */
export function advanceOpticalStep(stepIndex) {
  const events = [];
  const opticMap = buildOpticMap();
  const warps = getSortedWarps();
  const wallMode = state.wallMode;

  const moved = [];

  // 1. Move all active pulses one grid cell forward
  for (let i = 0; i < sim.pulses.length; i++) {
    const p = sim.pulses[i];
    if (p.energy <= 0) continue;

    const d = DIRS[p.dir];
    const oldX = p.x;
    const oldY = p.y;
    let nx = oldX + d.dx;
    let ny = oldY + d.dy;
    let wrapped = false;
    let wallBounceEdge = null;
    let alive = true;

    p.prevX = oldX;
    p.prevY = oldY;
    p.justTeleported = false;
    p.novaBoost = Math.max(0, p.novaBoost - 1);

    // Record trail point
    p.trail.push({ x: oldX, y: oldY, hue: p.hue, wrapped: p.wrapped });
    if (p.trail.length > 7) p.trail.shift();

    // Check chamber walls
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
      const hitEdge = nx < 0 ? 'W' : nx >= GRID_SIZE ? 'E' : ny < 0 ? 'N' : 'S';
      const edgePos = hitEdge === 'N' || hitEdge === 'S' ? oldX : oldY;

      if (wallMode === 'bounce') {
        // Rebound at edge cell & flip direction 180°
        nx = oldX;
        ny = oldY;
        p.dir = (p.dir + 2) % 4;
        p.energy -= 1;
        wallBounceEdge = hitEdge;
        spawnWallFlash(hitEdge, edgePos, p.hue);
        spawnSparks(
          hitEdge === 'W' ? -0.35 : hitEdge === 'E' ? GRID_SIZE - 0.65 : oldX,
          hitEdge === 'N' ? -0.35 : hitEdge === 'S' ? GRID_SIZE - 0.65 : oldY,
          p.hue,
          4,
          2.0
        );
        events.push({
          type: 'wall',
          edge: hitEdge,
          x: oldX,
          y: oldY,
          energy: Math.max(0.2, p.energy / INITIAL_ENERGY),
          hue: p.hue
        });
      } else if (wallMode === 'wrap') {
        nx = (nx + GRID_SIZE) % GRID_SIZE;
        ny = (ny + GRID_SIZE) % GRID_SIZE;
        wrapped = true;
        p.energy -= 1;
        spawnWallFlash(hitEdge, edgePos, 'violet');
        events.push({
          type: 'wall',
          edge: hitEdge,
          x: nx,
          y: ny,
          energy: Math.max(0.15, (p.energy / INITIAL_ENERGY) * 0.65),
          hue: 'violet',
          isWrap: true
        });
      } else {
        // ABSORB mode: beam dissolves softly at the edge
        alive = false;
        spawnWallFlash(hitEdge, edgePos, p.hue);
        spawnSparks(oldX, oldY, p.hue, 4, 1.4);
      }
    }

    if (alive && p.energy > 0) {
      p.x = nx;
      p.y = ny;
      p.wrapped = wrapped;
      p.wallBounceEdge = wallBounceEdge;
      moved.push(p);
    }
  }

  // 2. Emitter Fires on musical cadence
  const rate = state.emitterRate || 8;
  if (stepIndex % rate === 0) {
    const em = state.emitter;
    const d = DIRS[em.dir];
    let sx = em.x + d.dx;
    let sy = em.y + d.dy;
    let wrapped = false;

    if (sx < 0 || sx >= GRID_SIZE || sy < 0 || sy >= GRID_SIZE) {
      if (wallMode === 'wrap') {
        sx = (sx + GRID_SIZE) % GRID_SIZE;
        sy = (sy + GRID_SIZE) % GRID_SIZE;
        wrapped = true;
      } else {
        sx = em.x;
        sy = em.y;
      }
    }

    if (moved.length < MAX_PULSES) {
      const fresh = makePulse(sx, sy, em.dir, INITIAL_ENERGY, 'cyan', 0, em.x, em.y, 0);
      fresh.wrapped = wrapped;
      moved.push(fresh);
    }

    sim.emitterFlash = 1;
    spawnShockwave(em.x, em.y, 'cyan', 1.15, 0.28, false);
    events.push({
      type: 'emitter',
      x: em.x,
      y: em.y,
      stepIndex,
      energy: 1
    });
  }

  // 3. Detect Beam-to-Beam Collisions (same-cell OR head-on swap)
  const cellGroups = new Map();
  for (let i = 0; i < moved.length; i++) {
    const p = moved[i];
    const key = `${p.x},${p.y}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key).push(p);
  }

  const collidedCells = new Set();
  let collisionsThisStep = 0;
  const canCollide = (stepIndex - lastCollisionStep) >= 3 || stepIndex < lastCollisionStep;

  // Same-cell collisions (musical accent spacing so Novas shine!)
  if (canCollide) {
    for (const [key, list] of cellGroups.entries()) {
      if (list.length >= 2 && collisionsThisStep < 1) {
        const p0 = list[0];
        collidedCells.add(key);
        collisionsThisStep++;
        lastCollisionStep = stepIndex;
        for (const p of list) {
          p.novaBoost = 2;
        }
        spawnShockwave(p0.x, p0.y, 'white', 2.6, 0.44, true);
        spawnSparks(p0.x, p0.y, 'magenta', 10, 3.8);
        spawnSparks(p0.x, p0.y, 'white', 6, 2.5);
        events.push({
          type: 'collision',
          x: p0.x,
          y: p0.y,
          octaveShift: p0.octaveShift,
          energy: Math.min(1, 0.65 + list.length * 0.15)
        });
      }
    }
  }

  // Head-on crossing collisions (A went U->V, B went V->U)
  if (canCollide && collisionsThisStep === 0) {
    for (let i = 0; i < moved.length && collisionsThisStep < 1; i++) {
      const a = moved[i];
      if (a.wrapped || a.wallBounceEdge) continue;
      for (let j = i + 1; j < moved.length && collisionsThisStep < 1; j++) {
        const b = moved[j];
        if (b.wrapped || b.wallBounceEdge) continue;
        if (a.x === b.prevX && a.y === b.prevY && b.x === a.prevX && b.y === a.prevY) {
          const key = `${a.x},${a.y}`;
          if (collidedCells.has(key)) continue;
          collidedCells.add(key);
          collisionsThisStep++;
          lastCollisionStep = stepIndex;
          a.novaBoost = 2;
          b.novaBoost = 2;
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          spawnShockwave(mx, my, 'white', 2.5, 0.42, true);
          spawnSparks(mx, my, 'cyan', 9, 3.6);
          spawnSparks(mx, my, 'white', 6, 2.4);
          events.push({
            type: 'collision',
            x: a.x,
            y: a.y,
            octaveShift: a.octaveShift,
            energy: 0.9
          });
        }
      }
    }
  }

  sim.lastCollisionCount = collisionsThisStep;

  // 4. Process Optical Node Interactions
  const nextPulses = [];
  let totalCount = moved.length;

  for (let i = 0; i < moved.length; i++) {
    const p = moved[i];
    const optic = opticMap.get(`${p.x},${p.y}`);

    if (!optic) {
      nextPulses.push(p);
      continue;
    }

    const energyNorm = Math.max(0.22, Math.min(1, p.energy / INITIAL_ENERGY));

    if (optic.type === 'mirror') {
      p.dir = reflectMirror(p.dir, optic.variant);
      p.energy -= 1;
      flashNode(optic.x, optic.y, 'cyan', 1);
      spawnShockwave(optic.x, optic.y, 'cyan', 1.15, 0.25, false);
      spawnSparks(optic.x, optic.y, 'cyan', 5, 2.2);
      events.push({
        type: 'mirror',
        x: optic.x,
        y: optic.y,
        variant: optic.variant,
        octaveShift: p.octaveShift,
        energy: energyNorm,
        hue: p.hue
      });
      if (p.energy > 0) nextPulses.push(p);
    } else if (optic.type === 'split') {
      flashNode(optic.x, optic.y, 'magenta', 1);
      spawnShockwave(optic.x, optic.y, 'magenta', 1.7, 0.34, false);
      spawnSparks(optic.x, optic.y, 'magenta', 8, 2.9);

      events.push({
        type: 'split',
        x: optic.x,
        y: optic.y,
        variant: optic.variant,
        octaveShift: p.octaveShift,
        energy: energyNorm
      });

      const childEnergy = Math.min(p.energy - 2, 7);
      if (childEnergy > 0) {
        const canBranch = p.splitGen < MAX_SPLIT_GEN;
        const outDirs = optic.variant === 1
          ? [(p.dir + 1) % 4, (p.dir + 3) % 4, p.dir] // 3-way Star
          : [(p.dir + 1) % 4, (p.dir + 3) % 4];        // 2-way T-split

        // Reuse parent for first branch
        p.dir = outDirs[0];
        p.energy = childEnergy;
        p.hue = 'magenta';
        p.splitGen += 1;
        nextPulses.push(p);

        // Spawn additional child branches if under split generation & pulse caps
        if (canBranch) {
          for (let b = 1; b < outDirs.length; b++) {
            if (totalCount < MAX_PULSES) {
              const childHue = b === 1 ? 'cyan' : 'lime';
              const childOct = b === 2 ? Math.min(1, p.octaveShift + 1) : p.octaveShift;
              const child = makePulse(
                optic.x,
                optic.y,
                outDirs[b],
                childEnergy,
                childHue,
                childOct,
                optic.x,
                optic.y,
                p.recharges,
                p.splitGen
              );
              child.trail = p.trail.slice(-3);
              nextPulses.push(child);
              totalCount++;
            }
          }
        }
      }
    } else if (optic.type === 'bass') {
      flashNode(optic.x, optic.y, 'lime', 1);
      spawnShockwave(optic.x, optic.y, 'lime', 1.9, 0.38, false);
      spawnSparks(optic.x, optic.y, 'lime', 6, 2.4);

      if (optic.variant === 1) {
        // 180° Retro-bounce bass trap
        p.dir = (p.dir + 2) % 4;
        p.energy -= 1;
      } else {
        // Pass-through recharging resonant lens (capped to MAX_RECHARGES so loops breathe!)
        if (p.recharges < MAX_RECHARGES) {
          p.energy = Math.min(INITIAL_ENERGY, p.energy + 2);
          p.recharges += 1;
        } else {
          p.energy -= 1;
        }
      }

      p.hue = 'lime';
      p.octaveShift = Math.max(-1, p.octaveShift - 1);

      events.push({
        type: 'bass',
        x: optic.x,
        y: optic.y,
        variant: optic.variant,
        energy: Math.max(0.55, energyNorm)
      });

      if (p.energy > 0) nextPulses.push(p);
    } else if (optic.type === 'warp') {
      flashNode(optic.x, optic.y, 'violet', 1);
      spawnShockwave(optic.x, optic.y, 'violet', 1.65, 0.34, false);
      spawnSparks(optic.x, optic.y, 'violet', 7, 2.8);

      let target = optic;
      if (warps.length >= 2) {
        const idx = warps.findIndex((w) => w.x === optic.x && w.y === optic.y);
        target = warps[(idx + 1) % warps.length];
        flashNode(target.x, target.y, 'violet', 1);
        spawnShockwave(target.x, target.y, 'violet', 1.65, 0.34, false);
        sim.portalArcs.push({
          x1: optic.x,
          y1: optic.y,
          x2: target.x,
          y2: target.y,
          life: 1,
          color: 'violet'
        });

        p.prevX = target.x;
        p.prevY = target.y;
        p.x = target.x;
        p.y = target.y;
        p.wrapped = true;
        p.justTeleported = true;
        if (target.variant === 1) {
          p.dir = (p.dir + 1) % 4;
        }
      } else {
        // Single warp acts as a Chaos Prism deflector
        p.dir = (p.dir + 1 + (stepIndex % 3)) % 4;
      }

      p.hue = 'violet';
      p.octaveShift = p.octaveShift >= 1 ? 0 : 1;
      p.energy -= 1;

      events.push({
        type: 'warp',
        x: target.x,
        y: target.y,
        variant: optic.variant,
        teleported: warps.length >= 2,
        octaveShift: p.octaveShift,
        energy: energyNorm
      });

      if (p.energy > 0) nextPulses.push(p);
    } else {
      nextPulses.push(p);
    }
  }

  sim.pulses = nextPulses;
  return events;
}

/**
 * Decay visual particles & flashes smoothly at 60fps.
 */
export function updateSimVisuals(dtSec) {
  sim.emitterFlash = Math.max(0, sim.emitterFlash - dtSec * 3.8);

  for (const [key, val] of sim.nodeFlashes.entries()) {
    val.intensity -= dtSec * 3.6;
    if (val.intensity <= 0) sim.nodeFlashes.delete(key);
  }

  for (let i = sim.wallFlashes.length - 1; i >= 0; i--) {
    sim.wallFlashes[i].life -= dtSec * 3.4;
    if (sim.wallFlashes[i].life <= 0) sim.wallFlashes.splice(i, 1);
  }

  for (let i = sim.shockwaves.length - 1; i >= 0; i--) {
    const sw = sim.shockwaves[i];
    sw.age += dtSec;
    if (sw.age >= sw.duration) sim.shockwaves.splice(i, 1);
  }

  for (let i = sim.sparks.length - 1; i >= 0; i--) {
    const sp = sim.sparks[i];
    sp.x += sp.vx * dtSec;
    sp.y += sp.vy * dtSec;
    sp.vx *= Math.pow(0.08, dtSec);
    sp.vy *= Math.pow(0.08, dtSec);
    sp.life -= dtSec / sp.maxLife;
    if (sp.life <= 0) sim.sparks.splice(i, 1);
  }

  for (let i = sim.portalArcs.length - 1; i >= 0; i--) {
    sim.portalArcs[i].life -= dtSec * 3.2;
    if (sim.portalArcs[i].life <= 0) sim.portalArcs.splice(i, 1);
  }
}
