<script lang="ts">
  import {
    paletteGradientCss,
    frequencyToPaletteT,
  } from "$lib/render/waveform-palette";
  import type { WaveformPalette } from "$lib/stores/settings.svelte";

  let {
    palette,
    visible = true,
  }: {
    palette: WaveformPalette;
    visible?: boolean;
  } = $props();

  const TICKS = [100, 300, 1000, 3000, 8000];

  function tickLabel(hz: number): string {
    return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
  }

  const gradient = $derived(paletteGradientCss(palette, "to top"));
</script>

{#if visible}
  <div class="legend" aria-hidden="true">
    <div class="bar" style:background={gradient}></div>
    <div class="labels">
      {#each TICKS as hz (hz)}
        {@const pct = (1 - frequencyToPaletteT(hz)) * 100}
        <div class="tick" style:top="{pct}%">
          <span>{tickLabel(hz)}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .legend {
    position: relative;
    display: flex;
    gap: 0;
    padding: 0 0 0 12px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  .bar {
    width: 20px;
    height: 100%;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .labels {
    position: relative;
    flex: 1;
  }

  .tick {
    position: absolute;
    left: 6px;
    transform: translateY(-50%);
    font-size: var(--axis-label-size);
    font-family: var(--axis-label-font);
    color: var(--axis-label-color);
    pointer-events: none;
    white-space: nowrap;
  }

  .tick::before {
    content: "";
    position: absolute;
    left: -6px;
    top: 50%;
    width: 3px;
    height: 1px;
    background: rgba(139, 148, 181, 0.6);
  }
</style>
