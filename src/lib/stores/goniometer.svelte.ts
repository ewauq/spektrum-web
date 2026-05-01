import type { GoniometerResult } from '$lib/dsp/goniometer';
import { runGoniometer } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  pcmLeft: Float32Array;
  pcmRight: Float32Array;
}

function createStore() {
  let result = $state<GoniometerResult | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(pcmLeft: Float32Array, pcmRight: Float32Array): void {
    if (
      cachedFor &&
      cachedFor.pcmLeft === pcmLeft &&
      cachedFor.pcmRight === pcmRight
    ) {
      return;
    }
    const key: CacheKey = { pcmLeft, pcmRight };
    cachedFor = key;
    result = null;
    const taskId = taskStore.start('goniometer', t('tasks.goniometer'));
    const t0 = performance.now();

    runGoniometer(pcmLeft, pcmRight)
      .then((r) => {
        if (cachedFor !== key) return;
        result = r;
        perfStore.setPanelCompute('goniometer', performance.now() - t0);
      })
      .catch(() => {
        if (cachedFor === key) cachedFor = null;
      })
      .finally(() => {
        taskStore.end(taskId);
      });
  }

  function clear(): void {
    cachedFor = null;
    result = null;
  }

  return {
    get result() {
      return result;
    },
    ensure,
    clear
  };
}

export const goniometerStore = createStore();
