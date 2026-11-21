// Pixel-Art Turntable & Vinyl Platter Canvas Renderer for DUST.
// Logical resolution: 280 x 280 (crisp nearest-neighbor pixel art matching SOL-16 & 3AM).
// Renders:
//   - Recessed turntable deck & brushed strobe rim with animated pixel strobe dots
//   - Dark micro-grooved vinyl wax with subtle specular sheen & Focus Band halo
//   - Hand-stamped center white label (Side A/B, key, spinning spindle)
//   - Polar dust specks & dithered smudge arcs that flash when swept by the stylus
//   - Articulated S-curved pixel tonearm with glowing crimson stylus LED

import { state, getMarks, normalizeAngle } from '../state/store.js';
import { getKey, getSide, computeFocus } from '../state/scales.js';
import { STYLUS_ANGLE } from '../audio/scheduler.js';

export const CANVAS_SIZE = 280;
export const PLATTER = {
  cx: 130,
  cy: 146,
  rRimOut: 121,
  rRimIn: 111,
  rWaxOut: 109,
  rWaxIn: 47,
  rLabel: 42,
  rSpindle: 9,
  pivotX: 244,
  pivotY: 36,
  restX: 258,
  restY: 186,
  brushBox: { x: 11, y: 11, w: 36, h: 17 }
};

// Warm Oxblood / Brass-Gold / Cream Dubplate Pixel Palette
const C = {
  wellBg: '#0c090a',
  deckPanel: '#161113',
  deckEdge: '#281f22',
  rimMetal: '#3a3032',
  rimHighlight: '#594b4e',
  rimShadow: '#1e1719',
  strobeDot: '#8a7a7b',
  strobeLit: '#e6b85c',
  strobeScrub: '#ffe09a',

  waxBase: '#110d0f',
  waxGroove: '#191316',
  waxSheen: '#261e22',
  waxRunout: '#161113',

  focusHalo: 'rgba(230, 184, 92, 0.14)',
  focusCore: 'rgba(255, 210, 125, 0.28)',

  labelA: '#ede3cf',
  labelAInner: '#dfd1b6',
  labelB: '#d8cfc5',
  labelBInner: '#c3b6aa',
  labelInk: '#1b1416',
  labelAccentA: '#b83c48',
  labelAccentB: '#7a5a21',

  speckIn: '#ffe09a',
  speckMid: '#e6b85c',
  speckDim: '#6f5a38',
  smudgeFill: '#d9a44c',
  smudgeBright: '#ffebb8',
  smudgeDim: '#5c462b',

  armBase: '#2c2326',
  armBaseHi: '#4a3d41',
  armMetal: '#b5a7a3',
  armMetalShadow: '#695c5a',
  headshell: '#251e20',
  crimson: '#d94f5c',
  crimsonBright: '#ff96a0',
  crimsonDim: '#592329'
};

// Tiny 3x5 pixel bitmap font for crisp white-label stamping
const PIXEL_FONT = {
  A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7],
  F:[7,4,6,4,4], G:[3,4,5,5,3], H:[5,5,7,5,5], I:[7,2,2,2,7], J:[1,1,1,5,2],
  K:[5,5,6,5,5], L:[4,4,4,4,7], M:[5,7,5,5,5], N:[5,7,7,5,5], O:[2,5,5,5,2],
  P:[6,5,6,4,4], Q:[2,5,5,7,3], R:[6,5,6,5,5], S:[3,4,2,1,6], T:[7,2,2,2,2],
  U:[5,5,5,5,7], V:[5,5,5,5,2], W:[5,5,5,7,5], X:[5,5,2,5,5], Y:[5,5,2,2,2],
  Z:[7,1,2,4,7], '0':[7,5,5,5,7], '1':[2,6,2,2,7], '2':[7,1,7,4,7], '3':[7,1,3,1,7],
  '4':[5,5,7,1,1], '5':[7,4,7,1,7], '6':[7,4,7,5,7], '7':[7,1,1,2,2], '8':[7,5,7,5,7],
  '9':[7,5,7,1,7], '-':[0,0,7,0,0], '.':[0,0,0,0,2], ' ':[0,0,0,0,0]
};

