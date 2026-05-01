import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Self-similarity matrix computed on a downsampled, log-binned version
 * of the STFT magnitudes. The full spectrogram is too large for an
 * N² distance matrix, so we sub-sample frames by a stride and reduce
 * each surviving frame to a small log-spaced energy vector before the
 * cosine-distance pass.
 *
 * Output:
 *   - matrix[i × size + j] in [0, 1] = cosine similarity (1 = identical
 *     frames, 0 = orthogonal). Diagonals secondaires révèlent les
 *     répétitions de section, blocs sombres = sections homogènes.
 *   - hopSeconds = the downsampled frame period, used by the panel
 *     and by the novelty curve to map time.
 */
export interface SelfSimilarityResult {
  /** Row-major NxN cosine similarity matrix. */
  matrix: Float32Array;
  /** Side length N. */
  size: number;
  /** Time period of one row/column, in seconds. */
  hopSeconds: number;
  /** Total programme duration, useful for the time axis. */
  durationSeconds: number;
}

export interface SelfSimilarityOptions {
  /** Target number of rows/columns. Defaults to 400. */
  targetFrames?: number;
  /** Number of log-spaced bins per reduced frame. Defaults to 64. */
  targetBins?: number;
}

const DEFAULT_TARGET_FRAMES = 400;
const DEFAULT_TARGET_BINS = 64;

export function computeSelfSimilarity(
  stft: StftResult,
  options: SelfSimilarityOptions = {}
): SelfSimilarityResult {
  const targetFrames = options.targetFrames ?? DEFAULT_TARGET_FRAMES;
  const targetBins = options.targetBins ?? DEFAULT_TARGET_BINS;
  const { magnitudes, freqBins, timeFrames, sampleRate, fftSize, hopSize } =
    stft;

  if (timeFrames === 0) {
    return {
      matrix: new Float32Array(0),
      size: 0,
      hopSeconds: hopSize / sampleRate,
      durationSeconds: 0
    };
  }

  const stride = Math.max(1, Math.floor(timeFrames / targetFrames));
  const size = Math.ceil(timeFrames / stride);
  const reduced = new Float32Array(size * targetBins);

  // Bin → reduced bin mapping: log-spaced from binHz (sub Nyquist) to
  // Nyquist. Bin 0 (DC) excluded.
  const binToReduced = new Int16Array(freqBins);
  binToReduced[0] = -1;
  const binHz = sampleRate / fftSize;
  const fLow = Math.max(1, binHz);
  const fHigh = sampleRate / 2;
  const logLow = Math.log2(fLow);
  const logSpan = Math.log2(fHigh) - logLow;
  for (let k = 1; k < freqBins; k++) {
    const f = k * binHz;
    const r = Math.floor(((Math.log2(f) - logLow) / logSpan) * targetBins);
    binToReduced[k] = Math.max(0, Math.min(targetBins - 1, r));
  }

  // Reduce each sampled frame: sum linear power per reduced bin.
  for (let i = 0; i < size; i++) {
    const srcFrame = i * stride;
    if (srcFrame >= timeFrames) break;
    const offset = srcFrame * freqBins;
    const rowOff = i * targetBins;
    for (let k = 1; k < freqBins; k++) {
      const r = binToReduced[k];
      const amp = dbToAmp(magnitudes[offset + k]);
      reduced[rowOff + r] += amp * amp;
    }
  }

  // L2-normalise each reduced row so cosine similarity is just a dot
  // product.
  for (let i = 0; i < size; i++) {
    const rowOff = i * targetBins;
    let sumSq = 0;
    for (let j = 0; j < targetBins; j++) {
      const v = reduced[rowOff + j];
      sumSq += v * v;
    }
    if (sumSq > 0) {
      const inv = 1 / Math.sqrt(sumSq);
      for (let j = 0; j < targetBins; j++) reduced[rowOff + j] *= inv;
    }
  }

  // NxN cosine similarity (symmetric).
  const matrix = new Float32Array(size * size);
  for (let i = 0; i < size; i++) {
    const ri = i * targetBins;
    for (let j = i; j < size; j++) {
      const rj = j * targetBins;
      let dot = 0;
      for (let k = 0; k < targetBins; k++) dot += reduced[ri + k] * reduced[rj + k];
      matrix[i * size + j] = dot;
      matrix[j * size + i] = dot;
    }
  }

  const hopSeconds = (stride * hopSize) / sampleRate;
  const durationSeconds = (timeFrames * hopSize) / sampleRate;

  return { matrix, size, hopSeconds, durationSeconds };
}

/**
 * Novelty curve: convolution of the self-similarity matrix with a
 * checkerboard kernel along the main diagonal. Peaks mark section
 * boundaries (intro / verse / chorus / bridge transitions).
 *
 * Kernel sign pattern (4 quadrants, dy = row offset, dx = col offset):
 *   - upper-left  (dy<0, dx<0):  +1   (similarity to past, before boundary)
 *   - lower-right (dy>0, dx>0):  +1   (similarity to future, after boundary)
 *   - upper-right (dy<0, dx>0):  -1   (cross-similarity)
 *   - lower-left  (dy>0, dx<0):  -1
 *
 * High value = block-diagonal break, i.e. a section change.
 */
export interface NoveltyOptions {
  /** Kernel side length (must be even, defaults to 32). */
  kernelSize?: number;
}

const DEFAULT_KERNEL_SIZE = 32;

export function computeNovelty(
  similarity: SelfSimilarityResult,
  options: NoveltyOptions = {}
): Float32Array {
  const { matrix, size } = similarity;
  if (size === 0) return new Float32Array(0);
  const kernelSize = options.kernelSize ?? DEFAULT_KERNEL_SIZE;
  const half = kernelSize >> 1;
  const novelty = new Float32Array(size);

  for (let i = half; i < size - half; i++) {
    let sum = 0;
    for (let dy = -half; dy < half; dy++) {
      const r = i + dy;
      for (let dx = -half; dx < half; dx++) {
        const c = i + dx;
        // Diagonal-aligned checkerboard.
        const sign = (dy < 0) === (dx < 0) ? +1 : -1;
        sum += sign * matrix[r * size + c];
      }
    }
    novelty[i] = sum / (kernelSize * kernelSize);
  }

  // Half-rectify and normalise to [0, 1].
  let max = 0;
  for (let i = 0; i < size; i++) {
    if (novelty[i] < 0) novelty[i] = 0;
    if (novelty[i] > max) max = novelty[i];
  }
  if (max > 0) {
    const inv = 1 / max;
    for (let i = 0; i < size; i++) novelty[i] *= inv;
  }

  return novelty;
}
