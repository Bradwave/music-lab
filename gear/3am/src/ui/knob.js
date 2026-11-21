// Berlin 3 AM Tactile Pixel Rotary Knob.
// Drag vertically, scroll wheel, arrow keys, or double-tap to reset.

export function createPixelKnob(container, options = {}) {
  const {
    label = 'MICRO',
    min = 0,
    max = 1,
    step = 0.01,
    value = 0.5,
    defaultValue = 0.5,
    accent = '#4ee6a8',
    formatValue = v => `${Math.round(v * 100)}%`,
    onChange = () => {}
  } = options;

  let current = value;
  const cfg = { label, min, max, step, defaultValue, accent, formatValue };

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
  const valEl = container.querySelector('.knob-val');

  function getNorm() {
    return Math.max(0, Math.min(1, (current - cfg.min) / (cfg.max - cfg.min || 1)));
  }

  function drawOctagon(c, cx, cy, r) {
    const cut = Math.floor(r * 0.42);
    for (let y = -r; y <= r; y++) {
      const ay = Math.abs(y);
      const halfW = ay > r - cut ? r - (ay - (r - cut)) : r;
      c.fillRect(cx - halfW, cy + y, halfW * 2 + 1, 1);
    }
  }

  function drawLine(c, x0, y0, x1, y1, color) {
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

  function draw() {
    const W = 44;
    const H = 44;
    const cx = 22;
    const cy = 22;
    const norm = getNorm();

    ctx.clearRect(0, 0, W, H);

    // 13 pixel tick LEDs around a 270-degree arc
    const ticks = 13;
    const startAngle = (-225 * Math.PI) / 180;
    const endAngle = (45 * Math.PI) / 180;
    const litCount = Math.round(norm * (ticks - 1));

    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const ang = startAngle + t * (endAngle - startAngle);
      const rx = Math.round(cx + Math.cos(ang) * 19) - 1;
      const ry = Math.round(cy + Math.sin(ang) * 19) - 1;
      ctx.fillStyle = i <= litCount ? cfg.accent : '#2a3436';
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Shadow & octagonal matte slate cap
    ctx.fillStyle = '#090d0e';
    drawOctagon(ctx, cx, cy + 2, 13);

    ctx.fillStyle = '#334043';
    drawOctagon(ctx, cx, cy, 13);

    ctx.fillStyle = '#1b2224';
    drawOctagon(ctx, cx, cy, 11);

    // Subtle top bevel highlight
    ctx.fillStyle = '#2d393c';
    ctx.fillRect(cx - 5, cy - 10, 10, 1);

    // Center hub
    ctx.fillStyle = '#131819';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);

    // Crisp pointer notch
    const pointerAng = startAngle + norm * (endAngle - startAngle);
    const x0 = Math.round(cx + Math.cos(pointerAng) * 3);
    const y0 = Math.round(cy + Math.sin(pointerAng) * 3);
    const x1 = Math.round(cx + Math.cos(pointerAng) * 10);
    const y1 = Math.round(cy + Math.sin(pointerAng) * 10);
    drawLine(ctx, x0, y0, x1, y1, '#ddebe3');
  }

  function applyValue(nextVal, emit = true) {
    const clamped = Math.max(cfg.min, Math.min(cfg.max, nextVal));
    const stepped = Math.round((clamped - cfg.min) / cfg.step) * cfg.step + cfg.min;
    const clean = Number(stepped.toFixed(4));
    if (clean === current && emit) return;
    current = clean;
    valEl.textContent = cfg.formatValue(current);
    dial.setAttribute('aria-valuenow', String(current));
    draw();
    if (emit) onChange(current);
  }

  let dragStartY = 0;
  let dragStartNorm = 0;
  let lastTap = 0;

  dial.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap < 280) {
      applyValue(cfg.defaultValue, true);
      lastTap = 0;
      return;
    }
    lastTap = now;

    dial.setPointerCapture(e.pointerId);
    dial.classList.add('is-turning');
    dragStartY = e.clientY;
    dragStartNorm = getNorm();
  });

  dial.addEventListener('pointermove', (e) => {
    if (!dial.hasPointerCapture(e.pointerId)) return;
    const dy = dragStartY - e.clientY;
    const nextNorm = Math.max(0, Math.min(1, dragStartNorm + dy / 120));
    applyValue(cfg.min + nextNorm * (cfg.max - cfg.min), true);
  });

  const endDrag = (e) => {
    if (dial.hasPointerCapture(e.pointerId)) {
      dial.releasePointerCapture(e.pointerId);
    }
    dial.classList.remove('is-turning');
  };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);

  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const bigStep = (cfg.max - cfg.min) / 36;
    applyValue(current + delta * Math.max(cfg.step, bigStep), true);
  }, { passive: false });

  dial.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      applyValue(current + Math.max(cfg.step, (cfg.max - cfg.min) / 24), true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      applyValue(current - Math.max(cfg.step, (cfg.max - cfg.min) / 24), true);
    }
  });

  draw();

  return {
    setValue(v) {
      applyValue(v, false);
    }
  };
}
