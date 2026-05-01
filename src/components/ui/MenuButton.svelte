<script lang="ts">
  import type { Snippet } from "svelte";
  import { createMenuController } from "$lib/menu-controller.svelte";

  let {
    id,
    label,
    minWidth = 180,
    triggerEl = $bindable(),
    items,
  }: {
    id: string;
    label: string;
    minWidth?: number;
    triggerEl?: HTMLButtonElement;
    items: Snippet<[{ close: () => void }]>;
  } = $props();

  let containerEl = $state<HTMLDivElement | undefined>(undefined);
  let menuEl = $state<HTMLDivElement | undefined>(undefined);

  const m = createMenuController({
    getContainer: () => containerEl,
    getTrigger: () => triggerEl,
    getMenu: () => menuEl,
  });

  function close() {
    m.close();
    triggerEl?.focus();
  }
</script>

<div class="menu-root" bind:this={containerEl}>
  <button
    bind:this={triggerEl}
    class="trigger"
    class:active={m.open}
    onpointerdown={m.onTriggerPointerDown}
    onclick={m.onTriggerClick}
    onpointerenter={m.onTriggerEnter}
    onkeydown={m.onTriggerKeyDown}
    role="menuitem"
    aria-haspopup="menu"
    aria-expanded={m.open}
    aria-controls="{id}-dropdown"
  >
    <span>{label}</span>
  </button>

  {#if m.open}
    <div
      id="{id}-dropdown"
      bind:this={menuEl}
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label={label}
      style:min-width="{minWidth}px"
      onkeydown={m.onMenuKeyDown}
    >
      {@render items({ close })}
    </div>
  {/if}
</div>

<style>
  .menu-root {
    position: relative;
    display: flex;
    align-items: center;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 10px;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    cursor: pointer;
    border-radius: var(--r-sm);
    font-family: inherit;
    font-size: var(--fs-menu-trigger);
  }

  .trigger:hover,
  .trigger.active {
    color: var(--c-text);
    background: var(--c-border);
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 40;
    padding: 4px;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    transform-origin: top left;
    animation: menu-in 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Item primitives shared by all menus. */
  .menu :global(.menu-item) {
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

  .menu :global(.menu-item.checked-row) {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    gap: 4px;
  }

  .menu :global(.menu-item:hover:not(:disabled)),
  .menu :global(.menu-item:focus:not(:disabled)) {
    background: var(--c-border);
    outline: none;
  }

  .menu :global(.menu-item:disabled) {
    opacity: 0.4;
    cursor: default;
  }

  .menu :global(.menu-separator) {
    height: 1px;
    background: var(--c-border);
    margin: 4px 0;
  }

  .menu :global(.menu-check) {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-accent);
  }

  .menu :global(.menu-shortcut) {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: 13px;
    padding-left: 12px;
  }
</style>
