export type MenuHandle = {
  open: () => void;
  close: () => void;
  focusTrigger: () => void;
  openAndFocus: (at: 'first' | 'last') => void;
};

const handles: MenuHandle[] = [];
let current: MenuHandle | null = null;

export function useMenuBar(handle: MenuHandle) {
  handles.push(handle);

  return {
    notifyOpened() {
      if (current && current !== handle) current.close();
      current = handle;
    },
    notifyClosed() {
      if (current === handle) current = null;
    },
    onTriggerEnter() {
      if (current && current !== handle) {
        current.close();
        handle.open();
        current = handle;
      }
    },
    focusNeighbor(direction: 'next' | 'prev', reopenIfOpen: boolean) {
      const idx = handles.indexOf(handle);
      if (idx < 0 || handles.length <= 1) return;
      const delta = direction === 'next' ? 1 : -1;
      const neighbor = handles[(idx + delta + handles.length) % handles.length];
      const wasOpen = reopenIfOpen && current === handle;
      if (wasOpen) {
        handle.close();
        neighbor.openAndFocus('first');
        current = neighbor;
      } else {
        neighbor.focusTrigger();
      }
    },
    destroy() {
      const idx = handles.indexOf(handle);
      if (idx >= 0) handles.splice(idx, 1);
      if (current === handle) current = null;
    }
  };
}
