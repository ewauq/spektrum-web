/**
 * Hover-driven cursor data shared between the docked CursorBar and
 * the floating cursor tooltip. Both spectrogram and analysis panels
 * push into this store; the consumer (CursorBar / FloatingCursorInfo)
 * is selected at runtime by uiStore.cursorInfoMode.
 *
 * `bounds` is a viewport-coordinate DOMRect of the area the cursor is
 * over (eg the spectrogram canvas, or the panel's plot rect). The
 * floating tooltip clamps itself inside it so it never escapes the
 * graph it describes.
 */

export interface CursorInfoCell {
  label: string;
  value: string;
}

export interface CursorInfo {
  source: string;
  cells: CursorInfoCell[];
  clientX: number;
  clientY: number;
  bounds: DOMRect;
}

function createCursorInfoStore() {
  let info = $state<CursorInfo | null>(null);

  return {
    get info() {
      return info;
    },
    set(next: CursorInfo) {
      info = next;
    },
    clear(source?: string) {
      // When a source id is provided, only clear if it owns the
      // current entry — prevents a late pointerleave on source A
      // from wiping source B's hover after a fast cursor swap.
      if (source && info && info.source !== source) return;
      info = null;
    }
  };
}

export const cursorInfoStore = createCursorInfoStore();
