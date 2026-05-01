<script lang="ts">
  export type ContextMenuItem = {
    label: string;
    onSelect: () => void;
    disabled?: boolean;
  };

  let {
    x,
    y,
    items,
    onClose,
  }: {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
  } = $props();

  let menuEl: HTMLDivElement | undefined = $state(undefined);

  // Clamp to viewport once the menu is mounted and measured.
  let pos = $state({ left: 0, top: 0 });

  $effect(() => {
    if (!menuEl) return;
    const rect = menuEl.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 4) {
      left = window.innerWidth - rect.width - 4;
    }
    if (top + rect.height > window.innerHeight - 4) {
      top = window.innerHeight - rect.height - 4;
    }
    pos = { left: Math.max(4, left), top: Math.max(4, top) };
    const first =
      menuEl.querySelector<HTMLButtonElement>(".item:not(:disabled)");
    first?.focus();
  });

  function onDocPointerDown(e: PointerEvent) {
    if (!menuEl) return;
    if (!menuEl.contains(e.target as Node)) onClose();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!menuEl) return;
    const buttons = Array.from(
      menuEl.querySelectorAll<HTMLButtonElement>(".item:not(:disabled)"),
    );
    if (buttons.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? buttons.indexOf(active) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(idx + 1 + buttons.length) % buttons.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      buttons[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      buttons[buttons.length - 1].focus();
    }
  }

  $effect(() => {
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  function pick(item: ContextMenuItem) {
    if (item.disabled) return;
    onClose();
    item.onSelect();
  }
</script>

<div
  class="ctx-menu"
  bind:this={menuEl}
  role="menu"
  tabindex="-1"
  style:left="{pos.left}px"
  style:top="{pos.top}px"
>
  {#each items as item (item.label)}
    <button
      class="item"
      role="menuitem"
      disabled={item.disabled}
      onclick={() => pick(item)}
    >
      {item.label}
    </button>
  {/each}
</div>

<style>
  .ctx-menu {
    position: fixed;
    z-index: 100001;
    min-width: 180px;
    padding: 4px;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    animation: ctx-in 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ctx-menu:focus-visible {
    outline: none;
  }

  @keyframes ctx-in {
    from {
      opacity: 0;
      transform: translateY(-3px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .item {
    display: block;
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: none;
    color: var(--c-text);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--fs-menu-item);
    border-radius: var(--r-sm);
  }

  .item:hover:not(:disabled),
  .item:focus:not(:disabled) {
    background: var(--c-border);
    outline: none;
  }

  .item:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
