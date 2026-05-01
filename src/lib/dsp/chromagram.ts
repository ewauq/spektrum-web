import type { StftResult } from './stft';
import { dbToAmp } from './db-amp-lut';

/**
 * Chromagram (12 pitch classes × time) derived from the STFT magnitudes.
 *
 * The exact answer is a Constant-Q Transform with one bin per
 * semitone. Here we approximate by mapping every linear FFT bin to the
 * nearest semitone via 12·log₂(f / refA), then folding back into the
 * 12 pitch classes mod 12. Energies are summed in linear power and
 * the per-frame total is normalised so each column is read as a
 * relative distribution (0 = empty class, 1 = peak class).
 *
 * The approximation drifts at very low frequencies (< 80 Hz) where
 * each FFT bin spans more than a semitone — for an A=440 reference
 * with FFT 2048 / 44.1 kHz, bin 0..3 is unstable. Those bins are
 * excluded by a hard low-frequency cutoff.
 */

const REF_HZ = 440; // A4
const REF_MIDI = 69; // A4 in MIDI numbering
const PITCH_CLASSES = 12;
const LOW_CUTOFF_HZ = 65; // ≈ C2; below this the binning is unreliable.

export interface ChromagramResult {
  /**
   * Normalised pitch-class energy per frame. Layout:
   * data[frame * 12 + pitchClass]. Each column max ≤ 1.
   */
  data: Float32Array;
  frames: number;
  /** Per-frame total power before normalisation, useful for greying out silent frames. */
  framePower: Float32Array;
}

export function computeChromagram(stft: StftResult): ChromagramResult {
  const { magnitudes, freqBins, timeFrames, sampleRate, fftSize } = stft;
  const binHz = sampleRate / fftSize;

  // Pre-compute bin → pitch class. -1 marks bins outside the usable
  // range so the inner loop just skips with one comparison.
  const binToClass = new Int8Array(freqBins);
  binToClass[0] = -1;
  for (let k = 1; k < freqBins; k++) {
    const f = k * binHz;
    if (f < LOW_CUTOFF_HZ) {
      binToClass[k] = -1;
      continue;
    }
    // MIDI from frequency, then mod 12 for the pitch class.
    const midi = REF_MIDI + 12 * Math.log2(f / REF_HZ);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    binToClass[k] = pc;
  }

  const data = new Float32Array(timeFrames * PITCH_CLASSES);
  const framePower = new Float32Array(timeFrames);

  for (let t = 0; t < timeFrames; t++) {
    const offset = t * freqBins;
    let total = 0;
    // Accumulate linear power per pitch class.
    for (let pc = 0; pc < PITCH_CLASSES; pc++) {
      data[t * PITCH_CLASSES + pc] = 0;
    }
    for (let k = 1; k < freqBins; k++) {
      const pc = binToClass[k];
      if (pc < 0) continue;
      const amp = dbToAmp(magnitudes[offset + k]);
      const power = amp * amp;
      data[t * PITCH_CLASSES + pc] += power;
      total += power;
    }
    framePower[t] = total;
    // Normalise the column so the max class is 1.
    let max = 0;
    for (let pc = 0; pc < PITCH_CLASSES; pc++) {
      const v = data[t * PITCH_CLASSES + pc];
      if (v > max) max = v;
    }
    if (max > 0) {
      const inv = 1 / max;
      for (let pc = 0; pc < PITCH_CLASSES; pc++) {
        data[t * PITCH_CLASSES + pc] *= inv;
      }
    }
  }

  return { data, frames: timeFrames, framePower };
}

/** Pitch class names (sharp notation), index 0 = C. */
export const PITCH_CLASS_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B'
] as const;
