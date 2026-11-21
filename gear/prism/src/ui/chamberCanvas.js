// 60fps Pixel-Art Laser Optical Chamber Renderer for PRISM.
// Logical resolution: 276 x 276 (6px hardware rail bezel + 12x12 grid @ 22px per cell).

import { GRID_SIZE } from '../state/presets.js';
import { state } from '../state/store.js';
import { sim, DIRS } from '../engine/opticsSim.js';
import { getEnergyBands } from '../audio/engine.js';

export const CANVAS_SIZE = 276;
export const BOARD_PAD = 6;
export const CELL_SIZE = 22; // 12 * 22 + 12 = 276

const PALETTE = {
  cyan: { main: '#38f2ff', bright: '#c9fcff', glow: 'rgba(56, 242, 255, 0.32)', dim: '#155d6b' },
  magenta: { main: '#ff3d9a', bright: '#ffb5d9', glow: 'rgba(255, 61, 154, 0.34)', dim: '#6d1843' },
  lime: { main: '#c8ff4d', bright: '#efffc2', glow: 'rgba(200, 255, 77, 0.30)', dim: '#4d6b18' },
  violet: { main: '#b46eff', bright: '#e7ccff', glow: 'rgba(180, 110, 255, 0.34)', dim: '#4b2778' },
  white: { main: '#ffffff', bright: '#ffffff', glow: 'rgba(255, 255, 255, 0.45)', dim: '#8aa4c8' }
};

const FLUX_BG = {
  glass: '#080c15',
  acid: '#090e10',
  glitch: '#0e0914',
  void: '#070610'
};

const energyBands = new Float32Array(12);

export function cellCenterPx(gx, gy) {
  return {
    cx: BOARD_PAD + gx * CELL_SIZE + CELL_SIZE * 0.5,
    cy: BOARD_PAD + gy * CELL_SIZE + CELL_SIZE * 0.5
  };
}

export function canvasPointToCell(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const lx = ((clientX - rect.left) / rect.width) * CANVAS_SIZE;
  const ly = ((clientY - rect.top) / rect.height) * CANVAS_SIZE;
  const gx = Math.floor((lx - BOARD_PAD) / CELL_SIZE);
  const gy = Math.floor((ly - BOARD_PAD) / CELL_SIZE);
  const inBounds = gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE;
  return { gx, gy, inBounds, lx, ly };
}

function drawPixelLine(ctx, x0, y0, x1, y1, color, thickness = 2) {
  ctx.fillStyle = color;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = Math.floor(thickness * 0.5);
  for (let i = 0; i <= steps; i += 1) {
    const px = Math.round(x0 + (dx * i) / steps) - half;
    const py = Math.round(y0 + (dy * i) / steps) - half;
    ctx.fillRect(px, py, thickness, thickness);
  }
}

function drawBackground(ctx) {
  // Deep CRT chamber background tinted subtly by FLUX
  ctx.fillStyle = FLUX_BG[state.flux] || '#080c15';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Subtle CRT scanlines every 2px
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = BOARD_PAD; y < CANVAS_SIZE - BOARD_PAD; y += 2) {
    ctx.fillRect(BOARD_PAD, y, CANVAS_SIZE - BOARD_PAD * 2, 1);
  }

  // Faint 4x4 quadrant optical alignment hairlines
  ctx.fillStyle = state.isHyper ? 'rgba(255, 61, 154, 0.14)' : 'rgba(56, 242, 255, 0.065)';
  for (let i = 3; i < GRID_SIZE; i += 3) {
    const p = BOARD_PAD + i * CELL_SIZE;
    ctx.fillRect(p, BOARD_PAD, 1, GRID_SIZE * CELL_SIZE);
    ctx.fillRect(BOARD_PAD, p, GRID_SIZE * CELL_SIZE, 1);
  }

  // Crisp optical matrix dots at every cell center
  ctx.fillStyle = state.isHyper ? '#2e1d3e' : '#18233a';
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const { cx, cy } = cellCenterPx(x, y);
      ctx.fillRect(Math.floor(cx), Math.floor(cy), 1, 1);
    }
  }
}

