<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import {
    markersStore,
    MARKERS_CUSTOM_LIMIT,
    type MarkerStyle,
    type FreqMarker,
  } from "$lib/stores/markers.svelte";
  import { audioStore } from "$lib/stores/audio.svelte";
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

  const maxFreq = $derived(
    audioStore.status.kind === "ready"
      ? audioStore.status.audio.sampleRate / 2
      : 22050,
  );

  let expandedId = $state<string | null>(null);

  function toggleAdvanced(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function updateFreq(m: FreqMarker, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    markersStore.update(m.id, {
      freq: Math.max(1, Math.min(maxFreq, Math.round(n))),
    });
  }

  function updateLabel(m: FreqMarker, value: string) {
    markersStore.update(m.id, { label: value });
  }

  function updateColor(m: FreqMarker, value: string) {
    markersStore.update(m.id, { color: value });
  }

  function updateStyle(m: FreqMarker, value: string) {
    markersStore.update(m.id, { style: value as MarkerStyle });
  }

  function updateThickness(m: FreqMarker, value: string) {
    markersStore.update(m.id, { thickness: Math.max(1, Math.min(4, Number(value))) });
  }

  function updateOpacity(m: FreqMarker, value: string) {
    markersStore.update(m.id, { opacity: Math.max(0.1, Math.min(1, Number(value))) });
  }

  function addMarker() {
    const m = markersStore.add({
      label: t("markers.new_label"),
      freq: 1000,
      color: "#6b8bff",
      visible: true,
    });
    if (m) expandedId = m.id;
  }

  const presets = $derived(markersStore.markers.filter((m) => m.preset));
  const customs = $derived(markersStore.markers.filter((m) => !m.preset));
  const atLimit = $derived(!markersStore.canAdd());
</script>

<Section
  title={t("markers.section_title")}
  persistKey="markers"
  {draggableId}
  {onReorder}
  {onMoveUp}
  {onMoveDown}
  {canMoveUp}
  {canMoveDown}
>
  <div class="group-title">{t("markers.presets_group")}</div>
  {#each presets as m (m.id)}
    {@render row(m, false)}
  {/each}

  <div class="group-title">
    {t("markers.custom_group")}
    <span class="counter" class:full={atLimit}>
      {customs.length}/{MARKERS_CUSTOM_LIMIT}
    </span>
  </div>

  {#each customs as m (m.id)}
    {@render row(m, true)}
  {/each}

  {#if customs.length === 0}
    <div class="empty">{t("markers.no_custom")}</div>
  {/if}

  <div class="actions">
    <button
      class="btn add"
      onclick={addMarker}
      disabled={atLimit}
      title={atLimit ? t("markers.limit_reached", { limit: MARKERS_CUSTOM_LIMIT }) : ""}
    >
      + {t("markers.add")}
    </button>
    <button class="btn reset" onclick={() => markersStore.reset()}>
      {t("markers.reset")}
    </button>
  </div>
</Section>

{#snippet row(m: FreqMarker, removable: boolean)}
  <div class="row" class:active={m.visible}>
    <button
      class="eye"
      class:on={m.visible}
      onclick={() => markersStore.toggle(m.id)}
      aria-label={m.visible ? t("markers.hide") : t("markers.show")}
    >
      {#if m.visible}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-.722-3.25" />
          <path d="M2 8a10.645 10.645 0 0 0 20 0" />
          <path d="m20 15-1.726-2.05" />
          <path d="m4 15 1.726-2.05" />
          <path d="m9 18 .722-3.25" />
        </svg>
      {/if}
    </button>
    <input
      type="color"
      class="color"
      value={m.color}
      aria-label={t("markers.color")}
      oninput={(e) => updateColor(m, (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      type="text"
      class="label"
      value={m.label}
      aria-label={t("markers.label_input")}
      oninput={(e) => updateLabel(m, (e.currentTarget as HTMLInputElement).value)}
    />
    <div class="freq">
      <input
        type="number"
        min="1"
        max={maxFreq}
        step="1"
        value={m.freq}
        aria-label={t("markers.freq_input")}
        oninput={(e) => updateFreq(m, (e.currentTarget as HTMLInputElement).value)}
      />
      <span class="unit">Hz</span>
    </div>
    <button
      class="more"
      class:on={expandedId === m.id}
      onclick={() => toggleAdvanced(m.id)}
      aria-label={t("markers.advanced")}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
      </svg>
    </button>
    {#if removable}
      <button
        class="del"
        onclick={() => markersStore.remove(m.id)}
        aria-label={t("common.delete")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    {/if}
  </div>
  {#if expandedId === m.id}
    <div class="advanced">
      <label class="adv">
        <span>{t("markers.style")}</span>
        <select
          value={m.style}
          onchange={(e) => updateStyle(m, (e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="solid">{t("markers.style_solid")}</option>
          <option value="dashed">{t("markers.style_dashed")}</option>
          <option value="dotted">{t("markers.style_dotted")}</option>
        </select>
      </label>
      <label class="adv">
        <span>{t("markers.thickness")}</span>
        <input
          type="range"
          min="1"
          max="4"
          step="1"
          value={m.thickness}
          oninput={(e) => updateThickness(m, (e.currentTarget as HTMLInputElement).value)}
        />
        <span class="num">{m.thickness}px</span>
      </label>
      <label class="adv">
        <span>{t("markers.opacity")}</span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={m.opacity}
          oninput={(e) => updateOpacity(m, (e.currentTarget as HTMLInputElement).value)}
        />
        <span class="num">{Math.round(m.opacity * 100)}%</span>
      </label>
      <label class="adv toggle">
        <input
          type="checkbox"
          checked={m.labelVisible}
          onchange={(e) => markersStore.update(m.id, { labelVisible: (e.currentTarget as HTMLInputElement).checked })}
        />
        <span>{t("markers.label_visible")}</span>
      </label>
    </div>
  {/if}
{/snippet}

<style>
  .group-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: var(--sp-sm) 0 var(--sp-xs);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .group-title:first-child {
    margin-top: 0;
  }

  .counter {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-text-dim);
    text-transform: none;
    letter-spacing: 0;
  }

  .counter.full {
    color: var(--c-warning);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 0;
  }

  .eye,
  .more,
  .del {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    color: var(--c-text-dim);
    cursor: pointer;
    flex-shrink: 0;
  }

  .eye:hover,
  .more:hover,
  .del:hover {
    background: var(--c-border);
    color: var(--c-text);
  }

  .eye.on {
    color: var(--c-accent);
  }

  .more.on {
    background: var(--c-border);
    color: var(--c-text);
  }

  .color {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }

  .color::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color::-webkit-color-swatch {
    border: none;
    border-radius: calc(var(--r-sm) - 1px);
  }

  .label {
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    font-family: inherit;
    font-size: var(--fs-sm);
  }

  .freq {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .freq input {
    width: 3.5rem;
    padding: 2px 4px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-align: right;
  }

  .freq input::-webkit-inner-spin-button,
  .freq input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .unit {
    font-size: 0.7rem;
    color: var(--c-text-dim);
  }

  .advanced {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-xs) var(--sp-sm) var(--sp-sm) 30px;
  }

  .adv {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }

  .adv > span:first-child {
    width: 4.5rem;
  }

  .adv select,
  .adv input[type="range"] {
    flex: 1;
    padding: 2px 4px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    font-family: inherit;
    font-size: var(--fs-sm);
  }

  .adv input[type="range"] {
    padding: 0;
    background: transparent;
    border: none;
  }

  .adv.toggle {
    flex-direction: row-reverse;
    justify-content: flex-end;
    gap: var(--sp-xs);
  }

  .adv.toggle > span {
    width: auto;
  }

  .num {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-text-dim);
    width: 2.5rem;
    text-align: right;
  }

  .actions {
    display: flex;
    gap: var(--sp-sm);
    margin-top: var(--sp-sm);
  }

  .btn {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--c-border);
    color: var(--c-text);
    border: 1px solid var(--c-border-hover);
    border-radius: var(--r-sm);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--fs-sm);
  }

  .btn:hover:not(:disabled) {
    background: var(--c-border-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.reset {
    background: transparent;
  }

  .empty {
    padding: var(--sp-xs) 0;
    font-size: var(--fs-sm);
    color: var(--c-text-dim);
    font-style: italic;
  }
</style>
