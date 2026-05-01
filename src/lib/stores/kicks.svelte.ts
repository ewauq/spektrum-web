import type { OnsetData } from '$lib/dsp/onsets';
import { runOnsets } from '$lib/dsp/dsp-client';
import { createCachedStftStore } from './cached-stft-store.svelte';

// Kick band: 40 Hz floor catches the lowest usable sub-bass; 150 Hz
// ceiling stays under the body of snares so claps and rimshots do not
// register as kicks.
const KICK_BAND_HZ: [number, number] = [40, 150];

export const kicksStore = createCachedStftStore<OnsetData>({
  taskKind: 'kicks',
  taskLabelKey: 'tasks.kicks',
  runner: (stft) => runOnsets(stft, { band: KICK_BAND_HZ })
});
