import { runCentroid } from '$lib/dsp/dsp-client';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const centroidStore = createCachedStftStore<Float32Array>({
  taskKind: 'centroid',
  taskLabelKey: 'tasks.centroid',
  runner: runCentroid,
  perfPanelId: 'centroid'
});
