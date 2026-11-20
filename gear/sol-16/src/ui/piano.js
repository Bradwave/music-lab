// Minimal Pixel Piano Keyboard for Pianists (OP-1 / Nanoloop inspired)
// 15 chromatic keys (C..D+), multi-touch polyphony, scale-guide dots, octave shift,
// live quantized recording & step-by-step chord capture!

import { state, saveState, showLcdMessage, notify } from '../state/store.js';
import { getMoodPitchClasses, midiToNoteName } from '../state/scales.js';
import { initAudio } from '../audio/engine.js';
import { triggerPianoNote } from '../audio/synths.js';
import { getQuantizedStepIndex } from '../audio/scheduler.js';

// 9 white keys (semitone offsets from C) + 6 black keys with exact percentage positions across 9 white keys
const WHITE_KEYS = [
  { semi: 0,  name: 'C', key: 'a' },
  { semi: 2,  name: 'D', key: 's' },
  { semi: 4,  name: 'E', key: 'd' },
  { semi: 5,  name: 'F', key: 'f' },
  { semi: 7,  name: 'G', key: 'g' },
  { semi: 9,  name: 'A', key: 'h' },
  { semi: 11, name: 'B', key: 'j' },
  { semi: 12, name: 'C', key: 'k' },
  { semi: 14, name: 'D', key: 'l' }
];

const BLACK_KEYS = [
  { semi: 1,  afterWhite: 0, key: 'w' },
  { semi: 3,  afterWhite: 1, key: 'e' },
  { semi: 6,  afterWhite: 3, key: 't' },
  { semi: 8,  afterWhite: 4, key: 'y' },
  { semi: 10, afterWhite: 5, key: 'u' },
  { semi: 13, afterWhite: 7, key: 'o' }
];

export const PIANO_KEY_MAP = {};
WHITE_KEYS.forEach(k => { PIANO_KEY_MAP[k.key] = k.semi; });
BLACK_KEYS.forEach(k => { PIANO_KEY_MAP[k.key] = k.semi; });