function drawChamberWalls(ctx) {
  const mode = state.wallMode;
  const inner = GRID_SIZE * CELL_SIZE;

  // Base bezel rails
  ctx.fillStyle = '#0c111d';
  ctx.fillRect(0, 0, CANVAS_SIZE, BOARD_PAD);
  ctx.fillRect(0, CANVAS_SIZE - BOARD_PAD, CANVAS_SIZE, BOARD_PAD);
  ctx.fillRect(0, 0, BOARD_PAD, CANVAS_SIZE);
  ctx.fillRect(CANVAS_SIZE - BOARD_PAD, 0, BOARD_PAD, CANVAS_SIZE);

  // Inner rail line styled by Wall Mode
  if (mode === 'bounce') {
    ctx.fillStyle = '#2a3d66';
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD - 1, inner + 2, 1);
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD + inner, inner + 2, 1);
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD - 1, 1, inner + 2);
    ctx.fillRect(BOARD_PAD + inner, BOARD_PAD - 1, 1, inner + 2);
  } else if (mode === 'wrap') {
    // Dashed glowing ultraviolet toroidal portal border
    ctx.fillStyle = '#6f3eb8';
    for (let i = 0; i < inner; i += 8) {
      ctx.fillRect(BOARD_PAD + i, BOARD_PAD - 1, 4, 1);
      ctx.fillRect(BOARD_PAD + i, BOARD_PAD + inner, 4, 1);
      ctx.fillRect(BOARD_PAD - 1, BOARD_PAD + i, 1, 4);
      ctx.fillRect(BOARD_PAD + inner, BOARD_PAD + i, 1, 4);
    }
  } else {
    // Absorb: subtle dark matte rim
    ctx.fillStyle = '#182033';
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD - 1, inner + 2, 1);
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD + inner, inner + 2, 1);
    ctx.fillRect(BOARD_PAD - 1, BOARD_PAD - 1, 1, inner + 2);
    ctx.fillRect(BOARD_PAD + inner, BOARD_PAD - 1, 1, inner + 2);
  }

  // Wall Hit LEDs
  for (let i = 0; i < sim.wallFlashes.length; i++) {
    const wf = sim.wallFlashes[i];
    const pal = PALETTE[wf.color] || PALETTE.cyan;
    ctx.globalAlpha = Math.max(0, Math.min(1, wf.life));
    ctx.fillStyle = wf.life > 0.6 ? pal.bright : pal.main;
    const p = BOARD_PAD + wf.pos * CELL_SIZE + 2;
    const len = CELL_SIZE - 4;
    if (wf.edge === 'N') ctx.fillRect(p, 1, len, 4);
    else if (wf.edge === 'S') ctx.fillRect(p, CANVAS_SIZE - 5, len, 4);
    else if (wf.edge === 'W') ctx.fillRect(1, p, 4, len);
    else if (wf.edge === 'E') ctx.fillRect(CANVAS_SIZE - 5, p, 4, len);
    ctx.globalAlpha = 1;
  }

  // Subtle audio spectrum telemetry embedded in bottom bezel rail
  getEnergyBands(energyBands);
  for (let i = 0; i < 12; i++) {
    const val = energyBands[i];
    if (val < 0.06) continue;
    const bx = BOARD_PAD + i * CELL_SIZE + 3;
    const bw = Math.max(2, Math.round((CELL_SIZE - 6) * Math.min(1, val * 1.35)));
    ctx.fillStyle = state.isHyper
      ? '#ff3d9a'
      : state.flux === 'acid'
        ? '#c8ff4d'
        : state.flux === 'void'
          ? '#b46eff'
          : '#38f2ff';
    ctx.globalAlpha = 0.25 + val * 0.65;
    ctx.fillRect(bx, CANVAS_SIZE - 3, bw, 2);
    ctx.globalAlpha = 1;
  }

  // Corner optical bolts
  ctx.fillStyle = '#33466e';
  ctx.fillRect(1, 1, 3, 3);
  ctx.fillRect(CANVAS_SIZE - 4, 1, 3, 3);
  ctx.fillRect(1, CANVAS_SIZE - 4, 3, 3);
  ctx.fillRect(CANVAS_SIZE - 4, CANVAS_SIZE - 4, 3, 3);
}

