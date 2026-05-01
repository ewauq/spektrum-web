import { secondsToFrame, type StftResult } from './stft';

/**
 * Long-term average spectrum (LTAS) over an arbitrary time window of an
 * existing STFT. Two curves are produced:
 *
 *   - **rmsDb**: energy-averaged magnitude per bin, expressed in dBFS.
 *     This is the perceptually meaningful tilt of the spectrum.
 *   - **peakDb**: peak hold per bin, max dB seen across all frames.
 *     Useful to spot codec cutoffs, narrow tones, room resonances.
 *
 * The averaging is done in the *power* domain (10^(dB/10) is power, since
 * dB are stored as 20·log10|X|). We accumulate power, divide by the
 * frame count, then convert back to dB. Averaging directly in dB would
 * underweight high-energy frames and bias the curve down.
 *
 * Frame range follows secondsToFrame() (same convention as everywhere
 * else in the project: each frame is centered at fftSize/2).
 */
export interface AverageSpectrum {
  frequencies: Float32Array;
  rmsDb: Float32Array;
  peakDb: Float32Array;
  freqBins: number;
  frames: number;
  /** dB floor used by the underlying STFT (peakDb is clamped above this). */
  dbFloor: number;
}

const POWER_FROM_DB_HALF = Math.LN10 / 10;
const DB_FROM_POWER = 10 / Math.LN10;

export function computeAverageSpectrum(
  stft: StftResult,
  timeStart: number,
  timeEnd: number
): AverageSpectrum {
  const { magnitudes, freqBins, sampleRate, fftSize, dbFloor } = stft;

  const fStart = Math.max(0, secondsToFrame(stft, timeStart));
  const fEnd = Math.min(
    stft.timeFrames,
    Math.max(fStart + 1, secondsToFrame(stft, timeEnd))
  );
  const numFrames = fEnd - fStart;

  const frequencies = new Float32Array(freqBins);
  const rmsDb = new Float32Array(freqBins);
  const peakDb = new Float32Array(freqBins);

  for (let k = 0; k < freqBins; k++) {
    frequencies[k] = (k * sampleRate) / fftSize;
  }

  if (numFrames <= 0) {
    rmsDb.fill(dbFloor);
    peakDb.fill(dbFloor);
    return {
      frequencies,
      rmsDb,
      peakDb,
      freqBins,
      frames: 0,
      dbFloor
    };
  }

  // Frames outer, bins inner. magnitudes[base + k] is now read
  // sequentially for k = 0..freqBins-1, so each ~4 KB STFT row stays
  // in L1 instead of forcing a near-cache-miss per cell.
  // Float64 for sumPower: thousands of small linear-power adds would
  // accumulate float32 rounding error otherwise. The 8 KB extra fits
  // in L1 next to the row buffer.
  const sumPower = new Float64Array(freqBins);
  const maxDb = new Float32Array(freqBins);
  maxDb.fill(-Infinity);

  for (let f = fStart; f < fEnd; f++) {
    const base = f * freqBins;
    for (let k = 0; k < freqBins; k++) {
      const db = magnitudes[base + k];
      if (db > maxDb[k]) maxDb[k] = db;
      // Power = 10^(db/10) computed via exp for slightly better speed.
      sumPower[k] += Math.exp(db * POWER_FROM_DB_HALF);
    }
  }

  for (let k = 0; k < freqBins; k++) {
    const meanPower = sumPower[k] / numFrames;
    rmsDb[k] = meanPower > 0 ? Math.log(meanPower) * DB_FROM_POWER : dbFloor;
    peakDb[k] = maxDb[k];
  }

  return {
    frequencies,
    rmsDb,
    peakDb,
    freqBins,
    frames: numFrames,
    dbFloor
  };
}
