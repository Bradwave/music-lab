// Minimal hardware faceplate controller for 3AM.
// Wires 4 reels, Night-Arc mood hours (01:00–07:00), transport + root key,
// 4 always-visible pixel knobs, 4 lane pads, 4 master punch-in FX pads, menu & keyboard shortcuts.

import {
  state,
  subscribe,
  loadReelPreset,
  cycleKey,
  setHour,
  toggleMute,
  seedSingleLane,
  clearSingleLane,
  refreshGhostMaps,
  saveToLocalStorage,
  exportReelJson,
  importReelJson,
  showStatus
} from '../state/store.js';
import { LANES, HOURS, getKey } from '../state/scales.js';
import { initAudio, updateAudioParams, resetMasterGate } from '../audio/engine.js';
import { togglePlayback, tapAnchorOnLane } from '../audio/scheduler.js';
import { toggleWavRecording } from '../audio/wavRecorder.js';
import { createPixelKnob } from './knob.js';
import { initTapeDeck } from './tapeDeck.js';

export function initAppView() {
  const tapeCanvas = document.getElementById('tapeCanvas');
  initTapeDeck(tapeCanvas);

  // Elements
  const reelBtns = Array.from(document.querySelectorAll('.reel-btn'));
  const hourBtns = Array.from(document.querySelectorAll('.hour-btn'));
  const fxBtns = Array.from(document.querySelectorAll('.fx-btn'));

  const btnPlay = document.getElementById('btnPlay');
  const txtPlay = document.getElementById('txtPlay');
  const ledPlay = document.getElementById('ledPlay');
  const btnTap = document.getElementById('btnTap');
  const ledTap = document.getElementById('ledTap');
  const btnKey = document.getElementById('btnKey');

  const padRow = document.getElementById('padRow');
  const padHint = document.getElementById('padHint');
  const fxStatus = document.getElementById('fxStatus');

  const btnMenu = document.getElementById('btnMenu');
  const btnGuide = document.getElementById('btnGuide');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const guideBackdrop = document.getElementById('guideBackdrop');
  const btnCloseMenu = document.getElementById('btnCloseMenu');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const btnGuideStart = document.getElementById('btnGuideStart');

  const btnWav = document.getElementById('btnWav');
  const btnSaveJson = document.getElementById('btnSaveJson');
  const btnLoadJson = document.getElementById('btnLoadJson');
  const fileJsonInput = document.getElementById('fileJsonInput');
  const btnResetReel = document.getElementById('btnResetReel');

  // 4 Always-Visible Pixel Rotary Knobs
  const knobMicro = createPixelKnob(document.getElementById('knobMicro'), {
    label: 'MICRO',
    min: 0,
    max: 1,
    step: 0.01,
    value: state.micro,
    defaultValue: 0.42,
    accent: '#f2a649',
    formatValue: v => `${Math.round(v * 100)}%`,
    onChange: (v) => {
      state.micro = v;
      refreshGhostMaps();
      saveToLocalStorage();
      showStatus(`MICRO DUST ${Math.round(v * 100)}%`);
    }
  });

  const knobDepth = createPixelKnob(document.getElementById('knobDepth'), {
    label: 'DEPTH',
    min: 0,
    max: 1,
    step: 0.01,
    value: state.depth,
    defaultValue: 0.46,
    accent: '#f2a649',
    formatValue: v => `${Math.round(v * 100)}%`,
    onChange: (v) => {
      state.depth = v;
      updateAudioParams();
      saveToLocalStorage();
      showStatus(`DUB DEPTH ${Math.round(v * 100)}%`);
    }
  });

  const knobDrift = createPixelKnob(document.getElementById('knobDrift'), {
    label: 'DRIFT',
    min: 0,
    max: 1,
    step: 0.01,
    value: state.drift,
    defaultValue: 0.34,
    accent: '#4ee6a8',
    formatValue: v => `${Math.round(v * 100)}%`,
    onChange: (v) => {
      state.drift = v;
      updateAudioParams();
      saveToLocalStorage();
      showStatus(`GROOVE DRIFT ${Math.round(v * 100)}%`);
    }
  });

  const knobTempo = createPixelKnob(document.getElementById('knobTempo'), {
    label: 'BPM',
    min: 112,
    max: 132,
    step: 1,
    value: state.bpm,
    defaultValue: 122,
    accent: '#4ee6a8',
    formatValue: v => `${Math.round(v)}`,
    onChange: (v) => {
      state.bpm = Math.round(v);
      updateAudioParams();
      saveToLocalStorage();
      showStatus(`TEMPO ${state.bpm} BPM`);
    }
  });

  // Render 4 Lane Performance Pads + Per-Lane SEED / CLR
  const padEls = {};
  padRow.innerHTML = '';
  for (const laneDef of LANES) {
    const col = document.createElement('div');
    col.className = 'lane-pad-col';

    const pad = document.createElement('button');
    pad.className = 'px-btn lane-pad';
    pad.dataset.lane = laneDef.id;
    pad.title = `${laneDef.name}: Hold for Dub Throw, or tap in TAP mode (${laneDef.keyHint})`;
    pad.innerHTML = `
      <span class="pad-top">
        <span class="pad-name">${laneDef.name}</span>
        <span class="pad-key">${laneDef.keyHint}</span>
      </span>
      <span class="pad-sub">DUB</span>
    `;

    const startPad = (e) => {
      e.preventDefault();
      initAudio();
      pad.classList.add('pressed');
      if (state.isTapRec) {
        tapAnchorOnLane(laneDef.id);
      } else {
        state.laneDubThrow[laneDef.id] = true;
        updateAudioParams();
        showStatus(`DUB THROW: ${laneDef.name}`, 900);
        if (!state.isPlaying) tapAnchorOnLane(laneDef.id);
      }
    };

    const endPad = () => {
      pad.classList.remove('pressed');
      if (state.laneDubThrow[laneDef.id]) {
        state.laneDubThrow[laneDef.id] = false;
        updateAudioParams();
      }
    };

    pad.addEventListener('pointerdown', startPad);
    pad.addEventListener('pointerup', endPad);
    pad.addEventListener('pointerleave', endPad);
    pad.addEventListener('pointercancel', endPad);

    const actions = document.createElement('div');
    actions.className = 'lane-micro-actions';

    const btnSeed = document.createElement('button');
    btnSeed.className = 'micro-btn';
    btnSeed.textContent = 'SEED';
    btnSeed.title = `Generate fresh ${laneDef.name} anchor skeleton (Shift+${laneDef.keyHint})`;
    btnSeed.addEventListener('click', () => {
      initAudio();
      seedSingleLane(laneDef.id);
    });

    const btnClr = document.createElement('button');
    btnClr.className = 'micro-btn dim';
    btnClr.textContent = '×';
    btnClr.title = `Clear ${laneDef.name} anchors`;
    btnClr.addEventListener('click', () => {
      clearSingleLane(laneDef.id);
    });

    actions.appendChild(btnSeed);
    actions.appendChild(btnClr);
    col.appendChild(pad);
    col.appendChild(actions);
    padRow.appendChild(col);
    padEls[laneDef.id] = pad;
  }

  // Master Punch-In Tape FX Pads (Hold to Perform — Multi-touch Safe)
  const fxElMap = {};
  function setFxState(fxId, active) {
    if (!(fxId in state.fx)) return;
    if (state.fx[fxId] === active) return;
    if (active) initAudio();
    state.fx[fxId] = active;
    if (fxId === 'SLICE' && !active) {
      resetMasterGate();
    }
    updateAudioParams();
    syncFxUi();
  }

  fxBtns.forEach((btn) => {
    const fxId = btn.dataset.fx;
    fxElMap[fxId] = btn;

    const down = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      setFxState(fxId, true);
    };
    const up = (e) => {
      if (btn.hasPointerCapture?.(e.pointerId)) {
        btn.releasePointerCapture(e.pointerId);
      }
      setFxState(fxId, false);
    };

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', () => setFxState(fxId, false));
  });

  function syncFxUi() {
    const activeList = Object.keys(state.fx).filter(k => state.fx[k]);
    fxBtns.forEach((btn) => {
      const on = Boolean(state.fx[btn.dataset.fx]);
      btn.classList.toggle('active-amber', on);
      btn.classList.toggle('pressed', on);
    });
    if (fxStatus) {
      fxStatus.textContent = activeList.length ? activeList.join(' + ') : 'HOLD TO PERFORM';
      fxStatus.classList.toggle('is-active', activeList.length > 0);
    }
  }

  // Night-Arc Mood Hours (01:00 · 03:00 · 05:00 · 07:00)
  hourBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      initAudio();
      setHour(btn.dataset.hour);
      updateAudioParams();
    });
  });

  // Reel Preset Pills
  reelBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      loadReelPreset(Number(btn.dataset.reel));
      updateAudioParams();
    });
  });

  // Transport & Root Key
  btnPlay.addEventListener('click', () => togglePlayback());

  btnTap.addEventListener('click', () => {
    state.isTapRec = !state.isTapRec;
    showStatus(state.isTapRec ? 'TAP PADS TO PUNCH ANCHORS' : 'HOLD PADS FOR DUB THROW', 2000);
    syncUi();
  });

  btnKey.addEventListener('click', () => {
    cycleKey();
  });

  // Modals
  const closeModals = () => {
    menuBackdrop.classList.add('hidden');
    guideBackdrop.classList.add('hidden');
  };

  btnMenu.addEventListener('click', () => {
    guideBackdrop.classList.add('hidden');
    menuBackdrop.classList.toggle('hidden');
  });
  btnCloseMenu.addEventListener('click', closeModals);
  menuBackdrop.addEventListener('click', (e) => {
    if (e.target === menuBackdrop) closeModals();
  });

  btnGuide.addEventListener('click', () => {
    menuBackdrop.classList.add('hidden');
    guideBackdrop.classList.toggle('hidden');
  });
  btnCloseGuide.addEventListener('click', closeModals);
  btnGuideStart.addEventListener('click', closeModals);
  guideBackdrop.addEventListener('click', (e) => {
    if (e.target === guideBackdrop) closeModals();
  });

  // Menu Actions
  btnWav.addEventListener('click', () => toggleWavRecording());
  btnSaveJson.addEventListener('click', () => exportReelJson());
  btnLoadJson.addEventListener('click', () => fileJsonInput.click());

  fileJsonInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (importReelJson(text)) {
      updateAudioParams();
      closeModals();
    }
    fileJsonInput.value = '';
  });

  btnResetReel.addEventListener('click', () => {
    loadReelPreset(state.reelIndex);
    updateAudioParams();
    closeModals();
  });

  // Keyboard Shortcuts
  const keyToLane = { a: 'sub', s: 'cut', d: 'chd', f: 'air' };
  const keyToFx = { z: 'WASH', x: 'SUBM', c: 'FLUT', v: 'SLICE' };

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const k = e.key.toLowerCase();
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
      return;
    }
    if (k === 'r') {
      state.isTapRec = !state.isTapRec;
      showStatus(state.isTapRec ? 'TAP MODE ON' : 'DUB THROW MODE');
      syncUi();
      return;
    }
    if (k === 'k') {
      cycleKey();
      return;
    }
    if (k === 'h') {
      const idx = HOURS.findIndex(h => h.id === state.hourId);
      const next = HOURS[(idx + 1) % HOURS.length];
      setHour(next.id);
      updateAudioParams();
      return;
    }
    if (k === '1' || k === '2' || k === '3' || k === '4') {
      toggleMute(LANES[Number(k) - 1].id);
      updateAudioParams();
      return;
    }
    if (keyToFx[k]) {
      setFxState(keyToFx[k], true);
      return;
    }
    if (keyToLane[k]) {
      const laneId = keyToLane[k];
      if (e.shiftKey) {
        initAudio();
        seedSingleLane(laneId);
        return;
      }
      initAudio();
      padEls[laneId]?.classList.add('pressed');
      if (state.isTapRec) {
        tapAnchorOnLane(laneId);
      } else {
        state.laneDubThrow[laneId] = true;
        updateAudioParams();
        showStatus(`DUB THROW: ${laneId.toUpperCase()}`, 900);
        if (!state.isPlaying) tapAnchorOnLane(laneId);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keyToFx[k]) {
      setFxState(keyToFx[k], false);
      return;
    }
    if (keyToLane[k]) {
      const laneId = keyToLane[k];
      padEls[laneId]?.classList.remove('pressed');
      if (state.laneDubThrow[laneId]) {
        state.laneDubThrow[laneId] = false;
        updateAudioParams();
      }
    }
  });

  function syncUi(topic = 'all') {
    btnPlay.classList.toggle('active-mint', state.isPlaying);
    ledPlay.classList.toggle('on-mint', state.isPlaying);
    txtPlay.textContent = state.isPlaying ? 'STOP' : 'PLAY';

    btnTap.classList.toggle('active-amber', state.isTapRec);
    ledTap.classList.toggle('on-amber', state.isTapRec);

    btnKey.textContent = getKey(state.keyId).label;

    reelBtns.forEach((btn) => {
      btn.classList.toggle('active-mint', Number(btn.dataset.reel) === state.reelIndex);
    });

    hourBtns.forEach((btn) => {
      const isOn = btn.dataset.hour === state.hourId;
      btn.classList.toggle('active-hour', isOn);
    });

    padHint.textContent = state.isTapRec
      ? 'TAP MODE · HIT PADS OR A S D F TO PUNCH ANCHORS'
      : 'HOLD PADS (A S D F) FOR LANE DUB THROW';

    for (const laneDef of LANES) {
      const pad = padEls[laneDef.id];
      if (!pad) continue;
      pad.querySelector('.pad-sub').textContent = state.isTapRec ? 'TAP' : 'DUB';
      pad.classList.toggle('tap-armed', state.isTapRec);
      pad.classList.toggle('is-muted', state.lanes[laneDef.id].muted);
    }

    btnWav.textContent = state.isWavRecording ? 'STOP & SAVE .WAV' : 'REC MASTER .WAV';
    btnWav.classList.toggle('active-amber', state.isWavRecording);

    syncFxUi();

    if (topic === 'preset' || topic === 'all') {
      knobMicro.setValue(state.micro);
      knobDepth.setValue(state.depth);
      knobDrift.setValue(state.drift);
      knobTempo.setValue(state.bpm);
    }
  }

  subscribe((topic) => syncUi(topic));
  syncUi('all');
}
