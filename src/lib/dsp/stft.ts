import type { WindowType } from './window';
import type { StftWorkerRequest, StftWorkerMessage } from './stft.worker';

export interface StftResult {
  magnitudes: Float32Array;
  freqBins: number;
  timeFrames: number;
  fftSize: number;
  hopSize: number;
  sampleRate: number;
  dbFloor: number;
  dbCeiling: number;
  windowType: WindowType;
  l0?: Uint8Array;
}

export interface StftOptions {
  fftSize?: number;
  hopSize?: number;
  dbFloor?: number;
  dbCeiling?: number;
  windowType?: WindowType;
}

export function startStreamingStft(
  pcm: Float32Array,
  sampleRate: number,
  options: StftOptions = {},
  onProgress?: (completed: number, total: number) => void
): { result: StftResult; done: Promise<void>; cancel: () => void } {
  const fftSize = options.fftSize ?? 2048;
  const hopSize = options.hopSize ?? 512;
  const dbFloor = options.dbFloor ?? -140;
  const dbCeiling = options.dbCeiling ?? 0;
  const windowType = options.windowType ?? 'hann';

  if ((fftSize & (fftSize - 1)) !== 0) {
    throw new Error('fftSize must be a power of 2');
  }

  const freqBins = fftSize / 2 + 1;
  const timeFrames = Math.max(0, Math.floor((pcm.length - fftSize) / hopSize) + 1);

  const magnitudes = new Float32Array(freqBins * timeFrames);
  magnitudes.fill(dbFloor);

  const result: StftResult = {
    magnitudes,
    freqBins,
    timeFrames,
    fftSize,
    hopSize,
    sampleRate,
    dbFloor,
    dbCeiling,
    windowType
  };

  let worker: Worker | null = null;
  let cancelled = false;
  // Captured so cancel() can reject `done` instead of leaving it
  // pending forever, which would orphan any awaiter (and any task
  // tracking the streaming).
  let rejectDone: ((err: Error) => void) | null = null;

  const done = new Promise<void>((resolve, reject) => {
    rejectDone = reject;
    if (timeFrames === 0) {
      resolve();
      return;
    }

    worker = new Worker(new URL('./stft.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event: MessageEvent<StftWorkerMessage>) => {
      if (cancelled) return;
      const msg = event.data;
      if (msg.type === 'chunk') {
        magnitudes.set(msg.data, msg.frameStart * freqBins);
        onProgress?.(msg.frameEnd, timeFrames);
      } else if (msg.type === 'l0') {
        result.l0 = msg.data;
      } else if (msg.type === 'done') {
        worker?.terminate();
        worker = null;
        onProgress?.(timeFrames, timeFrames);
        rejectDone = null;
        resolve();
      } else {
        worker?.terminate();
        worker = null;
        rejectDone = null;
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (event) => {
      if (cancelled) return;
      worker?.terminate();
      worker = null;
      rejectDone = null;
      reject(new Error(event.message || 'Worker error'));
    };

    const pcmCopy = pcm.slice();
    const request: StftWorkerRequest = {
      pcm: pcmCopy,
      fftSize,
      hopSize,
      windowType,
      dbFloor,
      dbCeiling
    };
    worker.postMessage(request, [pcmCopy.buffer]);
  });

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    worker?.terminate();
    worker = null;
    if (rejectDone) {
      const reject = rejectDone;
      rejectDone = null;
      reject(new Error('cancelled'));
    }
  }

  return { result, done, cancel };
}

export function downsampleTime(
  stft: StftResult,
  targetColumns: number,
  frameRange?: { start: number; end: number },
  out?: Uint8Array,
  maxSamplesPerBucket?: number
): { data: Uint8Array; width: number; height: number; level: number } {
  const { magnitudes, freqBins, timeFrames, dbFloor, dbCeiling } = stft;
  const rangeStart = Math.max(0, frameRange?.start ?? 0);
  const rangeEnd = Math.min(timeFrames, frameRange?.end ?? timeFrames);
  const visibleFrames = Math.max(1, rangeEnd - rangeStart);
  const width = Math.min(targetColumns, visibleFrames);
  const dbRange = dbCeiling - dbFloor;
  const needed = width * freqBins;
  const data = out && out.length >= needed ? out : new Uint8Array(needed);

  const bucketSize = visibleFrames / width;

  for (let x = 0; x < width; x++) {
    const start = rangeStart + Math.floor(x * bucketSize);
    const end =
      Math.min(rangeEnd, rangeStart + Math.floor((x + 1) * bucketSize)) ||
      start + 1;
    const bucket = end - start;
    const stride =
      maxSamplesPerBucket && bucket > maxSamplesPerBucket
        ? Math.max(1, Math.floor(bucket / maxSamplesPerBucket))
        : 1;
    for (let k = 0; k < freqBins; k++) {
      let maxDb = -Infinity;
      for (let f = start; f < end; f += stride) {
        const v = magnitudes[f * freqBins + k];
        if (v > maxDb) maxDb = v;
      }
      const norm = (maxDb - dbFloor) / dbRange;
      data[k * width + x] = Math.max(0, Math.min(255, Math.round(norm * 255)));
    }
  }

  return { data, width, height: freqBins, level: -1 };
}

export function secondsToFrame(stft: StftResult, t: number): number {
  return Math.round((t * stft.sampleRate - stft.fftSize / 2) / stft.hopSize);
}

export function frameToSeconds(stft: StftResult, frame: number): number {
  return (frame * stft.hopSize + stft.fftSize / 2) / stft.sampleRate;
}
