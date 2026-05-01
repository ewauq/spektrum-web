import type { StftResult } from './stft';

/**
 * Per-frame threshold below the local max (in dB). Bins under this
 * threshold are excluded from the weighted sum. Without it, frames
 * dominated by clamped-to-dbFloor bins would drift the centroid to
 * the middle of the spectrum.
 */
const REL_THRESHOLD_DB = 60;

/**
 * Spectral centroid (Hz) per STFT frame. Magnitudes are stored as
 * 20·log10(|X|) (amplitude dB), so converting back to linear amplitude
 * is 10^(dB/20). Power weighting then squares that value. DC bin
 * excluded; frames below the floor return 0.
 */
export function computeCentroidPerFrame(stft: StftResult): Float32Array {
  const { magnitudes, freqBins, timeFrames, sampleRate, fftSize, dbFloor } =
    stft;
  const centroid = new Float32Array(timeFrames);

  // Bin index → frequency Hz factor: freq = bin * binHz. Inlined in the
  // weighted sum below, no array allocation needed.
  const binHz = sampleRate / fftSize;

  for (let t = 0; t < timeFrames; t++) {
    const offset = t * freqBins;

    // Find the per-frame max (DC bin excluded).
    let maxDb = -Infinity;
    for (let b = 1; b < freqBins; b++) {
      const v = magnitudes[offset + b];
      if (v > maxDb) maxDb = v;
    }
    if (maxDb <= dbFloor + 1) {
      centroid[t] = 0;
      continue;
    }

    const threshold = maxDb - REL_THRESHOLD_DB;
    let weightSum = 0;
    let weightedFreqSum = 0;
    for (let b = 1; b < freqBins; b++) {
      const db = magnitudes[offset + b];
      if (db < threshold) continue;
      const amp = Math.pow(10, db / 20);
      const power = amp * amp;
      weightSum += power;
      weightedFreqSum += b * binHz * power;
    }
    centroid[t] = weightSum > 0 ? weightedFreqSum / weightSum : 0;
  }

  return centroid;
}
