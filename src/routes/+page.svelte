<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { audioStore } from "$lib/stores/audio.svelte";
  import { waveformPyramidStore } from "$lib/stores/waveform-pyramid.svelte";
  import { kicksStore } from "$lib/stores/kicks.svelte";
  import { taskStore, STFT_STREAMING_COMPLETE } from "$lib/stores/tasks.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import { loadSettings, saveSettings } from "$lib/stores/persist";
  import { renderStore } from "$lib/stores/render.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { markersStore } from "$lib/stores/markers.svelte";
  import { toolStore } from "$lib/stores/tool.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { viewStore } from "$lib/stores/view.svelte";
  import {
    exportFullPng,
    exportRegionPng,
    type ExportOptions,
  } from "$lib/export/png";
  import { exportData } from "$lib/export/data";
  import { pickAudioFile, attachDragDrop } from "$lib/platform/file-input";
  import Spectrogram from "../components/Spectrogram.svelte";
  import SplashLogo from "../components/SplashLogo.svelte";
  import MarkersPanel from "../components/MarkersPanel.svelte";
  import { baseName } from "$lib/path";
  import {
    loadSectionOrder,
    saveSectionOrder,
    reorderList,
    sectionMoveHandlers,
  } from "$lib/stores/section-order";
  import HeaderBar from "../components/HeaderBar.svelte";
  import Sidebar from "../components/Sidebar.svelte";
  import InfoPanel from "../components/InfoPanel.svelte";
  import RenderPanel from "../components/RenderPanel.svelte";
  import SettingsPanel from "../components/SettingsPanel.svelte";
  import WaveformSettingsPanel from "../components/WaveformSettingsPanel.svelte";
  import WaveformLegend from "../components/WaveformLegend.svelte";
  import SubTabs from "../components/ui/SubTabs.svelte";
  import AppSettingsModal from "../components/AppSettingsModal.svelte";
  import ContextMenu from "../components/ui/ContextMenu.svelte";
  import ExportPanel from "../components/ExportPanel.svelte";
  import StatusBar from "../components/StatusBar.svelte";
  import FloatingCursorInfo from "../components/FloatingCursorInfo.svelte";

  let canvasRef = $state<HTMLCanvasElement | null>(null);
  let activeTab = $state("info");
  let dragActive = $state(false);
  let exportBusy = $state(false);
  let viewWaveform = $state(uiStore.viewWaveform);

  // Sync local <-> persisted store (uiStore is hydrated by loadSettings).
  $effect.pre(() => {
    viewWaveform = uiStore.viewWaveform;
  });
  $effect(() => {
    uiStore.viewWaveform = viewWaveform;
  });
  let hoverTime = $state<number | null>(null);
  let hoverFreq = $state<number | null>(null);
  let appSettingsOpen = $state(false);
  let ctxMenu = $state<{
    x: number;
    y: number;
    target: "spectrogram" | "spectrogram3d" | "waveform";
  } | null>(null);

  const SUPPORTED = /\.(flac|mp3)$/i;

  const status = $derived(audioStore.status);
  const selection = $derived(selectionStore.current);
  const audio = $derived(status.kind === "ready" ? status.audio : null);
  // Derived from taskStore so any blocking work (decode / streaming
  // STFT / recompute) gates the toolbar and sidebar. Secondary DSP
  // tasks (LUFS, vectorscope...) are intentionally excluded — the user
  // can keep panning while those run.
  const streamingProgress = $derived(taskStore.stftProgress);
  const recomputing = $derived(
    taskStore.active.some((t) => t.kind === "recompute"),
  );
  const loading = $derived(status.kind === "loading" || taskStore.hasBlocking);

  async function openFile() {
    const handle = await pickAudioFile();
    if (handle) await audioStore.load(handle);
  }

  function closeFile() {
    audioStore.reset();
    selectionStore.clear();
    waveformPyramidStore.clear();
    kicksStore.clear();
    taskStore.clearAll();
    stftRef = null;
  }

  function openSettings(tab: SettingsTabId) {
    activeTab = "settings";
    activeSettingsTab = tab;
  }

  function reloadCurrent() {
    if (audio) audioStore.load(audio.path);
  }

  const ctxItems = $derived.by(() => {
    if (!ctxMenu) return [];
    const reload = {
      label: t("context.reload"),
      onSelect: reloadCurrent,
      disabled: !audio,
    };
    const targetTab: SettingsTabId =
      ctxMenu.target === "waveform" ? "waveform" : "spectrogram";
    const options = {
      label: t("context.options"),
      onSelect: () => openSettings(targetTab),
    };
    return [reload, options];
  });

  function localizedError(raw: string): string {
    const m = raw.match(/^unsupported_format:(.+)$/);
    if (m) return t("common.error_unsupported_format", { ext: m[1] });
    return raw;
  }

  let stftRef = $state<import("$lib/dsp/stft").StftResult | null>(null);
  let pyramidRef = $state<import("$lib/dsp/pyramid").Pyramid | null>(null);


  function getExportOpts(): ExportOptions {
    return {
      imageFormat: settingsStore.imageFormat,
      legend: settingsStore.exportLegend,
      info: settingsStore.exportInfo,
      border: true,
      dbFloor: renderStore.dbFloor,
      dbCeiling: renderStore.dbCeiling,
      colormap: settingsStore.colormap,
      customStops: settingsStore.customStops,
      timeStart: viewStore.timeStart,
      timeEnd: viewStore.timeEnd,
      sampleRate: audio?.sampleRate,
      filePath: audio?.path,
      format: audio?.format,
      channels: audio?.channels,
      bitDepth: audio?.bitDepth,
      duration: audio?.duration,
      fftSize: settingsStore.fftSize,
      windowType: settingsStore.windowType,
      markers: markersStore.markers,
      exportMarkers: settingsStore.exportMarkers,
    };
  }

  function imgExt(): string {
    return settingsStore.imageFormat === "jpeg"
      ? "jpg"
      : settingsStore.imageFormat;
  }

  async function handleExportFull() {
    if (!canvasRef || exportBusy || !audio) return;
    exportBusy = true;
    const taskId = taskStore.start("export_png", t("tasks.export_png"));
    try {
      await exportFullPng(
        canvasRef,
        `${baseName(audio.path)}.${imgExt()}`,
        getExportOpts(),
      );
    } finally {
      taskStore.end(taskId);
      exportBusy = false;
    }
  }

  function regionDbRange(
    stft: import("$lib/dsp/stft").StftResult,
    timeStart: number,
    timeEnd: number,
    freqStart: number,
    freqEnd: number,
  ): { minDb: number; maxDb: number } | null {
    const { magnitudes, freqBins, sampleRate, hopSize, fftSize, timeFrames } =
      stft;
    const nyquist = sampleRate / 2;
    const t1 = Math.min(timeStart, timeEnd);
    const t2 = Math.max(timeStart, timeEnd);
    const f1 = Math.min(freqStart, freqEnd);
    const f2 = Math.max(freqStart, freqEnd);
    const frameOf = (t: number) =>
      Math.round((t * sampleRate - fftSize / 2) / hopSize);
    const fStart = Math.max(0, frameOf(t1));
    const fEnd = Math.min(timeFrames, Math.max(fStart + 1, frameOf(t2)));
    const kStart = Math.max(0, Math.round((f1 / nyquist) * (freqBins - 1)));
    const kEnd = Math.min(
      freqBins - 1,
      Math.max(kStart, Math.round((f2 / nyquist) * (freqBins - 1))),
    );
    const sentinel = stft.dbFloor;
    let minDb = Infinity;
    let maxDb = -Infinity;
    for (let f = fStart; f < fEnd; f++) {
      for (let k = kStart; k <= kEnd; k++) {
        const v = magnitudes[f * freqBins + k];
        if (v <= sentinel) continue;
        if (v < minDb) minDb = v;
        if (v > maxDb) maxDb = v;
      }
    }
    if (!Number.isFinite(minDb) || !Number.isFinite(maxDb)) return null;
    return { minDb, maxDb };
  }

  async function handleExportSelection() {
    if (!canvasRef || !selection || exportBusy || !audio) return;
    exportBusy = true;
    const taskId = taskStore.start("export_png", t("tasks.export_png"));
    try {
      const nyquist = audio.sampleRate / 2;
      const visibleRange = viewStore.timeEnd - viewStore.timeStart;
      const pxPerSec = canvasRef.width / visibleRange;
      const plotH = canvasRef.height;
      const x = Math.max(
        0,
        (selection.timeStart - viewStore.timeStart) * pxPerSec,
      );
      const w = Math.max(
        1,
        (selection.timeEnd - selection.timeStart) * pxPerSec,
      );
      const y = Math.max(0, plotH - (selection.freqEnd / nyquist) * plotH);
      const h = Math.max(
        1,
        ((selection.freqEnd - selection.freqStart) / nyquist) * plotH,
      );
      const baseOpts = getExportOpts();
      const range = stftRef
        ? regionDbRange(
            stftRef,
            selection.timeStart,
            selection.timeEnd,
            selection.freqStart,
            selection.freqEnd,
          )
        : null;
      const opts = range
        ? {
            ...baseOpts,
            legendDbFloor: range.minDb,
            legendDbCeiling: range.maxDb,
          }
        : baseOpts;
      await exportRegionPng(
        canvasRef,
        { x, y, width: w, height: h },
        `${baseName(audio.path)}-selection.${imgExt()}`,
        opts,
      );
    } finally {
      taskStore.end(taskId);
      exportBusy = false;
    }
  }

  async function handleExportData() {
    if (!stftRef || exportBusy || !audio) return;
    exportBusy = true;
    const taskId = taskStore.start(
      "export_data",
      t("tasks.export_data", {
        format: settingsStore.dataFormat.toUpperCase(),
      }),
    );
    try {
      await exportData({
        stft: stftRef,
        timeStart: viewStore.timeStart,
        timeEnd: viewStore.timeEnd,
        format: settingsStore.dataFormat,
        suggestedName: baseName(audio.path),
      });
    } finally {
      taskStore.end(taskId);
      exportBusy = false;
    }
  }

  onMount(() => {
    loadSettings();

    // Preload Waveform so toggling W later doesn't pay the import.
    void import("../components/Waveform.svelte");

    function isEditableTarget(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
      return el.isContentEditable;
    }

    function onGlobalKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        openFile();
      } else if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        appSettingsOpen = true;
      } else if (
        !isEditableTarget(e.target) &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey &&
        status.kind === "ready"
      ) {
        const k = e.key.toLowerCase();
        if (e.key === " ") {
          if (viewStore.duration > 0) {
            viewStore.setRange(0, viewStore.duration);
          }
          e.preventDefault();
        } else if (e.key === "Home") {
          if (viewStore.duration > 0) {
            const range = viewStore.timeEnd - viewStore.timeStart;
            viewStore.setRange(0, range);
          }
          e.preventDefault();
        } else if (e.key === "End") {
          if (viewStore.duration > 0) {
            const range = viewStore.timeEnd - viewStore.timeStart;
            viewStore.setRange(viewStore.duration - range, viewStore.duration);
          }
          e.preventDefault();
        } else if (k === "h") {
          toolStore.set("pan");
          e.preventDefault();
        } else if (k === "z") {
          toolStore.set("zoom");
          e.preventDefault();
        } else if (k === "s") {
          toolStore.set("select");
          e.preventDefault();
        } else if (k === "w") {
          viewWaveform = !viewWaveform;
          e.preventDefault();
        }
      }
      syncToolOverride(e);
    }

    function syncToolOverride(e: KeyboardEvent) {
      if (e.shiftKey) toolStore.setOverride("select");
      else if (e.altKey) toolStore.setOverride("zoom");
      else toolStore.setOverride(null);
    }

    function onGlobalKeyUp(e: KeyboardEvent) {
      syncToolOverride(e);
    }

    function onWindowBlur() {
      toolStore.setOverride(null);
    }

    window.addEventListener("keydown", onGlobalKeyDown);
    window.addEventListener("keyup", onGlobalKeyUp);
    window.addEventListener("blur", onWindowBlur);

    const detachDrop = attachDragDrop(document.body, (handle) => {
      dragActive = false;
      void audioStore.load(handle);
    });
    function onDragOver() {
      dragActive = true;
    }
    function onDragLeave(e: DragEvent) {
      // dragleave fires for every nested element entered; only flip
      // off the overlay when the cursor exits the document area.
      if (e.relatedTarget === null) dragActive = false;
    }
    document.body.addEventListener("dragover", onDragOver);
    document.body.addEventListener("dragleave", onDragLeave);

    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      window.removeEventListener("keyup", onGlobalKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      detachDrop();
      document.body.removeEventListener("dragover", onDragOver);
      document.body.removeEventListener("dragleave", onDragLeave);
    };
  });

  // Pre-build the waveform pyramid only when the waveform panel is
  // actually toggled on, so loading a file with the panel hidden does
  // not waste CPU/RAM. Toggling the panel on later re-evaluates this
  // effect and kicks off the build (startBuild() is idempotent).
  $effect(() => {
    if (!uiStore.viewWaveform) return;
    if (!audio) return;
    const pcm = audio.pcm;
    untrack(() => waveformPyramidStore.startBuild(pcm));
  });

  // Reset the visible time range to the full duration whenever a new
  // audio is loaded.
  let viewResetFor: import("$lib/audio/decode").DecodedAudio | null = null;
  $effect(() => {
    if (!audio) {
      viewResetFor = null;
      return;
    }
    if (audio !== viewResetFor) {
      viewResetFor = audio;
      viewStore.reset(audio.duration);
    }
  });

  $effect(() => {
    void renderStore.dbFloor;
    void renderStore.dbCeiling;
    void settingsStore.colormap;
    void settingsStore.customStops;
    void settingsStore.smoothing;
    void settingsStore.quality;
    void settingsStore.windowType;
    void settingsStore.exportLegend;
    void settingsStore.exportInfo;
    void settingsStore.exportMarkers;
    void settingsStore.waveformDisplayMode;
    void settingsStore.waveformColorMode;
    void settingsStore.waveformPalette;
    void settingsStore.waveformShowLegend;
    void settingsStore.waveformShowClippingGuides;
    void settingsStore.waveformShowClippingMarkers;
    void settingsStore.waveformGridTimeDivisions;
    void settingsStore.waveformGridAmpStep;
    void uiStore.viewWaveform;
    void uiStore.showStatusBar;
    void markersStore.markers;
    void i18n.locale;
    saveSettings();
  });

  // Mirror the user-controlled "status bar" preference into the task
  // tracker so disabling the bar also stops the start/update/end
  // bookkeeping for every DSP job and frees those few cycles.
  $effect(() => {
    taskStore.setEnabled(uiStore.showStatusBar);
  });

  $effect(() => {
    if (selectionStore.current) activeTab = "export";
  });

  const SETTINGS_ORDER_KEY = "spektrum.settings.order";
  const SETTINGS_DEFAULT_ORDER = [
    "settings_render",
    "render_sensitivity",
    "waveform",
    "markers",
  ] as const;
  type SettingsId = (typeof SETTINGS_DEFAULT_ORDER)[number];
  type SettingsTabId = "spectrogram" | "waveform";

  const SECTION_TAB: Record<SettingsId, SettingsTabId> = {
    settings_render: "spectrogram",
    render_sensitivity: "spectrogram",
    markers: "spectrogram",
    waveform: "waveform",
  };

  let activeSettingsTab = $state<SettingsTabId>("spectrogram");
  let settingsOrder = $state<SettingsId[]>(
    loadSectionOrder(SETTINGS_ORDER_KEY, SETTINGS_DEFAULT_ORDER),
  );

  function handleSettingsReorder(from: string, to: string) {
    const next = reorderList(
      settingsOrder,
      from as SettingsId,
      to as SettingsId,
    );
    settingsOrder = next;
    saveSectionOrder(SETTINGS_ORDER_KEY, next);
  }

  function settingsMove(id: SettingsId) {
    return sectionMoveHandlers(id, settingsOrder, (next) => {
      settingsOrder = next;
      saveSectionOrder(SETTINGS_ORDER_KEY, next);
    });
  }
