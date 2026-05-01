<script lang="ts">
  import {
    settingsStore,
    type WaveformDisplayMode,
    type WaveformColorMode,
    type WaveformPalette,
  } from "$lib/stores/settings.svelte";
  import { paletteGradientCss } from "$lib/render/waveform-palette";
  import { t } from "$lib/i18n/index.svelte";
  import Section from "./ui/Section.svelte";
  import Select from "./ui/Select.svelte";
  import Toggle from "./ui/Toggle.svelte";

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

  const displayOptions = $derived.by(() => [
    { value: "mono", label: t("waveform.display_mono") },
    { value: "leftRight", label: t("waveform.display_leftright") },
    { value: "midSide", label: t("waveform.display_midside") },
  ]);

  const colorOptions = $derived.by(() => [
    { value: "neutral", label: t("waveform.color_neutral") },
    { value: "spectral", label: t("waveform.color_spectral") },
  ]);

  const paletteOptions = $derived.by(() => [
    {
      value: "turbo",
      label: t("waveform.palette_turbo"),
      preview: paletteGradientCss("turbo"),
    },
    {
      value: "rainbow",
      label: t("waveform.palette_rainbow"),
      preview: paletteGradientCss("rainbow"),
    },
    {
      value: "fire",
      label: t("waveform.palette_fire"),
      preview: paletteGradientCss("fire"),
    },
  ]);

  const gridTimeOptions = $derived.by(() => [
    { value: "0", label: t("waveform.grid_off") },
    { value: "5", label: t("waveform.grid_time_low") },
    { value: "10", label: t("waveform.grid_time_medium") },
    { value: "20", label: t("waveform.grid_time_high") },
    { value: "40", label: t("waveform.grid_time_extra") },
  ]);

  const gridAmpOptions = $derived.by(() => [
    { value: "0", label: t("waveform.grid_off") },
    { value: "0.5", label: t("waveform.grid_amp_half") },
    { value: "0.25", label: t("waveform.grid_amp_quarter") },
    { value: "0.1", label: t("waveform.grid_amp_tenth") },
  ]);

  const gridTimeValue = $derived(
    String(settingsStore.waveformGridTimeDivisions),
  );
  const gridAmpValue = $derived(String(settingsStore.waveformGridAmpStep));
  const displayValue = $derived(settingsStore.waveformDisplayMode as string);
  const colorValue = $derived(settingsStore.waveformColorMode as string);
  const paletteValue = $derived(settingsStore.waveformPalette as string);
</script>

<Section
  title={t("waveform.title")}
  persistKey="waveform"
  {draggableId}
  {onReorder}
  {onMoveUp}
  {onMoveDown}
  {canMoveUp}
  {canMoveDown}
>
  <div class="row">
    <span class="label">{t("waveform.display")}</span>
    <Select
      options={displayOptions}
      value={displayValue}
      onchange={(v) =>
        (settingsStore.waveformDisplayMode = v as WaveformDisplayMode)}
    />
  </div>

  <div class="row">
    <span class="label">{t("waveform.color")}</span>
    <Select
      options={colorOptions}
      value={colorValue}
      onchange={(v) =>
        (settingsStore.waveformColorMode = v as WaveformColorMode)}
    />
  </div>

  {#if settingsStore.waveformColorMode === "spectral"}
    <div class="row">
      <span class="label">{t("waveform.palette")}</span>
      <Select
        options={paletteOptions}
        value={paletteValue}
        onchange={(v) =>
          (settingsStore.waveformPalette = v as WaveformPalette)}
      />
    </div>

    <div class="row">
      <span class="label">{t("waveform.show_legend")}</span>
      <Toggle bind:checked={settingsStore.waveformShowLegend} />
    </div>
  {/if}

  <div class="row">
    <span class="label">{t("waveform.show_clipping_guides")}</span>
    <Toggle bind:checked={settingsStore.waveformShowClippingGuides} />
  </div>

  <div class="row">
    <span class="label">{t("waveform.show_clipping_markers")}</span>
    <Toggle bind:checked={settingsStore.waveformShowClippingMarkers} />
  </div>

  <div class="row">
    <span class="label">{t("waveform.show_kicks")}</span>
    <Toggle bind:checked={settingsStore.waveformShowKicks} />
  </div>

  <div class="row">
    <span class="label">{t("waveform.smooth")}</span>
    <Toggle bind:checked={settingsStore.waveformSmooth} />
  </div>

  <div class="row">
    <span class="label">{t("waveform.grid_time")}</span>
    <Select
      options={gridTimeOptions}
      value={gridTimeValue}
      onchange={(v) => (settingsStore.waveformGridTimeDivisions = Number(v))}
    />
  </div>

  <div class="row">
    <span class="label">{t("waveform.grid_amp")}</span>
    <Select
      options={gridAmpOptions}
      value={gridAmpValue}
      onchange={(v) => (settingsStore.waveformGridAmpStep = Number(v))}
    />
  </div>
</Section>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-xs);
  }

  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    flex: 1;
    min-width: 0;
  }
</style>
