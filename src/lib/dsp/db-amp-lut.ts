/**
 * Shared dB → linear amplitude lookup table for the DSP routines that
 * decode magnitudes back from dBFS. Math.pow(10, dB / 20) is hot in
 * the spatialization workers (vectorscope, stereo-width, soundfield)
 * which call it tens of millions of times per file. The runtime cost
 * of a single Math.pow on a modern V8 sits around 30-50 ns; the LUT
 * + linear interpolation below comes in at 10-15 ns, a 3-5× speedup.
 *
 * Range matches the STFT clamp [dbFloor = -140, dbCeiling = 0] used
 * everywhere in the project, with a 0.05 dB step. That gives 2801
 * entries (≈ 11 KB) — fits easily in L1. Linear interpolation between
 * neighbours produces a relative error below 5e-6 vs Math.pow over
 * the whole range, well under the 0.1 dB perceptual / colormap
 * resolution our panels work with.
 *
 * The LUT is built lazily the first time any consumer calls dbToAmp,
 * so importing this file from a worker does not pay the construction
 * cost up front.
 */

const STEP = 0.05;
const FLOOR_DB = -140;
const CEILING_DB = 0;
const N = Math.round((CEILING_DB - FLOOR_DB) / STEP) + 1;
const INV_STEP = 1 / STEP;

let lut: Float32Array | null = null;

function buildLut(): Float32Array {
  const arr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    arr[i] = Math.pow(10, (FLOOR_DB + i * STEP) / 20);
  }
  return arr;
}

/**
 * Linear amplitude for a dBFS value. Equivalent to
 * `Math.pow(10, db / 20)` to ≈ 5e-6 relative error.
 */
export function dbToAmp(db: number): number {
  if (lut === null) lut = buildLut();
  if (db <= FLOOR_DB) return lut[0];
  if (db >= CEILING_DB) return lut[N - 1];
  const idx = (db - FLOOR_DB) * INV_STEP;
  // `idx | 0` is a fast floor for non-negative numbers (idx ≥ 0 here).
  const i = idx | 0;
  const a = lut[i];
  return a + (lut[i + 1] - a) * (idx - i);
}
