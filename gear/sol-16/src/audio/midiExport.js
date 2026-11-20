// Standard MIDI File (.mid, Format 1) Exporter for DAWs (Ableton, Logic, FL Studio, GarageBand)
// Exports either the active pattern or the full Song Chain with multi-track house grooves!

import { state, showLcdMessage } from '../state/store.js';
import { getMood } from '../state/scales.js';
import { PATTERN_LETTERS } from '../state/presets.js';

const TPQ = 480; // Ticks per quarter note (16th step = 120 ticks)
const STEP_TICKS = TPQ / 4;

// General MIDI Drum notes for Perc track (HAT, OPEN, SHAK, CLAP, RIM, CONG)
const PERC_GM_MIDI = [42, 46, 70, 39, 37, 63];

function writeVarLen(value) {
  let buffer = value & 0x7f;
  const out = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return out;
}

function encodeStringBytes(str) {
  return Array.from(str).map(c => c.charCodeAt(0) & 0x7f);
}

function buildTrackChunk(events) {
  // Sort by tick, NoteOff before NoteOn at identical ticks
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const bytes = [];
  let prevTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - prevTick);
    prevTick = ev.tick;
    bytes.push(...writeVarLen(delta), ...ev.data);
  }
  // End of Track meta-event
  bytes.push(0x00, 0xff, 0x2f, 0x00);

  const len = bytes.length;
  return [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...bytes
  ];
}

function addTrackName(events, name) {
  const nameBytes = encodeStringBytes(name);
  events.push({ tick: 0, order: 0, data: [0xff, 0x03, nameBytes.length, ...nameBytes] });
}

function addNote(events, channel, note, velocity, startTick, durTicks) {
  const n = Math.max(0, Math.min(127, Math.round(note)));
  const v = Math.max(1, Math.min(127, Math.round(velocity)));
  events.push({ tick: startTick, order: 2, data: [0x90 | channel, n, v] });
  events.push({ tick: startTick + durTicks, order: 1, data: [0x80 | channel, n, 0] });
}

export function exportMidiFile() {
  const mood = getMood(state.moodId);
  const patOrder = state.chainEnabled && state.songChain.length > 0
    ? state.songChain
    : [state.activePattern];

  const tracks = [];

  // Track 0: Tempo & Time Signature
  const tempoEvents = [];
  addTrackName(tempoEvents, 'SOL-16 Tempo');
  const usPerQuarter = Math.round(60000000 / state.bpm);
  tempoEvents.push({
    tick: 0,
    order: 0,
    data: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff]
  });
  tempoEvents.push({ tick: 0, order: 0, data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] });
  tracks.push(buildTrackChunk(tempoEvents));

  // Helper for subtle swing tick offset on odd 16th steps
  const swingTicks = Math.round((state.swing / 100) * (STEP_TICKS * 0.45));
  const stepTickAt = (barIdx, stepIdx) =>
    barIdx * 16 * STEP_TICKS + stepIdx * STEP_TICKS + (stepIdx % 2 === 1 ? swingTicks : 0);

  const trackConfigs = [
    { id: 'bd', name: 'SOL16 Kick',  midiCh: 9 },
    { id: 'pr', name: 'SOL16 Perc',  midiCh: 9 },
    { id: 'bs', name: 'SOL16 Bass',  midiCh: 0 },
    { id: 'ch', name: 'SOL16 Chord', midiCh: 1 },
    { id: 'vx', name: 'SOL16 Vox',   midiCh: 2 },
    { id: 'sm', name: 'SOL16 Smpl',  midiCh: 3 }
  ];

  trackConfigs.forEach(tc => {
    const events = [];
    addTrackName(events, tc.name);

    patOrder.forEach((patIdx, barIdx) => {
      const steps = state.patterns[patIdx]?.[tc.id] || [];
      steps.forEach((st, sIdx) => {
        if (!st || !st.on) return;
        const start = stepTickAt(barIdx, sIdx);
        const vel = st.accent ? 106 : 64;

        if (tc.id === 'bd') {
          addNote(events, tc.midiCh, typeof st.midi === 'number' ? st.midi : 36, vel, start, STEP_TICKS - 10);
        } else if (tc.id === 'pr') {
          addNote(events, tc.midiCh, PERC_GM_MIDI[st.note % PERC_GM_MIDI.length], vel, start, STEP_TICKS - 10);
        } else if (tc.id === 'bs') {
          const midi = typeof st.midi === 'number' ? st.midi : mood.bassMidi[st.note % mood.bassMidi.length];
          addNote(events, tc.midiCh, midi, vel, start, Math.round(STEP_TICKS * 1.4));
        } else if (tc.id === 'ch') {
          const notes = Array.isArray(st.notes) && st.notes.length > 0
            ? st.notes
            : (typeof st.midi === 'number' ? [st.midi] : mood.chords[st.note % mood.chords.length].notes);
          notes.forEach(n => addNote(events, tc.midiCh, n, vel, start, STEP_TICKS * 2));
        } else if (tc.id === 'vx') {
          const midi = typeof st.midi === 'number' ? st.midi : mood.voxMidi[st.note % mood.voxMidi.length];
          addNote(events, tc.midiCh, midi, vel, start, Math.round(STEP_TICKS * 1.5));
        } else {
          const midi = typeof st.midi === 'number' ? st.midi : 48 + (st.note % 8);
          addNote(events, tc.midiCh, midi, vel, start, STEP_TICKS);
        }
      });
    });

    tracks.push(buildTrackChunk(events));
  });

  const numTracks = tracks.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // header length
    0x00, 0x01,             // format 1 (multi-track)
    (numTracks >> 8) & 0xff, numTracks & 0xff,
    (TPQ >> 8) & 0xff, TPQ & 0xff
  ];

  const allBytes = new Uint8Array([...header, ...tracks.flat()]);
  const blob = new Blob([allBytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const tag = state.chainEnabled ? 'CHAIN' : `PAT_${PATTERN_LETTERS[state.activePattern]}`;
  a.download = `SOL16_${tag}_${state.bpm}bpm.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  showLcdMessage('SAVED .MID FILE!');
}