</script>

<HeaderBar
  onOpenFile={openFile}
  onCloseFile={closeFile}
  onAppSettings={() => (appSettingsOpen = true)}
  hasFile={!!audio}
  {loading}
  bind:viewWaveform
/>

{#if appSettingsOpen}
  <AppSettingsModal onClose={() => (appSettingsOpen = false)} />
{/if}

{#if ctxMenu}
  <ContextMenu
    x={ctxMenu.x}
    y={ctxMenu.y}
    items={ctxItems}
    onClose={() => (ctxMenu = null)}
  />
{/if}

<div class="content">
  <main>
    {#if dragActive}
      <div class="drop-overlay">
        <div class="drop-hint">{t("common.drag_drop_hint")}</div>
      </div>
    {/if}

    {#if status.kind === "idle"}
      <div class="splash">
        <div class="splash-content">
          <SplashLogo />
          <h1 class="splash-name">Spektrum</h1>
          <p class="splash-hint">
            <button class="splash-open" onclick={openFile}>
              {t("common.open_file_hint_verb")}
            </button>{t("common.open_file_hint_rest")}
          </p>
        </div>
      </div>
    {:else if status.kind === "error"}
      <div class="placeholder error">
        {t("common.error_prefix", {
          message: localizedError(status.message),
        })}
      </div>
    {:else}
      <div class="plot-area">
        <div class="plot-row">
          <div class="view-2d view-wrap">
            <Spectrogram
              {audio}
              {loading}
              {streamingProgress}
              bind:canvasRef
              bind:stftRef
              bind:pyramidRef
              bind:hoverTime
              bind:hoverFreq
              onContextMenu={(p: { x: number; y: number }) =>
                (ctxMenu = { x: p.x, y: p.y, target: "spectrogram" })}
            />
          </div>
        </div>
        {#if viewWaveform}
          <div
            class="waveform-panel"
            style:flex-basis={settingsStore.waveformDisplayMode !== "mono"
              ? "220px"
              : "120px"}
          >
            <div class="wf-host">
              {#await import("../components/Waveform.svelte") then { default: Waveform }}
                <Waveform
                  {audio}
                  stft={stftRef}
                  {streamingProgress}
                  bind:hoverTime
                  interactive={true}
                  onContextMenu={(p: { x: number; y: number }) =>
                    (ctxMenu = { x: p.x, y: p.y, target: "waveform" })}
                />
              {/await}
            </div>
            <div class="wf-legend">
              <WaveformLegend
                palette={settingsStore.waveformPalette}
                visible={settingsStore.waveformColorMode === "spectral" &&
                  settingsStore.waveformShowLegend &&
                  !!stftRef}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>

  {#if !uiStore.sidebarCollapsed && status.kind !== "idle"}
    <Sidebar
      tabs={[
        { id: "info", label: t("sidebar.info"), content: infoContent },
        {
          id: "settings",
          label: t("sidebar.settings"),
          content: settingsContent,
        },
        { id: "export", label: t("sidebar.export"), content: exportContent },
      ]}
      bind:activeTab
      disabled={loading}
    />
  {/if}
</div>

{#if uiStore.showStatusBar && status.kind !== "idle"}
  <StatusBar {audio} />
{/if}

<FloatingCursorInfo />

{#snippet infoContent()}
  <InfoPanel {audio} stft={stftRef} />
{/snippet}

{#snippet iconSpectrogram()}
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
    <path d="M2 21v-6" />
    <path d="M7 21v-15" />
    <path d="M12 21v-18" />
    <path d="M17 21v-10" />
    <path d="M22 21v-8" />
  </svg>
{/snippet}

{#snippet iconWaveform()}
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
    <path d="M2 10v3" />
    <path d="M6 6v11" />
    <path d="M10 3v18" />
    <path d="M14 8v7" />
    <path d="M18 5v13" />
    <path d="M22 10v3" />
  </svg>
{/snippet}

{#snippet settingsContent()}
  <SubTabs
    persistKey="spektrum.settings.subtab"
    bind:activeTab={activeSettingsTab as string}
    tabs={[
      {
        id: "spectrogram",
        label: t("settings.tab_spectrogram"),
        icon: iconSpectrogram,
        content: spectrogramSettings,
      },
      {
        id: "waveform",
        label: t("settings.tab_waveform"),
        icon: iconWaveform,
        content: waveformSettings,
      },
    ]}
  />
{/snippet}

{#snippet sectionFor(id: SettingsId)}
  {#if id === "settings_render"}
    <SettingsPanel
      {recomputing}
      draggableId="settings_render"
      onReorder={handleSettingsReorder}
      {...settingsMove("settings_render")}
    />
  {:else if id === "render_sensitivity"}
    <RenderPanel
      draggableId="render_sensitivity"
      onReorder={handleSettingsReorder}
      {...settingsMove("render_sensitivity")}
    />
  {:else if id === "waveform"}
    <WaveformSettingsPanel
      draggableId="waveform"
      onReorder={handleSettingsReorder}
      {...settingsMove("waveform")}
    />
  {:else if id === "markers"}
    <MarkersPanel
      draggableId="markers"
      onReorder={handleSettingsReorder}
      {...settingsMove("markers")}
    />
  {/if}
{/snippet}

{#snippet spectrogramSettings()}
  {#each settingsOrder.filter((id) => SECTION_TAB[id] === "spectrogram") as id (id)}
    {@render sectionFor(id)}
  {/each}
{/snippet}

{#snippet waveformSettings()}
  {#each settingsOrder.filter((id) => SECTION_TAB[id] === "waveform") as id (id)}
    {@render sectionFor(id)}
  {/each}
{/snippet}

{#snippet exportContent()}
  <ExportPanel
    hasFile={!!audio}
    hasSelection={!!selection}
    busy={exportBusy || loading}
    onExportFull={handleExportFull}
    onExportSelection={handleExportSelection}
    onExportData={handleExportData}
  />
{/snippet}

<style>
  .content {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .plot-area {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .plot-row {
    flex: 1;
    min-height: 0;
    position: relative;
    background-color: #000;
  }

  .view-2d {
    padding: 30px 20px 20px 20px;
  }

  .view-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    min-width: 0;
    min-height: 0;
  }

  .waveform-panel {
    flex: 0 0 120px;
    min-height: 0;
    display: grid;
    grid-template-columns: 38px 1fr 94px;
    padding: 20px;
    transition: flex-basis 0.25s ease-out;
    border-top: 1px solid var(--c-border);
    background: #000;
  }

  .wf-host {
    grid-column: 2;
    min-width: 0;
    min-height: 0;
    box-sizing: border-box;
  }

  .wf-legend {
    grid-column: 3;
    min-height: 0;
  }

  .splash {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-text-muted);
  }

  .splash-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-lg);
  }

  .splash-name {
    margin: -6px;
    font-size: 4rem;
    font-weight: 400;
    color: var(--c-text);
    font-family: "Carter One", system-ui, sans-serif;
    line-height: 1;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
  }

  .splash-hint {
    margin: var(--sp-xl) 0 0;
    font-size: 1.15rem;
    color: var(--c-text-muted);
  }

  .splash-open {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: var(--c-accent);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition:
      color 0.15s,
      text-decoration-color 0.15s;
  }

  .splash-open:hover,
  .splash-open:focus-visible {
    color: var(--c-text);
    text-decoration-color: currentColor;
    outline: none;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-text-muted);
    font-size: var(--fs-md);
  }

  .placeholder.error {
    color: var(--c-danger);
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(18, 21, 31, 0.85);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    border: 2px dashed var(--c-accent);
  }

  .drop-hint {
    padding: var(--sp-lg) var(--sp-xl);
    background: var(--c-border);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-lg);
    color: var(--c-text);
    font-size: var(--fs-lg);
    letter-spacing: 0.02em;
  }
</style>
