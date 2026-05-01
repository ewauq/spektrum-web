import { type StftResult } from './stft';

/**
 * Onset detection envelope and peak picking on top of an existing STFT.
 *
 * The pipeline follows librosa.onset.onset_strength + onset.onset_detect:
 *
 *   1. Spectral flux: positive half of the per-bin difference of
 *      magnitudes summed across the spectrum. Captures any energy that
 *      *increased* between two frames, which is the signature of an
 *      attack.
 *   2. Light moving average for smoothing.
 *   3. Peak picking with adaptive threshold (local mean) and a minimum
 *      separation between peaks to avoid double-onsets on long sustains.
 *
 * The same envelope is reused later for the tempogram (autocorrelation
 * over windows) and the novelty curve (checkerboard convolution on the
 * self-similarity matrix derived from it).
 */
export interface OnsetData {
  /** Onset envelope normalized to [0, 1]. Length = stft.timeFrames. */
  envelope: Float32Array;
  /** Time of each envelope frame center, in seconds. Length = stft.timeFrames. */
  times: Float32Array;
  /** Detected onset timestamps, in seconds. */
  onsets: Float32Array;
  /** Hop length in seconds (envelope sample period). */
  hopSeconds: number;
}

export interface OnsetOptions {
  /** Smoothing window length in frames (Hann). Default 3. */
  smoothingFrames?: number;
  /** Minimum separation between detected onsets, in seconds. Default 0.05. */
  minDistanceSeconds?: number;
  /** Detection threshold relative to local median. Default 2.5. */
  thresholdRel?: number;
  /** Local baseline window in frames. Default 30. */
  baselineWindowFrames?: number;
  /** Absolute floor on the normalized envelope. Default 0.10. */
  floorAbs?: number;
  /** Pre/post-max neighbourhood: peak must dominate ±N frames. Default 3. */
  peakNeighborhoodFrames?: number;
  /**
   * Optional [fLowHz, fHighHz] band to restrict the spectral flux to.
   * Bins outside the band are skipped, so transients dominated by other
   * frequencies (snares, hi-hats) do not register as detections. The DC
   * bin is always skipped regardless of band.
   */
  band?: [number, number];
}

const DB_TO_AMP_HALF = Math.LN10 / 20;

