// Tactile Pixel Rotary Knob — replaces fiddly sliders with Pocket-Operator-style encoders.
// Drag vertically, scroll with mouse wheel, use arrow keys, or double-tap to reset.

export function createPixelKnob(container, options = {}) {
  const {
    label = 'TONE',
    min = 0,
    max = 1,
    step = 0.01,
    value = 0.5,
    defaultValue = 0.5,
    formatValue = v => `${Math.round(v * 100)}%`,
    onChange = () => {}
  } = options;

  let current = value;
  let cfg = { label, min, max, step, defaultValue, formatValue };

  container.classList.add('pixel-knob-wrap');
  container.innerHTML = `
    <div class="knob-dial" tabindex="0" role="slider" aria-label="${label}">
      <canvas class="knob-canvas" width="44" height="44"></canvas>
    </div>
    <div class="knob-meta">
      <span class="knob-label">${label}</span>
      <span class="knob-val">${formatValue(value)}</span>
    </div>
  `;

  const dial = container.querySelector('.knob-dial');
  const canvas = container.querySelector('.knob-canvas');
  const ctx = canvas.getContext('2d');
  const labelEl = container.querySelector('.knob-label');
  const valEl = container.querySelector('.knob-val');

  function getNorm() {
    return Math.max(0, Math.min(1, (current - cfg.min) / (cfg.max - cfg.min || 1)));
  }

  function draw() {
    const W = 44;
    const H = 44;
    const cx = 22;
    const cy = 22;
    const norm = getNorm();

    ctx.clearRect(0, 0, W, H);

    // 13 pixel tick LEDs around a 270-degree arc (-225deg to +45deg)
    const ticks = 13;
    const startAngle = (-225 * Math.PI) / 180;
    const endAngle = (45 * Math.PI) / 180;
    const litCount = Math.round(norm * (ticks - 1));

    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const ang = startAngle + t * (endAngle - startAngle);
      const rx = Math.round(cx + Math.cos(ang) * 19) - 1;
      const ry = Math.round(cy + Math.sin(ang) * 19) - 1;
      ctx.fillStyle = i <= litCount ? '#ff6b2b' : '#3a332c';
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Chunky octagonal pixel knob shadow & body
    ctx.fillStyle = '#0b0908';
    drawPixelOctagon(ctx, cx, cy + 2, 13);

    ctx.fillStyle = '#473f38';
    drawPixelOctagon(ctx, cx, cy, 13);

    ctx.fillStyle = '#25211d';
    drawPixelOctagon(ctx, cx, cy, 11);

    // Subtle top bevel pixel highlight
    ctx.fillStyle = '#38322c';
    ctx.fillRect(cx - 5, cy - 10, 10, 1);

    // Center cap
    ctx.fillStyle = '#1b1815';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    // Rotating crisp indicator notch (Bresenham pixel line)
    const pointerAng = startAngle + norm * (endAngle - startAngle);
    const x0 = Math.round(cx + Math.cos(pointerAng) * 3);
    const y0 = Math.round(cy + Math.sin(pointerAng) * 3);
    const x1 = Math.round(cx + Math.cos(pointerAng) * 10);
    const y1 = Math.round(cy + Math.sin(pointerAng) * 10);
    drawPixelLine(ctx, x0, y0, x1, y1, '#f4e4c9');
  }

  function drawPixelOctagon(c, cx, cy, r) {
    const cut = Math.floor(r * 0.42);
    for (let y = -r; y <= r; y++) {
      const ay = Math.abs(y);
      const halfW = ay > r - cut ? r - (ay - (r - cut)) : r;
      c.fillRect(cx - halfW, cy + y, halfW * 2 + 1, 1);
    }
  }

  function drawPixelLine(c, x0, y0, x1, y1, color) {
    c.fillStyle = color;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
      c.fillRect(x - 1, y - 1, 2, 2);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  function applyValue(nextVal, emit = true) {
    const clamped = Math.max(cfg.min, Math.min(cfg.max, nextVal));
    const stepped = Math.round((clamped - cfg.min) / cfg.step) * cfg.step + cfg.min;
    const finalVal = Number(stepped.toFixed(4));
    if (finalVal === current && emit) return;
    current = finalVal;
    valEl.textContent = cfg.formatValue(current);
    dial.setAttribute('aria-valuenow', String(current));
    draw();
    if (emit) onChange(current, getNorm());
  }

  // Pointer drag (vertical drag feels super natural & accurate on touch and mouse)
  let dragging = false;
  let startY = 0;
  let startNorm = 0;
  let lastTapTime = 0;

  dial.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTapTime < 280) {
      // Double-tap resets to sweet spot!
      lastTapTime = 0;
      applyValue(cfg.defaultValue, true);
      return;
    }
    lastTapTime = now;

    dial.setPointerCapture(e.pointerId);
    dragging = true;
    dial.classList.add('is-turning');
    startY = e.clientY;
    startNorm = getNorm();
  });

  dial.addEventListener('pointermove', (e) => {
    if (!dragging || !dial.hasPointerCapture(e.pointerId)) return;
    const dy = startY - e.clientY;
    const sensitivity = 120; // pixels for full sweep
    const nextNorm = Math.max(0, Math.min(1, startNorm + dy / sensitivity));
    const nextVal = cfg.min + nextNorm * (cfg.max - cfg.min);
    applyValue(nextVal, true);
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    dial.classList.remove('is-turning');
    if (dial.hasPointerCapture(e.pointerId)) {
      dial.releasePointerCapture(e.pointerId);
    }
  };

  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);

  // Mouse wheel support for desktop ergonomics
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const wheelStep = Math.max(cfg.step, (cfg.max - cfg.min) / 28);
    applyValue(current + dir * wheelStep, true);
  }, { passive: false });

  // Keyboard support
  dial.addEventListener('keydown', (e) => {
    const keyStep = Math.max(cfg.step, (cfg.max - cfg.min) / 20);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      applyValue(current + keyStep, true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      applyValue(current - keyStep, true);
    }
  });

  draw();

  return {
    configure(nextCfg) {
      cfg = { ...cfg, ...nextCfg };
      labelEl.textContent = cfg.label;
      dial.setAttribute('aria-label', cfg.label);
      dial.setAttribute('aria-valuemin', String(cfg.min));
      dial.setAttribute('aria-valuemax', String(cfg.max));
      if (typeof nextCfg.value === 'number') {
        current = Math.max(cfg.min, Math.min(cfg.max, nextCfg.value));
      }
      valEl.textContent = cfg.formatValue(current);
      dial.setAttribute('aria-valuenow', String(current));
      draw();
    },
    setValue(v) {
      applyValue(v, false);
    }
  };
}
