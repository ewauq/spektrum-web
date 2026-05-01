import type { StftOptions } from '$lib/dsp/stft';
import type { WindowType } from '$lib/dsp/window';
import {
  startStreamingStftStereo,
  type StftStereoResult
} from '$lib/dsp/stft-stereo';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';

/**
 * Singleton cache for the per-channel STFT used by the spatialization
 * panels. The result is published only when streaming is fully done so
 * downstream computations (correlation, soundfield) always see the
 * complete magnitudes array.
 *
 * Mono files (pcmRight === null) leave the store empty and panels
 * display the `panels.spatial_mono_only` placeholder.
 */

interface CacheKey {
  pcmLeft: Float32Array;
  pcmRight: Float32Array;
  sampleRate: number;
  fftSize: number;
  hopSize: number;
  windowType: WindowType;
}

function createStore() {
  let stereo = $state<StftStereoResult | null>(null);
  let progress = $state(0);
  let cachedFor: CacheKey | null = null;
  let inflight: { cancel(): void } | null = null;

  function ensure(
    pcmLeft: Float32Array,
    pcmRight: Float32Array | null,
    sampleRate: number,
    options: StftOptions = {}
  ): void {
    if (!pcmRight) {
      if (stereo !== null || progress !== 0 || cachedFor !== null) clear();
      return;
    }
    const fftSize = options.fftSize ?? 2048;
    const hopSize = options.hopSize ?? 512;
    const windowType: WindowType = options.windowType ?? 'hann';
    if (
      cachedFor &&
      cachedFor.pcmLeft === pcmLeft &&
      cachedFor.pcmRight === pcmRight &&
      cachedFor.sampleRate === sampleRate &&
      cachedFor.fftSize === fftSize &&
      cachedFor.hopSize === hopSize &&
      cachedFor.windowType === windowType
    ) {
      return;
    }
    inflight?.cancel();
    const key: CacheKey = {
      pcmLeft,
      pcmRight,
      sampleRate,
      fftSize,
      hopSize,
      windowType
    };
    cachedFor = key;
    stereo = null;
    progress = 0;
    const taskId = taskStore.start('stft_stereo', t('tasks.stft_stereo'), {
      progress: 0
    });

    const handle = startStreamingStftStereo(
      pcmLeft,
      pcmRight,
      sampleRate,
      { fftSize, hopSize, windowType },
      (p) => {
        if (cachedFor !== key) return;
        progress = p;
        taskStore.update(taskId, p);
      }
    );
    inflight = handle;

    handle.done
      .then(() => {
        if (cachedFor !== key) return;
        stereo = handle.result;
        progress = 1;
        inflight = null;
      })
      .catch(() => {
        if (cachedFor === key) {
          cachedFor = null;
          stereo = null;
          progress = 0;
        }
        inflight = null;
      })
      .finally(() => {
        taskStore.end(taskId);
      });
  }

  function clear(): void {
    inflight?.cancel();
    inflight = null;
    cachedFor = null;
    stereo = null;
    progress = 0;
  }

  return {
    get stereo() {
      return stereo;
    },
    get progress() {
      return progress;
    },
    ensure,
    clear
  };
}

export const stftStereoStore = createStore();
