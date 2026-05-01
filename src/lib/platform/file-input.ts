/**
 * File picker + drag-drop helpers for the web shell. Both paths
 * funnel into the file-registry so the rest of the app keeps believing
 * it works with paths/handles.
 */

import { registerFile } from './file-registry';

const ACCEPT = '.flac,.mp3,audio/flac,audio/mpeg';

/**
 * Open the native browser file picker. Resolves with the registry
 * handle (the file's name) or null if the user cancelled.
 * The Promise stays unresolved indefinitely if the user closes the
 * dialog without picking — there is no reliable cancel event in the
 * File API, so callers should be ready for that. We mitigate by
 * resolving null on the next focus event after `change` fires
 * without files (best-effort cancel detection).
 */
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
    // Best-effort cancel detection: the focus event fires when the OS
    // dialog closes. If `change` hasn't fired by the next tick, treat
    // it as cancel.
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

/**
 * Wire drag-and-drop on the given element. Filters by accepted
 * extensions (.flac, .mp3) and registers the dropped file, then
 * invokes the callback with the handle. Returns a teardown function.
 */
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