export function groovePosToPixelRadius(groovePos) {
  return PLATTER.rWaxIn + groovePos * (PLATTER.rWaxOut - PLATTER.rWaxIn);
}

export function pixelRadiusToGroovePos(r) {
  return Math.max(0.02, Math.min(0.98, (r - PLATTER.rWaxIn) / (PLATTER.rWaxOut - PLATTER.rWaxIn)));
}

export function getStylusTipPosition() {
  if (!state.needleDropped) {
    return { x: PLATTER.restX, y: PLATTER.restY };
  }
  const r = groovePosToPixelRadius(state.groovePos);
  return {
    x: PLATTER.cx + Math.cos(STYLUS_ANGLE) * r,
    y: PLATTER.cy + Math.sin(STYLUS_ANGLE) * r
  };
}

// Pre-rendered static vinyl grooves & deck surface on an offscreen canvas for crisp 60fps performance
function buildStaticBackdrop() {
  const off = document.createElement('canvas');
  off.width = CANVAS_SIZE;
  off.height = CANVAS_SIZE;
  const g = off.getContext('2d');
  g.imageSmoothingEnabled = false;

  const { cx, cy, rRimOut, rRimIn, rWaxOut, rWaxIn } = PLATTER;

  // Recessed dark well + subtle corner screws
  g.fillStyle = C.wellBg;
  g.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Subtle corner mounting plate details
  g.fillStyle = C.deckPanel;
  g.fillRect(3, 3, CANVAS_SIZE - 6, CANVAS_SIZE - 6);
  g.fillStyle = C.deckEdge;
  g.fillRect(3, 3, CANVAS_SIZE - 6, 1);
  g.fillRect(3, 3, 1, CANVAS_SIZE - 6);

  // Corner deck rivets (bottom-left and bottom-right; top-left hosts carbon brush cradle)
  const rivets = [[9, CANVAS_SIZE - 13], [CANVAS_SIZE - 13, CANVAS_SIZE - 13]];
  rivets.forEach(([rx, ry]) => {
    g.fillStyle = '#090708';
    g.fillRect(rx, ry, 4, 4);
    g.fillStyle = '#33282b';
    g.fillRect(rx + 1, ry + 1, 2, 2);
  });

  // Platter drop shadow
  drawFilledPixelCircle(g, cx + 2, cy + 3, rRimOut + 1, '#060405');

  // Brushed metal outer strobe bevel
  drawFilledPixelCircle(g, cx, cy, rRimOut, C.rimShadow);
  drawFilledPixelCircle(g, cx, cy, rRimOut - 1, C.rimMetal);
  drawFilledPixelCircle(g, cx, cy, rRimIn, '#090708');

  // Vinyl wax base disc
  drawFilledPixelCircle(g, cx, cy, rWaxOut, C.waxBase);

  // Crisp concentric micro-grooves
  for (let r = rWaxIn + 2; r <= rWaxOut - 2; r += 3) {
    drawPixelRing(g, cx, cy, r, (r % 6 === 0) ? C.waxGroove : '#151012');
  }

  // Subtle inner runout boundary
  drawPixelRing(g, cx, cy, rWaxIn, '#231b1f');
  drawPixelRing(g, cx, cy, rWaxIn - 2, C.waxRunout);

  return off;
}

function drawFilledPixelCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const rr = r * r;
  for (let dy = -r; dy <= r; dy++) {
    const dxMax = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
    ctx.fillRect(Math.round(cx - dxMax), Math.round(cy + dy), dxMax * 2 + 1, 1);
  }
}

function drawPixelRing(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const steps = Math.max(48, Math.round(r * 6.5));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawPixelLine(ctx, x0, y0, x1, y1, color, thickness = 1) {
  ctx.fillStyle = color;
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;
  const half = Math.floor(thickness / 2);

  while (true) {
    ctx.fillRect(ix0 - half, iy0 - half, thickness, thickness);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; ix0 += sx; }
    if (e2 < dx) { err += dx; iy0 += sy; }
  }
}

