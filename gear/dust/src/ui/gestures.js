// Multi-zone pointer & touch gesture engine for DUST.
// Zero-conflict physical interaction zones:
//   1) Tonearm / Stylus   -> Drag radially (outer <-> inner groove) or dock off-edge to stop
//   2) Center Spindle     -> Tap to Drop / Lift needle (Play / Stop)
//   3) Strobe Rim / Label -> Drag tangentially to pitch-bend, hold to brake, back-spin to scrub
//                            (Double-tap white label flips Side A <-> Side B)
//   4) Vinyl Wax Surface  -> Tap = dust speck; Hold/Smear = granular smudge; Double-tap mark = flick off

import {
  state,
  getMarks,
  normalizeAngle,
  addMark,
  removeMarkById,
  clearCurrentSideMarks,
  setGroovePos,
  flipSide,
  showStatus
} from '../state/store.js';
import { getZoneLabel } from '../state/scales.js';
import {
  applyRimDrag,
  beginRimHold,
  endRimHold
} from '../engine/platterPhysics.js';
import { initAudio, playScrubZip, playBrushWipeSound } from '../audio/engine.js';
import { dropNeedle, liftNeedle, toggleNeedle } from '../audio/scheduler.js';
import { auditionMark } from '../audio/synths.js';
import {
  CANVAS_SIZE,
  PLATTER,
  groovePosToPixelRadius,
  pixelRadiusToGroovePos,
  getStylusTipPosition
} from './platterCanvas.js';

const TAU = Math.PI * 2;

