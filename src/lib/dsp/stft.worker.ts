/// <reference lib="webworker" />

import FFT from 'fft.js';
import { getWindow, type WindowType } from './window';

export interface StftWorkerRequest {
  pcm: Float32Array;
  fftSize: number;
  hopSize: number;
  windowType: WindowType;
  dbFloor: number;
  dbCeiling: number;
}

export type StftWorkerMessage =
  | {
      type: 'chunk';
      frameStart: number;
      frameEnd: number;
      data: Float32Array;
    }
  | { type: 'l0'; data: Uint8Array }
  | { type: 'done' }
  | { type: 'error'; message: string };

const CHUNK_MS = 80;

self.onmessage = (event: MessageEvent<StftWorkerRequest>) => {
  try {
    const { pcm, fftSize, hopSize, windowType, dbFloor, dbCeiling } = event.data;

    if ((fftSize & (fftSize - 1)) !== 0) {
      throw new Error('fftSize must be a power of 2');
    }

    const window = getWindow(windowType, fftSize);
    const freqBins = fftSize / 2 + 1;
    const timeFrames = Math.max(0, Math.floor((pcm.length - fftSize) / hopSize) + 1);

    const magnitudes = new Float32Array(freqBins * timeFrames);
    const fft = new FFT(fftSize);
    const frame = new Float32Array(fftSize);
    const spectrum = fft.createComplexArray() as number[];

    // Coherent gain compensation: a windowed full-scale sinusoid would
    // otherwise read sum(window)/N times the unwindowed level. Dividing
    // by the window mean cancels that bias so dBFS readings stay close
    // to the actual peak amplitude regardless of window choice.
    let windowSum = 0;
    for (let i = 0; i < fftSize; i++) windowSum += window[i];
    const coherentGain = windowSum / fftSize;
    const normalize = 2 / (fftSize * coherentGain);
    const epsilon = 1e-12;

    let lastPost = performance.now();
    let chunkStart = 0;

    const flushChunk = (end: number) => {
      if (end <= chunkStart) return;
      const data = magnitudes.slice(chunkStart * freqBins, end * freqBins);
      const msg: StftWorkerMessage = {
        type: 'chunk',
        frameStart: chunkStart,
        frameEnd: end,
        data,
      };
      (self as unknown as Worker).postMessage(msg, [data.buffer]);
      chunkStart = end;
    };

    for (let f = 0; f < timeFrames; f++) {
      const start = f * hopSize;
      for (let i = 0; i < fftSize; i++) {
        frame[i] = pcm[start + i] * window[i];
      }
      fft.realTransform(spectrum, frame);

      const colOffset = f * freqBins;
      for (let k = 0; k < freqBins; k++) {
        const re = spectrum[2 * k];
        const im = spectrum[2 * k + 1];
        const mag = Math.sqrt(re * re + im * im) * normalize;
        const db = 20 * Math.log10(mag + epsilon);
        magnitudes[colOffset + k] = Math.max(dbFloor, Math.min(dbCeiling, db));
      }

      const now = performance.now();
      if (now - lastPost > CHUNK_MS) {
        flushChunk(f + 1);
        lastPost = now;
      }
    }

    flushChunk(timeFrames);

    const dbRange = (dbCeiling - dbFloor) || 1;
    const l0 = new Uint8Array(freqBins * timeFrames);
    for (let i = 0; i < l0.length; i++) {
      const norm = (magnitudes[i] - dbFloor) / dbRange;
      l0[i] = Math.max(0, Math.min(255, Math.round(norm * 255)));
    }
    (self as unknown as Worker).postMessage(
      { type: 'l0', data: l0 } satisfies StftWorkerMessage,
      [l0.buffer]
    );

    (self as unknown as Worker).postMessage({ type: 'done' } satisfies StftWorkerMessage);
  } catch (err) {
    const msg: StftWorkerMessage = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(msg);
  }
};
