<script lang="ts">
  import { renderStore } from "$lib/stores/render.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Section from "./ui/Section.svelte";

  let {
    draggableId,
    onReorder,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
  }: {
    draggableId?: string;
    onReorder?: (from: string, to: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  } = $props();

  const MIN = -140;
  const MAX = 0;
  const TICKS = [-140, -120, -100, -80, -60, -40, -20, 0];

  let track: HTMLDivElement | undefined = $state();
  let activeThumb = $state<"floor" | "ceiling" | null>(null);

  function adjustWithKey(thumb: "floor" | "ceiling", e: KeyboardEvent) {
    const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
    const stepSize = big ? 10 : 1;
    let delta = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown")
      delta = -stepSize;
    else if (
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "PageUp"
    )
      delta = stepSize;
    else if (e.key === "Home") {
      e.preventDefault();
      if (thumb === "floor") renderStore.setFloor(MIN);
      else renderStore.setCeiling(MIN);
      return;
    } else if (e.key === "End") {
      e.preventDefault();
      if (thumb === "floor") renderStore.setFloor(MAX);
      else renderStore.setCeiling(MAX);
      return;
    } else return;
    e.preventDefault();
    const current =
      thumb === "floor" ? renderStore.dbFloor : renderStore.dbCeiling;
    const next = Math.max(MIN, Math.min(MAX, current + delta));
    if (thumb === "floor") renderStore.setFloor(next);
    else renderStore.setCeiling(next);
  }

  let draftFloor = $state(String(renderStore.dbFloor));
  let draftCeiling = $state(String(renderStore.dbCeiling));

  $effect(() => {
    draftFloor = String(renderStore.dbFloor);
  });
  $effect(() => {
    draftCeiling = String(renderStore.dbCeiling);
  });

  const floorPct = $derived(((renderStore.dbFloor - MIN) / (MAX - MIN)) * 100);
  const ceilingPct = $derived(
    ((renderStore.dbCeiling - MIN) / (MAX - MIN)) * 100,
  );

  function pctToValue(pct: number): number {
    return Math.round(MIN + (pct / 100) * (MAX - MIN));
  }

  function pctFromEvent(e: PointerEvent): number {
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
    );
  }

  function updateFromPct(thumb: "floor" | "ceiling", pct: number) {
    const v = pctToValue(pct);
    if (thumb === "floor") renderStore.setFloor(v);
    else renderStore.setCeiling(v);
  }

  function onTrackPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !track) return;
    const pct = pctFromEvent(e);
    const distFloor = Math.abs(pct - floorPct);
    const distCeiling = Math.abs(pct - ceilingPct);
    activeThumb = distFloor < distCeiling ? "floor" : "ceiling";
    track.setPointerCapture(e.pointerId);
    updateFromPct(activeThumb, pct);
  }

  function onTrackPointerMove(e: PointerEvent) {
    if (!activeThumb) return;
    updateFromPct(activeThumb, pctFromEvent(e));
  }

  function onTrackPointerUp(e: PointerEvent) {
    if (!activeThumb || !track) return;
    track.releasePointerCapture(e.pointerId);
    activeThumb = null;
  }

  function commitFloor(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(v)) renderStore.setFloor(v);
    (e.currentTarget as HTMLInputElement).blur();
  }

  function commitCeiling(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(v)) renderStore.setCeiling(v);
    (e.currentTarget as HTMLInputElement).blur();
  }
</script>

<Section
  title={t("render.title")}
  persistKey="render_sensitivity"
  {draggableId}
  {onReorder}
  {onMoveUp}
  {onMoveDown}
  {canMoveUp}
  {canMoveDown}
