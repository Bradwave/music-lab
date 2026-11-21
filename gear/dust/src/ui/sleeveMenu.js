// Minimal Top Readout, Stamped Footer Telemetry, Record Sleeve Menu,
// Quick Gesture Guide, Keyboard Shortcuts, and PWA Service Worker wiring for DUST.

import {
  state,
  subscribe,
  getMarks,
  setSide,
  flipSide,
  setKey,
  cycleKey,
  setBpm,
  setGroovePos,
  toggleAutoDrift,
  clearCurrentSideMarks,
  restoreCurrentSide,
  bumpScrubSeed,
  showStatus
} from '../state/store.js';
import { getZoneLabel, getKey } from '../state/scales.js';
import { initAudio, playScrubZip, playBrushWipeSound } from '../audio/engine.js';
import { toggleNeedle, dropNeedle } from '../audio/scheduler.js';
import { toggleWavRecording } from '../audio/wavRecorder.js';

export function initSleeveMenu() {
  const ledSpin = document.getElementById('ledSpin');
  const readoutText = document.getElementById('readoutText');
  const plateZone = document.getElementById('plateZone');
  const btnQuickKey = document.getElementById('btnQuickKey');
  const btnQuickBrush = document.getElementById('btnQuickBrush');

  const btnMenu = document.getElementById('btnMenu');
  const btnCloseMenu = document.getElementById('btnCloseMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');

  const btnGuide = document.getElementById('btnGuide');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const btnGuideStart = document.getElementById('btnGuideStart');
  const guideBackdrop = document.getElementById('guideBackdrop');

  const btnSideA = document.getElementById('btnSideA');
  const btnSideB = document.getElementById('btnSideB');
  const keyBtns = Array.from(document.querySelectorAll('.key-btn'));
  const btnBpmDown = document.getElementById('btnBpmDown');
  const btnBpmUp = document.getElementById('btnBpmUp');
  const bpmReadout = document.getElementById('bpmReadout');
  const btnAutoDrift = document.getElementById('btnAutoDrift');
  const btnCleanWax = document.getElementById('btnCleanWax');
  const btnRestoreSide = document.getElementById('btnRestoreSide');
  const btnWav = document.getElementById('btnWav');

  function syncUi() {
    // Top LED & Readout
    if (ledSpin) {
      ledSpin.classList.toggle('on', state.needleDropped && !state.isWavRecording);
      ledSpin.classList.toggle('rec', state.isWavRecording);
    }

    const now = performance.now();
    if (readoutText) {
      if (state.isWavRecording) {
        readoutText.textContent = 'REC DUBPLATE .WAV...';
      } else if (now < state.statusUntil && state.statusText) {
        readoutText.textContent = state.statusText;
      } else if (!state.needleDropped) {
        readoutText.textContent = 'DROP NEEDLE · TAP WAX';
      } else {
        readoutText.textContent = `SIDE ${state.side} · ${state.keyId.toUpperCase()} · ${state.bpm} BPM`;
      }
    }

    // Bottom Integrated Hardware Strip
    if (plateZone) {
      plateZone.textContent = getZoneLabel(state.groovePos, state.side);
    }
    if (btnQuickKey) {
      btnQuickKey.textContent = `KEY ${getKey(state.keyId).label}`;
    }
    if (btnQuickBrush) {
      const count = getMarks().length;
      btnQuickBrush.textContent = count > 0 ? `BRUSH · ${count}` : 'BRUSH';
      btnQuickBrush.classList.toggle('has-marks', count > 0);
    }

    // Sleeve Modal Active States
    btnSideA?.classList.toggle('active-gold', state.side === 'A');
    btnSideB?.classList.toggle('active-gold', state.side === 'B');
    keyBtns.forEach((btn) => {
      btn.classList.toggle('active-gold', btn.dataset.key === state.keyId);
    });
    if (bpmReadout) bpmReadout.textContent = `${state.bpm} BPM`;
    if (btnAutoDrift) {
      btnAutoDrift.textContent = state.autoDrift ? 'GROOVE: CREEP INWARD' : 'GROOVE: LOCKED LOOP';
      btnAutoDrift.classList.toggle('active-gold', state.autoDrift);
    }
    if (btnWav) {
      btnWav.textContent = state.isWavRecording ? 'STOP & SAVE .WAV' : 'REC MASTER .WAV';
      btnWav.classList.toggle('active-crimson', state.isWavRecording);
    }
  }

  subscribe(syncUi);
  syncUi();

  // Modal Open / Close
  const closeModals = () => {
    menuBackdrop?.classList.add('hidden');
    guideBackdrop?.classList.add('hidden');
  };

  btnMenu?.addEventListener('click', () => {
    syncUi();
    menuBackdrop?.classList.remove('hidden');
  });
  btnCloseMenu?.addEventListener('click', closeModals);
  menuBackdrop?.addEventListener('click', (e) => {
    if (e.target === menuBackdrop) closeModals();
  });

  btnGuide?.addEventListener('click', () => {
    guideBackdrop?.classList.remove('hidden');
  });
  btnCloseGuide?.addEventListener('click', closeModals);
  btnGuideStart?.addEventListener('click', () => {
    closeModals();
    dropNeedle();
  });
  guideBackdrop?.addEventListener('click', (e) => {
    if (e.target === guideBackdrop) closeModals();
  });

  // Sleeve Controls
  btnSideA?.addEventListener('click', () => {
    initAudio();
    setSide('A');
  });
  btnSideB?.addEventListener('click', () => {
    initAudio();
    setSide('B');
  });

  keyBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      initAudio();
      setKey(btn.dataset.key);
    });
  });

  btnBpmDown?.addEventListener('click', () => setBpm(state.bpm - 2));
  btnBpmUp?.addEventListener('click', () => setBpm(state.bpm + 2));
  btnAutoDrift?.addEventListener('click', () => toggleAutoDrift());

  btnCleanWax?.addEventListener('click', () => {
    clearCurrentSideMarks();
    playBrushWipeSound();
    closeModals();
  });
  btnQuickKey?.addEventListener('click', () => {
    initAudio();
    cycleKey();
  });
  btnQuickBrush?.addEventListener('click', () => {
    clearCurrentSideMarks();
    playBrushWipeSound();
  });
  btnRestoreSide?.addEventListener('click', () => {
    restoreCurrentSide();
    closeModals();
  });
  btnWav?.addEventListener('click', () => {
    toggleWavRecording();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Escape') {
      closeModals();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      toggleNeedle();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      setGroovePos(state.groovePos + 0.08);
      showStatus(getZoneLabel(state.groovePos, state.side), 1100);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      setGroovePos(state.groovePos - 0.08);
      showStatus(getZoneLabel(state.groovePos, state.side), 1100);
    } else if (e.key === 'k' || e.key === 'K') {
      initAudio();
      cycleKey();
    } else if (e.key === 'f' || e.key === 'F') {
      initAudio();
      flipSide();
    } else if (e.key === 's' || e.key === 'S') {
      initAudio();
      bumpScrubSeed();
      playScrubZip();
    } else if (e.key === 'c' || e.key === 'C') {
      clearCurrentSideMarks();
      playBrushWipeSound();
    }
  });

  // Register standalone Service Worker with automatic update on resume
  if ('serviceWorker' in navigator) {
    let reloading = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {});
            }
          });
        })
        .catch(() => {});
    });
  }

  return { syncUi };
}
