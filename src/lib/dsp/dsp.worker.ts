/// <reference lib="webworker" />

import { computeRmsCrest, type RmsOptions } from './rms';
import { computeAverageSpectrum } from './avg-spectrum';
import { computeOnsets, type OnsetOptions } from './onsets';
import { computeCentroidPerFrame } from './spectral-centroid';
import { computeSpectralEntropy } from './spectral-entropy';
import { computeBark } from './bark';
import { computeChromagram } from './chromagram';
import {
  computeSelfSimilarity,
  computeNovelty,
  type SelfSimilarityOptions,
  type NoveltyOptions,
  type SelfSimilarityResult
} from './self-similarity';
import { computeTempogram, type TempogramOptions } from './tempogram';
import type { OnsetData } from './onsets';
import { computeHpss, type HpssOptions } from './hpss';
import { computeLoudness, type LoudnessOptions } from './loudness';
import { computeVectorscope, type VectorscopeOptions } from './vectorscope';
import { computeGoniometer, type GoniometerOptions } from './goniometer';
import { computeStereoWidth } from './stereo-width';
import { computeSoundfield, type SoundfieldOptions } from './soundfield';
import {
  buildPyramidFromL0,
  buildPyramidFromMagnitudes
} from './pyramid';
import { buildWaveformPyramid } from './waveform-pyramid';
import type { StftResult } from './stft';

/**
 * Generic DSP worker. Handles four job types so far:
 *
 *  - rms          → RMS + crest factor sliding curve from raw PCM
 *  - avg-spectrum → long-term average spectrum from STFT magnitudes
 *  - onsets       → spectral flux + peak picking from STFT magnitudes
 *  - loudness     → ITU-R BS.1770 Momentary/Short-term/Integrated + TP
 *
 * All jobs are message-based with a jobId so the main thread can
 * reconcile responses, even if multiple jobs are in flight.
 *
 * Transferable ArrayBuffers are used everywhere we can to avoid
 * structured cloning of multi-MB Float32Arrays:
 *  - inbound payloads transfer their PCM / magnitudes from the main
 *    thread (the main thread keeps a copy when needed).
 *  - outbound results transfer Float32Arrays back to the main thread.
 */

export type DspRmsRequest = {
  type: 'rms';
  pcm: Float32Array;
  sampleRate: number;
  options: RmsOptions;
};

export type DspAvgSpectrumRequest = {
  type: 'avg-spectrum';
  stft: StftResult;
  timeStart: number;
  timeEnd: number;
};

export type DspOnsetsRequest = {
  type: 'onsets';
  stft: StftResult;
  options: OnsetOptions;
};

export type DspLoudnessRequest = {
  type: 'loudness';
  pcmLeft: Float32Array;
  pcmRight: Float32Array | null;
  sampleRate: number;
  options: LoudnessOptions;
};

export type DspVectorscopeRequest = {
  type: 'vectorscope';
  pcmLeft: Float32Array;
  pcmRight: Float32Array;
  stftLeft: StftResult;
  stftRight: StftResult;
  options: VectorscopeOptions;
};

export type DspGoniometerRequest = {
  type: 'goniometer';
  pcmLeft: Float32Array;
  pcmRight: Float32Array;
  options: GoniometerOptions;
};

export type DspStereoWidthRequest = {
  type: 'stereo-width';
  stftLeft: StftResult;
  stftRight: StftResult;
};

export type DspSoundfieldRequest = {
  type: 'soundfield';
  stftLeft: StftResult;
  stftRight: StftResult;
  options: SoundfieldOptions;
};

export type DspSpecPyramidL0Request = {
  type: 'spec-pyramid-l0';
  l0: Uint8Array;
  freqBins: number;
  timeFrames: number;
};

export type DspSpecPyramidMagRequest = {
  type: 'spec-pyramid-mag';
  magnitudes: Float32Array;
  freqBins: number;
  timeFrames: number;
  dbFloor: number;
  dbCeiling: number;
};

export type DspWavePyramidRequest = {
  type: 'wave-pyramid';
  pcm: Float32Array;
};

export type DspCentroidRequest = {
  type: 'centroid';
  stft: StftResult;
};

export type DspEntropyRequest = {
  type: 'entropy';
  stft: StftResult;
};

export type DspBarkRequest = {
  type: 'bark';
  stft: StftResult;
};

export type DspChromagramRequest = {
  type: 'chromagram';
  stft: StftResult;
};

export type DspSelfSimilarityRequest = {
  type: 'self-similarity';
  stft: StftResult;
  options: SelfSimilarityOptions;
};

export type DspNoveltyRequest = {
  type: 'novelty';
  similarity: SelfSimilarityResult;
  options: NoveltyOptions;
};

export type DspTempogramRequest = {
  type: 'tempogram';
  onsets: OnsetData;
  options: TempogramOptions;
};

