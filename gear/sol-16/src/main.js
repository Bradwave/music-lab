import { state, loadState, notify, showLcdMessage } from './state/store.js';
import { CHANNELS, LIVE_KEYS } from './state/scales.js';
import { initAudio } from './audio/engine.js';
import { togglePlayback } from './audio/scheduler.js';
import { initLcdDisplay } from './lcd/display.js';
import { mountAppView } from './ui/appView.js';

function boot() {
  loadState();

  const lcdCanvas = document.getElementById('lcdCanvas');
  initLcdDisplay(lcdCanvas);

  const view = mountAppView();

  const fxKeyMap = { z: 'RPT', x: 'DUB', c: 'LPF', v: 'TAPE' };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();

    if (k === 'escape') {
      state.drawerOpen = false;
      state.guideOpen = false;
      state.copyMode = false;
      notify('channel');
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
      return;
    }

    if (k === 'r') {
      initAudio();
      state.isRec = !state.isRec;
      showLcdMessage(state.isRec ? 'LIVE REC: TAP SOUNDS' : 'REC OFF');
      notify('transport');
      return;
    }

    if (k === 'g') {
      view.generateCurrentTrack();
      return;
    }

    if (['1', '2', '3', '4', '5', '6'].includes(k)) {
      const ch = CHANNELS[Number(k) - 1];
      if (!ch) return;
      if (e.shiftKey) {
        state.mutes[ch.id] = !state.mutes[ch.id];
        showLcdMessage(`${ch.name} ${state.mutes[ch.id] ? 'MUTED' : 'ON'}`);
      } else {
        state.activeChannel = ch.id;
        showLcdMessage(`${ch.name} SELECTED`);
      }
      notify('channel');
      return;
    }

    const liveIdx = LIVE_KEYS.indexOf(k);
    if (liveIdx !== -1) {
      view.triggerBrushByIndex(liveIdx);
      return;
    }

    if (fxKeyMap[k]) {
      view.setFxState(fxKeyMap[k], true);
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (fxKeyMap[k]) {
      view.setFxState(fxKeyMap[k], false);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

boot();
