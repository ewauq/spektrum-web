import type { OnsetData, OnsetOptions } from '$lib/dsp/onsets';
import { runOnsets } from '$lib/dsp/dsp-client';
import type { StftResult } from '$lib/dsp/stft';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

/**
 * Full-spectrum onset detection. Unlike the simpler cached-stft store
 * pattern, the cache key here mixes the STFT identity and the user
 * options (band, sensitivity, min distance) — every option flips the
 * detection result so we have to recompute on each change.
 */

interface CacheKey {
  stft: StftResult;
  band: OnsetOptions['band'];
  thresholdRel: number;
  minDistanceSeconds: number;
}

function sameKey(a: CacheKey | null, b: CacheKey): boolean {
  if (!a) return false;
  if (a.stft !== b.stft) return false;
  if (a.thresholdRel !== b.thresholdRel) return false;
  if (a.minDistanceSeconds !== b.minDistanceSeconds) return false;
  const ab = a.band;
  const bb = b.band;
  if (!ab && !bb) return true;
  if (!ab || !bb) return false;
  return ab[0] === bb[0] && ab[1] === bb[1];
}

function createOnsetsStore() {
  let data = $state<OnsetData | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(stft: StftResult, options: OnsetOptions = {}): void {
    const key: CacheKey = {
      stft,
      band: options.band,
      thresholdRel: options.thresholdRel ?? 2.5,
      minDistanceSeconds: options.minDistanceSeconds ?? 0.05
    };
    if (sameKey(cachedFor, key)) return;
    cachedFor = key;
    data = null;
    const taskId = taskStore.start('onsets', t('tasks.onsets'));
    const t0 = performance.now();

    runOnsets(stft, options)
      .then((result) => {
        if (!sameKey(cachedFor, key)) return;
        data = result;
        perfStore.setPanelCompute('onsets', performance.now() - t0);
      })
      .catch(() => {
        if (sameKey(cachedFor, key)) cachedFor = null;
      })
      .finally(() => {
        taskStore.end(taskId);
      });
  }

  function clear(): void {
    cachedFor = null;
    data = null;
  }

  return {
    get data() {
      return data;
    },
    ensure,
    clear
  };
}

export const onsetsStore = createOnsetsStore();
