import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Vectorscope (L vs R Lissajous) accumulator with per-band coloring.
 *
 * The signal is sub-sampled to a manageable point count (~50 k by
 * default) and binned into a (gridSize × gridSize) density buffer.
 * Three buffers are kept in parallel — low / mid / high — keyed by the
 * dominant frequency band of the STFT frame containing each PCM
 * sample. The panel later blends the three buffers into RGB so the
 * user can read at a glance which part of the spectrum sits centred or
 * spreads wide.
 *
 * Pearson correlation is computed on the full (non-subsampled) PCM so
 * the displayed `r` is exact, not an approximation of the rendered
 * point cloud.
 */

export const VECTORSCOPE_BAND_LOW_HZ = 250;
export const VECTORSCOPE_BAND_HIGH_HZ = 2500;

export interface VectorscopeResult {
  densityLow: Uint16Array;
  densityMid: Uint16Array;
  densityHigh: Uint16Array;
  gridSize: number;
  maxCount: number;
  correlation: number;
  sampleCount: number;
}

export interface VectorscopeOptions {
  targetPoints?: number;
  gridSize?: number;
}

const DEFAULT_TARGET_POINTS = 50_000;
const DEFAULT_GRID_SIZE = 256;
const EPS = 1e-12;

function computeDominantBand(
  stftLeft: StftResult,
  stftRight: StftResult
): Uint8Array {
  // Sum power per band per frame, return the index of the dominant
  // band for each frame: 0 = low, 1 = mid, 2 = high.
  const { freqBins, timeFrames, sampleRate, fftSize } = stftLeft;
  const out = new Uint8Array(timeFrames);
  const binHz = sampleRate / fftSize;
  const lowEndBin = Math.max(1, Math.floor(VECTORSCOPE_BAND_LOW_HZ / binHz));
  const midEndBin = Math.max(
    lowEndBin + 1,
    Math.floor(VECTORSCOPE_BAND_HIGH_HZ / binHz)
  );

  for (let f = 0; f < timeFrames; f++) {
    const offset = f * freqBins;
    let low = 0;
    let mid = 0;
    let high = 0;
    // Bin 0 (DC) excluded.
    for (let k = 1; k < freqBins; k++) {
      const dbL = stftLeft.magnitudes[offset + k];
      const dbR = stftRight.magnitudes[offset + k];
      const ampL = dbToAmp(dbL);
      const ampR = dbToAmp(dbR);
      const power = ampL * ampL + ampR * ampR;
      if (k < lowEndBin) low += power;
      else if (k < midEndBin) mid += power;
      else high += power;
    }
    if (low >= mid && low >= high) out[f] = 0;
    else if (mid >= high) out[f] = 1;
    else out[f] = 2;
  }
  return out;
}

export function computeVectorscope(
  pcmLeft: Float32Array,
  pcmRight: Float32Array,
  stftLeft: StftResult,
  stftRight: StftResult,
  options: VectorscopeOptions = {}
): VectorscopeResult {
  const target = options.targetPoints ?? DEFAULT_TARGET_POINTS;
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const len = Math.min(pcmLeft.length, pcmRight.length);
  const stride = Math.max(1, Math.floor(len / target));

  const densityLow = new Uint16Array(gridSize * gridSize);
  const densityMid = new Uint16Array(gridSize * gridSize);
  const densityHigh = new Uint16Array(gridSize * gridSize);

  const dominantBand = computeDominantBand(stftLeft, stftRight);
  const hopSize = stftLeft.hopSize;

  let maxCount = 0;
  let sampleCount = 0;

  for (let i = 0; i < len; i += stride) {
    const l = pcmLeft[i];
    const r = pcmRight[i];

    // Map (-1, +1) to grid index, clamped.
    const gx = Math.max(
      0,
      Math.min(gridSize - 1, Math.round((l + 1) * 0.5 * (gridSize - 1)))
    );
    const gy = Math.max(
      0,
      Math.min(gridSize - 1, Math.round((r + 1) * 0.5 * (gridSize - 1)))
    );
    const cell = gy * gridSize + gx;

    const frameIdx = Math.min(
      dominantBand.length - 1,
      Math.floor(i / hopSize)
    );
    const band = dominantBand[frameIdx] ?? 1;
    let v: number;
    if (band === 0) v = ++densityLow[cell];
    else if (band === 1) v = ++densityMid[cell];
    else v = ++densityHigh[cell];
    if (v > maxCount) maxCount = v;
    sampleCount++;
  }

  // Pearson correlation on the full PCM (unbiased by sub-sampling).
  let sumL = 0;
  let sumR = 0;
  for (let i = 0; i < len; i++) {
    sumL += pcmLeft[i];
    sumR += pcmRight[i];
  }
  const meanL = sumL / Math.max(1, len);
  const meanR = sumR / Math.max(1, len);
  let cov = 0;
  let varL = 0;
  let varR = 0;
  for (let i = 0; i < len; i++) {
    const dl = pcmLeft[i] - meanL;
    const dr = pcmRight[i] - meanR;
    cov += dl * dr;
    varL += dl * dl;
    varR += dr * dr;
  }
  const denom = Math.sqrt(varL * varR) + EPS;
  const correlation = denom > EPS ? cov / denom : 0;

  return {
    densityLow,
    densityMid,
    densityHigh,
    gridSize,
    maxCount,
    correlation,
    sampleCount
  };
}
