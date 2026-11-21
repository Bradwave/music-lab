// Entry point for DUST — Minimal Pixel-Art Vinyl Platter (Detroit Jazz-Wax / Jelinek).

import { loadFromLocalStorage, state } from './state/store.js';
import { stepPlatterPhysics } from './engine/platterPhysics.js';
import { initPlatterCanvas } from './ui/platterCanvas.js';
import { initPlatterGestures } from './ui/gestures.js';
import { initSleeveMenu } from './ui/sleeveMenu.js';

loadFromLocalStorage();

const canvas = document.getElementById('platterCanvas');
const { renderFrame } = initPlatterCanvas(canvas);
initPlatterGestures(canvas);
const { syncUi } = initSleeveMenu();

let lastTs = performance.now();
let lastUiSync = 0;

function tick(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
  lastTs = now;

  stepPlatterPhysics(dt);
  renderFrame(dt);

  // Periodically refresh subtle telemetry (e.g., when autoDrift creeps inward or status expires)
  if (now - lastUiSync > 180 || (state.statusUntil > 0 && now >= state.statusUntil)) {
    if (now >= state.statusUntil) state.statusUntil = 0;
    syncUi();
    lastUiSync = now;
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
