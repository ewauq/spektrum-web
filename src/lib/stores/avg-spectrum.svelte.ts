import type { AverageSpectrum } from '$lib/dsp/avg-spectrum';
import type { StftResult } from '$lib/dsp/stft';
import { runAvgSpectrum } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  stft: StftResult;
  timeStart: number;
  timeEnd: number;
}

function createStore() {
  let spectrum = $state<AverageSpectrum | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(stft: StftResult, timeStart: number, timeEnd: number): void {
    if (
      cachedFor &&
      cachedFor.stft === stft &&
      cachedFor.timeStart === timeStart &&
      cachedFor.timeEnd === timeEnd
    ) {
      return;
    }
    const key: CacheKey = { stft, timeStart, timeEnd };
    cachedFor = key;
    spectrum = null;
    const taskId = taskStore.start('avg_spectrum', t('tasks.avg_spectrum'));
    const t0 = performance.now();

    runAvgSpectrum(stft, timeStart, timeEnd)
      .then((result) => {
        if (cachedFor !== key) return;
        spectrum = result;
        perfStore.setPanelCompute('avg_spectrum', performance.now() - t0);
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
    spectrum = null;
  }

  return {
    get spectrum() {
      return spectrum;
    },
    ensure,
    clear
  };
}

export const avgSpectrumStore = createStore();
