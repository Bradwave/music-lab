import { state } from '../state/store.js';
import { CHANNELS, getMood } from '../state/scales.js';
import { PATTERN_LETTERS, PATTERN_NAMES } from '../state/presets.js';
import { getAudioNodes } from '../audio/engine.js';

const LCD_BG = '#f0dbb8';
const LCD_GHOST = '#dcc39b';
const LCD_INK = '#1e1813';

const PIXEL_FONT = {
  A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7],
  F:[7,4,6,4,4], G:[3,4,5,5,3], H:[5,5,7,5,5], I:[7,2,2,2,7], J:[1,1,1,5,2],
  K:[5,5,6,5,5], L:[4,4,4,4,7], M:[5,7,5,5,5], N:[5,7,7,5,5], O:[2,5,5,5,2],
  P:[6,5,6,4,4], Q:[2,5,5,7,3], R:[6,5,6,5,5], S:[3,4,2,1,6], T:[7,2,2,2,2],
  U:[5,5,5,5,7], V:[5,5,5,5,2], W:[5,5,5,7,5], X:[5,5,2,5,5], Y:[5,5,2,2,2],
  Z:[7,1,2,4,7], '0':[7,5,5,5,7], '1':[2,6,2,2,7], '2':[7,1,7,4,7], '3':[7,1,3,1,7],
  '4':[5,5,7,1,1], '5':[7,4,7,1,7], '6':[7,4,7,5,7], '7':[7,1,1,2,2], '8':[7,5,7,5,7],
  '9':[7,5,7,1,7], ':':[0,2,0,2,0], '-':[0,0,7,0,0], '.':[0,0,0,0,2], '%':[5,1,2,4,5],
  '/':[1,1,2,4,4], '+':[0,2,7,2,0], '!':[2,2,2,0,2], '&':[2,5,2,5,3], ' ':[0,0,0,0,0]
};

