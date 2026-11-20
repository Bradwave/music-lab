// Minimal hardware faceplate controller for 3AM.
// Wires 4 reel pills, transport, mood cycle, 4 always-visible pixel knobs,
// 4 live Dub-Throw / Tap-In pads + per-lane SEED pills, menu drawer & keyboard shortcuts.

import {
  state,
  subscribe,
  loadReelPreset,
  cycleMood,
  toggleMute,
  seedSingleLane,
  clearSingleLane,
  refreshGhostMaps,
  saveToLocalStorage,
  exportReelJson,
  importReelJson,
  showStatus
} from '../state/store.js';
import { LANES, getMood } from '../state/scales.js';
import { initAudio, updateAudioParams } from '../audio/engine.js';
import { togglePlayback, tapAnchorOnLane } from '../audio/scheduler.js';
import { toggleWavRecording } from '../audio/wavRecorder.js';
import { createPixelKnob } from './knob.js';
import { initTapeDeck } from './tapeDeck.js';

export function initAppView() {
  const tapeCanvas = document.getElementById('tapeCanvas');
  initTapeDeck(tapeCanvas);

  // Elements
  const reelBtns = Array.from(document.querySelectorAll('.reel-btn'));
  const btnPlay = document.getElementById('btnPlay');
  const txtPlay = document.getElementById('txtPlay');
  const ledPlay = document.getElementById('ledPlay');
  const btnTap = document.getElementById('btnTap');
  const ledTap = document.getElementById('ledTap');
  const btnMood = document.getElementById('btnMood');

  const padRow = document.getElementById('padRow');
  const padHint = document.getElementById('padHint');

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

  // 4 Always-Visible Pixel Rotary Knobs (Amber = Procedural/Dub, Mint = Groove/Tempo)
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

  // Render 4 Bottom Lane Performance Pads + Tiny SEED / CLR Micro-Strip
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
        if (!state.isPlaying) {
          tapAnchorOnLane(laneDef.id);
        }
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

  // Reel Preset Pills
  reelBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.reel);
      loadReelPreset(idx);
      updateAudioParams();
    });
  });

  // Transport & Mood
  btnPlay.addEventListener('click', () => togglePlayback());

  btnTap.addEventListener('click', () => {
    state.isTapRec = !state.isTapRec;
    if (state.isTapRec) {
      showStatus('TAP PADS TO PUNCH ANCHORS', 2200);
    } else {
      showStatus('HOLD PADS FOR DUB THROW');
    }
    syncUi();
  });

  btnMood.addEventListener('click', () => {
    cycleMood();
  });

  // Modals / Menu
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
  btnWav.addEventListener('click', () => {
    toggleWavRecording();
  });

  btnSaveJson.addEventListener('click', () => {
    exportReelJson();
  });

  btnLoadJson.addEventListener('click', () => {
    fileJsonInput.click();
  });

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
      cycleMood();
      return;
    }
    if (k === '1' || k === '2' || k === '3' || k === '4') {
      const idx = Number(k) - 1;
      toggleMute(LANES[idx].id);
      updateAudioParams();
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
    // Play & Tap transport
    btnPlay.classList.toggle('active-mint', state.isPlaying);
    ledPlay.classList.toggle('on-mint', state.isPlaying);
    txtPlay.textContent = state.isPlaying ? 'STOP' : 'PLAY';

    btnTap.classList.toggle('active-amber', state.isTapRec);
    ledTap.classList.toggle('on-amber', state.isTapRec);

    // Mood label
    btnMood.textContent = getMood(state.moodId).label;

    // Active Reel Pill
    reelBtns.forEach((btn) => {
      const active = Number(btn.dataset.reel) === state.reelIndex;
      btn.classList.toggle('active-mint', active);
    });

    // Pad mode subtitle
    padHint.textContent = state.isTapRec
      ? 'TAP MODE · HIT PADS OR A S D F TO PUNCH ANCHORS'
      : 'HOLD PADS OR A S D F FOR LIVE DUB THROW · SEED BELOW';

    for (const laneDef of LANES) {
      const pad = padEls[laneDef.id];
      if (!pad) continue;
      const sub = pad.querySelector('.pad-sub');
      sub.textContent = state.isTapRec ? 'TAP' : 'DUB';
      pad.classList.toggle('tap-armed', state.isTapRec);
      pad.classList.toggle('is-muted', state.lanes[laneDef.id].muted);
    }

    // WAV record button
    btnWav.textContent = state.isWavRecording ? 'STOP & SAVE .WAV' : 'REC MASTER .WAV';
    btnWav.classList.toggle('active-amber', state.isWavRecording);

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
