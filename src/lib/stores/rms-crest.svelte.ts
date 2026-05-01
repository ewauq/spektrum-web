import type { RmsCrestSeries } from '$lib/dsp/rms';
import { runRms } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  pcm: Float32Array;
  windowSeconds: number;
  sampleRate: number;
}

function createStore() {
  let series = $state<RmsCrestSeries | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(
    pcm: Float32Array,
    sampleRate: number,
    windowSeconds: number
  ): void {
    if (
      cachedFor &&
      cachedFor.pcm === pcm &&
      cachedFor.windowSeconds === windowSeconds
    ) {
      return;
    }
    const key: CacheKey = { pcm, sampleRate, windowSeconds };
    cachedFor = key;
    series = null;
    const taskId = taskStore.start('rms', t('tasks.rms'));
    const t0 = performance.now();

    runRms(pcm, sampleRate, {
      windowSeconds,
      hopSeconds: 0.05,
      floorDb: -90
    })
      .then((result) => {
        if (cachedFor !== key) return;
        series = result;
        perfStore.setPanelCompute('rms_crest', performance.now() - t0);
      })
      .catch(() => {
        // Worker disposed or fatal error: leave series at null and let
        // the caller retry on the next ensure().
        if (cachedFor === key) cachedFor = null;
      })
      .finally(() => {
        taskStore.end(taskId);
      });
  }

  function clear(): void {
    cachedFor = null;
    series = null;
  }

  return {
    get series() {
      return series;
    },
    ensure,
    clear
  };
}

export const rmsCrestStore = createStore();
