import { runBark } from '$lib/dsp/dsp-client';
import type { BarkResult } from '$lib/dsp/bark';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const barkStore = createCachedStftStore<BarkResult>({
  taskKind: 'bark',
  taskLabelKey: 'tasks.bark',
  runner: runBark,
  perfPanelId: 'bark'
});
