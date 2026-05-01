import { runChromagram } from '$lib/dsp/dsp-client';
import type { ChromagramResult } from '$lib/dsp/chromagram';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const chromagramStore = createCachedStftStore<ChromagramResult>({
  taskKind: 'chromagram',
  taskLabelKey: 'tasks.chromagram',
  runner: runChromagram,
  perfPanelId: 'chromagram'
});
