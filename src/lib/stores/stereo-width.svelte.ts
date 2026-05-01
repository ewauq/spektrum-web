import type { StereoWidthResult } from '$lib/dsp/stereo-width';
import type { StftResult } from '$lib/dsp/stft';
import { runStereoWidth } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  stftLeft: StftResult;
  stftRight: StftResult;
}

function createStore() {
  let result = $state<StereoWidthResult | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(stftLeft: StftResult, stftRight: StftResult): void {
    if (
      cachedFor &&
      cachedFor.stftLeft === stftLeft &&
      cachedFor.stftRight === stftRight
    ) {
      return;
    }
    const key: CacheKey = { stftLeft, stftRight };
    cachedFor = key;
    result = null;
    const taskId = taskStore.start('stereo_width', t('tasks.stereo_width'));
    const t0 = performance.now();

    runStereoWidth(stftLeft, stftRight)
      .then((r) => {
        if (cachedFor !== key) return;
        result = r;
        perfStore.setPanelCompute('stereo_width', performance.now() - t0);
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

export const stereoWidthStore = createStore();