export type DspHpssRequest = {
  type: 'hpss';
  stft: StftResult;
  options: HpssOptions;
};

export type DspRequest =
  | DspRmsRequest
  | DspAvgSpectrumRequest
  | DspOnsetsRequest
  | DspLoudnessRequest
  | DspVectorscopeRequest
  | DspGoniometerRequest
  | DspStereoWidthRequest
  | DspSoundfieldRequest
  | DspSpecPyramidL0Request
  | DspSpecPyramidMagRequest
  | DspWavePyramidRequest
  | DspCentroidRequest
  | DspEntropyRequest
  | DspBarkRequest
  | DspChromagramRequest
  | DspSelfSimilarityRequest
  | DspNoveltyRequest
  | DspTempogramRequest
  | DspHpssRequest;

interface JobMessage {
  jobId: number;
  request: DspRequest;
}

interface JobSuccess {
  jobId: number;
  ok: true;
  result: unknown;
}

interface JobFailure {
  jobId: number;
  ok: false;
  message: string;
}

export type JobResponse = JobSuccess | JobFailure;

function collectTransfers(value: unknown): Transferable[] {
  const transfers: Transferable[] = [];
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      if (
        v instanceof Float32Array ||
        v instanceof Uint8Array ||
        v instanceof Uint16Array ||
        v instanceof Int32Array
      ) {
        transfers.push(v.buffer);
      } else if (Array.isArray(v)) {
        // Pyramid levels arrive as arrays of typed arrays. Each
        // backing buffer is a separate transfer entry.
        for (const inner of v) {
          if (
            inner instanceof Uint8Array ||
            inner instanceof Float32Array ||
            inner instanceof Uint16Array ||
            inner instanceof Int32Array
          ) {
            transfers.push(inner.buffer);
          }
        }
      }
    }
  }
  return transfers;
}

self.onmessage = (event: MessageEvent<JobMessage>) => {
  const { jobId, request } = event.data;
  try {
    let result: unknown;
    if (request.type === 'rms') {
      result = computeRmsCrest(
        request.pcm,
        request.sampleRate,
        request.options
      );
    } else if (request.type === 'avg-spectrum') {
      result = computeAverageSpectrum(
        request.stft,
        request.timeStart,
        request.timeEnd
      );
    } else if (request.type === 'onsets') {
      result = computeOnsets(request.stft, request.options);
    } else if (request.type === 'loudness') {
      result = computeLoudness(
        request.pcmLeft,
        request.pcmRight,
        request.sampleRate,
        request.options
      );
    } else if (request.type === 'vectorscope') {
      result = computeVectorscope(
        request.pcmLeft,
        request.pcmRight,
        request.stftLeft,
        request.stftRight,
        request.options
      );
    } else if (request.type === 'goniometer') {
      result = computeGoniometer(
        request.pcmLeft,
        request.pcmRight,
        request.options
      );
    } else if (request.type === 'stereo-width') {
      result = computeStereoWidth(request.stftLeft, request.stftRight);
    } else if (request.type === 'soundfield') {
      result = computeSoundfield(
        request.stftLeft,
        request.stftRight,
        request.options
      );
    } else if (request.type === 'spec-pyramid-l0') {
      result = buildPyramidFromL0(
        request.l0,
        request.freqBins,
        request.timeFrames
      );
    } else if (request.type === 'spec-pyramid-mag') {
      result = buildPyramidFromMagnitudes(
        request.magnitudes,
        request.freqBins,
        request.timeFrames,
        request.dbFloor,
        request.dbCeiling
      );
    } else if (request.type === 'wave-pyramid') {
      result = buildWaveformPyramid(request.pcm);
    } else if (request.type === 'centroid') {
      result = { centroid: computeCentroidPerFrame(request.stft) };
    } else if (request.type === 'entropy') {
      result = computeSpectralEntropy(request.stft);
    } else if (request.type === 'bark') {
      result = computeBark(request.stft);
    } else if (request.type === 'chromagram') {
      result = computeChromagram(request.stft);
    } else if (request.type === 'self-similarity') {
      result = computeSelfSimilarity(request.stft, request.options);
    } else if (request.type === 'novelty') {
      result = { novelty: computeNovelty(request.similarity, request.options) };
    } else if (request.type === 'tempogram') {
      result = computeTempogram(request.onsets, request.options);
    } else if (request.type === 'hpss') {
      result = computeHpss(request.stft, request.options);
    } else {
      throw new Error(`unknown DSP job type`);
    }
    const transfers = collectTransfers(result);
    const response: JobSuccess = { jobId, ok: true, result };
    (self as unknown as Worker).postMessage(response, transfers);
  } catch (err) {
    const response: JobFailure = {
      jobId,
      ok: false,
      message: err instanceof Error ? err.message : String(err)
    };
    (self as unknown as Worker).postMessage(response);
  }
};
