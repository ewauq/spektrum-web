import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Per-frequency stereo width derived from the L/R STFT pair.
 *
 *   - For each bin k > 0 (DC excluded), Pearson correlation between
 *     the linear amplitudes of L and R across the frames of the
 *     programme.
 *   - width = clamp(1 - corr, 0, 2)
 *     · width = 0  → bin perfectly mono (L == R)
 *     · width = 1  → bin uncorrelated
 *     · width = 2  → bin in anti-phase (L = -R)
 *
 * The energy-weighted average width is returned alongside the curve so
 * the panel can show a single headline number.
 */

export interface StereoWidthResult {
  frequencies: Float32Array;
  width: Float32Array;
  correlation: Float32Array;
  freqBins: number;
  frames: number;
  weightedAvg: number;
}

const EPS = 1e-12;

export function computeStereoWidth(
  stftLeft: StftResult,
  stftRight: StftResult
): StereoWidthResult {
  const { freqBins, timeFrames, sampleRate, fftSize } = stftLeft;
  const frequencies = new Float32Array(freqBins);
  const width = new Float32Array(freqBins);
  const correlation = new Float32Array(freqBins);
  const binHz = sampleRate / fftSize;

  for (let k = 0; k < freqBins; k++) frequencies[k] = k * binHz;

  let totalEnergy = 0;
  let weightedWidth = 0;

  // Reusable per-bin amplitude scratch buffers. The naive
  // implementation called Math.pow twice per cell (once for means,
  // once for covariance) — on a 5 min file that's ≈ 4 × T × F ≈ 100 M
  // pow calls. We compute amps once per bin into these buffers and
  // read them back for the second pass.
  const ampsL = new Float32Array(timeFrames);
  const ampsR = new Float32Array(timeFrames);

  // Bin 0 is DC: skip the correlation but keep the array entry so the
  // index aligns with `frequencies[k]` for the panel.
  for (let k = 1; k < freqBins; k++) {
    let sumL = 0;
    let sumR = 0;
    let energy = 0;
    // Decode amps once and accumulate means + energy in the same pass.
    for (let f = 0; f < timeFrames; f++) {
      const ampL = dbToAmp(stftLeft.magnitudes[f * freqBins + k]);
      const ampR = dbToAmp(stftRight.magnitudes[f * freqBins + k]);
      ampsL[f] = ampL;
      ampsR[f] = ampR;
      sumL += ampL;
      sumR += ampR;
      energy += ampL * ampL + ampR * ampR;
    }
    if (timeFrames === 0 || energy < EPS) {
      width[k] = 0;
      correlation[k] = 1;
      continue;
    }
    const meanL = sumL / timeFrames;
    const meanR = sumR / timeFrames;
    let cov = 0;
    let varL = 0;
    let varR = 0;
    // Second pass reads the cached amps — no more Math.pow.
    for (let f = 0; f < timeFrames; f++) {
      const dl = ampsL[f] - meanL;
      const dr = ampsR[f] - meanR;
      cov += dl * dr;
      varL += dl * dl;
      varR += dr * dr;
    }
    const denom = Math.sqrt(varL * varR) + EPS;
    const corr = denom > EPS ? cov / denom : 1;
    correlation[k] = corr;
    const w = Math.max(0, Math.min(2, 1 - corr));
    width[k] = w;

    weightedWidth += w * energy;
    totalEnergy += energy;
  }

  const weightedAvg = totalEnergy > EPS ? weightedWidth / totalEnergy : 0;

  return {
    frequencies,
    width,
    correlation,
    freqBins,
    frames: timeFrames,
    weightedAvg
  };
}
