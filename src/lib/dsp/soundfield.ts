import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Soundfield: stereo energy distributed by direction × frequency.
 *
 *   - For each STFT cell (frame, bin > 0), pan = (R - L) / (R + L + EPS)
 *     in [-1, +1], with full-right = -1 and full-left = +1.
 *   - Each cell contributes (ampL + ampR)^2 to the bucket
 *     [bin][angleIdx], with angle 0 = full right, angleBins-1 = full
 *     left. The mid-bin corresponds to a centred source.
 *   - Final values are converted to dB and capped at -60 dB below max.
 *
 * The panel renders the half-disc by mapping each pixel back to
 * (freqIdx, angleIdx) — radial axis log frequency, polar axis the
 * direction.
 */

export interface SoundfieldResult {
  energy: Float32Array;
  freqBins: number;
  angleBins: number;
  sampleRate: number;
  fftSize: number;
  maxDb: number;
  minDb: number;
}

export interface SoundfieldOptions {
  angleBins?: number;
  rangeDb?: number;
}

const DEFAULT_ANGLE_BINS = 36;
const DEFAULT_RANGE_DB = 60;
const EPS = 1e-12;

export function computeSoundfield(
  stftLeft: StftResult,
  stftRight: StftResult,
  options: SoundfieldOptions = {}
): SoundfieldResult {
  const angleBins = options.angleBins ?? DEFAULT_ANGLE_BINS;
  const rangeDb = options.rangeDb ?? DEFAULT_RANGE_DB;
  const { freqBins, timeFrames, sampleRate, fftSize } = stftLeft;

  const energyLin = new Float32Array(freqBins * angleBins);

  for (let f = 0; f < timeFrames; f++) {
    const offset = f * freqBins;
    for (let k = 1; k < freqBins; k++) {
      const ampL = dbToAmp(stftLeft.magnitudes[offset + k]);
      const ampR = dbToAmp(stftRight.magnitudes[offset + k]);
      const sum = ampL + ampR;
      if (sum < EPS) continue;
      const pan = (ampR - ampL) / (sum + EPS);
      // pan = -1 → full right, +1 → full left.
      const angleIdx = Math.max(
        0,
        Math.min(
          angleBins - 1,
          Math.round(((1 - pan) * 0.5) * (angleBins - 1))
        )
      );
      const power = sum * sum;
      energyLin[k * angleBins + angleIdx] += power;
    }
  }

  // Convert to dB and find the max for normalisation. Cells that never
  // received energy stay at the minimum.
  const energy = new Float32Array(freqBins * angleBins);
  let maxDb = -Infinity;
  for (let i = 0; i < energy.length; i++) {
    const lin = energyLin[i];
    if (lin <= EPS) {
      energy[i] = -Infinity;
      continue;
    }
    const db = 10 * Math.log10(lin);
    energy[i] = db;
    if (db > maxDb) maxDb = db;
  }
  const minDb = isFinite(maxDb) ? maxDb - rangeDb : -rangeDb;

  // Floor everything below minDb so the panel can normalise without
  // dealing with -Infinity.
  for (let i = 0; i < energy.length; i++) {
    if (!isFinite(energy[i]) || energy[i] < minDb) energy[i] = minDb;
  }

  return {
    energy,
    freqBins,
    angleBins,
    sampleRate,
    fftSize,
    maxDb: isFinite(maxDb) ? maxDb : 0,
    minDb
  };
}
