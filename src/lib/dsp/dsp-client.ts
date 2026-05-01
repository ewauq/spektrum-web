import type { RmsCrestSeries, RmsOptions } from './rms';
import type { AverageSpectrum } from './avg-spectrum';
import type { OnsetData, OnsetOptions } from './onsets';
import type { LoudnessSeries, LoudnessOptions } from './loudness';
import type { VectorscopeResult, VectorscopeOptions } from './vectorscope';
import type { GoniometerResult, GoniometerOptions } from './goniometer';
import type { StereoWidthResult } from './stereo-width';
import type { SoundfieldResult, SoundfieldOptions } from './soundfield';
import type { SpectralEntropyResult } from './spectral-entropy';
import type { BarkResult } from './bark';
import type { ChromagramResult } from './chromagram';
import type {
  SelfSimilarityResult,
  SelfSimilarityOptions,
  NoveltyOptions
} from './self-similarity';
import type { TempogramResult, TempogramOptions } from './tempogram';
import type { HpssResult, HpssOptions } from './hpss';
import type { Pyramid } from './pyramid';
import type { WaveformPyramid } from './waveform-pyramid';
import type { StftResult } from './stft';
import type { DspRequest, JobResponse } from './dsp.worker';

let worker: Worker | null = null;
let nextJobId = 0;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
  }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./dsp.worker.ts', import.meta.url), {
    type: 'module'
  });
  worker.onmessage = (event: MessageEvent<JobResponse>) => {
    const { jobId } = event.data;
    const entry = pending.get(jobId);
    if (!entry) return;
    pending.delete(jobId);
    if (event.data.ok) {
      entry.resolve(event.data.result);
    } else {
      entry.reject(new Error(event.data.message));
    }
  };
  worker.onerror = (event) => {
    // Worker-level fatal error: reject all pending jobs and recreate
    // on demand on the next call.
    const err = new Error(event.message || 'DSP worker error');
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/**
 * Send a job to the DSP worker. The list of `transfers` should include
 * any Float32Array.buffer that the caller is OK losing access to.
 */
function dispatch<T>(
  request: DspRequest,
  transfers: Transferable[]
): Promise<T> {
  const w = ensureWorker();
  const jobId = nextJobId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(jobId, {
      resolve: resolve as (value: unknown) => void,
      reject
    });
    w.postMessage({ jobId, request }, transfers);
  });
}

/**
 * Run RMS+crest on a copy of the PCM. The caller's PCM stays usable —
 * we slice() before transferring so the main thread keeps the original.
 */
export function runRms(
  pcm: Float32Array,
  sampleRate: number,
  options: RmsOptions
): Promise<RmsCrestSeries> {
  const pcmCopy = pcm.slice();
  return dispatch<RmsCrestSeries>(
    { type: 'rms', pcm: pcmCopy, sampleRate, options },
    [pcmCopy.buffer]
  );
}

/**
 * Average spectrum on a copy of the STFT magnitudes. Same contract.
 */
export function runAvgSpectrum(
  stft: StftResult,
  timeStart: number,
  timeEnd: number
): Promise<AverageSpectrum> {
  const stftCopy = cloneStft(stft);
  return dispatch<AverageSpectrum>(
    { type: 'avg-spectrum', stft: stftCopy, timeStart, timeEnd },
    [stftCopy.magnitudes.buffer]
  );
}

export function runOnsets(
  stft: StftResult,
  options: OnsetOptions = {}
): Promise<OnsetData> {
  const stftCopy = cloneStft(stft);
  return dispatch<OnsetData>(
    { type: 'onsets', stft: stftCopy, options },
    [stftCopy.magnitudes.buffer]
  );
}

export function runCentroid(stft: StftResult): Promise<Float32Array> {
  const stftCopy = cloneStft(stft);
  return dispatch<{ centroid: Float32Array }>(
    { type: 'centroid', stft: stftCopy },
    [stftCopy.magnitudes.buffer]
  ).then((r) => r.centroid);
}

export function runSpectralEntropy(
  stft: StftResult
): Promise<SpectralEntropyResult> {
  const stftCopy = cloneStft(stft);
  return dispatch<SpectralEntropyResult>(
    { type: 'entropy', stft: stftCopy },
    [stftCopy.magnitudes.buffer]
  );
}

