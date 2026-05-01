<script lang="ts">
  import type { DecodedAudio } from "$lib/audio/decode";
  import type { StftResult } from "$lib/dsp/stft";
  import { t } from "$lib/i18n/index.svelte";
  import { viewStore } from "$lib/stores/view.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { renderStore } from "$lib/stores/render.svelte";
  import {
    loadSectionOrder,
    saveSectionOrder,
    reorderList,
    sectionMoveHandlers,
  } from "$lib/stores/section-order";
  import { formatDuration } from "$lib/format";
  import { fileName } from "$lib/path";
  import Section from "./ui/Section.svelte";
  import InfoTable, { type InfoRow } from "./ui/InfoTable.svelte";
  import RegionStats from "./RegionStats.svelte";
  import CursorBar from "./CursorBar.svelte";

  let {
    audio,
    stft = null,
  }: {
    audio: DecodedAudio | null;
    stft?: StftResult | null;
  } = $props();

  function formatSamples(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
    return String(n);
  }

  const ORDER_KEY = "spektrum.info.order";
  const DEFAULT_ORDER = [
    "window",
    "selection",
    "file",
    "audio",
  ] as const;
  type SectionId = (typeof DEFAULT_ORDER)[number];

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

  const fileRows = $derived.by((): InfoRow[] => {
    if (!audio) return [];
    return [
      {
        kind: "row",
        key: t("info.file_name"),
        cell: { kind: "text", value: fileName(audio.path), bold: true },
      },
      {
        kind: "row",
        key: t("info.file_format"),
        cell: { kind: "text", value: audio.format.toUpperCase() },
      },
      ...(audio.flacMeta?.vendorString
        ? [
            {
              kind: "row" as const,
              key: t("info.vendor_string"),
              cell: {
                kind: "text" as const,
                value: audio.flacMeta.vendorString,
                mono: true,
              },
            },
          ]
        : []),
    ];
  });

  const audioRows = $derived.by((): InfoRow[] => {
    if (!audio) return [];
    const rows: InfoRow[] = [
      {
        kind: "row",
        key: t("info.audio_duration"),
        cell: { kind: "text", value: formatDuration(audio.duration), mono: true },
      },
      {
        kind: "row",
        key: t("info.audio_sample_rate"),
        cell: {
          kind: "text",
          value: `${audio.sampleRate.toLocaleString("fr-FR")} ${t("unit.hz")}`,
          mono: true,
        },
      },
      {
        kind: "row",
        key: t("info.audio_channels"),
        cell: audio.effectivelyMono
          ? { kind: "snippet", render: channelsWithWarning }
          : { kind: "text", value: String(audio.channels), mono: true },
      },
    ];
    if (audio.bitDepth) {
      rows.push({
        kind: "row",
        key: t("info.audio_bit_depth"),
        cell: {
          kind: "text",
          value: `${audio.bitDepth} ${t("unit.bits")}`,
          mono: true,
        },
      });
    }
    if (audio.bitrate) {
      rows.push({
        kind: "row",
        key: t("info.audio_bitrate"),
        cell: {
          kind: "text",
          value: `${Math.round(audio.bitrate)} ${t("unit.kbps")}`,
          mono: true,
        },
      });
    }
    rows.push({
      kind: "row",
      key: t("info.audio_samples"),
      cell: {
        kind: "text",
        value: formatSamples(
          audio.duration * audio.sampleRate * audio.channels,
        ),
        mono: true,
      },
    });
    rows.push({
      kind: "row",
      key: t("info.audio_nyquist"),
      cell: {
        kind: "text",
        value: `${(audio.sampleRate / 2).toLocaleString("fr-FR")} ${t("unit.hz")}`,
        mono: true,
      },
    });
    return rows;
  });

</script>

{#if audio}
  <CursorBar {audio} />
  <div class="sections">
    {#each order as id (id)}
      {#if id === "window"}
        <RegionStats
          title={t("info.window_section")}
          persistKey="window"
          draggableId="window"
          onReorder={handleReorder}
          {...moveHandlers("window")}
          {stft}
          timeStart={viewStore.timeStart}
          timeEnd={viewStore.timeEnd}
          freqStart={0}
          freqEnd={audio.sampleRate / 2}
          dbFloor={renderStore.dbFloor}
        />
      {:else if id === "selection"}
        {#if selectionStore.current}
          <RegionStats
            title={t("info.selection_section")}
            persistKey="selection"
            draggableId="selection"
            onReorder={handleReorder}
            {...moveHandlers("selection")}
            {stft}
            timeStart={selectionStore.current.timeStart}
            timeEnd={selectionStore.current.timeEnd}
            freqStart={selectionStore.current.freqStart}
            freqEnd={selectionStore.current.freqEnd}
            dbFloor={renderStore.dbFloor}
          />
        {/if}
      {:else if id === "file"}
        <Section
          title={t("info.file_section")}
          persistKey="file"
          draggableId="file"
          onReorder={handleReorder}
          {...moveHandlers("file")}
        >
          <InfoTable rows={fileRows} />
        </Section>
      {:else if id === "audio"}
        <Section
          title={t("info.audio_section")}
          persistKey="audio"
          draggableId="audio"
          onReorder={handleReorder}
          {...moveHandlers("audio")}
        >
          <InfoTable rows={audioRows} />
        </Section>
      {/if}
    {/each}
  </div>
{:else}
  <div class="empty">{t("info.no_file")}</div>
{/if}

{#snippet channelsWithWarning()}
  {#if audio}
    <span class="channels-warn" title={t("statusbar.fake_stereo_warning")}>
      <span class="mono">{audio.channels}</span>
      <svg
        class="warn-icon"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-label={t("statusbar.fake_stereo_warning")}
      >
        <path
          d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
        />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    </span>
  {/if}
{/snippet}

<style>
  .sections {
    display: flex;
    flex-direction: column;
  }

  .empty {
    padding: var(--sp-xl);
    text-align: center;
    color: var(--c-text-dim);
    font-size: var(--fs-sm);
  }

  .channels-warn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .channels-warn .mono {
    font-family: var(--font-mono);
  }

  .warn-icon {
    color: #fbbf24;
    flex-shrink: 0;
  }
</style>
