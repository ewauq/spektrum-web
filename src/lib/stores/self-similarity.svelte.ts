import { runSelfSimilarity } from '$lib/dsp/dsp-client';
import type { SelfSimilarityResult } from '$lib/dsp/self-similarity';
import { createCachedStftStore } from './cached-stft-store.svelte';

export const selfSimilarityStore =
  createCachedStftStore<SelfSimilarityResult>({
    taskKind: 'self_similarity',
    taskLabelKey: 'tasks.self_similarity',
    runner: (stft) => runSelfSimilarity(stft),
    perfPanelId: 'self_similarity'
  });
