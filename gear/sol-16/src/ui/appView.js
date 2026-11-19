import {
  state,
  subscribe,
  notify,
  saveState,
  showLcdMessage,
  showLcdKnob,
  resetAllToDemo,
  clearActiveChannel
} from '../state/store.js';
import {
  CHANNELS,
  MOODS,
  getBrushList,
  getStepLabel
} from '../state/scales.js';
import {
  PATTERN_LETTERS,
  PATTERN_NAMES,
  makeStep,
  generateTrackGroove
} from '../state/presets.js';
import {
  initAudio,
  getAudioNodes,
  updateFxAudioParams,
  updateVinylAudio,
  recordMicSample,
  importAudioFile
} from '../audio/engine.js';
import { triggerChannelSound } from '../audio/synths.js';
import { togglePlayback, getQuantizedStepIndex, setPlayheadListener } from '../audio/scheduler.js';
import { toggleWavRecording } from '../audio/wavRecorder.js';
import { exportProjectJson, importProjectJson } from '../audio/projectIO.js';
import { exportMidiFile } from '../audio/midiExport.js';
import { createPixelKnob } from './knob.js';

export function mountAppView() {
  const chassisEl = document.getElementById('chassis');
  const dropOverlayEl = document.getElementById('dropOverlay');
  const trackBarEl = document.getElementById('trackBar');
  const brushStripEl = document.getElementById('brushStrip');
  const brushHintEl = document.getElementById('brushHint');
  const stepGridEl = document.getElementById('stepGrid');
  const fxStatusEl = document.getElementById('fxStatus');

  const btnPlay = document.getElementById('btnPlay');
  const ledPlay = document.getElementById('ledPlay');
  const txtPlay = document.getElementById('txtPlay');
  const btnRec = document.getElementById('btnRec');
  const ledRec = document.getElementById('ledRec');
  const btnBankSound = document.getElementById('btnBankSound');
  const btnBankGroove = document.getElementById('btnBankGroove');

  const btnLoadSampleInline = document.getElementById('btnLoadSampleInline');
  const btnGen = document.getElementById('btnGen');
  const btnClear = document.getElementById('btnClear');
  const btnMenu = document.getElementById('btnMenu');
  const btnGuide = document.getElementById('btnGuide');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const guideBackdrop = document.getElementById('guideBackdrop');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const btnCloseGuide = document.getElementById('btnCloseGuide');
  const btnGuideStart = document.getElementById('btnGuideStart');

  // Drawer elements
  const btnChainToggle = document.getElementById('btnChainToggle');
  const btnChainClear = document.getElementById('btnChainClear');
  const chainReadoutEl = document.getElementById('chainReadout');
  const chainAddGridEl = document.getElementById('chainAddGrid');
  const moodGridEl = document.getElementById('moodGrid');

  const btnLoadVox = document.getElementById('btnLoadVox');
  const btnLoadSmpl = document.getElementById('btnLoadSmpl');
  const btnMicVox = document.getElementById('btnMicVox');
  const btnMicSmpl = document.getElementById('btnMicSmpl');

  const btnSaveJson = document.getElementById('btnSaveJson');
  const btnLoadJson = document.getElementById('btnLoadJson');
  const btnExportMidi = document.getElementById('btnExportMidi');
  const btnWav = document.getElementById('btnWav');
  const btnVinyl = document.getElementById('btnVinyl');
  const btnCopy = document.getElementById('btnCopy');
  const btnReset = document.getElementById('btnReset');

  const fileAudioInput = document.getElementById('fileAudioInput');
  const fileProjectInput = document.getElementById('fileProjectInput');
  let pendingAudioTarget = 'sm';

  // -------------------------------------------------------------------------
  // 1. THREE PIXEL ROTARY KNOBS
  //    SND bank: TONE | DECAY | SPACE
  //    BPM bank: BPM  | SWING | PUMP
  // -------------------------------------------------------------------------
  const knobA = createPixelKnob(document.getElementById('knobA'), {
    label: 'TONE',
    onChange: (val, norm) => {
      initAudio();
      if (state.knobBank === 'SOUND') {
        state.trackParams[state.activeChannel].tone = val;
        const ch = CHANNELS.find(c => c.id === state.activeChannel);
        const lbl = state.activeChannel === 'vx' ? 'VOWEL' : `${ch.name} TONE`;
        showLcdKnob(lbl, `${Math.round(val * 100)}%`, norm);
      } else {
        state.bpm = Math.round(val);
        updateFxAudioParams();
        showLcdKnob('TEMPO', `${state.bpm} BPM`, norm);
      }
      saveState();
    }
  });

  const knobB = createPixelKnob(document.getElementById('knobB'), {
    label: 'DECAY',
    onChange: (val, norm) => {
      initAudio();
      if (state.knobBank === 'SOUND') {
        state.trackParams[state.activeChannel].decay = val;
        const ch = CHANNELS.find(c => c.id === state.activeChannel);
        showLcdKnob(`${ch.name} DECAY`, `${Math.round(val * 100)}%`, norm);
      } else {
        state.swing = Math.round(val);
        showLcdKnob('GROOVE SWING', `${state.swing}%`, norm);
      }
      saveState();
    }
  });

  const knobC = createPixelKnob(document.getElementById('knobC'), {
    label: 'SPACE',
    onChange: (val, norm) => {
      initAudio();
      if (state.knobBank === 'SOUND') {
        state.trackParams[state.activeChannel].space = val;
        const ch = CHANNELS.find(c => c.id === state.activeChannel);
        showLcdKnob(`${ch.name} SPACE`, `${Math.round(val * 100)}%`, norm);
      } else {
        state.pump = Math.round(val);
        updateFxAudioParams();
        showLcdKnob('SIDECHAIN PUMP', `${state.pump}%`, norm);
      }
      saveState();
    }
  });

  function syncKnobsUI() {
    btnBankSound.classList.toggle('active-orange', state.knobBank === 'SOUND');
    btnBankGroove.classList.toggle('active-orange', state.knobBank === 'GROOVE');

    if (state.knobBank === 'SOUND') {
      const ch = CHANNELS.find(c => c.id === state.activeChannel) || CHANNELS[0];
      const p = state.trackParams[state.activeChannel];
      knobA.configure({
        label: state.activeChannel === 'vx' ? 'VOWEL' : 'TONE',
        min: 0, max: 1, step: 0.01,
        value: p.tone, defaultValue: ch.defaultTone,
        formatValue: v => `${Math.round(v * 100)}%`
      });
      knobB.configure({
        label: 'DECAY',
        min: 0, max: 1, step: 0.01,
        value: p.decay, defaultValue: ch.defaultDecay,
        formatValue: v => `${Math.round(v * 100)}%`
      });
      knobC.configure({
        label: 'SPACE',
        min: 0, max: 1, step: 0.01,
        value: p.space, defaultValue: ch.defaultSpace,
        formatValue: v => `${Math.round(v * 100)}%`
      });
    } else {
      knobA.configure({
        label: 'BPM',
        min: 110, max: 136, step: 1,
        value: state.bpm, defaultValue: 123,
        formatValue: v => `${Math.round(v)}`
      });
      knobB.configure({
        label: 'SWING',
        min: 0, max: 65, step: 1,
        value: state.swing, defaultValue: 34,
        formatValue: v => `${Math.round(v)}%`
      });
      knobC.configure({
        label: 'PUMP',
        min: 0, max: 100, step: 1,
        value: state.pump, defaultValue: 62,
        formatValue: v => `${Math.round(v)}%`
      });
    }
  }

  btnBankSound.addEventListener('click', () => {
    state.knobBank = 'SOUND';
    syncKnobsUI();
    showLcdMessage('KNOBS: TONE DECAY SPACE');
  });

  btnBankGroove.addEventListener('click', () => {
    state.knobBank = 'GROOVE';
    syncKnobsUI();
    showLcdMessage('KNOBS: BPM SWING PUMP');
  });

  // -------------------------------------------------------------------------
  // 2. 6 TRACKS WITH INLINE 1-TAP MUTE BARS
  // -------------------------------------------------------------------------
  function renderTrackBar() {
    trackBarEl.innerHTML = '';
    CHANNELS.forEach((ch, idx) => {
      const isSelected = state.activeChannel === ch.id;
      const isMuted = state.mutes[ch.id];

      const unit = document.createElement('div');
      unit.className = 'track-unit';

      const selBtn = document.createElement('button');
      selBtn.className = `px-btn track-sel ${isSelected ? 'active-orange' : ''} ${isMuted ? 'is-muted' : ''}`;
      selBtn.textContent = ch.name;
      selBtn.title = `Select ${ch.name} (Key ${idx + 1})`;
      selBtn.addEventListener('click', () => {
        initAudio();
        state.activeChannel = ch.id;
        showLcdMessage(`${ch.name} SELECTED`);
        notify('channel');
      });

      const muteBar = document.createElement('button');
      muteBar.className = `track-mute-bar ${isMuted ? 'is-muted' : ''}`;
      muteBar.title = isMuted ? `Unmute ${ch.name}` : `Mute ${ch.name}`;
      muteBar.setAttribute('aria-label', `${isMuted ? 'Unmute' : 'Mute'} ${ch.name}`);
      muteBar.innerHTML = '<span class="track-mute-led"></span>';
      muteBar.addEventListener('click', () => {
        initAudio();
        state.mutes[ch.id] = !state.mutes[ch.id];
        showLcdMessage(`${ch.name} ${state.mutes[ch.id] ? 'MUTED' : 'ON'}`);
        renderTrackBar();
      });

      unit.appendChild(selBtn);
      unit.appendChild(muteBar);
      trackBarEl.appendChild(unit);
    });
  }

  // -------------------------------------------------------------------------
  // 3. SOUND BRUSH & LIVE PLAY STRIP (WITH INLINE SAMPLE LOAD FOR VOX & SMPL)
  // -------------------------------------------------------------------------
  function triggerBrushPad(noteIdx, padEl = null) {
    initAudio();
    const { audioCtx } = getAudioNodes();
    state.selectedBrush[state.activeChannel] = noteIdx;

    if (padEl) {
      padEl.classList.add('flash');
      setTimeout(() => padEl.classList.remove('flash'), 120);
    }

    const previewStep = makeStep(true, noteIdx, 1);
    triggerChannelSound(state.activeChannel, audioCtx.currentTime, previewStep);

    const lbl = getStepLabel(state.activeChannel, noteIdx, state.moodId, state.smplUseCustom);
    showLcdMessage(`BRUSH: ${lbl}`, 900);

    if (state.isPlaying && state.isRec) {
      const qStep = getQuantizedStepIndex();
      const target = state.patterns[state.activePattern][state.activeChannel][qStep];
      target.on = true;
      target.note = noteIdx;
      target.accent = 1;
      updateSinglePad(qStep);
      saveState();
      renderPatterns();
    }

    renderBrushSelectionOnly();
  }

  function renderBrushSelectionOnly() {
    const activeNote = state.selectedBrush[state.activeChannel];
    brushStripEl.querySelectorAll('.brush-pad[data-note]').forEach(btn => {
      btn.classList.toggle('selected', Number(btn.dataset.note) === activeNote);
    });
  }

  function renderBrushStrip() {
    brushStripEl.innerHTML = '';
    const chId = state.activeChannel;
    const brushes = getBrushList(chId, state.moodId, state.smplUseCustom);
    const activeNote = state.selectedBrush[chId] ?? 0;

    // Show quick "+ SMP" file-import action when on VOX or SMPL tracks!
    const isSamplerTrack = chId === 'vx' || chId === 'sm';
    btnLoadSampleInline.classList.toggle('hidden', !isSamplerTrack);

    if (chId === 'ch') brushHintEl.textContent = 'PICK A CHORD · TAP GRID';
    else if (chId === 'pr') brushHintEl.textContent = 'PICK A DRUM · TAP GRID';
    else if (chId === 'bd') brushHintEl.textContent = 'KICK HIT · TAP GRID';
    else if (chId === 'vx') brushHintEl.textContent = state.voxUseMic ? `VOX: ${state.voxSampleName || 'SAMPLE'}` : 'VOCAL CHOPS · TAP TO PAINT';
    else if (chId === 'sm') brushHintEl.textContent = state.smplUseCustom ? `8 CHOPS: ${state.smplSampleName || 'AUDIO'}` : 'ORGANIC TEXTURES · OR DROP AUDIO';
    else brushHintEl.textContent = 'PICK A NOTE · TAP GRID';

    brushes.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = `brush-pad ${b.note === activeNote ? 'selected' : ''}`;
      btn.dataset.note = String(b.note);
      btn.innerHTML = `<span class="brush-name">${b.label}</span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        triggerBrushPad(b.note, btn);
      });
      brushStripEl.appendChild(btn);
    });

    // Quick MIC/SYN toggle chip on VOX
    if (chId === 'vx') {
      const micBtn = document.createElement('button');
      micBtn.className = `brush-pad mic-pad ${state.voxUseMic || (state.isMicRecording && state.micTargetChannel === 'vx') ? 'mic-active' : ''}`;
      micBtn.title = state.voxUseMic ? 'Switch back to Built-in Vocal Choir' : 'Record 1.5s Mic Voice Chop';
      micBtn.innerHTML = `<span class="brush-name">${state.isMicRecording && state.micTargetChannel === 'vx' ? 'REC' : (state.voxUseMic ? 'SYN' : 'MIC')}</span>`;
      micBtn.addEventListener('click', () => {
        if (state.voxUseMic) {
          state.voxUseMic = false;
          showLcdMessage('VOX: DREAM SYNTH');
          notify('sample');
        } else if (state.voxMicBuffer) {
          state.voxUseMic = true;
          showLcdMessage(`VOX: ${state.voxSampleName || 'SAMPLE'}`);
          notify('sample');
        } else {
          recordMicSample('vx');
        }
      });
      brushStripEl.appendChild(micBtn);
    }

    // If SMPL has a custom sample loaded, allow toggling back to built-in textures via "+ SMP" or right on Menu
    if (chId === 'sm' && state.smplBuffer) {
      btnLoadSampleInline.textContent = state.smplUseCustom ? 'KIT' : 'CHOP';
      btnLoadSampleInline.title = state.smplUseCustom ? 'Switch to built-in organic textures' : 'Switch to your loaded 8-chop sample';
    } else if (isSamplerTrack) {
      btnLoadSampleInline.textContent = '+ SMP';
      btnLoadSampleInline.title = 'Load audio file (.mp3/.wav/.ogg/.m4a) onto this track';
    }

    brushStripEl.dataset.count = String(brushStripEl.children.length);
  }

  btnLoadSampleInline.addEventListener('click', () => {
    if (state.activeChannel === 'sm' && state.smplBuffer) {
      state.smplUseCustom = !state.smplUseCustom;
      showLcdMessage(state.smplUseCustom ? `CHOPS: ${state.smplSampleName || 'CUSTOM'}` : 'SMPL: ORGANIC KIT');
      notify('sample');
      return;
    }
    pendingAudioTarget = state.activeChannel === 'vx' ? 'vx' : 'sm';
    fileAudioInput.value = '';
    fileAudioInput.click();
  });

  // -------------------------------------------------------------------------
  // 4. 4x4 NANOLOOP STEP GRID
  // -------------------------------------------------------------------------
  function buildGridDOM() {
    stepGridEl.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.className = `step-pad ${i % 4 === 0 ? 'beat-start' : ''}`;
      pad.dataset.step = String(i);
      pad.innerHTML = `
        <div class="step-top">
          <span class="step-num">${i + 1}</span>
          <span class="step-dot"></span>
        </div>
        <div class="step-val"></div>
      `;

      let holdTimer = null;
      let didHold = false;

      pad.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        initAudio();
        didHold = false;
        const st = state.patterns[state.activePattern][state.activeChannel][i];
        if (st.on) {
          holdTimer = setTimeout(() => {
            didHold = true;
            st.accent = st.accent ? 0 : 1;
            updateSinglePad(i);
            saveState();
            showLcdMessage(`STEP ${i + 1}: ${st.accent ? 'FULL HIT' : 'SOFT GHOST'}`);
          }, 360);
        }
      });

      const cancelHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      pad.addEventListener('pointerleave', cancelHold);
      pad.addEventListener('pointercancel', cancelHold);

      pad.addEventListener('pointerup', (e) => {
        if (e.button === 2) return;
        cancelHold();
        if (didHold) return;

        const chId = state.activeChannel;
        const brushNote = state.selectedBrush[chId] ?? 0;
        const st = state.patterns[state.activePattern][chId][i];

        if (!st.on) {
          st.on = true;
          st.note = brushNote;
          st.accent = 1;
          if (!state.isPlaying) {
            const { audioCtx } = getAudioNodes();
            triggerChannelSound(chId, audioCtx.currentTime, st);
          }
          showLcdMessage(`S${i + 1}: ${getStepLabel(chId, st.note, state.moodId, state.smplUseCustom)}`, 900);
        } else if (st.note !== brushNote) {
          st.note = brushNote;
          st.accent = 1;
          if (!state.isPlaying) {
            const { audioCtx } = getAudioNodes();
            triggerChannelSound(chId, audioCtx.currentTime, st);
          }
          showLcdMessage(`S${i + 1} -> ${getStepLabel(chId, st.note, state.moodId, state.smplUseCustom)}`, 900);
        } else {
          st.on = false;
          showLcdMessage(`S${i + 1} CLEARED`, 700);
        }

        updateSinglePad(i);
        saveState();
        renderPatterns();
      });

      pad.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const st = state.patterns[state.activePattern][state.activeChannel][i];
        if (!st.on) return;
        st.accent = st.accent ? 0 : 1;
        updateSinglePad(i);
        saveState();
        showLcdMessage(`STEP ${i + 1}: ${st.accent ? 'FULL HIT' : 'SOFT GHOST'}`);
      });

      stepGridEl.appendChild(pad);
    }
  }

  function updateSinglePad(i) {
    const pad = stepGridEl.children[i];
    if (!pad) return;
    const chId = state.activeChannel;
    const st = state.patterns[state.activePattern][chId][i];

    pad.className = [
      'step-pad',
      i % 4 === 0 ? 'beat-start' : '',
      st.on ? 'step-on' : '',
      st.on && !st.accent ? 'is-ghost' : '',
      state.currentStep === i ? 'is-playing' : ''
    ].filter(Boolean).join(' ');

    const valEl = pad.querySelector('.step-val');
    valEl.textContent = st.on ? getStepLabel(chId, st.note, state.moodId, state.smplUseCustom) : '';
  }

  function renderGrid() {
    for (let i = 0; i < 16; i++) updateSinglePad(i);
  }

  setPlayheadListener((stepIdx) => {
    const pads = stepGridEl.children;
    for (let i = 0; i < pads.length; i++) {
      pads[i].classList.toggle('is-playing', i === stepIdx);
    }
  });

  // -------------------------------------------------------------------------
  // 5. TRANSPORT, 8 PATTERNS, SONG CHAIN, SAMPLES & EXPORT DRAWER
  // -------------------------------------------------------------------------
  function patternHasSteps(patIdx) {
    const pat = state.patterns[patIdx];
    if (!pat) return false;
    return CHANNELS.some(c => pat[c.id]?.some(s => s.on));
  }

  function renderTransport() {
    btnPlay.classList.toggle('active-orange', state.isPlaying);
    ledPlay.className = state.isPlaying ? 'led on-orange' : 'led';
    txtPlay.textContent = state.isPlaying ? 'STOP' : 'PLAY';

    btnRec.classList.toggle('active-orange', state.isRec);
    ledRec.className = state.isRec ? 'led on-rec' : 'led';
  }

  function renderPatterns() {
    document.querySelectorAll('.pat-btn').forEach(btn => {
      const idx = Number(btn.dataset.pat);
      btn.classList.toggle('active-orange', idx === state.activePattern);
      btn.classList.toggle('queued', idx === state.queuedPattern);
      btn.classList.toggle('has-data', patternHasSteps(idx));
    });
  }

  function renderDrawer() {
    drawerBackdrop.classList.toggle('hidden', !state.drawerOpen);
    guideBackdrop.classList.toggle('hidden', !state.guideOpen);

    // Song Chain UI
    btnChainToggle.textContent = state.chainEnabled ? 'CHAIN: ON' : 'CHAIN: OFF';
    btnChainToggle.classList.toggle('active-orange', state.chainEnabled);
    chainReadoutEl.textContent = state.songChain.length
      ? state.songChain.map(i => PATTERN_LETTERS[i]).join(' → ')
      : 'TAP A–H BELOW TO BUILD SONG';

    chainAddGridEl.innerHTML = '';
    PATTERN_LETTERS.forEach((ltr, idx) => {
      const b = document.createElement('button');
      b.className = 'px-btn chain-add-btn';
      b.textContent = ltr;
      b.title = `Add Pattern ${ltr} to Song Chain`;
      b.addEventListener('click', () => {
        if (state.songChain.length >= 16) {
          showLcdMessage('MAX 16 BARS IN CHAIN');
          return;
        }
        state.songChain.push(idx);
        state.chainEnabled = true;
        saveState();
        renderDrawer();
      });
      chainAddGridEl.appendChild(b);
    });

    // Mood buttons
    moodGridEl.innerHTML = '';
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.className = `px-btn mood-btn ${state.moodId === m.id ? 'active-orange' : ''}`;
      btn.innerHTML = `<span>${m.name}</span><span class="mood-key">${m.keyLabel}</span>`;
      btn.addEventListener('click', () => {
        initAudio();
        state.moodId = m.id;
        saveState();
        showLcdMessage(`MOOD: ${m.name} (${m.keyLabel})`);
        notify('mood');
      });
      moodGridEl.appendChild(btn);
    });

    btnLoadVox.textContent = state.voxMicBuffer ? `VOX: ${state.voxSampleName || 'LOADED'}` : 'LOAD VOX AUDIO';
    btnLoadVox.classList.toggle('active-orange', state.voxUseMic && Boolean(state.voxMicBuffer));

    btnLoadSmpl.textContent = state.smplBuffer ? `SMPL: ${state.smplSampleName || '8 CHOPS'}` : 'LOAD 8-CHOP SMPL';
    btnLoadSmpl.classList.toggle('active-orange', state.smplUseCustom && Boolean(state.smplBuffer));

    btnMicVox.textContent = state.isMicRecording && state.micTargetChannel === 'vx' ? 'REC 1.5S...' : 'MIC → VOX';
    btnMicSmpl.textContent = state.isMicRecording && state.micTargetChannel === 'sm' ? 'REC 2.4S...' : 'MIC → 8 CHOPS';

    btnVinyl.textContent = `VINYL DUST: ${state.vinylOn ? 'ON' : 'OFF'}`;
    btnVinyl.classList.toggle('active-orange', state.vinylOn);

    btnWav.textContent = state.isWavRecording ? 'STOP & SAVE .WAV' : 'REC .WAV';
    btnWav.classList.toggle('active-orange', state.isWavRecording);

    btnCopy.textContent = state.copyMode ? 'CANCEL COPY' : 'COPY PATTERN';
    btnCopy.classList.toggle('active-cream', state.copyMode);
  }

  btnPlay.addEventListener('click', togglePlayback);

  btnRec.addEventListener('click', () => {
    initAudio();
    state.isRec = !state.isRec;
    showLcdMessage(state.isRec ? 'LIVE REC: TAP SOUNDS' : 'REC OFF');
    renderTransport();
  });

  // 8 Pattern Buttons (A-H)
  document.querySelectorAll('.pat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const idx = Number(btn.dataset.pat);

      if (state.copyMode) {
        state.patterns[idx] = JSON.parse(JSON.stringify(state.patterns[state.activePattern]));
        state.copyMode = false;
        saveState();
        showLcdMessage(`COPIED TO PAT ${PATTERN_LETTERS[idx]}`);
        renderPatterns();
        renderDrawer();
        return;
      }

      if (state.isPlaying && idx !== state.activePattern) {
        state.queuedPattern = idx;
        showLcdMessage(`NEXT BAR: ${PATTERN_LETTERS[idx]} ${PATTERN_NAMES[idx]}`);
      } else {
        state.activePattern = idx;
        state.queuedPattern = null;
        showLcdMessage(`PAT ${PATTERN_LETTERS[idx]}: ${PATTERN_NAMES[idx]}`);
        renderGrid();
      }
      renderPatterns();
    });
  });

  // + IDEA Generator & Clear
  btnGen.addEventListener('click', () => {
    initAudio();
    const chId = state.activeChannel;
    state.patterns[state.activePattern][chId] = generateTrackGroove(chId);
    saveState();
    renderGrid();
    renderPatterns();
    const ch = CHANNELS.find(c => c.id === chId);
    showLcdMessage(`NEW ${ch.name} GROOVE!`);
  });

  btnClear.addEventListener('click', () => {
    const ch = CHANNELS.find(c => c.id === state.activeChannel);
    clearActiveChannel();
    renderPatterns();
    showLcdMessage(`CLEARED ${ch.name}`);
  });

  // Song Chain Controls
  btnChainToggle.addEventListener('click', () => {
    state.chainEnabled = !state.chainEnabled;
    if (state.chainEnabled && state.songChain.length === 0) {
      state.songChain = [0, 1];
    }
    saveState();
    showLcdMessage(state.chainEnabled ? 'SONG CHAIN ON' : 'SONG CHAIN OFF');
    renderDrawer();
  });

  btnChainClear.addEventListener('click', () => {
    state.songChain = [];
    state.chainEnabled = false;
    saveState();
    renderDrawer();
  });

  // Drawer & Guide open/close
  btnMenu.addEventListener('click', () => {
    state.drawerOpen = true;
    renderDrawer();
  });
  btnCloseDrawer.addEventListener('click', () => {
    state.drawerOpen = false;
    renderDrawer();
  });
  drawerBackdrop.addEventListener('click', (e) => {
    if (e.target === drawerBackdrop) {
      state.drawerOpen = false;
      renderDrawer();
    }
  });

  btnGuide.addEventListener('click', () => {
    state.guideOpen = true;
    renderDrawer();
  });
  const closeGuide = () => {
    state.guideOpen = false;
    renderDrawer();
  };
  btnCloseGuide.addEventListener('click', closeGuide);
  btnGuideStart.addEventListener('click', closeGuide);
  guideBackdrop.addEventListener('click', (e) => {
    if (e.target === guideBackdrop) closeGuide();
  });

  // Sample Loaders & Mic Samplers
  btnLoadVox.addEventListener('click', () => {
    pendingAudioTarget = 'vx';
    fileAudioInput.value = '';
    fileAudioInput.click();
  });

  btnLoadSmpl.addEventListener('click', () => {
    pendingAudioTarget = 'sm';
    fileAudioInput.value = '';
    fileAudioInput.click();
  });

  fileAudioInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.drawerOpen = false;
    state.activeChannel = pendingAudioTarget;
    renderDrawer();
    await importAudioFile(file, pendingAudioTarget);
    notify('channel');
  });

  btnMicVox.addEventListener('click', () => {
    state.drawerOpen = false;
    state.activeChannel = 'vx';
    renderDrawer();
    notify('channel');
    recordMicSample('vx');
  });

  btnMicSmpl.addEventListener('click', () => {
    state.drawerOpen = false;
    state.activeChannel = 'sm';
    renderDrawer();
    notify('channel');
    recordMicSample('sm');
  });

  // Project .sol16.json & MIDI .mid & WAV
  btnSaveJson.addEventListener('click', () => {
    exportProjectJson();
    state.drawerOpen = false;
    renderDrawer();
  });

  btnLoadJson.addEventListener('click', () => {
    fileProjectInput.value = '';
    fileProjectInput.click();
  });

  fileProjectInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.drawerOpen = false;
    renderDrawer();
    await importProjectJson(file);
  });

  btnExportMidi.addEventListener('click', () => {
    exportMidiFile();
    state.drawerOpen = false;
    renderDrawer();
  });

  btnWav.addEventListener('click', () => {
    state.drawerOpen = false;
    toggleWavRecording();
    renderDrawer();
  });

  btnVinyl.addEventListener('click', () => {
    initAudio();
    state.vinylOn = !state.vinylOn;
    updateVinylAudio();
    saveState();
    showLcdMessage(`VINYL DUST ${state.vinylOn ? 'ON' : 'OFF'}`);
    renderDrawer();
  });

  btnCopy.addEventListener('click', () => {
    state.copyMode = !state.copyMode;
    state.drawerOpen = false;
    showLcdMessage(state.copyMode ? 'TAP A-H TO COPY INTO' : 'COPY CANCELLED', 2500);
    renderDrawer();
  });

  let resetArmedUntil = 0;
  btnReset.addEventListener('click', () => {
    const now = performance.now();
    if (now > resetArmedUntil) {
      resetArmedUntil = now + 2400;
      btnReset.textContent = 'TAP AGAIN TO CONFIRM';
      btnReset.classList.add('active-orange');
      setTimeout(() => {
        if (performance.now() >= resetArmedUntil) {
          btnReset.textContent = 'RESTORE DEMO GROOVES';
          btnReset.classList.remove('active-orange');
        }
      }, 2450);
      return;
    }
    resetArmedUntil = 0;
    btnReset.textContent = 'RESTORE DEMO GROOVES';
    btnReset.classList.remove('active-orange');
    resetAllToDemo();
    updateVinylAudio();
    updateFxAudioParams();
    state.drawerOpen = false;
    showLcdMessage('DEMO GROOVES RESTORED');
    renderDrawer();
  });

  // Drag & Drop Audio Files or .sol16.json directly onto SOL-16!
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlayEl.classList.remove('hidden');
  });
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  window.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) dropOverlayEl.classList.add('hidden');
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlayEl.classList.add('hidden');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.json')) {
      await importProjectJson(file);
    } else {
      const target = state.activeChannel === 'vx' ? 'vx' : 'sm';
      state.activeChannel = target;
      await importAudioFile(file, target);
      notify('channel');
    }
  });

  // Punch-In FX
  function setFxState(fxName, isActive) {
    if (state.fx[fxName] === isActive) return;
    initAudio();
    state.fx[fxName] = isActive;
    if (fxName === 'RPT' && isActive) {
      state.rptAnchorStep = Math.max(0, state.currentStep);
    }
    updateFxAudioParams();

    const btn = document.querySelector(`.fx-btn[data-fx="${fxName}"]`);
    if (btn) {
      btn.classList.toggle('active-orange', isActive);
      btn.classList.toggle('pressed', isActive);
    }

    const activeList = Object.keys(state.fx).filter(k => state.fx[k]);
    fxStatusEl.textContent = activeList.length ? activeList.join(' + ') : 'READY';
    if (isActive) showLcdMessage(`FX: ${fxName}`, 800);
  }

  document.querySelectorAll('.fx-btn').forEach(btn => {
    const fxName = btn.dataset.fx;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      setFxState(fxName, true);
    });
    const release = (e) => {
      if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
      setFxState(fxName, false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  });

  // Reactive Subscriptions
  subscribe((reason) => {
    if (reason === 'transport') renderTransport();
    else if (reason === 'pattern') {
      renderPatterns();
      renderGrid();
    } else if (reason === 'channel' || reason === 'mood' || reason === 'reset') {
      renderTrackBar();
      renderBrushStrip();
      renderGrid();
      syncKnobsUI();
      renderPatterns();
      renderDrawer();
    } else if (reason === 'grid') {
      renderGrid();
    } else if (reason === 'sample' || reason === 'wav') {
      renderBrushStrip();
      renderGrid();
      renderDrawer();
    }
  });

  // Initial Build
  buildGridDOM();
  renderTrackBar();
  renderBrushStrip();
  renderGrid();
  renderPatterns();
  renderTransport();
  syncKnobsUI();
  renderDrawer();

  return {
    triggerBrushByIndex(idx) {
      const pads = brushStripEl.querySelectorAll('.brush-pad[data-note]');
      if (pads[idx]) {
        const note = Number(pads[idx].dataset.note);
        triggerBrushPad(note, pads[idx]);
      }
    },
    setFxState,
    generateCurrentTrack() {
      btnGen.click();
    }
  };
}
