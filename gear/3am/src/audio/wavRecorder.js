// Live stereo WAV master recorder for 3AM.

import { state, showStatus, notify } from '../state/store.js';
import { initAudio, getAudioNodes } from './engine.js';

let wavProcessor = null;
let leftChunks = [];
let rightChunks = [];
let totalSamples = 0;

function encodeStereoWav(lChunks, rChunks, totalLen, sampleRate) {
  const buffer = new ArrayBuffer(44 + totalLen * 4);
  const view = new DataView(buffer);

  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalLen * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, totalLen * 4, true);

  let offset = 44;
  for (let c = 0; c < lChunks.length; c++) {
    const lArr = lChunks[c];
    const rArr = rChunks[c];
    for (let i = 0; i < lArr.length; i++) {
      const l = Math.max(-1, Math.min(1, lArr[i]));
      const r = Math.max(-1, Math.min(1, rArr[i]));
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function toggleWavRecording() {
  initAudio();
  const { audioCtx, masterGain } = getAudioNodes();

  if (!state.isWavRecording) {
    leftChunks = [];
    rightChunks = [];
    totalSamples = 0;

    wavProcessor = audioCtx.createScriptProcessor(4096, 2, 2);
    wavProcessor.onaudioprocess = (e) => {
      if (!state.isWavRecording) return;
      leftChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      rightChunks.push(new Float32Array(e.inputBuffer.getChannelData(1)));
      totalSamples += e.inputBuffer.length;
    };

    const muteTap = audioCtx.createGain();
    muteTap.gain.value = 0;
    masterGain.connect(wavProcessor);
    wavProcessor.connect(muteTap);
    muteTap.connect(audioCtx.destination);
    wavProcessor._muteTap = muteTap;

    state.isWavRecording = true;
    showStatus('REC .WAV LIVE...', 4000);
    notify('wav');
  } else {
    state.isWavRecording = false;
    if (wavProcessor) {
      masterGain.disconnect(wavProcessor);
      wavProcessor.disconnect();
      if (wavProcessor._muteTap) wavProcessor._muteTap.disconnect();
      wavProcessor = null;
    }
    notify('wav');

    if (totalSamples > 0) {
      const blob = encodeStereoWav(leftChunks, rightChunks, totalSamples, audioCtx.sampleRate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `3AM_${state.reelName.toLowerCase()}_${state.bpm}bpm.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showStatus('EXPORTED .WAV');
    }
  }
}
