import type { VectorscopeResult } from '$lib/dsp/vectorscope';
import type { StftResult } from '$lib/dsp/stft';
import { runVectorscope } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  pcmLeft: Float32Array;
  pcmRight: Float32Array;
  stftLeft: StftResult;
  stftRight: StftResult;
}

function createStore() {
  let result = $state<VectorscopeResult | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(
    pcmLeft: Float32Array,
    pcmRight: Float32Array,
    stftLeft: StftResult,
    stftRight: StftResult
  ): void {
    if (
      cachedFor &&
      cachedFor.pcmLeft === pcmLeft &&
      cachedFor.pcmRight === pcmRight &&
      cachedFor.stftLeft === stftLeft &&
      cachedFor.stftRight === stftRight
    ) {
      return;
    }
    const key: CacheKey = { pcmLeft, pcmRight, stftLeft, stftRight };
    cachedFor = key;
    result = null;
    const taskId = taskStore.start('vectorscope', t('tasks.vectorscope'));
    const t0 = performance.now();

    runVectorscope(pcmLeft, pcmRight, stftLeft, stftRight)
      .then((r) => {
        if (cachedFor !== key) return;
        result = r;
        perfStore.setPanelCompute('vectorscope', performance.now() - t0);
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

export const vectorscopeStore = createStore();
