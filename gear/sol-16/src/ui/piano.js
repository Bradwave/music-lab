// Minimal Pixel Hardware Keybed for Pianists (OP-Z / Elektron / Nanoloop inspired)
// Pure 16-column pixel keycap grid: authentic 2+3 piano spacing in matte charcoal & orange,
// zero overlapping strips, multi-touch polyphony, scale LED indicators, & chord capture!

import { state, saveState, showLcdMessage } from '../state/store.js';
import { getMoodPitchClasses, midiToNoteName, getStepDisplayLabel } from '../state/scales.js';
import { initAudio } from '../audio/engine.js';
import { triggerPianoNote } from '../audio/synths.js';
import { getQuantizedStepIndex } from '../audio/scheduler.js';

// 16-column pixel grid:
// Top row (sharps/flats) offset by 1 column for dead-accurate 2-group & 3-group piano spacing!
const SHARP_KEYS = [
  { semi: 1,  label: 'C#', colStart: 2,  key: 'w' },
  { semi: 3,  label: 'Eb', colStart: 4,  key: 'e' },
  { semi: 6,  label: 'F#', colStart: 8,  key: 't' },
  { semi: 8,  label: 'Ab', colStart: 10, key: 'y' },
  { semi: 10, label: 'Bb', colStart: 12, key: 'u' }
];

const NATURAL_KEYS = [
  { semi: 0,  label: 'C',  colStart: 1,  key: 'a' },
  { semi: 2,  label: 'D',  colStart: 3,  key: 's' },
  { semi: 4,  label: 'E',  colStart: 5,  key: 'd' },
  { semi: 5,  label: 'F',  colStart: 7,  key: 'f' },
  { semi: 7,  label: 'G',  colStart: 9,  key: 'g' },
  { semi: 9,  label: 'A',  colStart: 11, key: 'h' },
  { semi: 11, label: 'B',  colStart: 13, key: 'j' },
  { semi: 12, label: 'C+', colStart: 15, key: 'k' }
];

export const PIANO_KEY_MAP = {};
NATURAL_KEYS.forEach(k => { PIANO_KEY_MAP[k.key] = k.semi; });
SHARP_KEYS.forEach(k => { PIANO_KEY_MAP[k.key] = k.semi; });

export function createMinimalPiano(container, { onStepWritten }) {
  container.innerHTML = `
    <div class="piano-bar">
      <div class="piano-oct-group">
        <button id="btnOctDown" class="mini-action" title="Octave Down ([)">OCT -</button>
        <span id="pianoRangeLbl" class="piano-range">C3–C4</span>
        <button id="btnOctUp" class="mini-action" title="Octave Up (])">OCT +</button>
      </div>
      <span class="piano-tip">TAP STEP OR REC LIVE</span>
    </div>
    <div class="mini-steps" id="pianoMiniSteps" aria-label="16-Step Strip"></div>
    <div class="pixel-keybed" id="pianoKeys" aria-label="Minimal Pixel Keybed"></div>
  `;

  const btnOctDown = container.querySelector('#btnOctDown');
  const btnOctUp = container.querySelector('#btnOctUp');
  const rangeLbl = container.querySelector('#pianoRangeLbl');
  const miniStepsEl = container.querySelector('#pianoMiniSteps');
  const keysEl = container.querySelector('#pianoKeys');

  let lastWriteStep = -1;
  let lastWriteTime = 0;

  function baseMidi() {
    return (state.pianoOctave + 1) * 12;
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
    if (keyEl) keyEl.classList.add('active');

    triggerPianoNote(state.activeChannel, midi);
    showLcdMessage(`KEY: ${midiToNoteName(midi)}`, 850);

    if (state.isPlaying && state.isRec) {
      const qStep = getQuantizedStepIndex();
      state.selectedStep = qStep;
      recordMidiToStep(qStep, midi);
    } else if (!state.isPlaying && state.isRec) {
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
      b.innerHTML = `<span class="ms-num">${i + 1}</span><span class="ms-val"></span>`;
      b.addEventListener('click', () => {
        initAudio();
        const st = state.patterns[state.activePattern][state.activeChannel][i];
        if (state.selectedStep === i && st.on) {
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
    const chId = state.activeChannel;
    const pat = state.patterns[state.activePattern][chId];
    const children = miniStepsEl.children;
    for (let i = 0; i < children.length; i++) {
      const st = pat[i];
      const el = children[i];
      el.classList.toggle('on', Boolean(st && st.on));
      el.classList.toggle('selected', i === state.selectedStep);
      el.classList.toggle('playing', i === state.currentStep);
      const valEl = el.querySelector('.ms-val');
      if (valEl) {
        valEl.textContent = st && st.on
          ? getStepDisplayLabel(chId, st, state.moodId, state.smplUseCustom)
          : '';
      }
    }
  }

  function makeKeycap(spec, isSharp, scalePCs, startMidi) {
    const midi = startMidi + spec.semi;
    const inScale = scalePCs.has(midi % 12);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `px-keycap ${isSharp ? 'px-sharp' : 'px-natural'} ${inScale ? 'in-scale' : ''}`;
    btn.dataset.semi = String(spec.semi);
    btn.style.gridColumn = `${spec.colStart} / span 2`;
    btn.style.gridRow = isSharp ? '1' : '2';

    const displayLbl = spec.semi === 0
      ? `C${state.pianoOctave}`
      : (spec.semi === 12 ? `C${state.pianoOctave + 1}` : spec.label);

    btn.innerHTML = `
      <span class="keycap-led"></span>
      <span class="keycap-note">${displayLbl}</span>
    `;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      triggerSemi(spec.semi, btn);
    });
    const up = (e) => {
      if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    return btn;
  }

  function renderKeys() {
    keysEl.innerHTML = '';
    const startMidi = baseMidi();
    rangeLbl.textContent = `${midiToNoteName(startMidi)}–${midiToNoteName(startMidi + 12)}`;
    const scalePCs = getMoodPitchClasses(state.moodId);

    SHARP_KEYS.forEach(spec => {
      keysEl.appendChild(makeKeycap(spec, true, scalePCs, startMidi));
    });
    NATURAL_KEYS.forEach(spec => {
      keysEl.appendChild(makeKeycap(spec, false, scalePCs, startMidi));
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
