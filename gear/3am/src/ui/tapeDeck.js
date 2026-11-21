// Interactive Pixel-Art 4-Track Magnetic Tape Deck Canvas for 3AM.
// Logical resolution: 264 x 224 (taller thumb-friendly bays, crisp pixelated rendering).
//
// Spatial zones per lane:
//   [0..36]     Left spinning pixel reel  -> Tap to Mute / Unmute
//   [38..228]   Magnetic tape strip       -> Tap slot: Anchor | Drag Y on anchor: Pitch/Voice
//                                            Drag X on empty: Slip phase | Drag right roller: Loop len (3-16)
//   [232..263]  Right vertical head meter -> Drag Y: Head pressure (filter openness & level)

import {
  state,
  toggleMute,
  setLaneLength,
  setLanePressure,
  setAnchor,
  slipLanePhase,
  showStatus
} from '../state/store.js';
import { LANES, getKey, getHour, getValueLabel } from '../state/scales.js';
import { getAudioNodes, updateAudioParams } from '../audio/engine.js';
import { auditionLane } from '../audio/synths.js';

const W = 264;
let H = 224;

// Subtle Night-Arc LCD header tints per hour
const HOUR_LCD = {
  '01': { bg: '#d8dec7', ghost: '#a3ad92', ink: '#171b14' }, // Warm 1 AM
  '03': { bg: '#cddfd1', ghost: '#97b2a1', ink: '#121b18' }, // Berlin 3 AM
  '05': { bg: '#b6c9c5', ghost: '#849b97', ink: '#0e1716' }, // Abyss 5 AM
  '07': { bg: '#daf0e4', ghost: '#9fc0b0', ink: '#111d18' }  // Dawn 7 AM
};

// Berlin 3 AM Palette
const C = {
  deckBg: '#0c1312',
  deckRail: '#162220',
  deckWell: '#080d0c',
  deckHatch: '#131d1b',
  divider: '#1b2826',

  tapeBody: '#13201d',
  tapeEdge: '#233632',
  tapeMuted: '#101817',

  reelRing: '#49635c',
  reelRim: '#709188',
  reelHub: '#111a18',
  reelDim: '#273532',

  mint: '#4ee6a8',
  mintBright: '#a4ffdc',
  mintDeep: '#1d6e50',

  amber: '#f2a649',
  amberBright: '#ffd594',
  amberDeep: '#7d4c17',

  playhead: '#e8faf0',
  rollerBody: '#2b3d38',
  rollerEdge: '#4f6d64',
  rollerHi: '#8ab3a7',
  textDim: '#5b756d',
  textMid: '#8da89f'
};

// Adaptive vertical layout metrics (recalculated cleanly on viewport resize)
const HEADER_H = 17;
const LEGEND_Y = 18;
const BAYS_TOP = 28;
const TAPE_OFFSET_Y = 5;
const TAPE_X = 40;
const SLOT_W = 11;
const PRESS_X = 235;
const PRESS_W = 22;

function getMetrics() {
  const bayH = Math.floor((H - BAYS_TOP - 2) / 4);
  const tapeH = Math.max(28, bayH - 11);
  return { bayH, tapeH };
}

// Crisp 3x5 bitmap pixel font
const FONT_3X5 = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 5, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 5, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 3, 1, 7],
  '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 1, 2, 2],
  '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
  ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], '.': [0, 0, 0, 0, 2],
  '!': [2, 2, 2, 0, 2], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5], '@': [2, 5, 7, 4, 3],
  ' ': [0, 0, 0, 0, 0]
};

