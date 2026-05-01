<script lang="ts">
  import { fade } from "svelte/transition";
  import type { Snippet } from "svelte";

  type SubTabIcon = Snippet | string;

  type SubTab = {
    id: string;
    label: string;
    icon?: SubTabIcon;
    content: Snippet;
  };

  let {
    tabs,
    activeTab = $bindable(""),
    persistKey,
  }: {
    tabs: SubTab[];
    activeTab?: string;
    persistKey?: string;
  } = $props();

  // Restore active tab from localStorage on first mount, then fall back
  // to the first tab if nothing was persisted.
  let initialized = false;
  $effect.pre(() => {
    if (initialized) return;
    initialized = true;
    if (typeof localStorage !== "undefined" && persistKey) {
      const stored = localStorage.getItem(persistKey);
      if (stored && tabs.some((t) => t.id === stored)) {
        activeTab = stored;
        return;
      }
    }
    if (!activeTab && tabs.length > 0) {
      activeTab = tabs[0].id;
    }
  });

  $effect(() => {
    if (typeof localStorage === "undefined" || !persistKey || !activeTab) {
      return;
    }
    localStorage.setItem(persistKey, activeTab);
  });

  const hasAnyIcon = $derived(tabs.some((t) => !!t.icon));
  const active = $derived(tabs.find((t) => t.id === activeTab));

  function focusAndScroll(id: string) {
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(`#subtab-${id}`);
      btn?.focus();
      btn?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function onKeyDown(e: KeyboardEvent, idx: number) {
    let target = -1;
    if (e.key === "ArrowLeft") target = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "ArrowRight") target = (idx + 1) % tabs.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = tabs.length - 1;
    if (target < 0) return;
    e.preventDefault();
    activeTab = tabs[target].id;
    focusAndScroll(tabs[target].id);
  }

  // Wheel + drag-to-scroll on the tabs bar (anticipating many subtabs).
  // We only engage pointer capture once the user has actually moved past a
  // small threshold, otherwise capturing on pointerdown would steal the
  // click event from the underlying tab button and break activation.
  const DRAG_THRESHOLD = 4;
  let scrollerEl = $state<HTMLDivElement | undefined>(undefined);
  let pendingPointerId: number | null = null;
  let dragging = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartScroll = 0;

  function onScrollerPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !scrollerEl) return;
    pendingPointerId = e.pointerId;
    dragging = false;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartScroll = scrollerEl.scrollLeft;
  }

  function onScrollerPointerMove(e: PointerEvent) {
    if (!scrollerEl) return;
    if (
      pendingPointerId === e.pointerId &&
      !dragging &&
      Math.abs(e.clientX - dragStartX) > DRAG_THRESHOLD
    ) {
      dragging = true;
      dragMoved = true;
      scrollerEl.setPointerCapture(e.pointerId);
    }
    if (dragging) {
      const dx = e.clientX - dragStartX;
      scrollerEl.scrollLeft = dragStartScroll - dx;
    }
  }

  function onScrollerPointerUp(e: PointerEvent) {
    if (pendingPointerId === e.pointerId) pendingPointerId = null;
    if (dragging && scrollerEl?.hasPointerCapture(e.pointerId)) {
      scrollerEl.releasePointerCapture(e.pointerId);
    }
    dragging = false;
  }

  function onScrollerClickCapture(e: MouseEvent) {
    // Swallow the click that immediately follows a real drag.
    if (dragMoved) {
      e.stopPropagation();
      e.preventDefault();
      dragMoved = false;
    }
  }

  function onScrollerWheel(e: WheelEvent) {
    if (!scrollerEl) return;
    // Convert vertical wheel to horizontal scroll.
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      scrollerEl.scrollLeft += e.deltaY;
    }
  }
</script>

<div class="subtabs-wrap" class:no-icons={!hasAnyIcon}>
  <div
    class="subtabs"
    bind:this={scrollerEl}
    role="tablist"
    tabindex="-1"
    aria-orientation="horizontal"
    onpointerdown={onScrollerPointerDown}
    onpointermove={onScrollerPointerMove}
    onpointerup={onScrollerPointerUp}
    onpointercancel={onScrollerPointerUp}
    onclickcapture={onScrollerClickCapture}
    onwheel={onScrollerWheel}
  >
    {#each tabs as tab, i (tab.id)}
      <button
        class="subtab"
        class:active={activeTab === tab.id}
        id="subtab-{tab.id}"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="subpanel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (activeTab = tab.id)}
        onkeydown={(e) => onKeyDown(e, i)}
      >
        <span class="subtab-icon" aria-hidden="true">
          {#if tab.icon && typeof tab.icon !== "string"}
            {@render tab.icon()}
          {/if}
        </span>
        <span class="subtab-label">{tab.label}</span>
      </button>
    {/each}
  </div>

  {#if active}
    {#key active.id}
      <div
        class="subpanel"
        id="subpanel-{active.id}"
        role="tabpanel"
        aria-labelledby="subtab-{active.id}"
        tabindex="0"
        in:fade={{ duration: 80 }}
      >
        {@render active.content()}
      </div>
    {/key}
  {/if}
</div>

<style>
  .subtabs-wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .subtabs {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md) 0;
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    cursor: grab;
    touch-action: pan-x;
  }

  .subtabs::-webkit-scrollbar {
    display: none;
  }

  .subtabs:active {
    cursor: grabbing;
  }

  .subtab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--sp-sm) var(--sp-md);
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
    border-radius: var(--r-sm) var(--r-sm) 0 0;
    transition:
      color 0.1s ease,
      background 0.1s ease;
  }

  .subtab::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -1px;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--c-accent);
    border-radius: 1px;
    transition: width 0.12s ease;
  }

  .subtab:hover {
    color: var(--c-text);
  }

  .subtab.active {
    color: var(--c-text);
  }

  .subtab.active::after {
    width: calc(100% - var(--sp-md) * 2);
  }

  .subtab:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: -2px;
  }

  .subtab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .subtab-label {
    white-space: nowrap;
  }

  .no-icons .subtab-icon {
    display: none;
  }

  .subpanel {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .subpanel:focus-visible {
    outline: none;
  }
</style>
