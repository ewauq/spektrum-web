import { runSpectralEntropy } from '$lib/dsp/dsp-client';
import type { SpectralEntropyResult } from '$lib/dsp/spectral-entropy';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const spectralEntropyStore = createCachedStftStore<SpectralEntropyResult>(
  {
    taskKind: 'entropy',
    taskLabelKey: 'tasks.entropy',
    runner: runSpectralEntropy,
    perfPanelId: 'entropy'
  }
);
