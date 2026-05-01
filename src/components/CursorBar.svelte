<script lang="ts">
  import type { DecodedAudio } from "$lib/audio/decode";
  import { t } from "$lib/i18n/index.svelte";
  import {
    cursorInfoStore,
    type CursorInfoCell,
  } from "$lib/stores/cursor-info.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";

  let {
    audio,
  }: {
    audio: DecodedAudio | null;
  } = $props();

  const PLACEHOLDER: CursorInfoCell[] = [
    { label: t("info.cursor_time"), value: "-" },
    { label: t("info.cursor_freq"), value: "-" },
    { label: t("info.cursor_energy"), value: "-" },
    { label: t("info.cursor_note"), value: "-" },
  ];

  const cells = $derived.by((): CursorInfoCell[] => {
    return cursorInfoStore.info?.cells ?? PLACEHOLDER;
  });
</script>

{#if audio && uiStore.cursorInfoMode === "dock"}
  <section class="cursor-bar" aria-label={t("info.cursor_section")}>
    {#each cells as cell, i (i)}
      <div class="cell">
        <span class="label">{cell.label}</span>
        <span class="value mono" class:dim={cell.value === "-"}>
          {cell.value}
        </span>
      </div>
    {/each}
  </section>
{/if}

<style>
  .cursor-bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-xs) var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--c-surface-raised);
    border-bottom: 1px solid var(--c-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    container-type: inline-size;
  }

  @container (min-width: 360px) {
    .cursor-bar {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    text-align: center;
  }

  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .value {
    color: var(--c-text);
    font-size: var(--fs-md);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .value.mono {
    font-family: var(--font-mono);
  }

  .value.dim {
    color: var(--c-text-dim);
  }
</style>