function drawPortalTethers(ctx) {
  const warps = state.optics
    .filter((o) => o.type === 'warp')
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));

  if (warps.length >= 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 110, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    for (let i = 0; i < warps.length; i++) {
      const a = cellCenterPx(warps[i].x, warps[i].y);
      const b = cellCenterPx(warps[(i + 1) % warps.length].x, warps[(i + 1) % warps.length].y);
      ctx.beginPath();
      ctx.moveTo(Math.round(a.cx), Math.round(a.cy));
      ctx.lineTo(Math.round(b.cx), Math.round(b.cy));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Active teleport lightning arcs
  for (let i = 0; i < sim.portalArcs.length; i++) {
    const arc = sim.portalArcs[i];
    const p1 = cellCenterPx(arc.x1, arc.y1);
    const p2 = cellCenterPx(arc.x2, arc.y2);
    const mx = (p1.cx + p2.cx) * 0.5 + (Math.random() - 0.5) * 10;
    const my = (p1.cy + p2.cy) * 0.5 + (Math.random() - 0.5) * 10;

    ctx.globalAlpha = Math.max(0, arc.life);
    drawPixelLine(ctx, p1.cx, p1.cy, mx, my, '#e7ccff', 2);
    drawPixelLine(ctx, mx, my, p2.cx, p2.cy, '#b46eff', 2);
    ctx.globalAlpha = 1;
  }
}

function drawEmitterSightline(ctx) {
  // Subtle aiming guide from emitter when paused or dragging
  if (state.isPlaying && !state.drag) return;
  const em = state.emitter;
  const d = DIRS[em.dir];
  const start = cellCenterPx(em.x, em.y);
  ctx.fillStyle = 'rgba(56, 242, 255, 0.22)';
  for (let step = 1; step <= 6; step++) {
    const nx = em.x + d.dx * step;
    const ny = em.y + d.dy * step;
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) break;
    const p = cellCenterPx(nx, ny);
    const x = Math.round(start.cx + (p.cx - start.cx) * 0.92);
    const y = Math.round(start.cy + (p.cy - start.cy) * 0.92);
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawPulses(ctx, nowMs) {
  const stepMs = Math.max(20, state.stepDurationMs || 120);
  const rawFrac = state.isPlaying ? (nowMs - state.lastStepPerfMs) / stepMs : 1;
  const frac = Math.max(0, Math.min(1, rawFrac));

  for (let i = 0; i < sim.pulses.length; i++) {
    const p = sim.pulses[i];
    const pal = p.novaBoost > 0 ? PALETTE.white : (PALETTE[p.hue] || PALETTE.cyan);
    const energyAlpha = Math.max(0.28, Math.min(1, p.energy / p.maxEnergy));

    // Compute smooth interpolated current position
    let curX = p.x;
    let curY = p.y;

    if (p.wallBounceEdge) {
      // Crisp bounce out to wall edge on first half of step, rebound on second half
      const off = frac < 0.5 ? frac * 0.9 : (1 - frac) * 0.9;
      if (p.wallBounceEdge === 'E') curX = p.x + off;
      else if (p.wallBounceEdge === 'W') curX = p.x - off;
      else if (p.wallBounceEdge === 'S') curY = p.y + off;
      else if (p.wallBounceEdge === 'N') curY = p.y - off;
    } else if (!p.wrapped && !p.justTeleported) {
      curX = p.prevX + (p.x - p.prevX) * frac;
      curY = p.prevY + (p.y - p.prevY) * frac;
    }

    const headPx = cellCenterPx(curX, curY);

    // Draw phosphor trail segments
    const trail = p.trail;
    for (let t = 1; t < trail.length; t++) {
      const a = trail[t - 1];
      const b = trail[t];
      if (b.wrapped) continue;
      if (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1) continue;
      const pa = cellCenterPx(a.x, a.y);
      const pb = cellCenterPx(b.x, b.y);
      const ratio = t / trail.length;
      const tPal = PALETTE[b.hue] || pal;
      ctx.globalAlpha = ratio * 0.55 * energyAlpha;
      drawPixelLine(ctx, pa.cx, pa.cy, pb.cx, pb.cy, tPal.main, 2);
    }

    // Segment from last trail node to smooth head
    if (!p.wrapped && !p.justTeleported && !p.wallBounceEdge) {
      const prevPx = cellCenterPx(p.prevX, p.prevY);
      ctx.globalAlpha = 0.88 * energyAlpha;
      drawPixelLine(ctx, prevPx.cx, prevPx.cy, headPx.cx, headPx.cy, pal.main, 4);
      ctx.globalAlpha = 1;
      drawPixelLine(ctx, prevPx.cx, prevPx.cy, headPx.cx, headPx.cy, pal.bright, 2);
    }

    // Glowing photon head
    const hx = Math.round(headPx.cx);
    const hy = Math.round(headPx.cy);
    ctx.globalAlpha = 0.45 * energyAlpha;
    ctx.fillStyle = pal.main;
    ctx.fillRect(hx - 4, hy - 4, 8, 8);
    ctx.globalAlpha = Math.min(1, energyAlpha + 0.15);
    ctx.fillStyle = pal.main;
    ctx.fillRect(hx - 3, hy - 3, 6, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - 1, hy - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawEmitter(ctx, em, nowMs, ghost = false) {
  const { cx, cy } = cellCenterPx(em.x, em.y);
  const x = Math.round(cx);
  const y = Math.round(cy);
  const flash = ghost ? 0 : sim.emitterFlash;

  ctx.save();
  if (ghost) ctx.globalAlpha = 0.65;

  // Outer housing
  ctx.fillStyle = flash > 0.3 ? '#38f2ff' : '#1e2c4a';
  ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.fillStyle = '#0c1322';
  ctx.fillRect(x - 5, y - 5, 10, 10);

  // Charge progress dots around core
  const rate = state.emitterRate || 8;
  const charge = state.isPlaying ? ((state.stepIndex % rate) / rate) : 0.5;
  const pulse = 0.55 + 0.45 * Math.sin(nowMs * 0.008);
  ctx.fillStyle = flash > 0.25 ? '#ffffff' : '#38f2ff';
  const coreSize = flash > 0.2 ? 6 : 4;
  ctx.fillRect(x - coreSize * 0.5, y - coreSize * 0.5, coreSize, coreSize);

  // Subtle charge indicator bar on top of housing
  const barW = Math.round(10 * (1 - charge));
  ctx.fillStyle = 'rgba(56, 242, 255, 0.55)';
  ctx.fillRect(x - 5, y - 8, barW, 1);

  // Directional barrel nozzle
  const d = DIRS[em.dir];
  ctx.fillStyle = flash > 0.2 || pulse > 0.75 ? '#c9fcff' : '#38f2ff';
  if (d.dx === 1) ctx.fillRect(x + 4, y - 2, 5, 4);
  else if (d.dx === -1) ctx.fillRect(x - 9, y - 2, 5, 4);
  else if (d.dy === 1) ctx.fillRect(x - 2, y + 4, 4, 5);
  else ctx.fillRect(x - 2, y - 9, 4, 5);

  ctx.restore();
}

function drawOptic(ctx, o, nowMs, ghost = false) {
  const { cx, cy } = cellCenterPx(o.x, o.y);
  const x = Math.round(cx);
  const y = Math.round(cy);
  const flashObj = ghost ? null : sim.nodeFlashes.get(`${o.x},${o.y}`);
  const flash = flashObj ? flashObj.intensity : 0;

  ctx.save();
  if (ghost) ctx.globalAlpha = 0.65;

  if (o.type === 'mirror') {
    const pal = PALETTE.cyan;
    // Soft glow halo when struck
    if (flash > 0.05) {
      ctx.globalAlpha = flash * 0.45;
      ctx.fillStyle = pal.main;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.globalAlpha = ghost ? 0.65 : 1;
    }

    // Small dark corner mount sockets
    ctx.fillStyle = '#253554';
    if (o.variant === 0) {
      // '/' mirror: bottom-left to top-right
      ctx.fillRect(x - 7, y + 5, 3, 3);
      ctx.fillRect(x + 4, y - 8, 3, 3);
      drawPixelLine(ctx, x - 6, y + 6, x + 6, y - 6, flash > 0.25 ? '#ffffff' : pal.main, 3);
      drawPixelLine(ctx, x - 5, y + 5, x + 5, y - 5, pal.bright, 1);
    } else {
      // '\' mirror: top-left to bottom-right
      ctx.fillRect(x - 7, y - 8, 3, 3);
      ctx.fillRect(x + 4, y + 5, 3, 3);
      drawPixelLine(ctx, x - 6, y - 6, x + 6, y + 6, flash > 0.25 ? '#ffffff' : pal.main, 3);
      drawPixelLine(ctx, x - 5, y - 5, x + 5, y + 5, pal.bright, 1);
    }
  } else if (o.type === 'split') {
    const pal = PALETTE.magenta;
    if (flash > 0.05) {
      ctx.globalAlpha = flash * 0.5;
      ctx.fillStyle = pal.main;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.globalAlpha = ghost ? 0.65 : 1;
    }

    // Pixel diamond prism
    const col = flash > 0.3 ? '#ffffff' : pal.main;
    ctx.fillStyle = col;
    ctx.fillRect(x - 2, y - 7, 4, 14);
    ctx.fillRect(x - 7, y - 2, 14, 4);
    ctx.fillRect(x - 5, y - 5, 10, 10);

    // Inner crystal facet
    ctx.fillStyle = '#240b1c';
    ctx.fillRect(x - 3, y - 3, 6, 6);

    if (o.variant === 1) {
      // 3-Way Star Prism indicator (glowing white/cyan star cross)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 4, y - 1, 8, 2);
      ctx.fillRect(x - 1, y - 4, 2, 8);
      ctx.fillStyle = '#38f2ff';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      // 2-Way T-Split crystal core
      ctx.fillStyle = pal.bright;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  } else if (o.type === 'bass') {
    const pal = PALETTE.lime;
    if (flash > 0.05) {
      ctx.globalAlpha = flash * 0.5;
      ctx.fillStyle = pal.main;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.globalAlpha = ghost ? 0.65 : 1;
    }

    // Chunky octagonal acid coil
    const col = flash > 0.3 ? '#ffffff' : pal.main;
    ctx.fillStyle = col;
    ctx.fillRect(x - 5, y - 7, 10, 14);
    ctx.fillRect(x - 7, y - 5, 14, 10);

    ctx.fillStyle = '#111a09';
    ctx.fillRect(x - 4, y - 4, 8, 8);

    if (o.variant === 1) {
      // 180° Retro-bounce solid core with double bars
      ctx.fillStyle = flash > 0.2 ? '#ffffff' : pal.bright;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#111a09';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    } else {
      // Pass-through recharging lens: hollow pulsing aperture
      const pSize = Math.sin(nowMs * 0.007) > 0 ? 4 : 2;
      ctx.fillStyle = pal.main;
      ctx.fillRect(x - pSize * 0.5, y - pSize * 0.5, pSize, pSize);
    }
  } else if (o.type === 'warp') {
    const pal = PALETTE.violet;
    if (flash > 0.05) {
      ctx.globalAlpha = flash * 0.55;
      ctx.fillStyle = pal.main;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.globalAlpha = ghost ? 0.65 : 1;
    }

    // Animated swirling pixel vortex ring
    const phase = Math.floor(nowMs / 120) % 4;
    ctx.fillStyle = flash > 0.25 ? '#ffffff' : pal.main;
    ctx.fillRect(x - 6, y - 6, 12, 2);
    ctx.fillRect(x - 6, y + 4, 12, 2);
    ctx.fillRect(x - 6, y - 6, 2, 12);
    ctx.fillRect(x + 4, y - 6, 2, 12);

    // Orbiting highlight pixel on vortex ring
    const ox = phase === 0 ? -6 : phase === 1 ? 4 : phase === 2 ? 4 : -6;
    const oy = phase === 0 ? -6 : phase === 1 ? -6 : phase === 2 ? 4 : 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + ox, y + oy, 2, 2);

    // Inner portal well
    ctx.fillStyle = '#140924';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = o.variant === 1 ? '#38f2ff' : pal.bright;
    ctx.fillRect(x - 2, y - 2, 4, 4);

    // Rotate +90° indicator chevron notch
    if (o.variant === 1) {
      ctx.fillStyle = '#38f2ff';
      ctx.fillRect(x + 2, y - 3, 2, 2);
      ctx.fillRect(x + 1, y - 4, 2, 1);
    }
  }

  ctx.restore();
}

function drawShockwavesAndSparks(ctx) {
  // Expanding pixel diamond shockwaves
  for (let i = 0; i < sim.shockwaves.length; i++) {
    const sw = sim.shockwaves[i];
    const t = Math.max(0, Math.min(1, sw.age / sw.duration));
    const alpha = 1 - t;
    const r = Math.round((0.35 + t * sw.maxR) * CELL_SIZE);
    const { cx, cy } = cellCenterPx(sw.x, sw.y);
    const pal = PALETTE[sw.color] || PALETTE.cyan;

    ctx.globalAlpha = alpha * (sw.isNova ? 0.95 : 0.65);
    const col = sw.isNova && t < 0.35 ? '#ffffff' : pal.main;
    const thick = sw.isNova ? 2 : 1;

    // Pixel diamond perimeter
    drawPixelLine(ctx, cx, cy - r, cx + r, cy, col, thick);
    drawPixelLine(ctx, cx + r, cy, cx, cy + r, col, thick);
    drawPixelLine(ctx, cx, cy + r, cx - r, cy, col, thick);
    drawPixelLine(ctx, cx - r, cy, cx, cy - r, col, thick);

    if (sw.isNova && t < 0.5) {
      const r2 = Math.round(r * 0.58);
      drawPixelLine(ctx, cx, cy - r2, cx + r2, cy, '#ff3d9a', 1);
      drawPixelLine(ctx, cx + r2, cy, cx, cy + r2, '#38f2ff', 1);
      drawPixelLine(ctx, cx, cy + r2, cx - r2, cy, '#ff3d9a', 1);
      drawPixelLine(ctx, cx - r2, cy, cx, cy - r2, '#38f2ff', 1);
    }
    ctx.globalAlpha = 1;
  }

  // Pixel impact sparks
  for (let i = 0; i < sim.sparks.length; i++) {
    const sp = sim.sparks[i];
    const { cx, cy } = cellCenterPx(sp.x, sp.y);
    const pal = PALETTE[sp.color] || PALETTE.cyan;
    ctx.globalAlpha = Math.max(0, Math.min(1, sp.life));
    ctx.fillStyle = sp.life > 0.6 ? pal.bright : pal.main;
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawDragGhost(ctx, nowMs) {
  if (!state.drag) return;
  const d = state.drag;

  if (d.offGrid) {
    // Red/magenta delete highlight around outer bezel
    ctx.strokeStyle = 'rgba(255, 61, 154, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_PAD, BOARD_PAD, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
    return;
  }

  // Highlight target cell frame
  const bx = BOARD_PAD + d.x * CELL_SIZE;
  const by = BOARD_PAD + d.y * CELL_SIZE;
  ctx.strokeStyle = 'rgba(232, 244, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 1.5, by + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);

  if (d.isEmitter) {
    drawEmitter(ctx, { ...state.emitter, x: d.x, y: d.y }, nowMs, true);
  } else if (d.item) {
    drawOptic(ctx, { ...d.item, x: d.x, y: d.y }, nowMs, true);
  }
}

export function renderChamber(canvas, nowMs) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  drawBackground(ctx);
  drawPortalTethers(ctx);
  drawEmitterSightline(ctx);
  drawPulses(ctx, nowMs);

  // Draw Optics (skipping the one currently lifted in a drag)
  for (let i = 0; i < state.optics.length; i++) {
    if (state.drag && !state.drag.isEmitter && state.drag.index === i) continue;
    drawOptic(ctx, state.optics[i], nowMs, false);
  }

  // Draw Emitter (unless currently lifted)
  if (!state.drag || !state.drag.isEmitter) {
    drawEmitter(ctx, state.emitter, nowMs, false);
  }

  drawShockwavesAndSparks(ctx);
  drawDragGhost(ctx, nowMs);
  drawChamberWalls(ctx);
}
