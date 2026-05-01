import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Spectral entropy (in bits) per STFT frame. Measures how spread the
 * energy distribution is across bins:
 *   - low entropy → tonal signal (single sinusoid, sustained note)
 *   - high entropy → noisy / broadband signal (cymbal, distortion)
 *
 * Formula: H = -Σ p_i · log₂(p_i)  with p_i = power_i / Σ power
 * Power is taken in linear amplitude squared (10^(dB/20))² so we
 * weigh peaks the way the ear perceives them.
 *
 * The same per-frame relative threshold as the centroid (max - 60 dB)
 * is applied: bins clamped at the dbFloor would otherwise inflate the
 * entropy on quiet frames toward log₂(freqBins). DC bin excluded.
 */
const REL_THRESHOLD_DB = 60;
const LN2 = Math.LN2;

export interface SpectralEntropyResult {
  /** Entropy per STFT frame, in bits. Length = timeFrames. */
  entropy: Float32Array;
  /** Maximum theoretical entropy log₂(N) where N is the active bin count. */
  maxEntropy: number;
  frames: number;
}

export function computeSpectralEntropy(
  stft: StftResult
): SpectralEntropyResult {
  const { magnitudes, freqBins, timeFrames, dbFloor } = stft;
  const entropy = new Float32Array(timeFrames);
  // Maximum possible value: log₂(freqBins - 1) since DC is excluded.
  // Actual max depends on how many bins survive the threshold per
  // frame, but this gives a stable normalisation reference.
  const maxEntropy = Math.log2(freqBins - 1);

  for (let t = 0; t < timeFrames; t++) {
    const offset = t * freqBins;

    let maxDb = -Infinity;
    for (let b = 1; b < freqBins; b++) {
      const v = magnitudes[offset + b];
      if (v > maxDb) maxDb = v;
    }
    if (maxDb <= dbFloor + 1) {
      entropy[t] = 0;
      continue;
    }

    const threshold = maxDb - REL_THRESHOLD_DB;
    let totalPower = 0;
    // First pass: sum of power over the active bins.
    for (let b = 1; b < freqBins; b++) {
      const db = magnitudes[offset + b];
      if (db < threshold) continue;
      const amp = dbToAmp(db);
      totalPower += amp * amp;
    }
    if (totalPower <= 0) {
      entropy[t] = 0;
      continue;
    }
    // Second pass: -Σ p log p (in nats, then convert to bits).
    let h = 0;
    for (let b = 1; b < freqBins; b++) {
      const db = magnitudes[offset + b];
      if (db < threshold) continue;
      const amp = dbToAmp(db);
      const p = (amp * amp) / totalPower;
      if (p > 0) h -= p * Math.log(p);
    }
    entropy[t] = h / LN2;
  }

  return { entropy, maxEntropy, frames: timeFrames };
}
