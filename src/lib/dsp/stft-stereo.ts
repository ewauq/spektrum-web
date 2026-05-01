import { startStreamingStft, type StftOptions, type StftResult } from './stft';

/**
 * Per-channel STFT for the spatialization panels. Runs two independent
 * `startStreamingStft` instances in parallel, each spawning its own
 * `stft.worker.ts`. The `stft.worker` is reused unchanged: the cost is
 * just one extra worker process for the duration of the analysis.
 *
 * Aggregate progress is the average of the two channels (worker pacing
 * is symmetric so they finish within a few frames of each other).
 */

export interface StftStereoResult {
  left: StftResult;
  right: StftResult;
}

export function startStreamingStftStereo(
  pcmLeft: Float32Array,
  pcmRight: Float32Array,
  sampleRate: number,
  options: StftOptions = {},
  onProgress?: (progress: number) => void
): { result: StftStereoResult; done: Promise<void>; cancel: () => void } {
  let leftCompleted = 0;
  let rightCompleted = 0;
  let totalFrames = 0;

  const left = startStreamingStft(pcmLeft, sampleRate, options, (done, total) => {
    leftCompleted = done;
    if (total > totalFrames) totalFrames = total;
    if (onProgress && totalFrames > 0) {
      const combined = (leftCompleted + rightCompleted) / (2 * totalFrames);
      onProgress(combined);
    }
  });
  const right = startStreamingStft(pcmRight, sampleRate, options, (done, total) => {
    rightCompleted = done;
    if (total > totalFrames) totalFrames = total;
    if (onProgress && totalFrames > 0) {
      const combined = (leftCompleted + rightCompleted) / (2 * totalFrames);
      onProgress(combined);
    }
  });

  const done = Promise.all([left.done, right.done]).then(() => {
    onProgress?.(1);
  });

  function cancel() {
    left.cancel();
    right.cancel();
  }

  return {
    result: { left: left.result, right: right.result },
    done,
    cancel
  };
}
