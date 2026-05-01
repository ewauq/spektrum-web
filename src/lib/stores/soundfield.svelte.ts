import type {
  SoundfieldResult,
  SoundfieldOptions
} from '$lib/dsp/soundfield';
import type { StftResult } from '$lib/dsp/stft';
import { runSoundfield } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  stftLeft: StftResult;
  stftRight: StftResult;
  angleBins: number;
  rangeDb: number;
}

function sameKey(a: CacheKey | null, b: CacheKey): boolean {
  if (!a) return false;
  return (
    a.stftLeft === b.stftLeft &&
    a.stftRight === b.stftRight &&
    a.angleBins === b.angleBins &&
    a.rangeDb === b.rangeDb
  );
}

function createStore() {
  let result = $state<SoundfieldResult | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(
    stftLeft: StftResult,
    stftRight: StftResult,
    options: SoundfieldOptions = {}
  ): void {
    const key: CacheKey = {
      stftLeft,
      stftRight,
      angleBins: options.angleBins ?? 36,
      rangeDb: options.rangeDb ?? 60
    };
    if (sameKey(cachedFor, key)) return;
    cachedFor = key;
    result = null;
    const taskId = taskStore.start('soundfield', t('tasks.soundfield'));
    const t0 = performance.now();

    runSoundfield(stftLeft, stftRight, options)
      .then((r) => {
        if (!sameKey(cachedFor, key)) return;
        result = r;
        perfStore.setPanelCompute('soundfield', performance.now() - t0);
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

export const soundfieldStore = createStore();