export function createMinimalPiano(container, { onStepWritten }) {
  container.innerHTML = `
    <div class="piano-bar">
      <div class="piano-oct-group">
        <button id="btnOctDown" class="mini-action" title="Octave Down ([)">OCT -</button>
        <span id="pianoRangeLbl" class="piano-range">C3–D4</span>
        <button id="btnOctUp" class="mini-action" title="Octave Up (])">OCT +</button>
      </div>
      <span class="piano-tip">TAP STEP OR REC LIVE</span>
    </div>
    <div class="mini-steps" id="pianoMiniSteps" aria-label="16-Step Strip"></div>
    <div class="piano-keys" id="pianoKeys" aria-label="Minimal Chromatic Keyboard"></div>
  `;

  const btnOctDown = container.querySelector('#btnOctDown');
  const btnOctUp = container.querySelector('#btnOctUp');
  const rangeLbl = container.querySelector('#pianoRangeLbl');
  const miniStepsEl = container.querySelector('#pianoMiniSteps');
  const keysEl = container.querySelector('#pianoKeys');

  // Chord-capture grouping buffer (combines notes struck within 75ms on CHORD track!)
  let lastWriteStep = -1;
  let lastWriteTime = 0;

  function baseMidi() {
    return (state.pianoOctave + 1) * 12; // oct 3 => C3 = 48
  }

  function recordMidiToStep(targetStep, midiNote) {
    const chId = state.activeChannel;
    const st = state.patterns[state.activePattern][chId][targetStep];
    const now = performance.now();

    if (chId === 'pr') {
      st.on = true;
      st.note = Math.abs(midiNote) % 6;
      st.accent = 1;
      delete st.midi;
      delete st.notes;
    } else if (chId === 'ch') {
      // Polyphonic chord capture: combine keys struck together within 85ms
      const isChordBurst = targetStep === lastWriteStep && (now - lastWriteTime) < 95 && st.on;
      if (isChordBurst) {
        const existing = Array.isArray(st.notes)
          ? [...st.notes]
          : (typeof st.midi === 'number' ? [st.midi] : []);
        if (!existing.includes(midiNote) && existing.length < 6) {
          existing.push(midiNote);
        }
        st.notes = existing.sort((a, b) => a - b);
        delete st.midi;
      } else {
        st.on = true;
        st.accent = 1;
        st.notes = [midiNote];
        delete st.midi;
      }
      lastWriteStep = targetStep;
      lastWriteTime = now;
    } else {
      const storedMidi = chId === 'bs' ? Math.max(24, midiNote - 12) : midiNote;
      st.on = true;
      st.accent = 1;
      st.midi = storedMidi;
      delete st.notes;
      lastWriteStep = targetStep;
      lastWriteTime = now;
    }

    saveState();
    renderMiniSteps();
    if (onStepWritten) onStepWritten(targetStep);
  }

  function triggerSemi(semi, keyEl = null) {
    initAudio();
    const midi = baseMidi() + semi;
    if (keyEl) {
      keyEl.classList.add('active');
    }

    triggerPianoNote(state.activeChannel, midi);
    showLcdMessage(`KEY: ${midiToNoteName(midi)}`, 850);

    if (state.isPlaying && state.isRec) {
      const qStep = getQuantizedStepIndex();
      state.selectedStep = qStep;
      recordMidiToStep(qStep, midi);
    } else if (!state.isPlaying && state.isRec) {
      // Step-by-step pianist chord entry when REC is armed & stopped!
      recordMidiToStep(state.selectedStep, midi);
    }
  }

  function releaseSemi(semi) {
    const el = keysEl.querySelector(`[data-semi="${semi}"]`);
    if (el) el.classList.remove('active');
  }

  function buildMiniSteps() {
    miniStepsEl.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mini-step ${i % 4 === 0 ? 'beat-start' : ''}`;
      b.dataset.step = String(i);
      b.textContent = String(i + 1);
      b.addEventListener('click', () => {
        initAudio();
        const st = state.patterns[state.activePattern][state.activeChannel][i];
        if (state.selectedStep === i && st.on) {
          // Tap already-selected active step to clear it quickly
          st.on = false;
          delete st.midi;
          delete st.notes;
          saveState();
          showLcdMessage(`S${i + 1} CLEARED`, 700);
          if (onStepWritten) onStepWritten(i);
        } else {
          state.selectedStep = i;
          showLcdMessage(`STEP ${i + 1} SELECTED`, 700);
        }
        renderMiniSteps();
      });
      miniStepsEl.appendChild(b);
    }
  }

  function renderMiniSteps() {
    const pat = state.patterns[state.activePattern][state.activeChannel];
    const children = miniStepsEl.children;
    for (let i = 0; i < children.length; i++) {
      const st = pat[i];
      children[i].classList.toggle('on', Boolean(st && st.on));
      children[i].classList.toggle('selected', i === state.selectedStep);
      children[i].classList.toggle('playing', i === state.currentStep);
    }
  }

  function renderKeys() {
    keysEl.innerHTML = '';
    const startMidi = baseMidi();
    rangeLbl.textContent = `${midiToNoteName(startMidi)}–${midiToNoteName(startMidi + 14)}`;
    const scalePCs = getMoodPitchClasses(state.moodId);

    const whiteWrap = document.createElement('div');
    whiteWrap.className = 'piano-whites';

    WHITE_KEYS.forEach((wk) => {
      const midi = startMidi + wk.semi;
      const inScale = scalePCs.has(midi % 12);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `p-key p-white ${inScale ? 'in-scale' : ''}`;
      btn.dataset.semi = String(wk.semi);
      btn.innerHTML = `
        <span class="scale-dot"></span>
        <span class="p-note">${wk.name}${wk.semi === 0 ? state.pianoOctave : (wk.semi === 12 ? state.pianoOctave + 1 : '')}</span>
      `;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        triggerSemi(wk.semi, btn);
      });
      const up = (e) => {
        if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      whiteWrap.appendChild(btn);
    });

    keysEl.appendChild(whiteWrap);

    // Raised chromatic black keys aligned cleanly over the 9 white keys
    const whiteWidthPct = 100 / WHITE_KEYS.length;
    BLACK_KEYS.forEach((bk) => {
      const midi = startMidi + bk.semi;
      const inScale = scalePCs.has(midi % 12);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `p-key p-black ${inScale ? 'in-scale' : ''}`;
      btn.dataset.semi = String(bk.semi);
      const leftPct = (bk.afterWhite + 1) * whiteWidthPct;
      btn.style.left = `calc(${leftPct}% - 4.4%)`;
      btn.innerHTML = '<span class="scale-dot"></span>';

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture(e.pointerId);
        triggerSemi(bk.semi, btn);
      });
      const up = (e) => {
        if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      keysEl.appendChild(btn);
    });
  }

  btnOctDown.addEventListener('click', () => {
    state.pianoOctave = Math.max(1, state.pianoOctave - 1);
    renderKeys();
    showLcdMessage(`OCTAVE ${state.pianoOctave}`);
  });

  btnOctUp.addEventListener('click', () => {
    state.pianoOctave = Math.min(5, state.pianoOctave + 1);
    renderKeys();
    showLcdMessage(`OCTAVE ${state.pianoOctave}`);
  });

  buildMiniSteps();
  renderKeys();
  renderMiniSteps();

  return {
    render() {
      renderKeys();
      renderMiniSteps();
    },
    renderMiniSteps,
    updatePlayhead(stepIdx) {
      const children = miniStepsEl.children;
      for (let i = 0; i < children.length; i++) {
        children[i].classList.toggle('playing', i === stepIdx);
      }
    },
    triggerKeyboardSemi(semi) {
      const el = keysEl.querySelector(`[data-semi="${semi}"]`);
      triggerSemi(semi, el);
    },
    releaseKeyboardSemi(semi) {
      releaseSemi(semi);
    },
    shiftOctave(delta) {
      state.pianoOctave = Math.max(1, Math.min(5, state.pianoOctave + delta));
      renderKeys();
      showLcdMessage(`OCTAVE ${state.pianoOctave}`);
    }
  };
}
