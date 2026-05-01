import { runNovelty } from '$lib/dsp/dsp-client';
import type { SelfSimilarityResult } from '$lib/dsp/self-similarity';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

/**
 * Novelty curve derived from the self-similarity matrix. Cached by
 * the identity of the parent SelfSimilarityResult: switching tracks
 * invalidates both the matrix and the curve.
 */
function createNoveltyStore() {
  let novelty = $state<Float32Array | null>(null);
  let cachedFor: SelfSimilarityResult | null = null;

  function ensure(similarity: SelfSimilarityResult): void {
    if (cachedFor === similarity) return;
    cachedFor = similarity;
    novelty = null;
    const taskId = taskStore.start('novelty', t('tasks.novelty'));
    const t0 = performance.now();

    runNovelty(similarity)
      .then((result) => {
        if (cachedFor !== similarity) return;
        novelty = result;
        perfStore.setPanelCompute('novelty', performance.now() - t0);
      })
      .catch(() => {
        if (cachedFor === similarity) cachedFor = null;
      })
      .finally(() => {
        taskStore.end(taskId);
      });
  }

  function clear(): void {
    cachedFor = null;
    novelty = null;
  }

  return {
    get novelty() {
      return novelty;
    },
    ensure,
    clear
  };
}

export const noveltyStore = createNoveltyStore();
