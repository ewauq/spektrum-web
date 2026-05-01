import type { OnsetData } from './onsets';

/**
 * Tempogram: BPM × time map computed by autocorrelating the onset
 * envelope inside a sliding window. Peaks in autocorrelation reveal
 * the dominant beat period at that point in the track. The result is
 * a heatmap that lets the user see whether a track sits on a stable
 * BPM, swings, modulates metrically, or sits in free-time.
 *
 * BPM range is 30 to 300 by default — covers ballads to drum-and-bass
 * sub-divisions while excluding very slow rubato (where the
 * autocorrelation result is dominated by noise) and ultrasonic
 * pulses.
 */

export interface TempogramOptions {
  /** Sliding window length in seconds. Defaults to 6. */
  windowSeconds?: number;
  /** Hop between successive windows in seconds. Defaults to 0.5. */
  hopSeconds?: number;
  /** Lowest BPM tracked. Defaults to 30. */
  minBpm?: number;
  /** Highest BPM tracked. Defaults to 300. */
  maxBpm?: number;
  /** BPM resolution (number of bins between min and max). Defaults to 200. */
  bpmBins?: number;
}

export interface TempogramResult {
  /**
   * Row-major [bpmBins × frames] autocorrelation strength normalised
   * to [0, 1]. data[bpmIdx * frames + frameIdx].
   */
  data: Float32Array;
  bpmBins: number;
  frames: number;
  /** Time of each output frame's centre, in seconds. Length = frames. */
  times: Float32Array;
  /** BPM value at each row index. Length = bpmBins. */
  bpms: Float32Array;
  /** Dominant BPM per frame (peak picking). */
  dominantBpm: Float32Array;
}

const DEFAULT_WINDOW_S = 6;
const DEFAULT_HOP_S = 0.5;
const DEFAULT_MIN_BPM = 30;
const DEFAULT_MAX_BPM = 300;
const DEFAULT_BPM_BINS = 200;

export function computeTempogram(
  onsets: OnsetData,
  options: TempogramOptions = {}
): TempogramResult {
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_S;
  const hopSeconds = options.hopSeconds ?? DEFAULT_HOP_S;
  const minBpm = options.minBpm ?? DEFAULT_MIN_BPM;
  const maxBpm = options.maxBpm ?? DEFAULT_MAX_BPM;
  const bpmBins = options.bpmBins ?? DEFAULT_BPM_BINS;

  const env = onsets.envelope;
  const envHop = onsets.hopSeconds;
  if (env.length === 0 || envHop <= 0) {
    return {
      data: new Float32Array(0),
      bpmBins,
      frames: 0,
      times: new Float32Array(0),
      bpms: new Float32Array(0),
      dominantBpm: new Float32Array(0)
    };
  }

  const winFrames = Math.max(2, Math.round(windowSeconds / envHop));
  const hopFrames = Math.max(1, Math.round(hopSeconds / envHop));

  // Pre-compute lag indices (in env-frames) for each BPM bin.
  const bpms = new Float32Array(bpmBins);
  const lags = new Int32Array(bpmBins);
  for (let b = 0; b < bpmBins; b++) {
    const bpm = minBpm + ((maxBpm - minBpm) * b) / Math.max(1, bpmBins - 1);
    bpms[b] = bpm;
    const periodSeconds = 60 / bpm;
    lags[b] = Math.max(1, Math.round(periodSeconds / envHop));
  }

  const totalEnv = env.length;
  if (totalEnv < winFrames) {
    return {
      data: new Float32Array(0),
      bpmBins,
      frames: 0,
      times: new Float32Array(0),
      bpms,
      dominantBpm: new Float32Array(0)
    };
  }

  const frames = Math.floor((totalEnv - winFrames) / hopFrames) + 1;
  const data = new Float32Array(bpmBins * frames);
  const times = new Float32Array(frames);
  const dominantBpm = new Float32Array(frames);

  // Per-window autocorrelation. The envelope is mean-removed inside
  // the window so DC doesn't dominate every lag.
  for (let f = 0; f < frames; f++) {
    const start = f * hopFrames;
    const end = start + winFrames;
    times[f] = (start + winFrames * 0.5) * envHop;

    let mean = 0;
    for (let i = start; i < end; i++) mean += env[i];
    mean /= winFrames;

    let energy = 0;
    for (let i = start; i < end; i++) {
      const d = env[i] - mean;
      energy += d * d;
    }
    if (energy <= 0) continue;
    const invEnergy = 1 / energy;

    let bestStrength = 0;
    let bestBpm = bpms[0];
    for (let b = 0; b < bpmBins; b++) {
      const lag = lags[b];
      if (lag >= winFrames) {
        data[b * frames + f] = 0;
        continue;
      }
      let acc = 0;
      const upper = end - lag;
      for (let i = start; i < upper; i++) {
        acc += (env[i] - mean) * (env[i + lag] - mean);
      }
      const strength = Math.max(0, acc * invEnergy);
      data[b * frames + f] = strength;
      if (strength > bestStrength) {
        bestStrength = strength;
        bestBpm = bpms[b];
      }
    }
    dominantBpm[f] = bestBpm;
  }

  // Per-column normalisation to [0, 1] for stable colormapping.
  for (let f = 0; f < frames; f++) {
    let maxVal = 0;
    for (let b = 0; b < bpmBins; b++) {
      const v = data[b * frames + f];
      if (v > maxVal) maxVal = v;
    }
    if (maxVal > 0) {
      const inv = 1 / maxVal;
      for (let b = 0; b < bpmBins; b++) data[b * frames + f] *= inv;
    }
  }

  return { data, bpmBins, frames, times, bpms, dominantBpm };
}
