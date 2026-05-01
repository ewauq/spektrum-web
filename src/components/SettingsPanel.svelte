<script lang="ts">
  import { settingsStore, type Quality } from '$lib/stores/settings.svelte';
  import { COLORMAP_NAMES, colormapGradientCss, type ColormapName } from '$lib/colormap';
  import type { WindowType } from '$lib/dsp/window';
  import { t } from '$lib/i18n/index.svelte';
  import Section from './ui/Section.svelte';
  import Select from './ui/Select.svelte';
  import Toggle from './ui/Toggle.svelte';
  import GradientEditor from './GradientEditor.svelte';

  let {
    recomputing,
    view3d = false,
    draggableId,
    onReorder,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
  }: {
    recomputing: boolean;
    view3d?: boolean;
    draggableId?: string;
    onReorder?: (from: string, to: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  } = $props();

  const colormapOptions = $derived(
    COLORMAP_NAMES.map((n) => ({
      value: n,
      label: t(`settings.colormap_${n}`),
      preview: n === 'custom' ? undefined : colormapGradientCss(n)
    }))
  );

  const qualityOptions = $derived.by(() => [
    { value: 'time', label: t('settings.quality_time'), title: t('settings.quality_time_title') },
    { value: 'balanced', label: t('settings.quality_balanced'), title: t('settings.quality_balanced_title') },
    { value: 'frequency', label: t('settings.quality_frequency'), title: t('settings.quality_frequency_title') }
  ]);

  const windowOptions = $derived.by(() => [
    { value: 'hann', label: 'Hann' },
    { value: 'hamming', label: 'Hamming' },
    { value: 'blackman', label: 'Blackman' },
    { value: 'blackman-harris', label: 'Blackman-Harris' },
    { value: 'rectangular', label: t('settings.window_rectangular') }
  ]);

  const colormapValue = $derived(settingsStore.colormap as string);
  const qualityValue = $derived(settingsStore.quality as string);
  const windowValue = $derived(settingsStore.windowType as string);
</script>

<Section
  title={t('settings.render_title')}
  persistKey="settings_render"
  {draggableId}
  {onReorder}
  {onMoveUp}
  {onMoveDown}
  {canMoveUp}
  {canMoveDown}
>
  <div class="row">
    <span class="label">{t('settings.colormap')}</span>
    <Select
      options={colormapOptions}
      value={colormapValue}
      onchange={(v) => (settingsStore.colormap = v as ColormapName)}
    />
  </div>

  {#if settingsStore.colormap === 'custom'}
    <GradientEditor
      stops={settingsStore.customStops}
      onchange={(s) => (settingsStore.customStops = s)}
    />
  {/if}

  <div class="row">
    <span class="label">{t('settings.resolution')}</span>
    <Select
      options={qualityOptions}
      value={qualityValue}
      onchange={(v) => (settingsStore.quality = v as Quality)}
      disabled={recomputing}
    />
  </div>

  <div class="row">
    <span class="label">{t('settings.window')}</span>
    <Select
      options={windowOptions}
      value={windowValue}
      onchange={(v) => (settingsStore.windowType = v as WindowType)}
      disabled={recomputing}
    />
  </div>

  {#if !view3d}
    <div class="row">
      <span class="label">{t('settings.smoothing')}</span>
      <Toggle bind:checked={settingsStore.smoothing} />
    </div>
  {/if}
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
    width: 8rem;
    flex-shrink: 0;
  }

</style>