export function computeOnsets(
  stft: StftResult,
  options: OnsetOptions = {}
): OnsetData {
  const {
    smoothingFrames = 3,
    minDistanceSeconds = 0.05,
    thresholdRel = 2.5,
    baselineWindowFrames = 30,
    floorAbs = 0.10,
    peakNeighborhoodFrames = 3,
    band
  } = options;

  const { magnitudes, freqBins, timeFrames, sampleRate, fftSize, hopSize } =
    stft;

  const hopSeconds = hopSize / sampleRate;

  // Resolve the band to a [kLow, kHigh] bin range. k=0 is always
  // skipped because the DC bin is not informative for onset detection.
  const nyq = sampleRate / 2;
  const kLow = band
    ? Math.max(1, Math.round((band[0] / nyq) * (freqBins - 1)))
    : 1;
  const kHigh = band
    ? Math.min(freqBins - 1, Math.round((band[1] / nyq) * (freqBins - 1)))
    : freqBins - 1;

  if (timeFrames < 2) {
    return {
      envelope: new Float32Array(0),
      times: new Float32Array(0),
      onsets: new Float32Array(0),
      hopSeconds
    };
  }

  // Step 1 — Spectral flux. Magnitudes are stored as 20·log10(|X|), so
  // we convert each bin back to linear amplitude before subtracting:
  // working in dB would over-emphasize quiet bins. When a band is set,
  // the loop runs only over [kLow, kHigh] so flux outside the band
  // does not contaminate the envelope.
  const flux = new Float32Array(timeFrames);
  // First frame has no predecessor: leave at 0.
  // prev/cur are allocated to freqBins for index alignment with the
  // magnitudes buffer, but only [kLow, kHigh] is ever read or written.
  // Bins outside the band stay at 0 and never participate in the flux.
  let prev = new Float32Array(freqBins);
  let cur = new Float32Array(freqBins);
  for (let k = kLow; k <= kHigh; k++) {
    prev[k] = Math.exp(magnitudes[k] * DB_TO_AMP_HALF);
  }
  for (let f = 1; f < timeFrames; f++) {
    const offset = f * freqBins;
    let sum = 0;
    for (let k = kLow; k <= kHigh; k++) {
      const a = Math.exp(magnitudes[offset + k] * DB_TO_AMP_HALF);
      cur[k] = a;
      const diff = a - prev[k];
      if (diff > 0) sum += diff;
    }
    flux[f] = sum;
    const swap = prev;
    prev = cur;
    cur = swap;
  }

  // Step 2 — Hann-weighted smoothing to suppress noise without dulling
  // sharp transients too much.
  const smoothed = new Float32Array(timeFrames);
  const w = Math.max(1, smoothingFrames | 0);
  if (w === 1) {
    smoothed.set(flux);
  } else {
    const kernel = new Float32Array(w);
    let kSum = 0;
    for (let i = 0; i < w; i++) {
      kernel[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, w - 1));
      kSum += kernel[i];
    }
    for (let i = 0; i < w; i++) kernel[i] /= kSum;
    const half = w >> 1;
    for (let f = 0; f < timeFrames; f++) {
      let s = 0;
      for (let i = 0; i < w; i++) {
        const idx = f + i - half;
        if (idx >= 0 && idx < timeFrames) s += flux[idx] * kernel[i];
      }
      smoothed[f] = s;
    }
  }

  // Normalize to [0, 1] for stable peak-picking thresholds across files.
  let maxVal = 0;
  for (let f = 0; f < timeFrames; f++) {
    if (smoothed[f] > maxVal) maxVal = smoothed[f];
  }
  const envelope = new Float32Array(timeFrames);
  if (maxVal > 0) {
    for (let f = 0; f < timeFrames; f++) envelope[f] = smoothed[f] / maxVal;
  }

  // Step 3 — Peak picking with adaptive threshold. Baseline is a
  // sliding *median*, not a mean: on sustained material (sludge,
  // post-rock, drones) the mean gets dragged up by the sustain itself
  // and a 2× threshold then sits above the real attacks. The median is
  // insensitive to spikes — it tracks the steady level and lets actual
  // attacks tower over it.
  const onsetIndices: number[] = [];
  const minDist = Math.max(1, Math.round(minDistanceSeconds / hopSeconds));
  const baselineW = Math.max(1, baselineWindowFrames | 0);
  const baselineHalf = baselineW >> 1;
  const nbh = Math.max(1, peakNeighborhoodFrames | 0);
  // Scratch buffer reused for each frame's median sort.
  const sortScratch = new Float32Array(baselineW);
  let lastPeak = -minDist;

  for (let f = 0; f < timeFrames; f++) {
    const start = Math.max(0, f - baselineHalf);
    const end = Math.min(timeFrames, f + baselineHalf + 1);
    const wlen = end - start;
    for (let i = 0; i < wlen; i++) sortScratch[i] = envelope[start + i];
    const view = sortScratch.subarray(0, wlen);
    view.sort();
    const localMedian = view[wlen >> 1];
    const threshold = Math.max(floorAbs, thresholdRel * localMedian);

    if (envelope[f] < threshold) continue;
    // Pre/post-max: peak must strictly dominate ±nbh frames. A single
    // frame check (f-1 vs f+1) lets micro-fluctuations leak through.
    let isPeak = true;
    for (let i = -nbh; i <= nbh; i++) {
      if (i === 0) continue;
      const j = f + i;
      if (j < 0 || j >= timeFrames) continue;
      if (envelope[f] <= envelope[j]) {
        isPeak = false;
        break;
      }
    }
    if (!isPeak) continue;

    if (f - lastPeak < minDist) {
      // Closer to previous peak: keep the stronger one.
      if (
        onsetIndices.length > 0 &&
        envelope[f] > envelope[onsetIndices[onsetIndices.length - 1]]
      ) {
        onsetIndices[onsetIndices.length - 1] = f;
        lastPeak = f;
      }
      continue;
    }
    onsetIndices.push(f);
    lastPeak = f;
  }

  // Time axis: same convention as secondsToFrame elsewhere in the
  // project (frame center = (f * hop + fftSize/2) / sr).
  const times = new Float32Array(timeFrames);
  for (let f = 0; f < timeFrames; f++) {
    times[f] = (f * hopSize + fftSize / 2) / sampleRate;
  }

  const onsets = new Float32Array(onsetIndices.length);
  for (let i = 0; i < onsetIndices.length; i++) {
    onsets[i] = times[onsetIndices[i]];
  }

  return {
    envelope,
    times,
    onsets,
    hopSeconds
  };
}
