<script lang="ts">
  import type { Snippet } from "svelte";
  import { dragState } from "$lib/stores/drag.svelte";
  import { t } from "$lib/i18n/index.svelte";

  let {
    title,
    persistKey,
    draggableId,
    onReorder,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    open = $bindable(true),
    children,
  }: {
    title: string;
    persistKey?: string;
    draggableId?: string;
    onReorder?: (fromId: string, toId: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    open?: boolean;
    children: Snippet;
  } = $props();

  let loaded = false;
  $effect(() => {
    if (typeof localStorage === "undefined" || !persistKey) return;
    if (!loaded) {
      loaded = true;
      const stored = localStorage.getItem(`spektrum.section.${persistKey}`);
      if (stored === "0") open = false;
      else if (stored === "1") open = true;
      return;
    }
    localStorage.setItem(`spektrum.section.${persistKey}`, open ? "1" : "0");
  });

  let sectionEl: HTMLDivElement | undefined = $state();

  const isDragging = $derived(!!draggableId && dragState.draggingId === draggableId);
  const isHovered = $derived(
    !!draggableId &&
      dragState.draggingId !== null &&
      dragState.draggingId !== draggableId &&
      dragState.hoveredId === draggableId
  );

  let downX = 0;
  let downY = 0;
  let tracking = false;
  let activated = false;

  function updateHover(x: number, y: number) {
    const el = document.elementFromPoint(x, y);
    const section = el?.closest("[data-section-id]") as HTMLElement | null;
    const id = section?.getAttribute("data-section-id") ?? null;
    if (id !== draggableId) {
      dragState.setHover(id);
    } else {
      dragState.setHover(null);
    }
  }

  function onHeaderPointerDown(e: PointerEvent) {
    if (!draggableId || e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    tracking = true;
    activated = false;
    document.addEventListener("pointermove", onGlobalPointerMove);
    document.addEventListener("pointerup", onGlobalPointerUp);
    document.addEventListener("pointercancel", onGlobalPointerUp);
  }

  function onGlobalPointerMove(e: PointerEvent) {
    if (!tracking || !draggableId) return;
    if (!activated) {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) < 4) return;
      activated = true;
      dragState.start(draggableId);
    }
    updateHover(e.clientX, e.clientY);
  }

  function onGlobalPointerUp(e: PointerEvent) {
    document.removeEventListener("pointermove", onGlobalPointerMove);
    document.removeEventListener("pointerup", onGlobalPointerUp);
    document.removeEventListener("pointercancel", onGlobalPointerUp);
    if (!tracking) return;
    const wasActivated = activated;
    tracking = false;
    activated = false;
    if (wasActivated) {
      updateHover(e.clientX, e.clientY);
      const { source, target } = dragState.end();
      if (source && target && source !== target) {
        onReorder?.(source, target);
      }
    }
  }

  function onHeaderClick(e: MouseEvent) {
    if (activated) {
      e.preventDefault();
      return;
    }
    open = !open;
  }
</script>

<div
  class="section"
  class:drag-over={isHovered}
  class:dragging={isDragging}
  bind:this={sectionEl}
  data-section-id={draggableId}
  role="presentation"
>
  <div class="header-row">
    <button
      class="header"
      class:draggable={!!draggableId}
      aria-expanded={open}
      onclick={onHeaderClick}
      onpointerdown={onHeaderPointerDown}
    >
      <svg
        class="chevron"
        class:open
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <polyline points="4,2 8,6 4,10" />
      </svg>
      <span>{title}</span>
    </button>
    {#if onMoveUp || onMoveDown}
      <div class="reorder-keys">
        <button
          class="reorder"
          onclick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={t("common.move_up")}
          title={t("common.move_up")}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,7 6,4 9,7"/></svg>
        </button>
        <button
          class="reorder"
          onclick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={t("common.move_down")}
          title={t("common.move_down")}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 6,8 9,5"/></svg>
        </button>
      </div>
    {/if}
  </div>
  {#if open}
    <div class="body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .section {
    border-bottom: 1px solid var(--c-border);
    transition: background 0.1s;
  }

  .section.drag-over {
    background: color-mix(in srgb, var(--c-accent) 12%, transparent);
    box-shadow: inset 0 2px 0 var(--c-accent);
  }

  .section.dragging {
    opacity: 0.5;
  }

  .header.draggable {
    cursor: grab;
  }

  .header.draggable:active {
    cursor: grabbing;
  }

  .header-row {
    display: flex;
    align-items: stretch;
  }

  .header-row:hover .reorder-keys,
  .header-row:focus-within .reorder-keys {
    opacity: 1;
  }

  .header {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-sm) var(--sp-md);
    background: none;
    border: none;
    color: var(--c-text);
    font-size: var(--fs-sm);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
  }

  .header:hover {
    background: var(--c-surface-raised);
  }

  .reorder-keys {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 6px;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .reorder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    color: var(--c-text-muted);
    cursor: pointer;
  }

  .reorder:hover:not(:disabled) {
    background: var(--c-border);
    color: var(--c-text);
  }

  .reorder:focus-visible {
    outline: 1px solid var(--c-accent);
    outline-offset: 1px;
  }

  .reorder:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .chevron {
    color: var(--c-text-muted);
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding: 0 var(--sp-lg) var(--sp-lg);
  }
</style>
