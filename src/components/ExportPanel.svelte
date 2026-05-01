<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { loadSectionOrder, saveSectionOrder, reorderList, sectionMoveHandlers } from '$lib/stores/section-order';
  import Section from './ui/Section.svelte';
  import ChipGroup from './ui/ChipGroup.svelte';
  import Toggle from './ui/Toggle.svelte';
  import Button from './ui/Button.svelte';

  let {
    hasFile = false,
    hasSelection = false,
    busy = false,
    onExportFull,
    onExportSelection,
    onExportData
  }: {
    hasFile?: boolean;
    hasSelection?: boolean;
    busy?: boolean;
    onExportFull?: () => void;
    onExportSelection?: () => void;
    onExportData?: () => void;
  } = $props();

  const ORDER_KEY = 'spektrum.export.order';
  const DEFAULT_ORDER = ['export_image', 'export_data'] as const;
  type SectionId = typeof DEFAULT_ORDER[number];

  let order = $state<SectionId[]>(loadSectionOrder(ORDER_KEY, DEFAULT_ORDER));

  function handleReorder(from: string, to: string) {
    const next = reorderList(order, from as SectionId, to as SectionId);
    order = next;
    saveSectionOrder(ORDER_KEY, next);
  }

  function moveHandlers(id: SectionId) {
    return sectionMoveHandlers(id, order, (next) => {
      order = next;
      saveSectionOrder(ORDER_KEY, next);
    });
  }
</script>

{#each order as id (id)}
  {#if id === 'export_image'}
    <Section
      title={t('export.image_section')}
      persistKey="export_image"
      draggableId="export_image"
      onReorder={handleReorder}
      {...moveHandlers('export_image')}
    >
      <div class="row">
        <span class="label">{t('export.image_format')}</span>
        <ChipGroup
          label={t('export.image_format')}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' },
            { value: 'webp', label: 'WebP' }
          ]}
          bind:value={settingsStore.imageFormat}
        />
      </div>

      <Toggle label={t('export.include_legend')} bind:checked={settingsStore.exportLegend} />
      <Toggle label={t('export.include_info')} bind:checked={settingsStore.exportInfo} />
      <Toggle label={t('export.include_markers')} bind:checked={settingsStore.exportMarkers} />

      <div class="actions">
        <Button onclick={onExportFull} disabled={!hasFile || busy}>
          {t('export.export_image')}
        </Button>
        {#if hasSelection}
          <Button onclick={onExportSelection} disabled={busy}>
            {t('export.export_selection')}
          </Button>
        {/if}
      </div>
    </Section>
  {:else if id === 'export_data'}
    <Section
      title={t('export.data_section')}
      persistKey="export_data"
      draggableId="export_data"
      onReorder={handleReorder}
      {...moveHandlers('export_data')}
    >
      <div class="row">
        <span class="label">{t('export.data_format')}</span>
        <ChipGroup
          label={t('export.data_format')}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'npy', label: 'NPY' }
          ]}
          bind:value={settingsStore.dataFormat}
        />
      </div>

      <div class="actions">
        <Button onclick={onExportData} disabled={!hasFile || busy}>
          {t('export.export_data')}
        </Button>
      </div>
    </Section>
  {/if}
{/each}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    flex-wrap: wrap;
  }

  .label {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    min-width: 5.5rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding-top: var(--sp-xs);
  }
</style>
