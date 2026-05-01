import { runHpss } from '$lib/dsp/dsp-client';
import type { HpssResult } from '$lib/dsp/hpss';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const hpssStore = createCachedStftStore<HpssResult>({
  taskKind: 'hpss',
  taskLabelKey: 'tasks.hpss',
  runner: (stft) => runHpss(stft),
  perfPanelId: 'hpss'
});