export function runBark(stft: StftResult): Promise<BarkResult> {
  const stftCopy = cloneStft(stft);
  return dispatch<BarkResult>(
    { type: 'bark', stft: stftCopy },
    [stftCopy.magnitudes.buffer]
  );
}

export function runChromagram(stft: StftResult): Promise<ChromagramResult> {
  const stftCopy = cloneStft(stft);
  return dispatch<ChromagramResult>(
    { type: 'chromagram', stft: stftCopy },
    [stftCopy.magnitudes.buffer]
  );
}

export function runSelfSimilarity(
  stft: StftResult,
  options: SelfSimilarityOptions = {}
): Promise<SelfSimilarityResult> {
  const stftCopy = cloneStft(stft);
  return dispatch<SelfSimilarityResult>(
    { type: 'self-similarity', stft: stftCopy, options },
    [stftCopy.magnitudes.buffer]
  );
}

export function runNovelty(
  similarity: SelfSimilarityResult,
  options: NoveltyOptions = {}
): Promise<Float32Array> {
  // The similarity matrix is large (N²) — copy + transfer.
  const matrixCopy = similarity.matrix.slice();
  const payload: SelfSimilarityResult = {
    matrix: matrixCopy,
    size: similarity.size,
    hopSeconds: similarity.hopSeconds,
    durationSeconds: similarity.durationSeconds
  };
  return dispatch<{ novelty: Float32Array }>(
    { type: 'novelty', similarity: payload, options },
    [matrixCopy.buffer]
  ).then((r) => r.novelty);
}

export function runTempogram(
  onsets: OnsetData,
  options: TempogramOptions = {}
): Promise<TempogramResult> {
  // Onset envelope + times are large but cheap to slice.
  const envCopy = onsets.envelope.slice();
  const timesCopy = onsets.times.slice();
  const onsetsCopy = onsets.onsets.slice();
  const payload: OnsetData = {
    envelope: envCopy,
    times: timesCopy,
    onsets: onsetsCopy,
    hopSeconds: onsets.hopSeconds
  };
  return dispatch<TempogramResult>(
    { type: 'tempogram', onsets: payload, options },
    [envCopy.buffer, timesCopy.buffer, onsetsCopy.buffer]
  );
}

export function runHpss(
  stft: StftResult,
  options: HpssOptions = {}
): Promise<HpssResult> {
  const stftCopy = cloneStft(stft);
  return dispatch<HpssResult>(
    { type: 'hpss', stft: stftCopy, options },
    [stftCopy.magnitudes.buffer]
  );
}

/**
 * Run vectorscope density accumulation on copies of the per-channel PCM
 * and per-channel STFT magnitudes. Caller's buffers stay usable.
 */
export function runVectorscope(
  pcmLeft: Float32Array,
  pcmRight: Float32Array,
  stftLeft: StftResult,
  stftRight: StftResult,
  options: VectorscopeOptions = {}
): Promise<VectorscopeResult> {
  const leftCopy = pcmLeft.slice();
  const rightCopy = pcmRight.slice();
  const stftLeftCopy = cloneStft(stftLeft);
  const stftRightCopy = cloneStft(stftRight);
  return dispatch<VectorscopeResult>(
    {
      type: 'vectorscope',
      pcmLeft: leftCopy,
      pcmRight: rightCopy,
      stftLeft: stftLeftCopy,
      stftRight: stftRightCopy,
      options
    },
    [
      leftCopy.buffer,
      rightCopy.buffer,
      stftLeftCopy.magnitudes.buffer,
      stftRightCopy.magnitudes.buffer
    ]
  );
}

/**
 * Run per-frequency stereo width on copies of the per-channel STFT
 * magnitudes. Caller's buffers stay usable.
 */
export function runStereoWidth(
  stftLeft: StftResult,
  stftRight: StftResult
): Promise<StereoWidthResult> {
  const stftLeftCopy = cloneStft(stftLeft);
  const stftRightCopy = cloneStft(stftRight);
  return dispatch<StereoWidthResult>(
    {
      type: 'stereo-width',
      stftLeft: stftLeftCopy,
      stftRight: stftRightCopy
    },
    [stftLeftCopy.magnitudes.buffer, stftRightCopy.magnitudes.buffer]
  );
}

/**
 * Run soundfield directional accumulation on copies of the per-channel
 * STFT magnitudes.
 */
