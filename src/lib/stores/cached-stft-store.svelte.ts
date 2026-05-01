import type { StftResult } from '$lib/dsp/stft';
import { t } from '$lib/i18n/index.svelte';
import { taskStore, type TaskKind } from './tasks.svelte';
import { perfStore } from './perf.svelte';
import { debugError } from '$lib/debug/log';

/**
 * Result of any computation derived from an STFT and cached by reference
 * (no time-window slicing — consumers filter to the visible range at
 * draw time). Used by onsets, kicks, centroid, and any future analysis
 * that follows the same compute-once-per-STFT pattern.
 */
export interface CachedStftStore<T> {
  readonly data: T | null;
  ensure(stft: StftResult): void;
  clear(): void;
}

interface CachedStftStoreConfig<T> {
  taskKind: TaskKind;
  taskLabelKey: string;
  runner: (stft: StftResult) => Promise<T>;
  /**
   * Optional panel id to publish the compute timing to perfStore.
   * Lets the inline `compute + render` readout pick it up without
   * each consumer wiring it manually.
   */
  perfPanelId?: string;
}

export function createCachedStftStore<T>(
  config: CachedStftStoreConfig<T>
): CachedStftStore<T> {
  let data = $state<T | null>(null);
  let cachedFor: StftResult | null = null;

  function ensure(stft: StftResult): void {
    if (cachedFor === stft) return;
    cachedFor = stft;
    data = null;
    const taskId = taskStore.start(config.taskKind, t(config.taskLabelKey));
    const t0 = performance.now();

    config
      .runner(stft)
      .then((result) => {
        if (cachedFor !== stft) return;
        data = result;
        if (config.perfPanelId) {
          perfStore.setPanelCompute(
            config.perfPanelId,
            performance.now() - t0
          );
        }
      })
      .catch((err) => {
        if (cachedFor === stft) cachedFor = null;
        debugError('analysis', 'cached stft computation failed', {
          taskKind: config.taskKind,
          panelId: config.perfPanelId,
          error: err instanceof Error ? err.message : String(err)
        });
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