export function initLcdDisplay(canvas) {
  const ctx = canvas.getContext('2d');
  const waveData = new Uint8Array(128);

  function drawText(text, x, y, scale = 1, color = LCD_INK) {
    ctx.fillStyle = color;
    const str = String(text).toUpperCase();
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const glyph = PIXEL_FONT[str[i]] || PIXEL_FONT[' '];
      for (let row = 0; row < 5; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 3; col++) {
          if (bits & (1 << (2 - col))) {
            ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
          }
        }
      }
      cx += 4 * scale;
    }
  }

  function drawSunScene(pulse, frame) {
    const bx = 6;
    const by = 18;
    const bounce = pulse > 0.35 ? -2 : 0;

    ctx.fillStyle = LCD_INK;
    ctx.fillRect(bx + 7, by + 4 + bounce, 8, 8);
    ctx.fillRect(bx + 6, by + 5 + bounce, 10, 6);
    ctx.fillRect(bx + 8, by + 3 + bounce, 6, 10);

    const rOff = pulse > 0.28 ? 1 : 0;
    ctx.fillRect(bx + 10, by - 1 - rOff + bounce, 2, 2);
    ctx.fillRect(bx + 10, by + 15 + rOff + bounce, 2, 2);
    ctx.fillRect(bx + 2 - rOff, by + 7 + bounce, 2, 2);
    ctx.fillRect(bx + 18 + rOff, by + 7 + bounce, 2, 2);
    if (frame % 2 === 0 || pulse > 0.28) {
      ctx.fillRect(bx + 4, by + 1 + bounce, 2, 2);
      ctx.fillRect(bx + 16, by + 1 + bounce, 2, 2);
      ctx.fillRect(bx + 4, by + 13 + bounce, 2, 2);
      ctx.fillRect(bx + 16, by + 13 + bounce, 2, 2);
    }

    for (let x = 0; x < 48; x += 2) {
      const wy = (x + frame * 2) % 8 < 4 ? 0 : 1;
      ctx.fillRect(bx + x, by + 39 + wy, 2, 1);
    }

    const sway = frame % 4 < 2 ? 0 : 1;
    const px = bx + 32;
    const py = by + 23;
    ctx.fillRect(px + 2, py + 14, 3, 3);
    ctx.fillRect(px + 2, py + 10, 2, 4);
    ctx.fillRect(px + 3 + sway, py + 6, 2, 4);
    ctx.fillRect(px + 4 + sway, py + 2, 2, 4);
    ctx.fillRect(px - 2 + sway, py + 1, 6, 2);
    ctx.fillRect(px - 4 + sway, py + 3, 3, 2);
    ctx.fillRect(px + 5 + sway, py, 6, 2);
    ctx.fillRect(px + 10 + sway, py + 2, 3, 2);
    ctx.fillRect(px + 1 + sway, py - 2, 5, 2);

    const dx = bx + 15;
    const dy = by + 29 + (pulse > 0.38 ? -2 : 0);
    const armUp = frame % 2 === 0;
    ctx.fillRect(dx + 2, dy, 3, 3);
    ctx.fillRect(dx + 2, dy + 3, 3, 4);
    if (armUp) {
      ctx.fillRect(dx, dy + 2, 2, 2);
      ctx.fillRect(dx + 5, dy + 2, 2, 2);
    } else {
      ctx.fillRect(dx, dy + 4, 2, 2);
      ctx.fillRect(dx + 5, dy + 4, 2, 2);
    }
    ctx.fillRect(dx + 1, dy + 7, 2, 3);
    ctx.fillRect(dx + 4, dy + 7, 2, 3);
  }

  function render() {
    requestAnimationFrame(render);
    state.kickPulse *= 0.82;

    const W = 240;
    const H = 80;
    const now = performance.now();

    ctx.fillStyle = LCD_BG;
    ctx.fillRect(0, 0, W, H);

    // Top Inverted Header Strip
    ctx.fillStyle = LCD_INK;
    ctx.fillRect(0, 0, W, 13);

    const patLetter = PATTERN_LETTERS[state.activePattern] || 'A';
    const patName = PATTERN_NAMES[state.activePattern] || 'SLOT';
    const chObj = CHANNELS.find(c => c.id === state.activeChannel) || CHANNELS[0];
    const mood = getMood(state.moodId);

    const leftTag = state.chainEnabled && state.songChain.length > 0
      ? `CHN ${state.chainPos + 1}/${state.songChain.length} ${patLetter}`
      : `${patLetter}:${patName.slice(0, 8)}`;

    drawText(leftTag, 5, 4, 1, LCD_BG);
    drawText(mood.keyLabel, 76, 4, 1, LCD_BG);
    drawText(`${state.bpm}BPM`, 138, 4, 1, LCD_BG);

    let badge = 'STOP';
    if (state.isWavRecording) badge = 'WAV!';
    else if (state.isMicRecording) badge = 'MIC!';
    else if (state.isRec) badge = 'REC';
    else if (state.isPlaying) badge = 'PLAY';
    drawText(badge, 212 - (badge.length - 4) * 4, 4, 1, LCD_BG);

    drawSunScene(state.kickPulse, state.animFrame);

    ctx.fillStyle = LCD_GHOST;
    ctx.fillRect(58, 16, 1, 58);

    const knobOverlay = state.lcdKnobOverlay;
    if (knobOverlay && now < knobOverlay.until) {
      drawText(knobOverlay.label, 66, 19, 1, LCD_INK);
      drawText(knobOverlay.valueText, 66, 30, 2, LCD_INK);

      const barX = 66;
      const barY = 47;
      const blocks = 16;
      const filled = Math.round(knobOverlay.norm * blocks);
      for (let i = 0; i < blocks; i++) {
        ctx.fillStyle = i < filled ? LCD_INK : LCD_GHOST;
        ctx.fillRect(barX + i * 10, barY, 8, 8);
      }
    } else {
      const sx = 64;
      const sy = 18;
      const sw = 112;
      const sh = 36;
      ctx.fillStyle = LCD_GHOST;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = LCD_BG;
      ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

      ctx.fillStyle = LCD_GHOST;
      ctx.fillRect(sx + 2, sy + 18, sw - 4, 1);

      const { analyser } = getAudioNodes();
      if (analyser && state.isPlaying) {
        analyser.getByteTimeDomainData(waveData);
        ctx.fillStyle = LCD_INK;
        for (let i = 0; i < sw - 4; i += 2) {
          const idx = Math.floor((i / (sw - 4)) * waveData.length);
          const v = (waveData[idx] - 128) / 128;
          const py = Math.round(sy + 18 + v * 17);
          ctx.fillRect(sx + 2 + i, Math.max(sy + 2, Math.min(sy + sh - 3, py)), 2, 2);
        }
      } else {
        ctx.fillStyle = LCD_INK;
        for (let i = 0; i < sw - 4; i += 4) {
          ctx.fillRect(sx + 2 + i, sy + 18, 2, 1);
        }
      }

      const stpTxt = state.currentStep >= 0
        ? String(state.currentStep + 1).padStart(2, '0')
        : '--';
      drawText('STEP', 182, 19, 1, LCD_INK);
      drawText(stpTxt, 206, 18, 2, LCD_INK);

      const activeFx = Object.keys(state.fx).filter(k => state.fx[k]);
      if (activeFx.length) {
        drawText(`FX:${activeFx[0]}`, 182, 34, 1, LCD_INK);
      } else {
        drawText(`TRK:${chObj.name}`, 182, 34, 1, LCD_INK);
      }

      // 6 Mini track bars (KICK PERC BASS CHORD VOX SMPL)
      CHANNELS.forEach((ch, idx) => {
        const mx = 182 + idx * 9;
        const my = 45;
        const isMuted = state.mutes[ch.id];
        const isSel = state.activeChannel === ch.id;
        ctx.fillStyle = isMuted ? LCD_GHOST : LCD_INK;
        ctx.fillRect(mx, my, 6, isSel ? 7 : 4);
      });
    }

    // Bottom Status Ticker
    ctx.fillStyle = LCD_INK;
    ctx.fillRect(64, 60, 170, 15);

    let ticker = '';
    if (now < state.lcdMessageUntil) {
      ticker = state.lcdMessage;
    } else if (state.copyMode) {
      ticker = 'TAP A-H TO COPY PATTERN INTO';
    } else if (!state.isPlaying) {
      ticker = 'PRESS PLAY OR DROP AUDIO FILE';
    } else if (state.isRec) {
      ticker = `REC ${chObj.name}: TAP SOUNDS LIVE`;
    } else if (state.activeChannel === 'sm' && state.smplUseCustom) {
      ticker = `CHOPS: ${state.smplSampleName || 'CUSTOM'}`;
    } else if (state.activeChannel === 'vx' && state.voxUseMic) {
      ticker = `VOX: ${state.voxSampleName || 'CUSTOM'}`;
    } else {
      ticker = `${chObj.name}: PICK SOUND & PAINT`;
    }
    drawText(ticker.slice(0, 39), 69, 65, 1, LCD_BG);
  }

  requestAnimationFrame(render);
}