export function initTapeDeck(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Dynamically adapt logical pixel height H to fill tall mobile / wide landscape bezels edge-to-edge
  function syncLogicalResolution() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const targetH = Math.max(204, Math.min(312, Math.round(W * (rect.height / rect.width))));
    if (Math.abs(targetH - H) >= 2) {
      H = targetH;
      canvas.width = W;
      canvas.height = H;
      ctx.imageSmoothingEnabled = false;
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => syncLogicalResolution());
    ro.observe(canvas);
  }
  window.addEventListener('resize', syncLogicalResolution);
  requestAnimationFrame(syncLogicalResolution);

  const waveData = new Uint8Array(128);
  const reelAngles = { sub: 0, cut: 0, chd: 0, air: 0 };
  const lastDefaultVal = { sub: 0, cut: 0, chd: 0, air: 0 };

  let hoverState = { laneIdx: -1, zone: null, slot: -1 };
  let drag = null;
  let animTick = 0;

  function drawText(text, x, y, color, scale = 1) {
    ctx.fillStyle = color;
    const str = String(text).toUpperCase();
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (let i = 0; i < str.length; i++) {
      const glyph = FONT_3X5[str[i]] || FONT_3X5[' '];
      for (let r = 0; r < 5; r++) {
        const bits = glyph[r];
        for (let c = 0; c < 3; c++) {
          if (bits & (1 << (2 - c))) {
            ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
          }
        }
      }
      cx += 4 * scale;
    }
  }

  function drawReel(cx, cy, frame, muted, dubThrow, pulseOffset) {
    const ry = cy + pulseOffset;
    const outer = muted ? C.reelDim : dubThrow ? C.amber : C.reelRing;
    const rim = muted ? '#344440' : dubThrow ? C.amberBright : C.reelRim;

    // 17x17 pixel circular flange
    ctx.fillStyle = '#070b0a';
    ctx.fillRect(cx - 6, ry - 7, 13, 17);
    ctx.fillRect(cx - 7, ry - 6, 15, 15);

    ctx.fillStyle = outer;
    ctx.fillRect(cx - 5, ry - 8, 11, 17);
    ctx.fillRect(cx - 8, ry - 5, 17, 11);
    ctx.fillRect(cx - 7, ry - 7, 15, 15);

    ctx.fillStyle = rim;
    ctx.fillRect(cx - 5, ry - 8, 10, 1);
    ctx.fillRect(cx - 7, ry - 6, 1, 6);

    ctx.fillStyle = C.reelHub;
    ctx.fillRect(cx - 4, ry - 6, 9, 13);
    ctx.fillRect(cx - 6, ry - 4, 13, 9);
    ctx.fillRect(cx - 5, ry - 5, 11, 11);

    if (muted) {
      ctx.fillStyle = '#4e635d';
      ctx.fillRect(cx - 2, ry - 2, 1, 1);
      ctx.fillRect(cx + 2, ry - 2, 1, 1);
      ctx.fillRect(cx - 1, ry - 1, 3, 3);
      ctx.fillRect(cx - 2, ry + 2, 1, 1);
      ctx.fillRect(cx + 2, ry + 2, 1, 1);
      return;
    }

    ctx.fillStyle = dubThrow ? C.amber : C.mint;
    const f = ((frame % 4) + 4) % 4;
    if (f === 0) {
      ctx.fillRect(cx - 1, ry - 5, 3, 2);
      ctx.fillRect(cx - 5, ry + 1, 2, 2);
      ctx.fillRect(cx + 4, ry + 1, 2, 2);
    } else if (f === 1) {
      ctx.fillRect(cx + 1, ry - 5, 2, 2);
      ctx.fillRect(cx - 5, ry - 1, 2, 2);
      ctx.fillRect(cx + 1, ry + 3, 2, 2);
    } else if (f === 2) {
      ctx.fillRect(cx - 1, ry + 4, 3, 2);
      ctx.fillRect(cx - 5, ry - 2, 2, 2);
      ctx.fillRect(cx + 4, ry - 2, 2, 2);
    } else {
      ctx.fillRect(cx - 2, ry - 5, 2, 2);
      ctx.fillRect(cx + 4, ry - 1, 2, 2);
      ctx.fillRect(cx - 2, ry + 3, 2, 2);
    }

    ctx.fillStyle = C.playhead;
    ctx.fillRect(cx - 1, ry - 1, 3, 3);
    ctx.fillStyle = C.reelHub;
    ctx.fillRect(cx, ry, 1, 1);
  }

  function drawHeader(now) {
    const lcd = HOUR_LCD[state.hourId] || HOUR_LCD['03'];
    ctx.fillStyle = lcd.bg;
    ctx.fillRect(0, 0, W, HEADER_H);

    ctx.fillStyle = '#090e0d';
    ctx.fillRect(0, HEADER_H, W, 1);

    const key = getKey(state.keyId);
    const hour = getHour(state.hourId);
    const activeFx = Object.keys(state.fx).find(k => state.fx[k]);
    const hasStatus = now < state.statusUntil && state.statusText;

    const leftText = activeFx
      ? `FX: ${activeFx}!`
      : hasStatus
        ? state.statusText.slice(0, 17)
        : `REEL:${state.reelName}`;
    drawText(leftText, 5, 6, lcd.ink, 1);

    // Mini 1-bit pixel oscilloscope
    const sx = 96;
    const sy = 3;
    const sw = 44;
    const sh = 11;
    ctx.fillStyle = lcd.ghost;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = lcd.bg;
    ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

    const { analyser } = getAudioNodes();
    if (analyser && state.isPlaying) {
      analyser.getByteTimeDomainData(waveData);
      ctx.fillStyle = lcd.ink;
      for (let i = 0; i < sw - 2; i += 2) {
        const idx = Math.floor((i / (sw - 2)) * waveData.length);
        const v = (waveData[idx] - 128) / 128;
        const py = Math.round(sy + 5 + v * 5.2);
        ctx.fillRect(sx + 1 + i, Math.max(sy + 1, Math.min(sy + sh - 2, py)), 2, 1);
      }
    } else {
      ctx.fillStyle = lcd.ghost;
      for (let i = 0; i < sw - 2; i += 4) {
        ctx.fillRect(sx + 1 + i, sy + 5, 2, 1);
      }
    }

    // Hour + Root Key + BPM
    drawText(`${hour.label} ${key.short}`, 145, 6, lcd.ink, 1);
    drawText(`${state.bpm}`, 189, 6, lcd.ink, 1);

    let badge = 'STOP';
    let badgeBg = lcd.ghost;
    let badgeFg = lcd.ink;
    if (state.isWavRecording) {
      badge = 'WAV!';
      badgeBg = lcd.ink;
      badgeFg = C.amber;
    } else if (activeFx) {
      badge = activeFx.slice(0, 4);
      badgeBg = lcd.ink;
      badgeFg = C.amber;
    } else if (state.isTapRec) {
      badge = 'TAP!';
      badgeBg = lcd.ink;
      badgeFg = C.amber;
    } else if (state.isPlaying) {
      badge = 'PLAY';
      badgeBg = lcd.ink;
      badgeFg = C.mint;
    }

    ctx.fillStyle = badgeBg;
    ctx.fillRect(222, 3, 37, 11);
    drawText(badge, 232 - (badge.length - 4) * 2, 6, badgeFg, 1);
  }

  function drawLegendBar() {
    ctx.fillStyle = '#0e1615';
    ctx.fillRect(0, LEGEND_Y, W, 9);

    ctx.fillStyle = C.mint;
    ctx.fillRect(6, LEGEND_Y + 2, 4, 4);
    drawText('ANCHOR', 13, LEGEND_Y + 2, C.textMid, 1);

    ctx.fillStyle = C.amber;
    ctx.fillRect(46, LEGEND_Y + 3, 3, 3);
    drawText('DUST', 52, LEGEND_Y + 2, C.textMid, 1);

    drawText('EDGE:LEN', 86, LEGEND_Y + 2, C.textDim, 1);
    drawText('DRAG:PITCH', 138, LEGEND_Y + 2, C.textDim, 1);
    drawText('HEAD', 237, LEGEND_Y + 2, C.textDim, 1);

    ctx.fillStyle = C.divider;
    ctx.fillRect(0, LEGEND_Y + 9, W, 1);
  }

  function drawLaneBay(laneDef, laneIdx) {
    const id = laneDef.id;
    const lane = state.lanes[id];
    const ghosts = state.ghostMaps[id] || [];
    const { bayH, tapeH } = getMetrics();
    const by = BAYS_TOP + laneIdx * bayH;
    const isMuted = lane.muted || lane.pressure <= 0.02;
    const dubThrow = Boolean(state.laneDubThrow[id]) || (state.fx.WASH && id !== 'sub');
    const stepNow = state.laneStep[id];
    const flash = state.laneFlash[id];

    // Bay background
    ctx.fillStyle = dubThrow ? '#181913' : C.deckBg;
    ctx.fillRect(0, by, W, bayH - 1);

    ctx.fillStyle = C.divider;
    ctx.fillRect(0, by + bayH - 1, W, 1);

    // Reel rotation (slows & wobbles when FLUT tape brake FX is held)
    if (state.isPlaying && !isMuted) {
      const rate = state.fx.FLUT ? 0.055 : (dubThrow ? 0.22 : 0.12);
      reelAngles[id] += (state.bpm / 122) * rate;
    }

    // 1) LEFT SPINNING REEL & MUTE CAP
    const kickOffset = id === 'sub' && state.kickPulse > 0.35 ? -1 : 0;
    const reelHovered = hoverState.laneIdx === laneIdx && hoverState.zone === 'mute';
    if (reelHovered) {
      ctx.fillStyle = '#172522';
      ctx.fillRect(2, by + 2, 34, bayH - 5);
    }
    const reelCy = by + Math.max(14, Math.floor((bayH - 12) / 2));
    drawReel(19, reelCy, Math.floor(reelAngles[id]), isMuted, dubThrow, kickOffset);
    const labelColor = isMuted
      ? C.textDim
      : dubThrow
        ? C.amberBright
        : flash > 0.25
          ? (state.laneFlashType[id] === 'ghost' ? C.amber : C.mintBright)
          : C.textMid;
    drawText(laneDef.name, 13, by + bayH - 11, labelColor, 1);

    // 2) MAGNETIC TAPE TRACK WELL
    const flutterShift = state.fx.FLUT ? Math.round(Math.sin(animTick * 0.45 + laneIdx) * 1.4) : 0;
    const tapeY = by + TAPE_OFFSET_Y;
    const activeW = lane.length * SLOT_W;
    const maxW = 16 * SLOT_W;

    ctx.fillStyle = C.deckWell;
    ctx.fillRect(TAPE_X - 1, tapeY - 1, maxW + 13, tapeH + 2);

    // Unused bay hatch beyond loop length
    if (lane.length < 16) {
      ctx.fillStyle = C.deckHatch;
      const startUnused = TAPE_X + activeW + 11;
      const endUnused = TAPE_X + maxW + 11;
      for (let hx = startUnused; hx < endUnused; hx += 4) {
        for (let hy = tapeY + 2; hy < tapeY + tapeH - 2; hy += 4) {
          ctx.fillRect(hx + ((hy >> 2) % 2) * 2, hy, 1, 1);
        }
      }
    }

    // Active Magnetic Tape Ribbon body
    ctx.fillStyle = isMuted ? C.tapeMuted : dubThrow ? '#211c12' : C.tapeBody;
    ctx.fillRect(TAPE_X + flutterShift, tapeY, activeW, tapeH);

    // Top & bottom tape rails + moving pixel sprocket perforations
    ctx.fillStyle = isMuted ? '#1d2725' : dubThrow ? C.amberDeep : C.tapeEdge;
    ctx.fillRect(TAPE_X + flutterShift, tapeY, activeW, 2);
    ctx.fillRect(TAPE_X + flutterShift, tapeY + tapeH - 2, activeW, 2);

    const scrollSpeed = state.fx.FLUT ? 8 : 4;
    const scrollShift = state.isPlaying && !isMuted ? Math.floor(animTick / scrollSpeed) % 6 : 0;
    ctx.fillStyle = C.deckWell;
    for (let sx = TAPE_X + scrollShift; sx < TAPE_X + activeW - 2; sx += 6) {
      ctx.fillRect(sx + flutterShift, tapeY, 2, 1);
      ctx.fillRect(sx + flutterShift, tapeY + tapeH - 1, 2, 1);
    }

    // Dub Throw / WASH animated amber echo waves
    if (dubThrow && !isMuted) {
      ctx.fillStyle = 'rgba(242, 166, 73, 0.22)';
      const waveOff = Math.floor(animTick * 0.7) % 12;
      for (let wx = TAPE_X + waveOff; wx < TAPE_X + activeW - 2; wx += 12) {
        ctx.fillRect(wx, tapeY + 3, 3, tapeH - 6);
      }
    }

    // Per-slot grid marks, amber micro-dust & solid mint anchors
    for (let s = 0; s < lane.length; s++) {
      const sx = TAPE_X + s * SLOT_W + flutterShift;
      const isPlayStep = state.isPlaying && stepNow === s;
      const isBeat = s % 4 === 0;
      const anchor = lane.anchors[s];
      const ghost = ghosts[s];

      if (s > 0) {
        ctx.fillStyle = isBeat ? '#243a35' : '#182825';
        ctx.fillRect(sx, tapeY + 3, 1, tapeH - 6);
      }
      if (isBeat) {
        ctx.fillStyle = isMuted ? '#24302d' : '#35544c';
        ctx.fillRect(sx + 1, tapeY + tapeH - 4, 2, 1);
      }

      if (hoverState.laneIdx === laneIdx && hoverState.zone === 'tape' && hoverState.slot === s) {
        ctx.fillStyle = '#1d322d';
        ctx.fillRect(sx + 1, tapeY + 2, SLOT_W - 1, tapeH - 4);
      }

      if (isPlayStep && !isMuted) {
        ctx.fillStyle = anchor ? '#265c49' : ghost ? '#4a3519' : '#1c302c';
        ctx.fillRect(sx + 1, tapeY + 2, SLOT_W - 1, tapeH - 4);
      }

      // A) SOLID MINT ANCHOR (User's sacred hit — full dynamic height range)
      if (anchor) {
        const minH = 8;
        const maxH = Math.max(20, tapeH - 9);
        const barH = Math.round(minH + (anchor.val / 7) * (maxH - minH));
        const bx = sx + 2;
        const bw = 7;
        const byTop = tapeY + tapeH - 3 - barH;

        if (isMuted) {
          ctx.fillStyle = '#2d453f';
          ctx.fillRect(bx, byTop, bw, barH);
        } else {
          ctx.fillStyle = isPlayStep ? C.mintBright : C.mint;
          ctx.fillRect(bx, byTop, bw, barH);

          ctx.fillStyle = isPlayStep ? '#ffffff' : C.mintBright;
          ctx.fillRect(bx, byTop, bw, 2);

          ctx.fillStyle = C.mintDeep;
          ctx.fillRect(bx, tapeY + tapeH - 5, bw, 2);

          if (anchor.accent) {
            ctx.fillStyle = C.deckWell;
            ctx.fillRect(bx + 2, byTop + Math.floor(barH / 2), 3, 1);
          }
        }
      }
      // B) PROCEDURAL AMBER GHOST DUST SPARK
      else if (ghost) {
        const isHit = isPlayStep && state.laneLastGhostHit[id] === s;
        const dustSpan = Math.max(14, tapeH - 15);
        const dustY = tapeY + 6 + Math.round(((7 - ghost.val) / 7) * dustSpan);
        const cx = sx + 5;

        if (isMuted) {
          ctx.fillStyle = '#332d22';
          ctx.fillRect(cx, dustY, 2, 2);
        } else {
          const colMain = isHit ? C.amberBright : C.amber;
          const colDim = isHit ? C.amber : C.amberDeep;

          ctx.fillStyle = colMain;
          ctx.fillRect(cx - 1, dustY, 3, 3);
          ctx.fillStyle = colDim;
          ctx.fillRect(cx, dustY - 2, 1, 1);
          ctx.fillRect(cx, dustY + 4, 1, 1);
          if (ghost.role === 'pre' || ghost.role === 'echo') {
            ctx.fillRect(cx - 2, dustY + 1, 1, 1);
            ctx.fillRect(cx + 2, dustY + 1, 1, 1);
          }
        }
      }

      if (isPlayStep) {
        ctx.fillStyle = isMuted ? '#4e635d' : C.playhead;
        ctx.fillRect(sx + 1, tapeY + 1, 1, tapeH - 2);
      }
    }

    // SUBM underwater filter visual veil across upper half of tape
    if (state.fx.SUBM && !isMuted) {
      ctx.fillStyle = 'rgba(10, 22, 24, 0.56)';
      ctx.fillRect(TAPE_X, tapeY + 2, activeW, Math.floor(tapeH * 0.52));
      ctx.fillStyle = C.mint;
      for (let wx = TAPE_X; wx < TAPE_X + activeW - 2; wx += 4) {
        ctx.fillRect(wx, tapeY + Math.floor(tapeH * 0.52) + 2, 2, 1);
      }
    }

    // SLICE rhythmic stutter gate scan flash
    if (state.fx.SLICE && state.isPlaying && (animTick % 6 < 3)) {
      ctx.fillStyle = 'rgba(242, 166, 73, 0.16)';
      ctx.fillRect(TAPE_X, tapeY + 2, activeW, tapeH - 4);
    }

    // 50% Bayer checkerboard dither overlay when lane is muted
    if (isMuted) {
      ctx.fillStyle = C.deckBg;
      for (let dy = tapeY + 2; dy < tapeY + tapeH - 2; dy += 2) {
        for (let dx = TAPE_X + (dy % 4 === 0 ? 0 : 1); dx < TAPE_X + activeW; dx += 2) {
          ctx.fillRect(dx, dy, 1, 1);
        }
      }
    }

    // 3) DRAGGABLE RIGHT PINCH-ROLLER HANDLE (Loop Length 3..16)
    const handleX = TAPE_X + activeW;
    const isLenActive =
      (drag && drag.mode === 'length' && drag.laneIdx === laneIdx) ||
      (hoverState.laneIdx === laneIdx && hoverState.zone === 'length');

    ctx.fillStyle = isLenActive ? C.mintDeep : C.rollerBody;
    ctx.fillRect(handleX, tapeY - 1, 11, tapeH + 2);
    ctx.fillStyle = isLenActive ? C.mint : C.rollerEdge;
    ctx.fillRect(handleX, tapeY - 1, 1, tapeH + 2);
    ctx.fillRect(handleX + 10, tapeY - 1, 1, tapeH + 2);
    ctx.fillRect(handleX, tapeY - 1, 11, 1);
    ctx.fillRect(handleX, tapeY + tapeH, 11, 1);

    const lenStr = String(lane.length).padStart(2, '0');
    drawText(lenStr, handleX + 2, tapeY + Math.floor((tapeH - 5) / 2), isLenActive ? '#ffffff' : '#d7e6dd', 1);
    ctx.fillStyle = isLenActive ? C.mintBright : C.rollerHi;
    ctx.fillRect(handleX + 4, tapeY + 5, 3, 1);
    ctx.fillRect(handleX + 4, tapeY + tapeH - 6, 3, 1);

    // 4) FAR-RIGHT VERTICAL "HEAD PRESSURE" METER (adapts segment count to bay height)
    const pHover =
      (drag && drag.mode === 'pressure' && drag.laneIdx === laneIdx) ||
      (hoverState.laneIdx === laneIdx && hoverState.zone === 'pressure');

    ctx.fillStyle = C.deckWell;
    ctx.fillRect(PRESS_X, tapeY - 1, PRESS_W, tapeH + 2);
    ctx.fillStyle = pHover ? C.mint : C.divider;
    ctx.fillRect(PRESS_X, tapeY - 1, PRESS_W, 1);
    ctx.fillRect(PRESS_X, tapeY + tapeH, PRESS_W, 1);
    ctx.fillRect(PRESS_X, tapeY - 1, 1, tapeH + 2);
    ctx.fillRect(PRESS_X + PRESS_W - 1, tapeY - 1, 1, tapeH + 2);

    const segs = Math.max(8, Math.min(14, Math.floor((tapeH - 4) / 3.5)));
    const stepY = (tapeH - 4) / segs;
    const litSegs = isMuted ? 0 : Math.round(lane.pressure * segs);
    for (let k = 0; k < segs; k++) {
      const segY = tapeY + tapeH - 3 - k * stepY;
      const isLit = k < litSegs;
      ctx.fillStyle = isLit
        ? (k >= segs - 2 ? C.amber : C.mint)
        : (isMuted ? '#151c1b' : '#1b2926');
      ctx.fillRect(PRESS_X + 3, Math.round(segY), PRESS_W - 6, 2);
    }
  }

  // ---- Hit Testing & Direct Manipulation ----
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / (rect.width || 1)) * W;
    const py = ((e.clientY - rect.top) / (rect.height || 1)) * H;
    return { px, py };
  }

  function hitTest(px, py) {
    const { bayH } = getMetrics();
    if (py < BAYS_TOP || py >= BAYS_TOP + 4 * bayH) {
      return { laneIdx: -1, zone: null, slot: -1 };
    }
    const laneIdx = Math.floor((py - BAYS_TOP) / bayH);
    const laneDef = LANES[laneIdx];
    const lane = state.lanes[laneDef.id];

    if (px < 37) {
      return { laneIdx, zone: 'mute', slot: -1 };
    }
    if (px >= PRESS_X - 4) {
      return { laneIdx, zone: 'pressure', slot: -1 };
    }

    const handleCenter = TAPE_X + lane.length * SLOT_W + 5;
    if (Math.abs(px - handleCenter) <= 9) {
      return { laneIdx, zone: 'length', slot: -1 };
    }

    if (px >= TAPE_X && px < TAPE_X + lane.length * SLOT_W) {
      const slot = Math.max(0, Math.min(lane.length - 1, Math.floor((px - TAPE_X) / SLOT_W)));
      return { laneIdx, zone: 'tape', slot };
    }

    return { laneIdx, zone: null, slot: -1 };
  }

  function updateCursor(hit) {
    if (!hit || hit.laneIdx < 0) {
      canvas.style.cursor = 'default';
      return;
    }
    if (hit.zone === 'length') canvas.style.cursor = 'ew-resize';
    else if (hit.zone === 'pressure') canvas.style.cursor = 'ns-resize';
    else if (hit.zone === 'mute') canvas.style.cursor = 'pointer';
    else if (hit.zone === 'tape') {
      const lane = state.lanes[LANES[hit.laneIdx].id];
      canvas.style.cursor = lane.anchors[hit.slot] ? 'ns-resize' : 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  function pressureFromPy(laneIdx, py) {
    const { bayH, tapeH } = getMetrics();
    const tapeY = BAYS_TOP + laneIdx * bayH + TAPE_OFFSET_Y;
    const norm = 1 - (py - tapeY) / tapeH;
    return Math.max(0, Math.min(1, norm));
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const { px, py } = getCanvasCoords(e);
    const hit = hitTest(px, py);
    if (hit.laneIdx < 0 || !hit.zone) return;

    const laneId = LANES[hit.laneIdx].id;
    const lane = state.lanes[laneId];
    state.activeLane = laneId;

    if (hit.zone === 'mute') {
      toggleMute(laneId);
      updateAudioParams();
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    if (hit.zone === 'pressure') {
      setLanePressure(laneId, pressureFromPy(hit.laneIdx, py));
      updateAudioParams();
      drag = { mode: 'pressure', laneIdx: hit.laneIdx, laneId };
      return;
    }

    if (hit.zone === 'length') {
      drag = { mode: 'length', laneIdx: hit.laneIdx, laneId };
      return;
    }

    if (hit.zone === 'tape') {
      const existing = lane.anchors[hit.slot];
      drag = {
        mode: existing ? 'anchor-pending' : 'empty-pending',
        laneIdx: hit.laneIdx,
        laneId,
        slot: hit.slot,
        startPx: px,
        startPy: py,
        startVal: existing ? existing.val : lastDefaultVal[laneId],
        lastSlipSteps: 0,
        moved: false
      };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const { px, py } = getCanvasCoords(e);

    if (!drag) {
      hoverState = hitTest(px, py);
      updateCursor(hoverState);
      return;
    }

    if (drag.mode === 'pressure') {
      setLanePressure(drag.laneId, pressureFromPy(drag.laneIdx, py));
      updateAudioParams();
      return;
    }

    if (drag.mode === 'length') {
      const nextLen = Math.round((px - TAPE_X) / SLOT_W);
      setLaneLength(drag.laneId, nextLen);
      return;
    }

    if (drag.mode === 'anchor-pending' || drag.mode === 'pitch') {
      const dy = drag.startPy - py;
      if (Math.abs(dy) >= 4) {
        drag.mode = 'pitch';
        drag.moved = true;
      }
      if (drag.mode === 'pitch') {
        const deltaVal = Math.round(dy / 5.5);
        const nextVal = Math.max(0, Math.min(7, drag.startVal + deltaVal));
        const curr = state.lanes[drag.laneId].anchors[drag.slot];
        if (!curr || curr.val !== nextVal) {
          lastDefaultVal[drag.laneId] = nextVal;
          setAnchor(drag.laneId, drag.slot, { val: nextVal, accent: true });
          auditionLane(drag.laneId, nextVal);
          showStatus(`${drag.laneId.toUpperCase()}: ${getValueLabel(drag.laneId, nextVal, state.keyId, state.hourId)}`);
        }
      }
      return;
    }

    if (drag.mode === 'empty-pending' || drag.mode === 'slip') {
      const dx = px - drag.startPx;
      if (Math.abs(dx) >= 9) {
        drag.mode = 'slip';
        drag.moved = true;
      }
      if (drag.mode === 'slip') {
        const steps = Math.trunc(dx / SLOT_W);
        if (steps !== drag.lastSlipSteps) {
          const dir = steps > drag.lastSlipSteps ? 1 : -1;
          slipLanePhase(drag.laneId, dir);
          drag.lastSlipSteps = steps;
        }
      }
    }
  });

  const finishDrag = (e) => {
    if (!drag) return;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (drag.mode === 'anchor-pending' && !drag.moved) {
      setAnchor(drag.laneId, drag.slot, null);
      showStatus(`RM ${drag.laneId.toUpperCase()} @${drag.slot + 1}`);
    } else if (drag.mode === 'empty-pending' && !drag.moved) {
      const val = drag.laneId === 'sub'
        ? (drag.slot % 4 === 0 ? 0 : Math.max(2, lastDefaultVal.sub || 2))
        : lastDefaultVal[drag.laneId];
      setAnchor(drag.laneId, drag.slot, { val, accent: true });
      auditionLane(drag.laneId, val);
      showStatus(`${drag.laneId.toUpperCase()} @${drag.slot + 1} ${getValueLabel(drag.laneId, val, state.keyId, state.hourId)}`);
    }

    drag = null;
  };

  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  canvas.addEventListener('pointerleave', () => {
    if (!drag) {
      hoverState = { laneIdx: -1, zone: null, slot: -1 };
      canvas.style.cursor = 'default';
    }
  });

  function render() {
    requestAnimationFrame(render);
    animTick++;
    state.kickPulse *= 0.80;
    for (const l of LANES) {
      state.laneFlash[l.id] *= 0.84;
    }

    const now = performance.now();
    ctx.fillStyle = C.deckBg;
    ctx.fillRect(0, 0, W, H);

    drawHeader(now);
    drawLegendBar();
    LANES.forEach((laneDef, idx) => drawLaneBay(laneDef, idx));
  }

  requestAnimationFrame(render);
}
