/**
 * Sliding RMS and crest factor on raw PCM. Both metrics are returned
 * in dBFS so they can share a y-axis with other dB-based panels.
 *
 * Window length is given in seconds and converted to samples internally
 * to make the API independent of the audio sample rate.
 *
 * Conventions :
 *   - RMS_dBFS  = 20·log10(rms / fullScale) clamped to [floorDb, 0]
 *   - peak_dBFS = 20·log10(maxAbs / fullScale) clamped likewise
 *   - crest_dB  = peak_dBFS - rms_dBFS  (always ≥ 0)
 *
 * Crest factor is the headroom between peak and RMS. ~12 dB is a
 * "respiring" master, ~6 dB indicates heavy limiting, ~3 dB is brick-
 * walled. Useful to spot a hot master at a glance.
 */

export interface RmsCrestSeries {
  /** Time in seconds of each frame center, length = N. */
  times: Float32Array;
  /** RMS level in dBFS, length = N. */
  rmsDb: Float32Array;
  /** Peak level in dBFS, length = N. */
  peakDb: Float32Array;
  /** Crest factor (peakDb - rmsDb) in dB, length = N. */
  crestDb: Float32Array;
  /** Window length in seconds actually used. */
  windowSeconds: number;
  /** Hop length in seconds actually used. */
  hopSeconds: number;
  /** dBFS floor used for clamping. Frames below this are flat at the floor. */
  floorDb: number;
}

export interface RmsOptions {
  /** Sliding window in seconds. Default 0.4 s ≈ same as LUFS momentary. */
  windowSeconds?: number;
  /** Hop between frames in seconds. Default 0.05 s = 20 Hz update. */
  hopSeconds?: number;
  /** Lower clamp in dBFS. Default -90. Avoids -Inf when the signal is flat. */
  floorDb?: number;
}

const EPS = 1e-12;

export function computeRmsCrest(
  pcm: Float32Array,
  sampleRate: number,
  options: RmsOptions = {}
): RmsCrestSeries {
  const windowSeconds = Math.max(0.005, options.windowSeconds ?? 0.4);
  const hopSeconds = Math.max(0.001, options.hopSeconds ?? 0.05);
  const floorDb = options.floorDb ?? -90;

  const winSamples = Math.max(1, Math.round(windowSeconds * sampleRate));
  const hopSamples = Math.max(1, Math.round(hopSeconds * sampleRate));

  if (pcm.length < winSamples) {
    const empty = new Float32Array(0);
    return {
      times: empty,
      rmsDb: empty,
      peakDb: empty,
      crestDb: empty,
      windowSeconds,
      hopSeconds,
      floorDb
    };
  }

  const frames = Math.floor((pcm.length - winSamples) / hopSamples) + 1;
  const times = new Float32Array(frames);
  const rmsDb = new Float32Array(frames);
  const peakDb = new Float32Array(frames);
  const crestDb = new Float32Array(frames);

  // RMS uses a sliding sum-of-squares (O(N) total).
  // Peak uses a monotonic deque of |pcm[i]|: we keep at most winSamples
  // candidates, popping any that are dominated by a newer larger value.
  // The front of the deque is always the max of the current window.
  // Total cost: each sample is pushed once and popped at most once → O(N).
  // Memory: a circular Int32Array of size winSamples is enough.
  const dequeCap = winSamples;
  const dequeIdx = new Int32Array(dequeCap);
  let head = 0;
  let tail = 0;
  let size = 0;
  const wrap = (i: number) => {
    let j = i % dequeCap;
    if (j < 0) j += dequeCap;
    return j;
  };

  // Push sample index `i` (with absolute value `a`) onto the deque.
  function pushBack(i: number, a: number) {
    while (size > 0) {
      const prev = wrap(tail - 1);
      const prevAbs = Math.abs(pcm[dequeIdx[prev]]);
      if (prevAbs <= a) {
        tail = prev;
        size--;
      } else break;
    }
    dequeIdx[tail] = i;
    tail = wrap(tail + 1);
    size++;
  }

  // Pop indices that have fallen out of the current window [start, end).
  function dropOlderThan(start: number) {
    while (size > 0 && dequeIdx[head] < start) {
      head = wrap(head + 1);
      size--;
    }
  }

  // Initialize: load the first window for both RMS sum and peak deque.
  let sumSq = 0;
  for (let i = 0; i < winSamples; i++) {
    const v = pcm[i];
    sumSq += v * v;
    pushBack(i, Math.abs(v));
  }

  for (let f = 0; f < frames; f++) {
    const start = f * hopSamples;
    const peak = Math.abs(pcm[dequeIdx[head]]);

    const meanSq = sumSq / winSamples;
    const rms = Math.sqrt(Math.max(0, meanSq));
    const rmsValDb = 20 * Math.log10(rms + EPS);
    const peakValDb = 20 * Math.log10(peak + EPS);

    const rmsClamped = Math.max(floorDb, Math.min(0, rmsValDb));
    const peakClamped = Math.max(floorDb, Math.min(0, peakValDb));

    times[f] = (start + winSamples / 2) / sampleRate;
    rmsDb[f] = rmsClamped;
    peakDb[f] = peakClamped;
    crestDb[f] =
      peakClamped > floorDb + 1 ? Math.max(0, peakClamped - rmsClamped) : 0;

    // Advance to the next frame: slide window by hopSamples.
    if (f + 1 < frames) {
      const nextStart = start + hopSamples;
      const nextEnd = nextStart + winSamples;
      // Remove samples that left the window (front of deque).
      dropOlderThan(nextStart);
      // Add newly entering samples: also update the rolling sumSq.
      for (let i = start + winSamples; i < nextEnd; i++) {
        const out = pcm[i - winSamples];
        const inn = i < pcm.length ? pcm[i] : 0;
        sumSq -= out * out;
        sumSq += inn * inn;
        pushBack(i, Math.abs(inn));
      }
      if (sumSq < 0) sumSq = 0; // numerical drift safety
    }
  }

  return {
    times,
    rmsDb,
    peakDb,
    crestDb,
    windowSeconds,
    hopSeconds,
    floorDb
  };
}