function toCanvasCoords(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_SIZE,
    y: ((clientY - rect.top) / rect.height) * CANVAS_SIZE
  };
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function shortestAngleDelta(fromA, toA) {
  let d = toA - fromA;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function findMarkNear(x, y, maxDist = 11) {
  const marks = getMarks();
  let best = null;
  let bestD = maxDist;
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    const r = groovePosToPixelRadius(m.radius);
    const wa = normalizeAngle(m.angle + state.platterAngle);
    const mx = PLATTER.cx + Math.cos(wa) * r;
    const my = PLATTER.cy + Math.sin(wa) * r;
    const d = Math.hypot(x - mx, y - my);
    const threshold = m.kind === 'smudge' ? maxDist + 4 : maxDist;
    if (d < threshold && d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function classifyZone(x, y) {
  // Top-left parked carbon-fiber record brush (generous touch target)
  const bb = PLATTER.brushBox;
  if (x >= bb.x - 6 && x <= bb.x + bb.w + 8 && y >= bb.y - 6 && y <= bb.y + bb.h + 14) {
    return 'brush';
  }

  const tip = getStylusTipPosition();
  const distToTip = Math.hypot(x - tip.x, y - tip.y);
  const distToShaft = pointToSegmentDist(x, y, PLATTER.pivotX, PLATTER.pivotY, tip.x, tip.y);
  const distToRest = Math.hypot(x - PLATTER.restX, y - PLATTER.restY);

  if (distToTip <= 20 || distToShaft <= 9 || (!state.needleDropped && distToRest <= 18)) {
    return 'tonearm';
  }

  const distCenter = Math.hypot(x - PLATTER.cx, y - PLATTER.cy);
  if (distCenter <= PLATTER.rSpindle + 5) return 'spindle';
  if (distCenter <= PLATTER.rLabel) return 'label';
  if (distCenter >= PLATTER.rWaxIn - 2 && distCenter <= PLATTER.rWaxOut + 2) return 'wax';
  if (distCenter > PLATTER.rWaxOut + 2 && distCenter <= PLATTER.rRimOut + 12) return 'rim';
  return 'deck';
}

export function initPlatterGestures(canvas) {
  let active = null;
  let lastTapTime = 0;
  let lastTapZone = '';
  let lastTapMarkId = null;

  function updateDraftFromPointer(pt) {
    if (!active || active.mode !== 'wax') return;
    const elapsed = (performance.now() - active.startTime) / 1000;
    const moveDist = Math.hypot(pt.x - active.startX, pt.y - active.startY);
    const curWorldA = Math.atan2(pt.y - PLATTER.cy, pt.x - PLATTER.cx);
    const curDiscA = normalizeAngle(curWorldA - state.platterAngle);
    const arcDelta = Math.abs(shortestAngleDelta(active.startDiscAngle, curDiscA));

    // Promote to smudge once held >= 0.20s or smeared noticeably along wax
    if (elapsed >= 0.20 || moveDist >= 7) {
      active.isSmudge = true;
      const size = Math.min(1.0, 0.34 + elapsed * 0.55 + (moveDist / 65) * 0.3);
      const smearArc = Math.min(0.85, Math.max(0.20, arcDelta * 1.35 + elapsed * 0.25));
      state.draftMark = {
        angle: active.startDiscAngle,
        radius: active.startRadiusNorm,
        size,
        smearArc,
        kind: 'smudge',
        flash: 0.7
      };
    }
  }

  // Smoothly grow draft smudge even if the user holds their finger completely still
  let holdGrowRaf = null;
  function tickHoldGrow() {
    if (!active || active.mode !== 'wax') {
      holdGrowRaf = null;
      return;
    }
    updateDraftFromPointer({ x: active.lastX, y: active.lastY });
    holdGrowRaf = requestAnimationFrame(tickHoldGrow);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    initAudio();

    const pt = toCanvasCoords(canvas, e.clientX, e.clientY);
    const zone = classifyZone(pt.x, pt.y);
    const now = performance.now();

    canvas.setPointerCapture(e.pointerId);

    if (zone === 'brush') {
      clearCurrentSideMarks();
      playBrushWipeSound();
      active = null;
      return;
    }

    if (zone === 'tonearm') {
      state.isTonearmHeld = true;
      active = {
        pointerId: e.pointerId,
        mode: 'tonearm',
        startX: pt.x,
        startY: pt.y,
        moved: false
      };
      return;
    }

    if (zone === 'spindle') {
      toggleNeedle();
      active = null;
      return;
    }

    if (zone === 'rim' || zone === 'label') {
      const isDoubleTapLabel = zone === 'label' && lastTapZone === 'label' && (now - lastTapTime) < 340;
      lastTapTime = now;
      lastTapZone = zone;
      lastTapMarkId = null;

      if (isDoubleTapLabel) {
        flipSide();
        active = null;
        return;
      }

      beginRimHold();
      const angle = Math.atan2(pt.y - PLATTER.cy, pt.x - PLATTER.cx);
      active = {
        pointerId: e.pointerId,
        mode: 'rim',
        zone,
        lastAngle: angle,
        lastTime: now,
        moved: false
      };
      return;
    }

    if (zone === 'wax') {
      const hitMark = findMarkNear(pt.x, pt.y, 11);
      const isDoubleTapMark = hitMark && lastTapMarkId === hitMark.id && (now - lastTapTime) < 360;

      if (isDoubleTapMark) {
        removeMarkById(hitMark.id);
        showStatus('FLICKED DUST OFF');
        lastTapMarkId = null;
        lastTapTime = 0;
        active = null;
        return;
      }

      lastTapTime = now;
      lastTapZone = 'wax';
      lastTapMarkId = hitMark ? hitMark.id : null;

      // Auto-drop needle if user starts tapping directly on a silent record
      if (!state.needleDropped) {
        dropNeedle();
      }

      const distCenter = Math.hypot(pt.x - PLATTER.cx, pt.y - PLATTER.cy);
      const worldA = Math.atan2(pt.y - PLATTER.cy, pt.x - PLATTER.cx);
      const discA = normalizeAngle(worldA - state.platterAngle);
      const radiusNorm = pixelRadiusToGroovePos(distCenter);

      active = {
        pointerId: e.pointerId,
        mode: 'wax',
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y,
        startTime: now,
        startDiscAngle: discA,
        startRadiusNorm: radiusNorm,
        isSmudge: false,
        hitExisting: Boolean(hitMark)
      };

      if (!holdGrowRaf) {
        holdGrowRaf = requestAnimationFrame(tickHoldGrow);
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const pt = toCanvasCoords(canvas, e.clientX, e.clientY);

    if (!active) {
      const z = classifyZone(pt.x, pt.y);
      state.hoverZone = z;
      if (z === 'tonearm' || z === 'rim') canvas.style.cursor = 'grab';
      else if (z === 'spindle' || z === 'label' || z === 'brush') canvas.style.cursor = 'pointer';
      else if (z === 'wax') canvas.style.cursor = findMarkNear(pt.x, pt.y, 10) ? 'pointer' : 'crosshair';
      else canvas.style.cursor = 'default';
      return;
    }

    if (e.pointerId !== active.pointerId) return;

    if (active.mode === 'tonearm') {
      const distMoved = Math.hypot(pt.x - active.startX, pt.y - active.startY);
      if (distMoved > 3) active.moved = true;

      const distCenter = Math.hypot(pt.x - PLATTER.cx, pt.y - PLATTER.cy);
      // Dragging tonearm past the outer rim docks & parks it
      if (distCenter > PLATTER.rRimOut - 2 && pt.x > PLATTER.cx + 78) {
        if (state.needleDropped) {
          liftNeedle();
        }
      } else {
        const nextPos = pixelRadiusToGroovePos(distCenter);
        if (!state.needleDropped) {
          dropNeedle(nextPos);
        } else {
          setGroovePos(nextPos);
        }
        showStatus(getZoneLabel(state.groovePos, state.side), 1100);
      }
      return;
    }

    if (active.mode === 'rim') {
      const now = performance.now();
      const dtSec = (now - active.lastTime) / 1000;
      const curAngle = Math.atan2(pt.y - PLATTER.cy, pt.x - PLATTER.cx);
      const delta = shortestAngleDelta(active.lastAngle, curAngle);

      if (Math.abs(delta) > 0.002) {
        active.moved = true;
        const { scrubbed } = applyRimDrag(delta, dtSec);
        if (scrubbed) {
          playScrubZip();
        }
      }

      active.lastAngle = curAngle;
      active.lastTime = now;
      return;
    }

    if (active.mode === 'wax') {
      active.lastX = pt.x;
      active.lastY = pt.y;
      updateDraftFromPointer(pt);
    }
  });

  function finishPointer(e) {
    if (!active || e.pointerId !== active.pointerId) return;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (active.mode === 'tonearm') {
      state.isTonearmHeld = false;
      // Single click on parked tonearm drops it onto the wax
      if (!active.moved) {
        toggleNeedle();
      }
    } else if (active.mode === 'rim') {
      endRimHold();
    } else if (active.mode === 'wax') {
      if (active.isSmudge && state.draftMark) {
        const committed = addMark({
          angle: state.draftMark.angle,
          radius: state.draftMark.radius,
          size: state.draftMark.size,
          smearArc: state.draftMark.smearArc,
          kind: 'smudge'
        });
        auditionMark(committed);
        showStatus('SMUDGED WAX', 1200);
      } else if (!active.hitExisting) {
        const committed = addMark({
          angle: active.startDiscAngle,
          radius: active.startRadiusNorm,
          size: 0.22 + Math.random() * 0.22,
          smearArc: 0,
          kind: 'speck'
        });
        auditionMark(committed);
        showStatus('DUST SPECK', 1000);
      }
      state.draftMark = null;
    }

    active = null;
    if (holdGrowRaf) {
      cancelAnimationFrame(holdGrowRaf);
      holdGrowRaf = null;
    }
  }

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('pointerleave', () => {
    state.hoverZone = null;
  });
}
