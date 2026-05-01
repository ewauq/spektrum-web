import type { LoudnessSeries } from '$lib/dsp/loudness';
import { runLoudness } from '$lib/dsp/dsp-client';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

interface CacheKey {
  pcmLeft: Float32Array;
  pcmRight: Float32Array | null;
  sampleRate: number;
}

function createStore() {
  let series = $state<LoudnessSeries | null>(null);
  let cachedFor: CacheKey | null = null;

  function ensure(
    pcmLeft: Float32Array,
    pcmRight: Float32Array | null,
    sampleRate: number
  ): void {
    if (
      cachedFor &&
      cachedFor.pcmLeft === pcmLeft &&
      cachedFor.pcmRight === pcmRight &&
      cachedFor.sampleRate === sampleRate
    ) {
      return;
    }
    const key: CacheKey = { pcmLeft, pcmRight, sampleRate };
    cachedFor = key;
    series = null;
    const taskId = taskStore.start('lufs', t('tasks.lufs'));
    const t0 = performance.now();

    runLoudness(pcmLeft, pcmRight, sampleRate)
      .then((result) => {
        if (cachedFor !== key) return;
        series = result;
        perfStore.setPanelCompute('lufs', performance.now() - t0);
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

export const lufsStore = createStore();
