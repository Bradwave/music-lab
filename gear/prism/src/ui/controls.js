// Canvas touch/mouse gestures, control deck, modals & keyboard shortcuts for PRISM.

import {
  PRESETS,
  createMutatedOptics,
  generateRandomConstellation,
  getPreset
} from '../state/presets.js';
import { SCALES } from '../state/scales.js';
import {
  state,
  FLUX_MODES,
  WALL_MODES,
  subscribe,
  notify,
  showStatus,
  getIdleReadout,
  saveState,
  loadPreset,
  findOpticAt,
  isEmitterAt
} from '../state/store.js';
import { resetSim } from '../engine/opticsSim.js';
import { initAudio, updateEngineParams } from '../audio/engine.js';
import { playPreviewPing } from '../audio/synths.js';
import {
  startTransport,
  stopTransport,
  toggleTransport,
  setHyperMode
} from '../audio/scheduler.js';
import { toggleWavRecording } from '../audio/wavRecorder.js';
import { canvasPointToCell } from './chamberCanvas.js';

const TOOL_CLASS = {
  mirror: 'active-cyan',
  split: 'active-magenta',
  bass: 'active-lime',
  warp: 'active-violet'
};

const DIR_LABELS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];

function opticVariantLabel(o) {
  if (o.type === 'mirror') return o.variant === 0 ? 'MIRROR /' : 'MIRROR \\';
  if (o.type === 'split') return o.variant === 0 ? 'PRISM 2-WAY' : 'PRISM 3-WAY STAR';
  if (o.type === 'bass') return o.variant === 0 ? 'BASS PASS LENS' : 'BASS 180° TRAP';
  if (o.type === 'warp') return o.variant === 0 ? 'WARP STRAIGHT' : 'WARP +90°';
  return o.type.toUpperCase();
}