>
  <div class="inputs">
    <label>
      <span>{t("render.floor")}</span>
      <div class="numeric">
        <input
          type="number"
          min={MIN}
          max={MAX}
          step="1"
          bind:value={draftFloor}
          onkeydown={commitFloor}
        />
        <span class="unit">{t("unit.db")}</span>
      </div>
    </label>
    <label>
      <span>{t("render.ceiling")}</span>
      <div class="numeric">
        <input
          type="number"
          min={MIN}
          max={MAX}
          step="1"
          bind:value={draftCeiling}
          onkeydown={commitCeiling}
        />
        <span class="unit">{t("unit.db")}</span>
      </div>
    </label>
    <button
      class="reset"
      onclick={() => renderStore.reset()}
      aria-label={t("render.reset")}
      title={t("render.reset")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  </div>

  <div
    class="track"
    bind:this={track}
    role="group"
    aria-label={t("render.db_range")}
    onpointerdown={onTrackPointerDown}
    onpointermove={onTrackPointerMove}
    onpointerup={onTrackPointerUp}
    onpointercancel={onTrackPointerUp}
  >
    <div class="rail"></div>
    <div
      class="fill"
      style:left="{floorPct}%"
      style:width="{ceilingPct - floorPct}%"
    ></div>
    {#each TICKS as t (t)}
      {@const p = ((t - MIN) / (MAX - MIN)) * 100}
      {@const isEdge = t === MIN || t === MAX}
      <div class="tick" class:no-line={isEdge} style:left="{p}%">
        <span class="tick-label">{t}</span>
      </div>
    {/each}
    <div
      class="thumb floor"
      class:active={activeThumb === "floor"}
      style:left="{floorPct}%"
      role="slider"
      aria-label={t("render.floor")}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={renderStore.dbFloor}
      tabindex="0"
      onkeydown={(e) => adjustWithKey("floor", e)}
    >
      <span class="thumb-label">{renderStore.dbFloor}</span>
    </div>
    <div
      class="thumb ceiling"
      class:active={activeThumb === "ceiling"}
      style:left="{ceilingPct}%"
      role="slider"
      aria-label={t("render.ceiling")}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={renderStore.dbCeiling}
      tabindex="0"
      onkeydown={(e) => adjustWithKey("ceiling", e)}
    >
      <span class="thumb-label">{renderStore.dbCeiling}</span>
    </div>
  </div>
</Section>

<style>
  .inputs {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    flex-wrap: wrap;
  }

  .inputs label {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xs);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }

  .numeric {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xs);
  }

  .numeric input {
    width: 2rem;
    padding: 2px var(--sp-xs);
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-align: right;
  }

  .numeric input:focus-visible {
    border-color: var(--c-border-focus);
  }

  .unit {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    background: var(--c-border);
    color: var(--c-text-accent);
    border: 1px solid var(--c-border-hover);
    border-radius: var(--r-sm);
    cursor: pointer;
  }

  .reset:hover {
    background: var(--c-border-hover);
    color: var(--c-text);
  }

  .track {
    position: relative;
    height: 44px;
    margin: var(--sp-xs) 0;
    touch-action: none;
    cursor: pointer;
  }

  .rail {
    position: absolute;
    top: 18px;
    left: 0;
    right: 0;
    height: 8px;
    background: linear-gradient(to right, var(--c-bg), var(--c-border));
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
  }

  .fill {
    position: absolute;
    top: 20px;
    height: 6px;
    background: linear-gradient(to right, #2a3c6b, var(--c-accent));
    border-radius: var(--r-sm);
    pointer-events: none;
  }

  .tick {
    position: absolute;
    top: 14px;
    width: 1px;
    height: 16px;
    background: rgba(139, 148, 181, 0.3);
    transform: translateX(-0.5px);
    pointer-events: none;
  }

  .tick.no-line {
    background: none;
  }

  .tick-label {
    position: absolute;
    bottom: -14px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--fs-sm);
    color: var(--c-text-dim);
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .thumb {
    position: absolute;
    top: 12px;
    width: 14px;
    height: 20px;
    transform: translateX(-50%);
    border-radius: var(--r-sm);
    cursor: grab;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
  }

  .thumb.floor {
    background: #fdd835;
  }

  .thumb.ceiling {
    background: #ff5a6c;
  }

  .thumb.active,
  .thumb:focus-visible {
    cursor: grabbing;
    outline: none;
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.6),
      0 0 8px rgba(107, 139, 255, 0.6);
  }

  .thumb-label {
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--fs-sm);
    font-family: var(--font-mono);
    color: var(--c-text);
    background: rgba(18, 21, 31, 0.9);
    padding: 1px 4px;
    border-radius: var(--r-sm);
    white-space: nowrap;
    pointer-events: none;
  }
</style>
