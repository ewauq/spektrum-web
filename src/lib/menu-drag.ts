export function createMenuDrag(options: {
  getContainer: () => HTMLElement | undefined;
  isOpen: () => boolean;
  setOpen: (value: boolean) => void;
}) {
  let pressX = 0;
  let pressY = 0;
  let dragActive = false;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if (options.isOpen()) {
      options.setOpen(false);
      return;
    }
    options.setOpen(true);
    dragActive = true;
    pressX = e.clientX;
    pressY = e.clientY;
    window.addEventListener('pointerup', onGlobalPointerUp);
  }

  function onGlobalPointerUp(e: PointerEvent) {
    window.removeEventListener('pointerup', onGlobalPointerUp);
    if (!dragActive) return;
    dragActive = false;

    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const container = options.getContainer();
    const item = under?.closest<HTMLButtonElement>('.menu-item');
    if (item && container?.contains(item) && !item.disabled) {
      item.click();
      return;
    }

    const dist = Math.hypot(e.clientX - pressX, e.clientY - pressY);
    const trigger = under?.closest('.trigger');
    if (dist < 5 && trigger && container?.contains(trigger as Node)) {
      return;
    }

    options.setOpen(false);
  }

  function onKeyboardClick(e: MouseEvent) {
    if (e.detail !== 0) return;
    options.setOpen(!options.isOpen());
  }

  return { onPointerDown, onKeyboardClick };
}