export function runSoundfield(
  stftLeft: StftResult,
  stftRight: StftResult,
  options: SoundfieldOptions = {}
): Promise<SoundfieldResult> {
  const stftLeftCopy = cloneStft(stftLeft);
  const stftRightCopy = cloneStft(stftRight);
  return dispatch<SoundfieldResult>(
    {
      type: 'soundfield',
      stftLeft: stftLeftCopy,
      stftRight: stftRightCopy,
      options
    },
    [stftLeftCopy.magnitudes.buffer, stftRightCopy.magnitudes.buffer]
  );
}

/**
 * Run goniometer (Mid/Side) density accumulation on copies of the
 * per-channel PCM. Caller's buffers stay usable.
 */
export function runGoniometer(
  pcmLeft: Float32Array,
  pcmRight: Float32Array,
  options: GoniometerOptions = {}
): Promise<GoniometerResult> {
  const leftCopy = pcmLeft.slice();
  const rightCopy = pcmRight.slice();
  return dispatch<GoniometerResult>(
    {
      type: 'goniometer',
      pcmLeft: leftCopy,
      pcmRight: rightCopy,
      options
    },
    [leftCopy.buffer, rightCopy.buffer]
  );
}

/**
 * Run ITU-R BS.1770 loudness on copies of the per-channel PCM. Mono
 * inputs pass `pcmRight = null`. Caller's PCM buffers stay usable.
 */
export function runLoudness(
  pcmLeft: Float32Array,
  pcmRight: Float32Array | null,
  sampleRate: number,
  options: LoudnessOptions = {}
): Promise<LoudnessSeries> {
  const leftCopy = pcmLeft.slice();
  const rightCopy = pcmRight ? pcmRight.slice() : null;
  const transfers: Transferable[] = [leftCopy.buffer];
  if (rightCopy) transfers.push(rightCopy.buffer);
  return dispatch<LoudnessSeries>(
    {
      type: 'loudness',
      pcmLeft: leftCopy,
      pcmRight: rightCopy,
      sampleRate,
      options
    },
    transfers
  );
}

/**
 * Build a minimal StftResult clone whose `magnitudes` is a new
 * Float32Array (transferable to the worker without losing the main
 * copy). Other fields are scalars / strings.
 */
function cloneStft(stft: StftResult): StftResult {
  return {
    magnitudes: stft.magnitudes.slice(),
    freqBins: stft.freqBins,
    timeFrames: stft.timeFrames,
    fftSize: stft.fftSize,
    hopSize: stft.hopSize,
    sampleRate: stft.sampleRate,
    dbFloor: stft.dbFloor,
    dbCeiling: stft.dbCeiling,
    windowType: stft.windowType,
    l0: stft.l0
  };
}

/**
 * Build the spectrogram zoom pyramid from a pre-quantised L0 buffer.
 * Transfers the L0 directly: caller must not read it after the call.
 * The result's `levels[0]` is the same data, ready to use.
 */
export function runSpecPyramidFromL0(
  l0: Uint8Array,
  freqBins: number,
  timeFrames: number
): Promise<Pyramid> {
  const l0Copy = l0.slice();
  return dispatch<Pyramid>(
    {
      type: 'spec-pyramid-l0',
      l0: l0Copy,
      freqBins,
      timeFrames
    },
    [l0Copy.buffer]
  );
}

/**
 * Build the spectrogram zoom pyramid from raw STFT magnitudes (dB).
 * Slices the magnitudes so the main thread keeps its copy.
 */
export function runSpecPyramidFromMagnitudes(
  magnitudes: Float32Array,
  freqBins: number,
  timeFrames: number,
  dbFloor: number,
  dbCeiling: number
): Promise<Pyramid> {
  const magCopy = magnitudes.slice();
  return dispatch<Pyramid>(
    {
      type: 'spec-pyramid-mag',
      magnitudes: magCopy,
      freqBins,
      timeFrames,
      dbFloor,
      dbCeiling
    },
    [magCopy.buffer]
  );
}

/**
 * Build the waveform min/max pyramid from raw PCM. Slices the PCM
 * so the main thread keeps its copy.
 */
export function runWavePyramid(pcm: Float32Array): Promise<WaveformPyramid> {
  const pcmCopy = pcm.slice();
  return dispatch<WaveformPyramid>(
    {
      type: 'wave-pyramid',
      pcm: pcmCopy
    },
    [pcmCopy.buffer]
  );
}

export function disposeDspWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const entry of pending.values()) {
    entry.reject(new Error('DSP worker disposed'));
  }
  pending.clear();
}