export function initControls(canvas) {
  const chassis = document.getElementById('chassis');
  const wallTag = document.getElementById('wallTag');
  const ledBeam = document.getElementById('ledBeam');
  const readoutText = document.getElementById('readoutText');

  const btnPlay = document.getElementById('btnPlay');
  const toolBtns = Array.from(document.querySelectorAll('.tool-btn'));
  const btnFlux = document.getElementById('btnFlux');
  const btnHyper = document.getElementById('btnHyper');
  const btnMutate = document.getElementById('btnMutate');
  const btnPatch = document.getElementById('btnPatch');

  const btnMenu = document.getElementById('btnMenu');
  const btnCloseMenu = document.getElementById('btnCloseMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');

  const btnGuide = document.getElementById('btnGuide');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const btnGuideStart = document.getElementById('btnGuideStart');
  const guideBackdrop = document.getElementById('guideBackdrop');

  const presetGrid = document.getElementById('presetGrid');
  const scaleGrid = document.getElementById('scaleGrid');
  const fluxOpts = Array.from(document.querySelectorAll('.flux-opt'));
  const wallOpts = Array.from(document.querySelectorAll('.wall-opt'));
  const rateOpts = Array.from(document.querySelectorAll('.rate-opt'));
  const bpmReadout = document.getElementById('bpmReadout');
  const btnBpmDown = document.getElementById('btnBpmDown');
  const btnBpmUp = document.getElementById('btnBpmUp');
  const btnRandom = document.getElementById('btnRandom');
  const btnClear = document.getElementById('btnClear');
  const btnWav = document.getElementById('btnWav');

  // Populate dynamic Preset & Scale grids in menu modal
  PRESETS.forEach((p, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'px-btn modal-btn preset-opt';
    b.dataset.preset = String(idx);
    b.textContent = p.name;
    b.addEventListener('click', () => {
      initAudio();
      loadPreset(idx);
      resetSim();
      updateEngineParams();
      if (!state.isPlaying) startTransport();
    });
    presetGrid.appendChild(b);
  });

  SCALES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'px-btn modal-btn scale-opt';
    b.dataset.scale = s.id;
    b.textContent = s.name;
    b.addEventListener('click', () => {
      state.scaleId = s.id;
      saveState();
      showStatus(`SCALE: ${s.name}`);
      notify('scale');
    });
    scaleGrid.appendChild(b);
  });

  const presetBtns = Array.from(presetGrid.querySelectorAll('.preset-opt'));
  const scaleBtns = Array.from(scaleGrid.querySelectorAll('.scale-opt'));

  // Sync DOM with state
  function syncUI() {
    chassis.classList.toggle('hyper-active', state.isHyper);

    // Wall badge
    wallTag.textContent = state.wallMode.toUpperCase();

    // LED & Readout
    ledBeam.className = 'led';
    if (state.isWavRecording) ledBeam.classList.add('rec');
    else if (state.isHyper) ledBeam.classList.add('hyper');
    else if (state.isPlaying) ledBeam.classList.add('on');

    readoutText.textContent = state.statusText || getIdleReadout();

    // Play Button
    btnPlay.textContent = state.isPlaying ? '■ STOP' : '▶ PLAY';
    btnPlay.classList.toggle('active-cyan', state.isPlaying);

    // Tool Palette
    for (const b of toolBtns) {
      const t = b.dataset.tool;
      b.classList.remove('active-cyan', 'active-magenta', 'active-lime', 'active-violet');
      if (t === state.selectedTool) {
        b.classList.add(TOOL_CLASS[t]);
      }
    }

    // Flux Button
    btnFlux.textContent = state.flux.toUpperCase();
    btnFlux.classList.remove('flux-glass', 'flux-acid', 'flux-glitch', 'flux-void');
    btnFlux.classList.add(`flux-${state.flux}`);

    // Hyper Button
    btnHyper.classList.toggle('active-magenta', state.isHyper);
    btnHyper.textContent = state.isHyper ? '2× HYPER' : 'HYPER';

    // Patch Button
    const curPreset = getPreset(state.presetIndex);
    btnPatch.textContent = state.customPatch ? 'CUSTOM' : curPreset.short;

    // Modal Selections
    presetBtns.forEach((b, idx) => {
      b.classList.toggle('active-cyan', !state.customPatch && idx === state.presetIndex);
    });

    fluxOpts.forEach((b) => {
      b.classList.remove('active-cyan', 'active-lime', 'active-magenta', 'active-violet');
      if (b.dataset.flux === state.flux) {
        const cls = state.flux === 'acid'
          ? 'active-lime'
          : state.flux === 'glitch'
            ? 'active-magenta'
            : state.flux === 'void'
              ? 'active-violet'
              : 'active-cyan';
        b.classList.add(cls);
      }
    });

    scaleBtns.forEach((b) => {
      b.classList.toggle('active-cyan', b.dataset.scale === state.scaleId);
    });

    wallOpts.forEach((b) => {
      b.classList.toggle('active-violet', b.dataset.wall === state.wallMode);
    });

    rateOpts.forEach((b) => {
      b.classList.toggle('active-cyan', Number(b.dataset.rate) === state.emitterRate);
    });

    bpmReadout.textContent = `${state.bpm} BPM`;

    btnWav.textContent = state.isWavRecording ? '■ STOP & SAVE .WAV' : 'REC MASTER .WAV';
    btnWav.classList.toggle('active-lime', state.isWavRecording);
  }

  subscribe(syncUI);

  // Actions
  function cycleFlux() {
    initAudio();
    const idx = (FLUX_MODES.indexOf(state.flux) + 1) % FLUX_MODES.length;
    state.flux = FLUX_MODES[idx];
    updateEngineParams();
    saveState();
    showStatus(`FLUX: ${state.flux.toUpperCase()}`);
    notify('flux');
  }

  function cycleWallMode() {
    const idx = (WALL_MODES.indexOf(state.wallMode) + 1) % WALL_MODES.length;
    state.wallMode = WALL_MODES[idx];
    saveState();
    showStatus(`WALLS: ${state.wallMode.toUpperCase()}`);
    notify('wall');
  }

  function mutateCircuit() {
    initAudio();
    state.optics = createMutatedOptics(state.emitter, state.optics);
    state.customPatch = true;
    saveState();
    showStatus('MUTATED OPTICS');
    notify('board');
    if (!state.isPlaying) startTransport();
  }

  function nextPreset() {
    initAudio();
    loadPreset(state.presetIndex + 1);
    resetSim();
    updateEngineParams();
    if (!state.isPlaying) startTransport();
  }

  function adjustBpm(delta) {
    state.bpm = Math.max(72, Math.min(168, state.bpm + delta));
    updateEngineParams();
    saveState();
    showStatus(`TEMPO ${state.bpm} BPM`);
    notify('bpm');
  }

  function setTool(tool) {
    state.selectedTool = tool;
    showStatus(`TOOL: ${tool.toUpperCase()}`);
    notify('tool');
  }

  // Control Deck Event Listeners
  btnPlay.addEventListener('click', () => {
    toggleTransport();
  });

  toolBtns.forEach((b) => {
    b.addEventListener('click', () => setTool(b.dataset.tool));
  });

  btnFlux.addEventListener('click', cycleFlux);
  wallTag.addEventListener('click', cycleWallMode);
  btnMutate.addEventListener('click', mutateCircuit);
  btnPatch.addEventListener('click', nextPreset);

  // Momentary HYPER Hold Pad
  const startHyper = (e) => {
    e.preventDefault();
    initAudio();
    setHyperMode(true);
    showStatus('HYPERDRIVE 2×', 1400);
  };
  const endHyper = () => {
    if (state.isHyper) {
      setHyperMode(false);
    }
  };
  btnHyper.addEventListener('pointerdown', startHyper);
  btnHyper.addEventListener('pointerup', endHyper);
  btnHyper.addEventListener('pointercancel', endHyper);
  btnHyper.addEventListener('pointerleave', endHyper);

  // Modal Controls
  const openMenu = () => menuBackdrop.classList.remove('hidden');
  const closeMenu = () => menuBackdrop.classList.add('hidden');
  const openGuide = () => guideBackdrop.classList.remove('hidden');
  const closeGuide = () => guideBackdrop.classList.add('hidden');

  btnMenu.addEventListener('click', openMenu);
  btnCloseMenu.addEventListener('click', closeMenu);
  menuBackdrop.addEventListener('click', (e) => {
    if (e.target === menuBackdrop) closeMenu();
  });

  btnGuide.addEventListener('click', openGuide);
  btnCloseGuide.addEventListener('click', closeGuide);
  guideBackdrop.addEventListener('click', (e) => {
    if (e.target === guideBackdrop) closeGuide();
  });
  btnGuideStart.addEventListener('click', () => {
    closeGuide();
    if (!state.isPlaying) startTransport();
  });

  fluxOpts.forEach((b) => {
    b.addEventListener('click', () => {
      initAudio();
      state.flux = b.dataset.flux;
      updateEngineParams();
      saveState();
      showStatus(`FLUX: ${state.flux.toUpperCase()}`);
      notify('flux');
    });
  });

  wallOpts.forEach((b) => {
    b.addEventListener('click', () => {
      state.wallMode = b.dataset.wall;
      saveState();
      showStatus(`WALLS: ${state.wallMode.toUpperCase()}`);
      notify('wall');
    });
  });

  rateOpts.forEach((b) => {
    b.addEventListener('click', () => {
      state.emitterRate = Number(b.dataset.rate);
      saveState();
      showStatus(`PULSE: ${b.textContent}`);
      notify('rate');
    });
  });

  btnBpmDown.addEventListener('click', () => adjustBpm(-4));
  btnBpmUp.addEventListener('click', () => adjustBpm(4));

  btnRandom.addEventListener('click', () => {
    initAudio();
    const gen = generateRandomConstellation();
    state.emitter = gen.emitter;
    state.optics = gen.optics;
    state.customPatch = true;
    resetSim();
    saveState();
    showStatus('GENERATED PATCH');
    notify('board');
    if (!state.isPlaying) startTransport();
    closeMenu();
  });

  btnClear.addEventListener('click', () => {
    state.optics = [];
    state.customPatch = true;
    resetSim();
    saveState();
    showStatus('BENCH CLEARED');
    notify('board');
  });

  btnWav.addEventListener('click', () => {
    toggleWavRecording();
  });

  // =========================================================================
  // CANVAS GESTURES: Tap place/rotate · Double-tap/Right-click remove · Drag move
  // =========================================================================
  let pointerState = null;
  let lastTap = { key: '', time: 0 };

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { gx, gy, inBounds } = canvasPointToCell(canvas, e.clientX, e.clientY);
    if (!inBounds) return;
    const idx = findOpticAt(gx, gy);
    if (idx !== -1) {
      state.optics.splice(idx, 1);
      state.customPatch = true;
      saveState();
      showStatus('REMOVED OPTIC');
      notify('board');
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return; // handled by contextmenu
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const pt = canvasPointToCell(canvas, e.clientX, e.clientY);
    if (!pt.inBounds) return;

    const hitEmitter = isEmitterAt(pt.gx, pt.gy);
    const opticIdx = hitEmitter ? -1 : findOpticAt(pt.gx, pt.gy);

    pointerState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startGx: pt.gx,
      startGy: pt.gy,
      hitEmitter,
      opticIdx,
      isDragging: false
    };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointerState || pointerState.pointerId !== e.pointerId) return;
    if (!pointerState.hitEmitter && pointerState.opticIdx === -1) return;

    const dx = e.clientX - pointerState.startX;
    const dy = e.clientY - pointerState.startY;
    const pt = canvasPointToCell(canvas, e.clientX, e.clientY);

    if (!pointerState.isDragging) {
      if (Math.hypot(dx, dy) > 9 || pt.gx !== pointerState.startGx || pt.gy !== pointerState.startGy) {
        pointerState.isDragging = true;
        state.drag = {
          isEmitter: pointerState.hitEmitter,
          index: pointerState.opticIdx,
          item: pointerState.opticIdx !== -1 ? state.optics[pointerState.opticIdx] : null,
          x: pt.gx,
          y: pt.gy,
          offGrid: !pt.inBounds
        };
      }
    }

    if (pointerState.isDragging && state.drag) {
      state.drag.x = pt.gx;
      state.drag.y = pt.gy;
      state.drag.offGrid = !pt.inBounds;
    }
  });

  function finishPointer(e) {
    if (!pointerState || pointerState.pointerId !== e.pointerId) return;
    const ps = pointerState;
    pointerState = null;

    if (ps.isDragging && state.drag) {
      const d = state.drag;
      state.drag = null;

      if (d.offGrid) {
        // Dragging an optic off the bench removes it!
        if (!d.isEmitter && d.index !== -1) {
          state.optics.splice(d.index, 1);
          state.customPatch = true;
          saveState();
          showStatus('REMOVED OPTIC');
          notify('board');
        }
        return;
      }

      if (d.x === ps.startGx && d.y === ps.startGy) return;

      if (d.isEmitter) {
        const destOpticIdx = findOpticAt(d.x, d.y);
        if (destOpticIdx !== -1) {
          // Swap emitter & optic
          state.optics[destOpticIdx].x = ps.startGx;
          state.optics[destOpticIdx].y = ps.startGy;
        }
        state.emitter.x = d.x;
        state.emitter.y = d.y;
        state.customPatch = true;
        saveState();
        showStatus('MOVED EMITTER');
        notify('board');
      } else if (d.index !== -1) {
        if (isEmitterAt(d.x, d.y)) {
          // Swap optic & emitter
          state.emitter.x = ps.startGx;
          state.emitter.y = ps.startGy;
        } else {
          const destIdx = findOpticAt(d.x, d.y);
          if (destIdx !== -1 && destIdx !== d.index) {
            state.optics[destIdx].x = ps.startGx;
            state.optics[destIdx].y = ps.startGy;
          }
        }
        state.optics[d.index].x = d.x;
        state.optics[d.index].y = d.y;
        state.customPatch = true;
        saveState();
        showStatus(`MOVED ${state.optics[d.index].type.toUpperCase()}`);
        notify('board');
      }
      return;
    }

    // Regular TAP action
    state.drag = null;
    initAudio();

    const gx = ps.startGx;
    const gy = ps.startGy;
    const now = performance.now();
    const tapKey = `${gx},${gy}`;

    if (ps.hitEmitter) {
      state.emitter.dir = (state.emitter.dir + 1) % 4;
      state.customPatch = true;
      saveState();
      showStatus(`EMITTER → ${DIR_LABELS[state.emitter.dir]}`);
      notify('board');
      if (!state.isPlaying) startTransport();
      lastTap = { key: '', time: 0 };
      return;
    }

    if (ps.opticIdx !== -1) {
      const optic = state.optics[ps.opticIdx];
      // Double-tap on same optic removes it!
      if (lastTap.key === tapKey && (now - lastTap.time) < 300) {
        state.optics.splice(ps.opticIdx, 1);
        state.customPatch = true;
        saveState();
        showStatus('REMOVED OPTIC');
        notify('board');
        lastTap = { key: '', time: 0 };
        return;
      }

      // Single tap rotates / flips variant immediately
      optic.variant = optic.variant ? 0 : 1;
      state.customPatch = true;
      saveState();
      showStatus(opticVariantLabel(optic));
      if (!state.isPlaying) {
        playPreviewPing(optic.type, gx, gy, optic.variant);
      }
      notify('board');
      lastTap = { key: tapKey, time: now };
      return;
    }

    // Empty cell -> Place selected optical piece!
    if (state.optics.length >= 28) {
      showStatus('BENCH FULL (28 MAX)');
      return;
    }

    const placed = {
      x: gx,
      y: gy,
      type: state.selectedTool,
      variant: 0
    };
    state.optics.push(placed);
    state.customPatch = true;
    saveState();
    showStatus(`+ ${opticVariantLabel(placed)}`);

    if (!state.isPlaying) {
      playPreviewPing(placed.type, gx, gy, placed.variant);
      startTransport();
    }
    notify('board');
    lastTap = { key: tapKey, time: now };
  }

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', () => {
    pointerState = null;
    state.drag = null;
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'Escape') {
      closeMenu();
      closeGuide();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      toggleTransport();
    } else if (e.key === '1') {
      setTool('mirror');
    } else if (e.key === '2') {
      setTool('split');
    } else if (e.key === '3') {
      setTool('bass');
    } else if (e.key === '4') {
      setTool('warp');
    } else if (e.key === 'f' || e.key === 'F') {
      cycleFlux();
    } else if ((e.key === 'h' || e.key === 'H') && !e.repeat) {
      initAudio();
      setHyperMode(true);
      showStatus('HYPERDRIVE 2×', 1400);
    } else if (e.key === 'm' || e.key === 'M') {
      mutateCircuit();
    } else if (e.key === 'p' || e.key === 'P') {
      nextPreset();
    } else if (e.key === 'w' || e.key === 'W') {
      cycleWallMode();
    } else if (e.key === 'k' || e.key === 'K') {
      const idx = (SCALES.findIndex((s) => s.id === state.scaleId) + 1) % SCALES.length;
      state.scaleId = SCALES[idx].id;
      saveState();
      showStatus(`SCALE: ${SCALES[idx].name}`);
      notify('scale');
    } else if (e.key === 'c' || e.key === 'C') {
      state.optics = [];
      state.customPatch = true;
      resetSim();
      saveState();
      showStatus('BENCH CLEARED');
      notify('board');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      endHyper();
    }
  });

  window.addEventListener('blur', () => {
    endHyper();
  });

  // Initial sync
  syncUI();
}
