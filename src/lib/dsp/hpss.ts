import type { StftResult } from './stft';

/**
 * Harmonic / Percussive Source Separation (Fitzgerald 2010, simplified).
 *
 * The STFT magnitudes are filtered with two median filters:
 *   - Horizontal median (over time): captures sustained, slowly-varying
 *     content → harmonic component.
 *   - Vertical median (over frequency): captures broadband transients
 *     localised in time → percussive component.
 *
 * The two outputs are combined with a soft Wiener-like mask. The
 * caller receives both magnitudes (in dB, same layout as the input
 * STFT) so a panel can blend them, show one alone, or render the
 * harmonic + percussive in two stacked rows.
 *
 * Median windows are kept small (11 horizontal × 7 vertical by
 * default) for speed; the qualitative split is preserved with no
 * meaningful loss of separation.
 */

export interface HpssOptions {
  /** Horizontal (time) median window size, odd. Default 11. */
  hWindow?: number;
  /** Vertical (frequency) median window size, odd. Default 7. */
  vWindow?: number;
  /** Mask power (Wiener-like exponent). Default 2 (energy ratio). */
  power?: number;
}

export interface HpssResult {
  /** Harmonic magnitudes in dB, layout [timeFrames × freqBins]. */
  harmonic: Float32Array;
  /** Percussive magnitudes in dB, same layout. */
  percussive: Float32Array;
  freqBins: number;
  timeFrames: number;
  dbFloor: number;
}

const DEFAULT_H_WINDOW = 11;
const DEFAULT_V_WINDOW = 7;
const DEFAULT_POWER = 2;
const EPS = 1e-12;

// Quick-select for partial sort, used to find the median in a small
// window without a full Array.sort (which would dominate the cost).
function median(buf: Float32Array, len: number): number {
  // Bubble-style insertion sort: optimal for the small windows we
  // use (≤ 11 entries) and avoids allocations.
  for (let i = 1; i < len; i++) {
    const x = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > x) {
      buf[j + 1] = buf[j];
      j--;
    }
    buf[j + 1] = x;
  }
  return buf[len >> 1];
}

export function computeHpss(
  stft: StftResult,
  options: HpssOptions = {}
): HpssResult {
  const { magnitudes, freqBins, timeFrames, dbFloor } = stft;
  const hWindow = (options.hWindow ?? DEFAULT_H_WINDOW) | 0;
  const vWindow = (options.vWindow ?? DEFAULT_V_WINDOW) | 0;
  const power = options.power ?? DEFAULT_POWER;
  const hHalf = hWindow >> 1;
  const vHalf = vWindow >> 1;

  // Convert dB → linear amplitude up front so we can do all the
  // medians + masking in one space, then reconvert at the end.
  const amp = new Float32Array(timeFrames * freqBins);
  // We don't import dbToAmp here: the conversion is run once over the
  // whole grid and locality dominates. Math.pow(10, db/20) inlined.
  for (let i = 0; i < amp.length; i++) {
    amp[i] = Math.pow(10, magnitudes[i] / 20);
  }

  // Horizontal median: per (k, f), median over t in [f-hHalf, f+hHalf].
  const harm = new Float32Array(timeFrames * freqBins);
  const hBuf = new Float32Array(hWindow);
  for (let k = 1; k < freqBins; k++) {
    for (let f = 0; f < timeFrames; f++) {
      const lo = Math.max(0, f - hHalf);
      const hi = Math.min(timeFrames - 1, f + hHalf);
      let n = 0;
      for (let i = lo; i <= hi; i++) hBuf[n++] = amp[i * freqBins + k];
      harm[f * freqBins + k] = median(hBuf, n);
    }
  }

  // Vertical median: per (f, k), median over k' in [k-vHalf, k+vHalf].
  const perc = new Float32Array(timeFrames * freqBins);
  const vBuf = new Float32Array(vWindow);
  for (let f = 0; f < timeFrames; f++) {
    const off = f * freqBins;
    for (let k = 1; k < freqBins; k++) {
      const lo = Math.max(1, k - vHalf);
      const hi = Math.min(freqBins - 1, k + vHalf);
      let n = 0;
      for (let i = lo; i <= hi; i++) vBuf[n++] = amp[off + i];
      perc[off + k] = median(vBuf, n);
    }
  }

  // Wiener-like soft mask + reconvert to dB.
  const harmonicDb = new Float32Array(timeFrames * freqBins);
  const percussiveDb = new Float32Array(timeFrames * freqBins);
  for (let i = 0; i < amp.length; i++) {
    const h = Math.pow(harm[i], power);
    const p = Math.pow(perc[i], power);
    const denom = h + p + EPS;
    const a = amp[i];
    const ah = a * (h / denom);
    const ap = a * (p / denom);
    harmonicDb[i] = ah > 0 ? Math.max(dbFloor, 20 * Math.log10(ah)) : dbFloor;
    percussiveDb[i] = ap > 0 ? Math.max(dbFloor, 20 * Math.log10(ap)) : dbFloor;
  }

  return {
    harmonic: harmonicDb,
    percussive: percussiveDb,
    freqBins,
    timeFrames,
    dbFloor
  };
}
