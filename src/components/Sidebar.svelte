<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let {
    tabs,
    activeTab = $bindable('info'),
    disabled = false
  }: {
    tabs: { id: string; label: string; content: Snippet }[];
    activeTab?: string;
    disabled?: boolean;
  } = $props();

  const MIN_WIDTH = 240;
  const MAX_WIDTH = 720;
  const STORAGE_KEY = 'spektrum.sidebarWidth';

  let width = $state(320);
  let widthInitialized = false;

  $effect.pre(() => {
    if (widthInitialized) return;
    widthInitialized = true;
    if (typeof localStorage === 'undefined') return;
    const stored = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
    if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) {
      width = stored;
    }
  });

  const active = $derived(tabs.find((t) => t.id === activeTab));

  function onTabKeyDown(e: KeyboardEvent, index: number) {
    let target = -1;
    if (e.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = tabs.length - 1;
    if (target < 0) return;
    e.preventDefault();
    activeTab = tabs[target].id;
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        `#tab-${tabs[target].id}`
      );
      btn?.focus();
    });
  }

  let resizing = $state(false);
  let startX = 0;
  let startWidth = 0;

  function onResizeStart(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX = e.clientX;
    startWidth = width;
    resizing = true;
  }

  function onResizeMove(e: PointerEvent) {
    if (!resizing) return;
    const dx = startX - e.clientX;
    const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + dx));
    width = next;
  }

  function onResizeEnd(e: PointerEvent) {
    if (!resizing) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    resizing = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(width));
    }
  }
</script>

<aside class="sidebar" style:width="{width}px">
  <div
    class="resizer"
    class:active={resizing}
    role="separator"
    aria-orientation="vertical"
    aria-label={t('common.sidebar_resize')}
    onpointerdown={onResizeStart}
    onpointermove={onResizeMove}
    onpointerup={onResizeEnd}
    onpointercancel={onResizeEnd}
  ></div>
  <div class="tabs" role="tablist">
    {#each tabs as tab, i (tab.id)}
      <button
        class="tab"
        id="tab-{tab.id}"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="panel-{tab.id}"
        tabindex={activeTab === tab.id ? 0 : -1}
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
        onkeydown={(e) => onTabKeyDown(e, i)}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  {#if active}
    <div
      class="body"
      id="panel-{active.id}"
      role="tabpanel"
      aria-labelledby="tab-{active.id}"
      tabindex="0"
      class:disabled
    >
      {@render active.content()}
    </div>
  {/if}
</aside>

<style>
  .sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--c-surface);
    border-left: 1px solid var(--c-border);
    flex-shrink: 0;
  }

  .resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
    transition: background 0.1s;
  }

  .resizer:hover,
  .resizer.active {
    background: var(--c-accent);
    opacity: 0.5;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }

  .tab {
    position: relative;
    flex: 1;
    padding: var(--sp-sm) var(--sp-md);
    background: none;
    border: none;
    color: var(--c-text-muted);
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.1s ease;
  }

  .tab::after {
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

  .tab:hover {
    color: var(--c-text);
  }

  .tab.active {
    color: var(--c-text);
  }

  .tab.active::after {
    width: calc(100% - var(--sp-md) * 2);
  }

  .body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .body.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
</style>
