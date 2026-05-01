<script lang="ts">
  import type { ColorStop } from '$lib/colormap';
  import { t } from '$lib/i18n/index.svelte';
  import ColorInput from './ColorInput.svelte';

  let { stops, onchange }: {
    stops: ColorStop[];
    onchange: (stops: ColorStop[]) => void;
  } = $props();

  let track: HTMLDivElement | undefined = $state();
  let activeStop = $state<number | null>(null);

  function onStopKeyDown(i: number, e: KeyboardEvent) {
    const big = e.shiftKey;
    const stepPct = big ? 0.1 : 0.01;
    let delta = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -stepPct;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = stepPct;
    else if (e.key === "Home") {
      e.preventDefault();
      const next = [...stops];
      next[i] = { ...next[i], position: 0 };
      onchange(next);
      return;
    } else if (e.key === "End") {
      e.preventDefault();
      const next = [...stops];
      next[i] = { ...next[i], position: 1 };
      onchange(next);
      return;
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeStop(i);
      return;
    } else return;
    e.preventDefault();
    const next = [...stops];
    const newPos = Math.max(0, Math.min(1, next[i].position + delta));
    next[i] = { ...next[i], position: newPos };
    onchange(next);
  }

  function gradientCss(s: ColorStop[]): string {
    const sorted = [...s].sort((a, b) => a.position - b.position);
    return sorted.map((c) => `${c.color} ${(c.position * 100).toFixed(1)}%`).join(', ');
  }

  function pctFromEvent(e: PointerEvent): number {
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  function onStopPointerDown(i: number, e: PointerEvent) {
    e.stopPropagation();
    activeStop = i;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onStopPointerMove(e: PointerEvent) {
    if (activeStop === null) return;
    const next = [...stops];
    next[activeStop] = { ...next[activeStop], position: pctFromEvent(e) };
    onchange(next);
  }

  function onStopPointerUp(e: PointerEvent) {
    if (activeStop !== null) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      activeStop = null;
    }
  }

  function onTrackDoubleClick(e: MouseEvent) {
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const next = [...stops, { position: pos, color: '#888888' }];
    onchange(next);
  }

  function removeStop(i: number) {
    if (stops.length <= 2) return;
    const next = stops.filter((_, idx) => idx !== i);
    onchange(next);
  }

  function changeColor(i: number, color: string) {
    const next = [...stops];
    next[i] = { ...next[i], color };
    onchange(next);
  }
</script>

<div class="editor">
  <div
    class="track"
    role="img"
    aria-label={t('common.gradient_editor')}
    bind:this={track}
    style:background="linear-gradient(to right, {gradientCss(stops)})"
    ondblclick={onTrackDoubleClick}
  >
    {#each stops as stop, i (i)}
      <div
        class="stop"
        role="slider"
        aria-label={t('common.color_stop', { index: i })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(stop.position * 100)}
        tabindex="0"
        class:active={activeStop === i}
        style:left="{stop.position * 100}%"
        onpointerdown={(e) => onStopPointerDown(i, e)}
        onpointermove={onStopPointerMove}
        onpointerup={onStopPointerUp}
        onpointercancel={onStopPointerUp}
        onkeydown={(e) => onStopKeyDown(i, e)}
      >
        <div class="handle" style:background={stop.color}></div>
      </div>
    {/each}
  </div>
  <div class="stops-list">
    {#each stops.toSorted((a, b) => a.position - b.position) as stop, i (stop.position + stop.color)}
      {@const origIdx = stops.indexOf(stop)}
      <div class="stop-row">
        <ColorInput
          value={stop.color}
          onchange={(hex) => changeColor(origIdx, hex)}
        />
        <span class="pos">{Math.round(stop.position * 100)}%</span>
        <button
          class="remove"
          onclick={() => removeStop(origIdx)}
          disabled={stops.length <= 2}
          aria-label={t('common.delete')}
        >×</button>
      </div>
    {/each}
    <span class="hint">{t('common.gradient_hint')}</span>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .track {
    position: relative;
    height: 28px;
    border-radius: 4px;
    border: 1px solid #2a3145;
    cursor: crosshair;
    touch-action: none;
  }

  .stop {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    cursor: grab;
    touch-action: none;
  }

  .stop.active {
    cursor: grabbing;
    z-index: 1;
  }

  .stop:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
    border-radius: 50%;
  }

  .handle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    transform: translateY(50%);
    pointer-events: none;
  }

  .stops-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }

  .stop-row {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.3rem;
    background: #1a1f2e;
    border: 1px solid #2a3145;
    border-radius: 3px;
  }

  .pos {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
    color: #8b94b5;
    min-width: 2.5rem;
    text-align: right;
  }

  .remove {
    background: transparent;
    color: #8b94b5;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    padding: 0 0.2rem;
  }

  .remove:hover:not(:disabled) {
    color: #ff6b7a;
  }

  .remove:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .hint {
    font-size: 0.68rem;
    color: #6b7599;
    font-style: italic;
  }
</style>
