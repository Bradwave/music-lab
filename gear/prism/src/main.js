// PRISM // Laser Optical Bench & West-Coast Buchla FM Synthesizer
// Main entry point: initializes state, controls, 60fps optical canvas loop & PWA service worker.

import { loadSavedState } from './state/store.js';
import { updateSimVisuals } from './engine/opticsSim.js';
import { renderChamber } from './ui/chamberCanvas.js';
import { initControls } from './ui/controls.js';

loadSavedState();

const canvas = document.getElementById('chamberCanvas');
initControls(canvas);

// 60fps animation loop
let lastFrameMs = performance.now();

function frame(nowMs) {
  const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  updateSimVisuals(dtSec);
  renderChamber(canvas, nowMs);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Register standalone PRISM PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {});
  });
}
