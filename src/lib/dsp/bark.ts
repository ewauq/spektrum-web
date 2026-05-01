import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Bark-scale spectrogram remapping. The 24 critical bands of Zwicker
 * approximate how the human cochlea groups frequencies: each band is
 * roughly the width of a critical filter, ~100 Hz at low frequencies
 * and ~1/3 octave higher up. A bin → bark mapping aggregates STFT
 * magnitudes into per-band energy per frame.
 *
 * Reading: low bark indices (1-4) = sub / bass, mid (5-15) = vocals
 * and main musical content, high (15-24) = air, sibilance, brilliance.
 *
 * Edges follow the standard Zwicker (1961) table truncated above
 * Nyquist for the current sample rate.
 */

// Upper edges of the 24 critical bands in Hz (Zwicker 1961).
const BARK_EDGES_HZ = [
  100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480, 1720, 2000,
  2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500
];

export interface BarkResult {
  /**
   * Energy per band per frame, in dBFS, row-major (frame × band).
   * Layout: data[frame * bands + band]. Length = timeFrames * bands.
   */
  data: Float32Array;
  /** Number of bands actually populated (may be < 24 below Nyquist). */
  bands: number;
  /** Lower edges of each populated band in Hz. */
  bandLowHz: Float32Array;
  /** Upper edges of each populated band in Hz. */
  bandHighHz: Float32Array;
  frames: number;
  dbFloor: number;
}

export function computeBark(stft: StftResult): BarkResult {
  const { magnitudes, freqBins, timeFrames, sampleRate, fftSize, dbFloor } =
    stft;
  const nyquist = sampleRate / 2;
  const binHz = sampleRate / fftSize;

  // Trim band edges to Nyquist. The first band starts at 0 Hz; each
  // subsequent band starts where the previous ended.
  const upperEdges: number[] = [];
  for (const e of BARK_EDGES_HZ) {
    if (e <= nyquist) upperEdges.push(e);
    else {
      upperEdges.push(nyquist);
      break;
    }
  }
  const bands = upperEdges.length;
  const bandLowHz = new Float32Array(bands);
  const bandHighHz = new Float32Array(bands);
  bandLowHz[0] = 0;
  bandHighHz[0] = upperEdges[0];
  for (let b = 1; b < bands; b++) {
    bandLowHz[b] = upperEdges[b - 1];
    bandHighHz[b] = upperEdges[b];
  }

  // Pre-compute bin → band index for fast accumulation. DC bin maps
  // to band 0 by convention but is excluded from the sum below.
  const binToBand = new Int16Array(freqBins);
  for (let k = 0; k < freqBins; k++) {
    const f = k * binHz;
    let band = bands - 1;
    for (let b = 0; b < bands; b++) {
      if (f <= bandHighHz[b]) {
        band = b;
        break;
      }
    }
    binToBand[k] = band;
  }

  const data = new Float32Array(timeFrames * bands);

  for (let t = 0; t < timeFrames; t++) {
    const offset = t * freqBins;
    // Accumulate linear power per band (DC excluded).
    for (let b = 0; b < bands; b++) {
      // Reset to 0; we'll overwrite below with the dB-converted sum.
      data[t * bands + b] = 0;
    }
    const accum = new Float64Array(bands);
    for (let k = 1; k < freqBins; k++) {
      const amp = dbToAmp(magnitudes[offset + k]);
      accum[binToBand[k]] += amp * amp;
    }
    for (let b = 0; b < bands; b++) {
      const power = accum[b];
      data[t * bands + b] =
        power > 0 ? Math.max(dbFloor, 10 * Math.log10(power)) : dbFloor;
    }
  }

  return {
    data,
    bands,
    bandLowHz,
    bandHighHz,
    frames: timeFrames,
    dbFloor
  };
}
