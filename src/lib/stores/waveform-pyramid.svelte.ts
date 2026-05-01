import { type WaveformPyramid } from '$lib/dsp/waveform-pyramid';
import { runWavePyramid } from '$lib/dsp/dsp-client';
import { perfStore } from './perf.svelte';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';

function createWaveformPyramidStore() {
  let pyramid = $state<WaveformPyramid | null>(null);
  // Plain (non-reactive) flag mirroring `pyramid != null`. Reading
  // `pyramid` from the guard would subscribe whichever $effect calls
  // startBuild() to the very state we mutate inside the same call,
  // which trips the Svelte 5 "effect reads and writes the same state"
  // infinite-loop guard.
  let isBuilt = false;
  let pcmRef: Float32Array | null = null;
  let activeTaskId: number | null = null;

  async function startBuild(pcm: Float32Array): Promise<void> {
    if (pcmRef === pcm && isBuilt) return;
    if (activeTaskId !== null) {
      taskStore.end(activeTaskId);
      activeTaskId = null;
    }
    pcmRef = pcm;
    isBuilt = false;
    pyramid = null;
    const taskId = taskStore.start('wave_pyramid', t('tasks.wave_pyramid'));
    activeTaskId = taskId;
    const t0 = performance.now();
    try {
      const built = await runWavePyramid(pcm);
      // Another startBuild may have superseded us in the meantime.
      if (pcmRef !== pcm) return;
      perfStore.setWavePyramid(performance.now() - t0);
      let bytes = 0;
      for (const lv of built.levels) bytes += lv.byteLength;
      perfStore.setMemWavePyr(bytes);
      pyramid = built;
      isBuilt = true;
    } catch {
      // Worker disposed or fatal: leave state empty so the next
      // startBuild() retries cleanly.
      if (pcmRef === pcm) {
        pcmRef = null;
        isBuilt = false;
      }
    } finally {
      taskStore.end(taskId);
      if (activeTaskId === taskId) activeTaskId = null;
    }
  }

  function clear() {
    if (activeTaskId !== null) {
      taskStore.end(activeTaskId);
      activeTaskId = null;
    }
    pcmRef = null;
    isBuilt = false;
    pyramid = null;
  }

  return {
    get pyramid() {
      return pyramid;
    },
    /** True when the pyramid is built and tied to the given PCM buffer. */
    isReadyFor(pcm: Float32Array): boolean {
      return pcmRef === pcm && pyramid !== null;
    },
    startBuild,
    clear
  };
}

export const waveformPyramidStore = createWaveformPyramidStore();
