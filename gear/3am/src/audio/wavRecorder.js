// Live stereo WAV master recorder for 3AM.

import { state, showStatus, notify } from '../state/store.js';
import { initAudio, getAudioNodes } from './engine.js';

let recorderNode = null;
let muteTap = null;
let workletLoadedCtx = null;
let leftChunks = [];
let rightChunks = [];
let totalSamples = 0;

const WORKLET_CODE = `
class StereoWavCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufSize = 2048;
    this.bufL = new Float32Array(this.bufSize);
    this.bufR = new Float32Array(this.bufSize);
    this.offset = 0;
    this.active = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') {
        if (this.offset > 0) {
          const l = this.bufL.slice(0, this.offset);
          const r = this.bufR.slice(0, this.offset);
          this.port.postMessage({ l, r }, [l.buffer, r.buffer]);
          this.offset = 0;
        }
        this.active = false;
      }
    };
  }
  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0];
    if (!input || !input.length) return true;
    const chL = input[0];
    const chR = input[1] || chL;
    if (!chL) return true;
    let i = 0;
    while (i < chL.length) {
      const copy = Math.min(this.bufSize - this.offset, chL.length - i);
      this.bufL.set(chL.subarray(i, i + copy), this.offset);
      this.bufR.set(chR.subarray(i, i + copy), this.offset);
      this.offset += copy;
      i += copy;
      if (this.offset >= this.bufSize) {
        const l = this.bufL;
        const r = this.bufR;
        this.port.postMessage({ l, r }, [l.buffer, r.buffer]);
        this.bufL = new Float32Array(this.bufSize);
        this.bufR = new Float32Array(this.bufSize);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('stereo-wav-capture', StereoWavCaptureProcessor);
`;

async function ensureWorkletLoaded(audioCtx) {
  if (!audioCtx.audioWorklet) return false;
  if (workletLoadedCtx === audioCtx) return true;
  try {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await audioCtx.audioWorklet.addModule(url);
      workletLoadedCtx = audioCtx;
      return true;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return false;
  }
}

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

let isStarting = false;

export async function toggleWavRecording() {
  initAudio();
  const { audioCtx, masterGain } = getAudioNodes();

  if (!state.isWavRecording) {
    if (isStarting) return;
    isStarting = true;
    leftChunks = [];
    rightChunks = [];
    totalSamples = 0;

    try {
      const useWorklet = await ensureWorkletLoaded(audioCtx);
      muteTap = audioCtx.createGain();
      muteTap.gain.value = 0;

      if (useWorklet) {
        const workletNode = new AudioWorkletNode(audioCtx, 'stereo-wav-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 2,
          channelCountMode: 'explicit'
        });
        workletNode.port.onmessage = (e) => {
          const { l, r } = e.data || {};
          if (!l || !r) return;
          leftChunks.push(l);
          rightChunks.push(r);
          totalSamples += l.length;
        };
        recorderNode = workletNode;
      } else {
        const scriptNode = audioCtx.createScriptProcessor(4096, 2, 2);
        scriptNode.onaudioprocess = (e) => {
          if (!state.isWavRecording) return;
          leftChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          rightChunks.push(new Float32Array(e.inputBuffer.getChannelData(1)));
          totalSamples += e.inputBuffer.length;
        };
        recorderNode = scriptNode;
      }

      masterGain.connect(recorderNode);
      recorderNode.connect(muteTap);
      muteTap.connect(audioCtx.destination);

      state.isWavRecording = true;
      showStatus('REC .WAV LIVE...', 4000);
      notify('wav');
    } finally {
      isStarting = false;
    }
  } else {
    state.isWavRecording = false;
    if (recorderNode) {
      if (recorderNode.port) {
        recorderNode.port.postMessage('stop');
      }
      try { masterGain.disconnect(recorderNode); } catch {}
      try { recorderNode.disconnect(); } catch {}
      if (recorderNode.onaudioprocess) recorderNode.onaudioprocess = null;
      recorderNode = null;
    }
    if (muteTap) {
      try { muteTap.disconnect(); } catch {}
      muteTap = null;
    }
    notify('wav');

    if (totalSamples > 0) {
      const blob = encodeStereoWav(leftChunks, rightChunks, totalSamples, audioCtx.sampleRate);
      leftChunks = [];
      rightChunks = [];
      totalSamples = 0;

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
