import { runTempogram } from '$lib/dsp/dsp-client';
import type { TempogramResult } from '$lib/dsp/tempogram';
import type { OnsetData } from '$lib/dsp/onsets';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';
import { perfStore } from './perf.svelte';

/**
 * Tempogram cached by the identity of the OnsetData it is derived
 * from. The onset envelope already encapsulates the STFT, sensitivity
 * and band the user picked, so a single dependency is enough.
 */
function createTempogramStore() {
  let result = $state<TempogramResult | null>(null);
  let cachedFor: OnsetData | null = null;

  function ensure(onsets: OnsetData): void {
    if (cachedFor === onsets) return;
    cachedFor = onsets;
    result = null;
    const taskId = taskStore.start('tempogram', t('tasks.tempogram'));
    const t0 = performance.now();

    runTempogram(onsets)
      .then((r) => {
        if (cachedFor !== onsets) return;
        result = r;
        perfStore.setPanelCompute('tempogram', performance.now() - t0);
      })
      .catch(() => {
        if (cachedFor === onsets) cachedFor = null;
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

export const tempogramStore = createTempogramStore();