function drawPixelTextCentered(ctx, text, cx, y, color) {
  const str = String(text).toUpperCase();
  const totalW = str.length * 4 - 1;
  let x = Math.round(cx - totalW / 2);
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const glyph = PIXEL_FONT[str[i]] || PIXEL_FONT[' '];
    for (let row = 0; row < 5; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 3; col++) {
        if (bits & (1 << (2 - col))) {
          ctx.fillRect(x + col, Math.round(y) + row, 1, 1);
        }
      }
    }
    x += 4;
  }
}

export function initPlatterCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const backdrop = buildStaticBackdrop();

  function drawStrobeRim(angle) {
    const { cx, cy, rRimIn, rRimOut } = PLATTER;
    const rDots = (rRimIn + rRimOut) * 0.5;
    const dotCount = 36;
    const isScrub = state.scrubFlash > 0.1;

    for (let i = 0; i < dotCount; i++) {
      const a = angle + (i / dotCount) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rDots);
      const y = Math.round(cy + Math.sin(a) * rDots);

      // Dots near the bottom-left crimson strobe lamp glow brighter
      const lampDist = Math.abs(normalizeAngle(a - 2.35) - Math.PI);
      const nearLamp = lampDist > 2.45;
      if (isScrub) {
        ctx.fillStyle = C.strobeScrub;
      } else if (state.needleDropped && nearLamp) {
        ctx.fillStyle = C.crimsonBright;
      } else if (i % 3 === 0) {
        ctx.fillStyle = state.isRimHeld ? C.strobeLit : C.strobeDot;
      } else {
        ctx.fillStyle = '#524548';
      }
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    // Bottom-left Technics-style crimson strobe tower lamp
    const lx = 26;
    const ly = 248;
    ctx.fillStyle = '#251c1f';
    ctx.fillRect(lx - 7, ly - 5, 14, 10);
    ctx.fillStyle = '#3c2e32';
    ctx.fillRect(lx - 6, ly - 4, 12, 8);
    ctx.fillStyle = state.needleDropped
      ? (state.kickPulse > 0.25 ? C.crimsonBright : C.crimson)
      : C.crimsonDim;
    ctx.fillRect(lx - 3, ly - 2, 6, 4);
  }

  function drawWaxSheenAndFocusBand(angle) {
    const { cx, cy, rWaxIn, rWaxOut } = PLATTER;

    // Subtle specular vinyl wedge sheen (slowly wobbles slightly with rotation)
    const sheenAngle = -0.68 + Math.sin(angle * 2) * 0.04;
    for (let band = 0; band < 2; band++) {
      const baseA = sheenAngle + band * Math.PI;
      for (let r = rWaxIn + 4; r <= rWaxOut - 4; r += 4) {
        for (let da = -0.22; da <= 0.22; da += 0.055) {
          const x = Math.round(cx + Math.cos(baseA + da) * r);
          const y = Math.round(cy + Math.sin(baseA + da) * r);
          if (((x + y) & 1) === 0) {
            ctx.fillStyle = C.waxSheen;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    // Focus Band Halo centered on the needle's current groove radius!
    if (state.needleDropped || state.isTonearmHeld) {
      const rFocus = groovePosToPixelRadius(state.groovePos);
      const bandHalf = 11;
      const rMin = Math.max(rWaxIn + 1, Math.round(rFocus - bandHalf));
      const rMax = Math.min(rWaxOut - 1, Math.round(rFocus + bandHalf));

      // Dithered warm gold focus band so you clearly see which specks are in the stylus sweet spot
      for (let r = rMin; r <= rMax; r += 2) {
        const distNorm = Math.abs(r - rFocus) / bandHalf;
        const steps = Math.round(r * 3.1);
        ctx.fillStyle = distNorm < 0.35 ? C.focusCore : C.focusHalo;
        for (let i = 0; i < steps; i++) {
          if (distNorm > 0.45 && (i & 1) === 1) continue;
          const a = (i / steps) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(a) * r);
          const y = Math.round(cy + Math.sin(a) * r);
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Crisp active groove tracking ring right under stylus
      drawPixelRing(
        ctx,
        cx,
        cy,
        Math.round(rFocus),
        state.stylusGlow > 0.2 ? '#e6b85c' : '#573c28'
      );
    }

    // Carbon-brush wipe sweep animation (brass handle + dark bristle bar gliding over wax)
    if (state.brushSweep > 0.02) {
      const sweepA = -2.35 + (1 - state.brushSweep) * Math.PI * 2;
      const x1 = cx + Math.cos(sweepA) * (rWaxIn + 1);
      const y1 = cy + Math.sin(sweepA) * (rWaxIn + 1);
      const x2 = cx + Math.cos(sweepA) * (rWaxOut - 1);
      const y2 = cy + Math.sin(sweepA) * (rWaxOut - 1);
      drawPixelLine(ctx, x1 + 1, y1 + 2, x2 + 1, y2 + 2, 'rgba(6, 4, 5, 0.7)', 4);
      drawPixelLine(ctx, x1, y1, x2, y2, '#3a2d2f', 4);
      drawPixelLine(ctx, x1, y1, x2, y2, '#ffe09a', 2);
    }
  }

  function drawDeckBrush() {
    const { x, y, w, h } = PLATTER.brushBox;
    const hasMarks = getMarks().length > 0;
    const hovered = state.hoverZone === 'brush';
    const sweeping = state.brushSweep > 0.08;

    // Recessed matte cradle on top-left corner of turntable deck
    ctx.fillStyle = '#090708';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hovered ? '#3a2d24' : '#241b1e';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#120d0f';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    if (!sweeping) {
      // Carbon-fiber vinyl brush body parked in cradle
      const handleCol = hovered ? '#ffe09a' : (hasMarks ? '#e6b85c' : '#7a6850');
      const gripCol = hovered ? '#594234' : '#3a2c2f';
      // Brass top spine
      ctx.fillStyle = handleCol;
      ctx.fillRect(x + 4, y + 3, w - 8, 3);
      // Matte handle body
      ctx.fillStyle = gripCol;
      ctx.fillRect(x + 4, y + 6, w - 8, 4);
      ctx.fillStyle = '#1d1517';
      ctx.fillRect(x + 6, y + 7, w - 12, 2);
      // Fine carbon-fiber bristles along bottom edge
      for (let bx = x + 5; bx < x + w - 5; bx += 2) {
        ctx.fillStyle = hovered ? '#d9c5a0' : (hasMarks ? '#9c8a78' : '#4f4345');
        ctx.fillRect(bx, y + 10, 1, 4);
      }
    }

    // Tiny diegetic label underneath cradle
    drawPixelTextCentered(
      ctx,
      'BRUSH',
      x + w / 2,
      y + h + 3,
      hovered ? '#ffe09a' : (hasMarks ? '#a88c5c' : '#524447')
    );
  }

  function drawCenterWhiteLabel(angle) {
    const { cx, cy, rLabel, rSpindle } = PLATTER;
    const isA = state.side === 'A';
    const side = getSide(state.side);
    const key = getKey(state.keyId);

    // Subtle kick-pulse halo around label edge
    if (state.kickPulse > 0.08) {
      drawPixelRing(ctx, cx, cy, rLabel + 1, state.kickPulse > 0.45 ? C.speckMid : '#523c24');
    }

    drawFilledPixelCircle(ctx, cx, cy, rLabel, isA ? C.labelA : C.labelB);
    drawFilledPixelCircle(ctx, cx, cy, rLabel - 3, isA ? C.labelAInner : C.labelBInner);
    drawPixelRing(ctx, cx, cy, rLabel - 4, isA ? C.labelAccentA : C.labelAccentB);

    // Spinning radial marker notch on white label so rotation speed is immediately readable
    const notchX = Math.round(cx + Math.cos(angle) * (rLabel - 8));
    const notchY = Math.round(cy + Math.sin(angle) * (rLabel - 8));
    ctx.fillStyle = isA ? C.labelAccentA : C.labelAccentB;
    ctx.fillRect(notchX - 2, notchY - 2, 4, 4);

    // Opposite micro-dot
    const dotX = Math.round(cx + Math.cos(angle + Math.PI) * (rLabel - 9));
    const dotY = Math.round(cy + Math.sin(angle + Math.PI) * (rLabel - 9));
    ctx.fillStyle = '#736558';
    ctx.fillRect(dotX - 1, dotY - 1, 2, 2);

    // Crisp hand-stamped typography (upright for legibility!)
    drawPixelTextCentered(ctx, side.stamp, cx, cy - 23, C.labelInk);
    drawPixelTextCentered(ctx, `${key.label} ${state.bpm}`, cx, cy + 14, C.labelInk);
    drawPixelTextCentered(ctx, side.name.slice(0, 7), cx, cy + 22, isA ? C.labelAccentA : C.labelAccentB);

    // Center metallic spindle hole
    drawFilledPixelCircle(ctx, cx, cy, rSpindle, '#292123');
    drawFilledPixelCircle(ctx, cx, cy, rSpindle - 2, '#100c0d');
    ctx.fillStyle = state.needleDropped ? C.crimson : '#6e5f61';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  function drawMark(mark, platterAngle, isDraft = false) {
    const { cx, cy } = PLATTER;
    const r = groovePosToPixelRadius(mark.radius);
    const worldA = normalizeAngle(mark.angle + platterAngle);
    const focus = computeFocus(mark.radius, state.groovePos);
    const inFocus = focus >= 0.48;
    const flash = mark.flash || 0;

    if (mark.kind === 'smudge') {
      // Curved dithered oil-sheen smudge arc along the groove
      const arcSpan = Math.max(0.18, mark.smearArc || 0.24);
      const halfThick = Math.max(2, Math.round(2 + mark.size * 3.5));
      const steps = Math.max(8, Math.round(arcSpan * r * 0.75));

      for (let s = 0; s <= steps; s++) {
        const u = s / steps - 0.5;
        const a = worldA + u * arcSpan;
        // Taper thickness cleanly at arc ends
        const taper = Math.cos(u * Math.PI);
        const radSpan = Math.max(1, Math.round(halfThick * taper));

        for (let dr = -radSpan; dr <= radSpan; dr++) {
          const px = Math.round(cx + Math.cos(a) * (r + dr));
          const py = Math.round(cy + Math.sin(a) * (r + dr));
          // Bayer-like pixel dither on edges for authentic smudged fingerprint texture
          const isEdge = Math.abs(dr) === radSpan;
          if (isEdge && ((px + py) & 1) === 1 && flash < 0.2) continue;

          if (flash > 0.28 || isDraft) {
            ctx.fillStyle = C.smudgeBright;
          } else if (inFocus) {
            ctx.fillStyle = isEdge ? '#9c7233' : C.smudgeFill;
          } else {
            ctx.fillStyle = isEdge ? '#3d2e1e' : C.smudgeDim;
          }
          ctx.fillRect(px, py, 1, 1);
        }
      }

      // Flash ripple when swept by stylus
      if (flash > 0.08) {
        const mx = Math.round(cx + Math.cos(worldA) * r);
        const my = Math.round(cy + Math.sin(worldA) * r);
        const rippleR = Math.round(4 + (1 - flash) * 11);
        drawPixelRing(ctx, mx, my, rippleR, '#ffe09a');
      }
      return;
    }

    // Crisp dust speck fleck
    const mx = Math.round(cx + Math.cos(worldA) * r);
    const my = Math.round(cy + Math.sin(worldA) * r);
    const pxSize = mark.size > 0.55 ? 4 : (mark.size > 0.3 ? 3 : 2);
    const off = Math.floor(pxSize / 2);

    ctx.fillStyle = (flash > 0.22 || isDraft)
      ? C.speckIn
      : (inFocus ? C.speckMid : C.speckDim);
    ctx.fillRect(mx - off, my - off, pxSize, pxSize);

    // Bright center core pixel
    if (inFocus || flash > 0.2) {
      ctx.fillStyle = '#fff5d6';
      ctx.fillRect(mx, my, 1, 1);
    }

    if (flash > 0.08) {
      const rippleR = Math.round(3 + (1 - flash) * 9);
      drawPixelRing(ctx, mx, my, rippleR, C.speckIn);
    }
  }

  function drawTonearm() {
    const { pivotX, pivotY, restX, restY } = PLATTER;
    const tip = getStylusTipPosition();

    // Tonearm park cradle
    ctx.fillStyle = '#2d2326';
    ctx.fillRect(restX - 5, restY - 4, 10, 8);
    ctx.fillStyle = '#4f3f43';
    ctx.fillRect(restX - 4, restY - 3, 8, 2);

    // Top-right gimbal base housing
    drawFilledPixelCircle(ctx, pivotX, pivotY, 20, '#090708');
    drawFilledPixelCircle(ctx, pivotX, pivotY, 18, C.armBase);
    drawPixelRing(ctx, pivotX, pivotY, 17, C.armBaseHi);
    drawFilledPixelCircle(ctx, pivotX, pivotY, 9, '#191315');
    drawFilledPixelCircle(ctx, pivotX, pivotY, 6, '#57494c');

    // Counterweight sticking out above/behind pivot
    const dirX = tip.x - pivotX;
    const dirY = tip.y - pivotY;
    const len = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;
    const px = -uy;
    const py = ux;

    const cwX = pivotX - ux * 16;
    const cwY = pivotY - uy * 16;
    drawPixelLine(ctx, pivotX, pivotY, cwX, cwY, C.armMetalShadow, 4);
    drawFilledPixelCircle(ctx, Math.round(cwX), Math.round(cwY), 5, '#463a3d');

    // Slight S-curve elbow along the tonearm tube
    const elbowX = pivotX + ux * (len * 0.68) + px * 7;
    const elbowY = pivotY + uy * (len * 0.68) + py * 7;

    // Drop shadow underneath arm
    drawPixelLine(ctx, pivotX + 2, pivotY + 3, elbowX + 2, elbowY + 3, 'rgba(6, 4, 5, 0.72)', 4);
    drawPixelLine(ctx, elbowX + 2, elbowY + 3, tip.x + 2, tip.y + 3, 'rgba(6, 4, 5, 0.72)', 4);

    // Metallic tonearm shaft
    drawPixelLine(ctx, pivotX, pivotY, elbowX, elbowY, C.armMetalShadow, 4);
    drawPixelLine(ctx, pivotX, pivotY, elbowX, elbowY, C.armMetal, 2);
    drawPixelLine(ctx, elbowX, elbowY, tip.x, tip.y, C.armMetalShadow, 4);
    drawPixelLine(ctx, elbowX, elbowY, tip.x, tip.y, C.armMetal, 2);

    // Cartridge Headshell block around stylus tip
    const hx = Math.round(tip.x);
    const hy = Math.round(tip.y);
    ctx.fillStyle = '#090708';
    ctx.fillRect(hx - 6, hy - 5, 12, 10);
    ctx.fillStyle = state.isTonearmHeld ? '#4a3a3f' : C.headshell;
    ctx.fillRect(hx - 5, hy - 4, 10, 8);
    ctx.fillStyle = '#5e4c51';
    ctx.fillRect(hx - 4, hy - 3, 8, 2);

    // Finger lift handle jutting off headshell
    drawPixelLine(ctx, hx + 4, hy - 2, hx + 9, hy - 5, C.armMetal, 1);

    // Glowing Crimson Stylus LED & diamond needle point
    const glow = state.stylusGlow;
    ctx.fillStyle = state.needleDropped
      ? (glow > 0.25 ? C.crimsonBright : C.crimson)
      : C.crimsonDim;
    ctx.fillRect(hx - 2, hy + 1, 4, 2);

    if (state.needleDropped && glow > 0.12) {
      drawPixelRing(ctx, hx, hy + 2, Math.round(4 + glow * 5), C.crimsonBright);
    }
  }

  function renderFrame(dtSec) {
    // Decay per-mark flash smoothly
    const marks = getMarks();
    for (let i = 0; i < marks.length; i++) {
      if (marks[i].flash > 0) {
        marks[i].flash *= Math.exp(-dtSec * 8.5);
        if (marks[i].flash < 0.01) marks[i].flash = 0;
      }
    }

    ctx.drawImage(backdrop, 0, 0);
    drawDeckBrush();
    drawStrobeRim(state.platterAngle);
    drawWaxSheenAndFocusBand(state.platterAngle);

    // Draw all polar dust specks & finger smudges
    for (let i = 0; i < marks.length; i++) {
      drawMark(marks[i], state.platterAngle, false);
    }

    // Draw active press-and-hold draft smudge preview
    if (state.draftMark) {
      drawMark(state.draftMark, state.platterAngle, true);
    }

    drawCenterWhiteLabel(state.platterAngle);
    drawTonearm();
  }

  return { renderFrame };
}
