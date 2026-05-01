import type { DecodedAudio } from '$lib/audio/decode';
import { decodeFile } from '$lib/audio/decode';
import { fileName } from '$lib/path';
import { t } from '$lib/i18n/index.svelte';
import { taskStore } from './tasks.svelte';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; path: string }
  | { kind: 'ready'; audio: DecodedAudio }
  | { kind: 'error'; message: string; path: string };

function createAudioStore() {
  let status = $state<Status>({ kind: 'idle' });

  return {
    get status() {
      return status;
    },
    async load(path: string) {
      status = { kind: 'loading', path };
      const taskId = taskStore.start(
        'decode',
        t('tasks.decode_file', { name: fileName(path) })
      );
      try {
        const audio = await decodeFile(path);
        status = { kind: 'ready', audio };
      } catch (err) {
        status = {
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
          path
        };
      } finally {
        taskStore.end(taskId);
      }
    },
    reset() {
      status = { kind: 'idle' };
    }
  };
}

export const audioStore = createAudioStore();
