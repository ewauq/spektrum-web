import { tick, onDestroy } from 'svelte';
import { createMenuDrag } from './menu-drag';
import { useMenuBar } from './menu-bar';
import { focusItem } from './menu-support';

export function createMenuController(refs: {
  getContainer: () => HTMLElement | undefined;
  getTrigger: () => HTMLButtonElement | undefined;
  getMenu: () => HTMLElement | undefined;
}) {
  let open = $state(false);

  const drag = createMenuDrag({
    getContainer: refs.getContainer,
    isOpen: () => open,
    setOpen: (v) => (open = v)
  });

  const bar = useMenuBar({
    open: () => (open = true),
    close: () => (open = false),
    focusTrigger: () => refs.getTrigger()?.focus(),
    openAndFocus: async (at) => {
      open = true;
      await tick();
      focusItem(refs.getMenu(), at);
    }
  });

  onDestroy(() => bar.destroy());

  $effect(() => {
    if (open) bar.notifyOpened();
    else bar.notifyClosed();
  });

  async function openWithFocus(at: 'first' | 'last') {
    open = true;
    await tick();
    focusItem(refs.getMenu(), at);
  }

  function closeAndRestoreFocus() {
    open = false;
    refs.getTrigger()?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        openWithFocus('first');
      }
    } else if (e.key === 'ArrowUp') {
      if (!open) {
        e.preventDefault();
        openWithFocus('last');
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      bar.focusNeighbor('next', open);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      bar.focusNeighbor('prev', open);
    }
  }

  function onMenuKeyDown(e: KeyboardEvent) {
    const menu = refs.getMenu();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(menu, 'next');
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(menu, 'prev');
        break;
      case 'Home':
        e.preventDefault();
        focusItem(menu, 'first');
        break;
      case 'End':
        e.preventDefault();
        focusItem(menu, 'last');
        break;
      case 'Escape':
        e.preventDefault();
        closeAndRestoreFocus();
        break;
      case 'Tab':
        open = false;
        break;
      case 'ArrowRight':
        e.preventDefault();
        bar.focusNeighbor('next', true);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        bar.focusNeighbor('prev', true);
        break;
    }
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open) return;
    const container = refs.getContainer();
    if (!container) return;
    if (!container.contains(e.target as Node)) open = false;
  }

  $effect(() => {
    if (!open) return;
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  });

  return {
    get open() {
      return open;
    },
    close: () => (open = false),
    onTriggerPointerDown: drag.onPointerDown,
    onTriggerClick: drag.onKeyboardClick,
    onTriggerEnter: bar.onTriggerEnter,
    onTriggerKeyDown,
    onMenuKeyDown
  };
}
