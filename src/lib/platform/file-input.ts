import { registerFile } from './file-registry';

const ACCEPT = '.flac,.mp3,audio/flac,audio/mpeg';

// The File API has no reliable cancel event. We resolve null on the
// next focus tick after `change` failed to fire — best-effort, will
// briefly delay a successful pick by 250 ms before the listener
// rejects via `settled`.
export function pickAudioFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.style.display = 'none';
    let settled = false;
    const settle = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      settle(file ? registerFile(file) : null);
      input.remove();
    });
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => settle(null), 250);
      },
      { once: true }
    );
    document.body.appendChild(input);
    input.click();
  });
}

export function attachDragDrop(
  el: HTMLElement,
  onFile: (handle: string) => void
): () => void {
  function isAccepted(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.flac') || name.endsWith('.mp3');
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = Array.from(files).find(isAccepted);
    if (!file) return;
    onFile(registerFile(file));
  }

  el.addEventListener('dragover', onDragOver);
  el.addEventListener('drop', onDrop);
  return () => {
    el.removeEventListener('dragover', onDragOver);
    el.removeEventListener('drop', onDrop);
  };
}
