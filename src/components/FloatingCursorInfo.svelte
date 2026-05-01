<script lang="ts">
  import { cursorInfoStore } from "$lib/stores/cursor-info.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { t } from "$lib/i18n/index.svelte";

  const OFFSET = 14;
  const PADDING = 6;

  let tipEl: HTMLDivElement | undefined = $state();
  let tipWidth = $state(0);
  let tipHeight = $state(0);

  const visible = $derived(
    uiStore.cursorInfoMode === "follow" && cursorInfoStore.info !== null,
  );

  // Compute the on-screen position of the tooltip. Default placement is
  // below the cursor; when the bottom edge of the host bounds is too
  // close, flip above. Horizontal placement is clamped to the bounds so
  // the tooltip never escapes the graph it describes.
  const placement = $derived.by(() => {
    const info = cursorInfoStore.info;
    if (!info || !visible) return null;
    const w = tipWidth || 0;
    const h = tipHeight || 0;
    const b = info.bounds;
    const minLeft = b.left + PADDING;
    const maxLeft = b.right - w - PADDING;
    let left = info.clientX - w / 2;
    if (Number.isFinite(maxLeft) && maxLeft > minLeft) {
      left = Math.max(minLeft, Math.min(maxLeft, left));
    } else {
      left = minLeft;
    }
    let top = info.clientY + OFFSET;
    if (top + h + PADDING > b.bottom) {
      top = info.clientY - h - OFFSET;
    }
    if (top < b.top + PADDING) top = b.top + PADDING;
    return { left, top };
  });

  $effect(() => {
    if (!tipEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      tipWidth = r.width;
      tipHeight = r.height;
    });
    ro.observe(tipEl);
    return () => ro.disconnect();
  });
</script>

{#if visible && cursorInfoStore.info}
  <div
    bind:this={tipEl}
    class="floating"
    class:measuring={tipWidth === 0}
    style:left={placement ? `${Math.round(placement.left)}px` : "-9999px"}
    style:top={placement ? `${Math.round(placement.top)}px` : "-9999px"}
    role="tooltip"
    aria-label={t("info.cursor_section")}
  >
    {#each cursorInfoStore.info.cells as cell, i (i)}
      <div class="cell">
        <span class="label">{cell.label}</span>
        <span class="value mono" class:dim={cell.value === "-"}>
          {cell.value}
        </span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .floating {
    position: fixed;
    z-index: 150;
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 4px 12px;
    padding: 8px 12px;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
  }

  .floating.measuring {
    visibility: hidden;
  }

  .cell {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .value {
    color: var(--c-text);
    font-size: var(--fs-md);
  }

  .value.mono {
    font-family: var(--font-mono);
  }

  .value.dim {
    color: var(--c-text-dim);
  }
</style>
