<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import {
    startStreamingStft,
    downsampleTime,
    secondsToFrame,
    type StftResult,
  } from "$lib/dsp/stft";
  import {
    downsampleFromPyramid,
    type Pyramid,
  } from "$lib/dsp/pyramid";
  import {
    runSpecPyramidFromL0,
    runSpecPyramidFromMagnitudes,
  } from "$lib/dsp/dsp-client";
  import { buildLut, buildCustomLut, colormapVerticalCss } from "$lib/colormap";
  import {
    createSpectrogramRenderer,
    type SpectrogramRenderer,
  } from "$lib/render/spectrogram";
  import { viewStore } from "$lib/stores/view.svelte";
  import { selectionStore, type Selection } from "$lib/stores/selection.svelte";
  import { renderStore } from "$lib/stores/render.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { perfStore } from "$lib/stores/perf.svelte";
  import {
    taskStore,
    STFT_STREAMING_COMPLETE,
  } from "$lib/stores/tasks.svelte";
  import { toolStore } from "$lib/stores/tool.svelte";
  import { markersStore } from "$lib/stores/markers.svelte";
  import { niceTicks, formatTime, formatFrequency } from "$lib/render/axes";
  import { cursorInfoStore } from "$lib/stores/cursor-info.svelte";
  import { formatTimecode, formatHz, freqToNote } from "$lib/format";
  import type { DecodedAudio } from "$lib/audio/decode";

  let {
    audio,
    loading = false,
    streamingProgress = 1,
    canvasRef = $bindable(),
    stftRef = $bindable(),
    pyramidRef = $bindable(),
    hoverTime = $bindable(),
    hoverFreq = $bindable(),
    onContextMenu,
  }: {
    audio: DecodedAudio | null;
    loading?: boolean;
    streamingProgress?: number;
    canvasRef?: HTMLCanvasElement | null;
    stftRef?: StftResult | null;
    pyramidRef?: Pyramid | null;
    hoverTime?: number | null;
    hoverFreq?: number | null;
    onContextMenu?: (pos: { x: number; y: number }) => void;
  } = $props();

  // Loading message shown centered while decoding is in progress OR
  // while the STFT is not yet finalized. The text sits above the
  // canvas in z-index, but is clipped progressively from left to right
  // at the same speed the STFT fills the area: visual effect of the
  // spectrogram eating the text.
  const showLoading = $derived(
    loading || streamingProgress < STFT_STREAMING_COMPLETE,
  );

  // During the pure decoding phase (audio not yet ready) no clip — the
  // text stays fully visible. As soon as the STFT streams, the left
  // portion is clipped following the progress.
  const loadingClipPercent = $derived(
    audio === null ? 0 : Math.min(100, streamingProgress * 100),
  );

  let canvas: HTMLCanvasElement | undefined = $state();
  let plot: HTMLDivElement | undefined = $state();
  let renderer: SpectrogramRenderer | null = null;
  let stft: StftResult | null = null;
  let pyramid: Pyramid | null = null;
  let renderScheduled = false;
  let specBuf: Uint8Array | null = null;

  let plotWidth = $state(1);
  let plotHeight = $state(1);

  let pending = $state<Selection | null>(null);

  const nyquist = $derived((audio?.sampleRate ?? 2) / 2);
  const visibleRange = $derived(viewStore.timeEnd - viewStore.timeStart);
  const canPan = $derived(
    viewStore.duration > 0 && visibleRange < viewStore.duration - 1e-6,
  );
  const selection = $derived(selectionStore.current);

  const timeAxis = $derived.by(() => {
    const approx = Math.max(3, Math.floor(plotWidth / 90));
    const start = viewStore.timeStart;
    const end = viewStore.timeEnd;
    if (end <= start) return { ticks: [], step: 1 };
    const inner = niceTicks(start, end, approx);
    const step =
      inner.length >= 2 ? inner[1] - inner[0] : (end - start) / approx;
    const margin = step / 2;
    const filtered = inner.filter(
      (tick) => tick - start > margin && end - tick > margin,
    );
    return { ticks: [start, ...filtered, end], step };
  });

  const timeTicks = $derived(timeAxis.ticks);
  const timeStep = $derived(timeAxis.step);

  const freqTicks = $derived.by(() => {
    if (!audio) return [];
    const approx = Math.max(4, Math.floor(plotHeight / 40));
    return niceTicks(0, nyquist, approx);
  });

  const dbTicks = $derived.by(() => {
    const approx = Math.max(3, Math.floor(plotHeight / 50));
    return niceTicks(renderStore.dbFloor, renderStore.dbCeiling, approx);
  });

  const colormapCss = $derived(
    colormapVerticalCss(settingsStore.colormap, settingsStore.customStops),
  );

  function dbToY(db: number): number {
    const range = renderStore.dbCeiling - renderStore.dbFloor;
    if (range <= 0) return 0;
    return plotHeight - ((db - renderStore.dbFloor) / range) * plotHeight;
  }

  function timeToX(t: number): number {
    if (visibleRange <= 0) return 0;
    return ((t - viewStore.timeStart) / visibleRange) * plotWidth;
  }

  function xToTime(x: number): number {
    return viewStore.timeStart + (x / plotWidth) * visibleRange;
  }

  function freqToY(hz: number): number {
    return plotHeight - (hz / nyquist) * plotHeight;
  }

  function yToFreq(y: number): number {
    return ((plotHeight - y) / plotHeight) * nyquist;
  }

  function ensureBuffer(buf: Uint8Array | null, size: number): Uint8Array {
    if (buf && buf.length >= size) return buf;
    return new Uint8Array(size);
  }

  function render() {
    if (!renderer || !plot) return;
    const t0 = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(plotWidth * dpr));
    const height = Math.max(1, Math.floor(plotHeight * dpr));
    renderer.resize(width, height);

    if (!stft) {
      renderer.draw();
      perfStore.setSpecDraw(performance.now() - t0);
      return;
    }

    const frameStart = Math.max(0, secondsToFrame(stft, viewStore.timeStart));
    const frameEnd = Math.max(
      frameStart + 1,
      secondsToFrame(stft, viewStore.timeEnd),
    );
    const range = { start: frameStart, end: frameEnd };

    specBuf = ensureBuffer(specBuf, width * stft.freqBins);
    const spectrum = pyramid
      ? downsampleFromPyramid(pyramid, width, range, specBuf)
      : downsampleTime(stft, width, range, specBuf, 4);
    renderer.uploadSpectrum(spectrum.data, spectrum.width, spectrum.height);

    renderer.setDbRange(
      renderStore.dbFloor,
      renderStore.dbCeiling,
      renderStore.dataFloor,
      renderStore.dataCeiling,
    );
    renderer.draw();

    if (perfStore.debugMode) {
      const framesPerPixel = (frameEnd - frameStart) / Math.max(1, width);
      perfStore.setSpecLevel(spectrum.level, framesPerPixel);
      perfStore.setCanvas(plotWidth, plotHeight, dpr);
    }
    perfStore.setSpecDraw(performance.now() - t0);
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  }

  type Interaction =
    | { kind: "none" }
    | { kind: "pan"; startX: number; startTime: number; startEnd: number }
    | { kind: "select"; startX: number; startY: number }
    | { kind: "zoom"; startX: number; startY: number }
    | {
        kind: "move-selection";
        startX: number;
        startY: number;
        base: Selection;
      };

  let interaction: Interaction = $state({ kind: "none" });
  let hoverInSelection = $state(false);

  function pointInSelection(x: number, y: number): boolean {
    if (!selection) return false;
    const x1 = timeToX(selection.timeStart);
    const x2 = timeToX(selection.timeEnd);
    const y1 = freqToY(selection.freqStart);
    const y2 = freqToY(selection.freqEnd);
    return (
      x >= Math.min(x1, x2) &&
      x <= Math.max(x1, x2) &&
      y >= Math.min(y1, y2) &&
      y <= Math.max(y1, y2)
    );
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    target.setPointerCapture(e.pointerId);

    const forceSelect = e.shiftKey;
    const forceZoom = e.altKey;
    const mode: "pan" | "select" | "zoom" = forceSelect
      ? "select"
      : forceZoom
        ? "zoom"
        : toolStore.mode;

    if (mode === "select") {
      if (selection && pointInSelection(localX, localY)) {
        interaction = {
          kind: "move-selection",
          startX: localX,
          startY: localY,
          base: selection,
        };
        pending = { ...selection };
        return;
      }
      interaction = { kind: "select", startX: localX, startY: localY };
      pending = {
        timeStart: xToTime(localX),
        timeEnd: xToTime(localX),
        freqStart: yToFreq(localY),
        freqEnd: yToFreq(localY),
      };
      selectionStore.clear();
    } else if (mode === "zoom") {
      interaction = { kind: "zoom", startX: localX, startY: localY };
      pending = {
        timeStart: xToTime(localX),
        timeEnd: xToTime(localX),
        freqStart: 0,
        freqEnd: nyquist,
      };
    } else {
      interaction = {
        kind: "pan",
        startX: e.clientX,
        startTime: viewStore.timeStart,
        startEnd: viewStore.timeEnd,
      };
    }
  }

  function onPointerMove(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const inside =
      localX >= 0 &&
      localX <= plotWidth &&
      localY >= 0 &&
      localY <= plotHeight;
    if (inside) {
      hoverTime = xToTime(localX);
      hoverFreq = yToFreq(localY);
      // Skip the rich cursor-info push while the user is actively
      // dragging the canvas: the four formatted cells + state proxy
      // notifications at 60 Hz are enough to introduce visible
      // stutters on the spectrogram (the waveform doesn't push to
      // the store and stays smooth). We resume on the next move
      // after pointerup.
      if (interaction.kind === "none") {
        pushCursorInfo(e.clientX, e.clientY, rect, hoverTime, hoverFreq);
      }
    }

    hoverInSelection =
      toolStore.mode === "select" &&
      interaction.kind === "none" &&
      pointInSelection(localX, localY);

    if (interaction.kind === "pan") {
      // Skip when fully zoomed out: clamp() would always renormalize
      // back to (0, duration). No visible change at 60+ Hz.
      if (
        interaction.startTime <= 0 &&
        interaction.startEnd >= viewStore.duration
      ) {
        return;
      }
      const range = interaction.startEnd - interaction.startTime;
      const dt = ((interaction.startX - e.clientX) / plotWidth) * range;
      viewStore.setRange(interaction.startTime + dt, interaction.startEnd + dt);
    } else if (interaction.kind === "select") {
      const clampedX = Math.max(0, Math.min(plotWidth, localX));
      const clampedY = Math.max(0, Math.min(plotHeight, localY));
      pending = {
        timeStart: xToTime(interaction.startX),
        timeEnd: xToTime(clampedX),
        freqStart: yToFreq(interaction.startY),
        freqEnd: yToFreq(clampedY),
      };
    } else if (interaction.kind === "zoom") {
      const clampedX = Math.max(0, Math.min(plotWidth, localX));
      pending = {
        timeStart: xToTime(interaction.startX),
        timeEnd: xToTime(clampedX),
        freqStart: 0,
        freqEnd: nyquist,
      };
    } else if (interaction.kind === "move-selection") {
      const dt = ((localX - interaction.startX) / plotWidth) * visibleRange;
      const df = -((localY - interaction.startY) / plotHeight) * nyquist;
      pending = {
        timeStart: interaction.base.timeStart + dt,
        timeEnd: interaction.base.timeEnd + dt,
        freqStart: interaction.base.freqStart + df,
        freqEnd: interaction.base.freqEnd + df,
      };
    }
  }

  function onPointerLeave() {
    hoverTime = null;
    hoverFreq = null;
    hoverInSelection = false;
    cursorInfoStore.clear("spectrogram");
  }

  function sampleSpectrogramDb(time: number, hz: number): number | null {
    if (!stft) return null;
    const frame = secondsToFrame(stft, time);
    if (frame < 0 || frame >= stft.timeFrames) return null;
    const nyq = stft.sampleRate / 2;
    const bin = Math.round((hz / nyq) * (stft.freqBins - 1));
    if (bin < 0 || bin >= stft.freqBins) return null;
    return stft.magnitudes[frame * stft.freqBins + bin];
  }

  function pushCursorInfo(
    clientX: number,
    clientY: number,
    bounds: DOMRect,
    time: number,
    freq: number,
  ) {
    const db = sampleSpectrogramDb(time, freq);
    const note = freqToNote(freq);
    cursorInfoStore.set({
      source: "spectrogram",
      clientX,
      clientY,
      bounds,
      cells: [
        { label: t("info.cursor_time"), value: formatTimecode(time) },
        { label: t("info.cursor_freq"), value: formatHz(freq) },
        {
          label: t("info.cursor_energy"),
          value: db != null ? `${db.toFixed(1)} ${t("unit.db")}` : "-",
        },
        {
          label: t("info.cursor_note"),
          value: note
            ? `${note.name}${
                note.cents !== 0
                  ? ` ${note.cents > 0 ? "+" : ""}${note.cents}¢`
                  : ""
              }`
            : "-",
        },
      ],
    });
  }

  function onPointerUp(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId))
      target.releasePointerCapture(e.pointerId);

    if (interaction.kind === "select" && pending) {
      const minDurMs = 10;
      const minHz = 20;
      if (
        Math.abs(pending.timeEnd - pending.timeStart) > minDurMs / 1000 &&
        Math.abs(pending.freqEnd - pending.freqStart) > minHz
      ) {
        selectionStore.set(pending);
      }
      pending = null;
    } else if (interaction.kind === "zoom" && pending) {
      const minDurMs = 10;
      const t1 = Math.min(pending.timeStart, pending.timeEnd);
      const t2 = Math.max(pending.timeStart, pending.timeEnd);
      if (t2 - t1 > minDurMs / 1000) viewStore.setRange(t1, t2);
      pending = null;
    } else if (interaction.kind === "move-selection" && pending) {
      selectionStore.set(pending);
      pending = null;
    }
    interaction = { kind: "none" };
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const factor = Math.exp(e.deltaY * 0.0015);
    viewStore.zoomAt(ratio, factor);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") selectionStore.clear();
    if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      viewStore.setRange(0, viewStore.duration);
    }
  }

  function resetZoom() {
    if (viewStore.duration > 0) {
      viewStore.setRange(0, viewStore.duration);
    }
  }

  let activeStftCancel: (() => void) | null = null;

  async function buildStft(source: DecodedAudio) {
    activeStftCancel?.();
    pyramid = null;
    pyramidRef = null;
    let lastRenderAt = 0;
    const RENDER_THROTTLE_MS = 120;
    const stftStart = performance.now();
    const stftTaskId = taskStore.start("stft", t("tasks.stft"), {
      progress: 0,
    });
    const { result, done, cancel } = startStreamingStft(
      source.pcm,
      source.sampleRate,
      {
        fftSize: settingsStore.fftSize,
        hopSize: settingsStore.hopSize,
        windowType: settingsStore.windowType,
      },
      (completed, total) => {
        taskStore.update(stftTaskId, completed / total);
        const now = performance.now();
        if (now - lastRenderAt > RENDER_THROTTLE_MS) {
          lastRenderAt = now;
          scheduleRender();
        }
      },
    );
    activeStftCancel = cancel;
    stft = result;
    stftRef = result;
    scheduleRender();
    try {
      await done;
    } catch {
      taskStore.end(stftTaskId);
      return;
    }
    if (activeStftCancel !== cancel) {
      taskStore.end(stftTaskId);
      return;
    }
    activeStftCancel = null;
    perfStore.setStft(performance.now() - stftStart);
    perfStore.setMemStft(result.magnitudes.byteLength);
    taskStore.end(stftTaskId);

    // Pyramid build runs in the generic DSP worker so the main thread
    // stays free for the streaming-end paint and any user interaction.
    scheduleRender();
    const pyramidTaskId = taskStore.start(
      "spec_pyramid",
      t("tasks.spec_pyramid"),
    );
    const pyrStart = performance.now();
    try {
      pyramid = result.l0
        ? await runSpecPyramidFromL0(
            result.l0,
            result.freqBins,
            result.timeFrames,
          )
        : await runSpecPyramidFromMagnitudes(
            result.magnitudes,
            result.freqBins,
            result.timeFrames,
            result.dbFloor,
            result.dbCeiling,
          );
      perfStore.setSpecPyramid(performance.now() - pyrStart);
      let pyrBytes = 0;
      for (const lv of pyramid.levels) pyrBytes += lv.byteLength;
      perfStore.setMemSpecPyr(pyrBytes);
      pyramidRef = pyramid;
      scheduleRender();
    } finally {
      taskStore.end(pyramidTaskId);
    }
  }

  onMount(() => {
    if (!canvas || !plot) return;
    const canvasEl = canvas;
    const plotEl = plot;
    renderer = createSpectrogramRenderer(canvasEl);
    canvasRef = canvasEl;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      plotWidth = rect.width;
      plotHeight = rect.height;
    });
    observer.observe(plotEl);

    const rect = plotEl.getBoundingClientRect();
    plotWidth = rect.width;
    plotHeight = rect.height;

    window.addEventListener("keydown", onKeyDown);

    return () => {
      activeStftCancel?.();
      activeStftCancel = null;
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      renderer?.destroy();
      renderer = null;
      stft = null;
      pyramid = null;
      pyramidRef = null;
      specBuf = null;
      canvasRef = null;
    };
  });

  let currentAudio: DecodedAudio | null = null;
  $effect(() => {
    if (!audio) {
      if (currentAudio !== null) {
        currentAudio = null;
        stft = null;
        stftRef = null;
        pyramid = null;
        pyramidRef = null;
        perfStore.resetSession();
        scheduleRender();
      }
      return;
    }
    if (audio !== currentAudio) {
      currentAudio = audio;
      selectionStore.clear();
      stft = null;
      stftRef = null;
      pyramid = null;
      pyramidRef = null;
      perfStore.setMemPcm(audio.pcm.byteLength);
      buildStft(audio);
    }
  });

  $effect(() => {
    void plotWidth;
    void plotHeight;
    void viewStore.timeStart;
    void viewStore.timeEnd;
    void renderStore.dbFloor;
    void renderStore.dbCeiling;
    scheduleRender();
  });

  $effect(() => {
    if (!renderer) return;
    const name = settingsStore.colormap;
    const lut =
      name === "custom"
        ? buildCustomLut(settingsStore.customStops)
        : buildLut(name);
    renderer.setColormapLut(lut);
    scheduleRender();
  });

  $effect(() => {
    if (!renderer) return;
    renderer.setSmoothing(settingsStore.smoothing);
    scheduleRender();
  });

  $effect(() => {
    const fft = settingsStore.fftSize;
    const hop = settingsStore.hopSize;
    const wt = settingsStore.windowType;
    if (!renderer || !stft || !audio) return;
    if (stft.fftSize === fft && stft.hopSize === hop && stft.windowType === wt)
      return;
    specBuf = null;
    const recomputeId = taskStore.start(
      "recompute",
      t("tasks.recomputing"),
    );
    buildStft(audio).finally(() => {
      taskStore.end(recomputeId);
    });
  });

  const overlayRect = $derived.by(() => {
    const sel = pending ?? selection;
    if (!sel) return null;
    const x1 = timeToX(sel.timeStart);
    const x2 = timeToX(sel.timeEnd);
    const y1 = freqToY(sel.freqStart);
    const y2 = freqToY(sel.freqEnd);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  });
</script>

<div class="grid">
  <div class="axis axis-freq">
    {#each freqTicks as hz (hz)}
      {@const y = freqToY(hz)}
      {#if y >= 0 && y <= plotHeight}
        <div class="tick tick-freq" style:top="{y}px">
          <span>{formatFrequency(hz)}</span>
        </div>
      {/if}
    {/each}
  </div>

  <div
    class="plot"
    class:cursor-grab={toolStore.effective === "pan" && canPan}
    class:cursor-text={toolStore.effective === "zoom"}
    class:cursor-crosshair={toolStore.effective === "select" &&
      !hoverInSelection &&
      interaction.kind !== "move-selection"}
    class:cursor-move={hoverInSelection ||
      interaction.kind === "move-selection"}
    role="img"
    aria-label={t("spectrogram.label")}
    bind:this={plot}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onpointerleave={onPointerLeave}
    onwheel={onWheel}
    ondblclick={resetZoom}
    oncontextmenu={(e) => {
      e.preventDefault();
      onContextMenu?.({ x: e.clientX, y: e.clientY });
    }}
  >
    <canvas bind:this={canvas}></canvas>
    {#if showLoading}
      <div
        class="loading-text"
        style:clip-path="inset(0 0 0 {loadingClipPercent}%)"
      >
        {t("spectrogram.decoding")}
      </div>
    {/if}
    {#each markersStore.visible as m (m.id)}
      {@const y = freqToY(m.freq)}
      {#if y >= 0 && y <= plotHeight}
        <div
          class="marker marker-{m.style}"
          style:top="{y}px"
          style:border-top-color={m.color}
          style:border-top-width="{m.thickness}px"
          style:opacity={m.opacity}
        ></div>
        {#if m.labelVisible}
          <div class="marker-label" style:top="{y}px" style:color={m.color}>
            {m.label}
          </div>
        {/if}
      {/if}
    {/each}
    {#if overlayRect}
      <div
        class="selection"
        class:pending={pending !== null}
        style:left="{overlayRect.x}px"
        style:top="{overlayRect.y}px"
        style:width="{overlayRect.w}px"
        style:height="{overlayRect.h}px"
      >
        {#if selection && !pending}
          <span class="hint">{t("selection.cancel_hint")}</span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="colorbar">
    <div class="cb-gradient" style:background={colormapCss}></div>
    <div class="cb-labels">
      {#each dbTicks as db (db)}
        {@const y = dbToY(db)}
        {#if y >= 0 && y <= plotHeight}
          <div class="cb-tick" style:top="{y}px">
            <span>{db} {t("unit.db")}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <div class="axis axis-time">
    {#each timeTicks as t, i (i)}
      {@const x = timeToX(t)}
      {#if x >= 0 && x <= plotWidth}
        <div class="tick tick-time" style:left="{x}px">
          <span>{formatTime(t, timeStep)}</span>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 38px 1fr 94px;
    grid-template-rows: 1fr 24px;
    width: 100%;
    height: 100%;
    background: #000;
  }

  .plot {
    position: relative;
    overflow: hidden;
    cursor: default;
    touch-action: none;
    border: 1px solid var(--c-border);
    box-sizing: border-box;
  }

  .plot.cursor-grab {
    cursor: grab;
  }

  .plot.cursor-grab:active {
    cursor: grabbing;
  }

  .plot.cursor-text,
  .plot.cursor-text:active {
    cursor: text;
  }

  .plot.cursor-crosshair,
  .plot.cursor-crosshair:active {
    cursor: crosshair;
  }

  .plot.cursor-move,
  .plot.cursor-move:active {
    cursor: move;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .loading-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    color: var(--c-text);
    font-size: var(--fs-md);
    pointer-events: none;
    user-select: none;
  }

  .selection {
    position: absolute;
    background: rgba(180, 200, 255, 0.15);
    border: 1px solid rgba(220, 230, 255, 0.85);
    pointer-events: none;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3) inset;
  }

  .hint {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 8px;
    background: rgba(12, 13, 18, 0.9);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    white-space: nowrap;
  }

  .marker {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px solid transparent;
    border-bottom: none;
    border-left: none;
    border-right: none;
    pointer-events: none;
    transform: translateY(-50%);
  }

  .marker-dashed {
    border-top-style: dashed;
  }

  .marker-dotted {
    border-top-style: dotted;
  }

  .marker-solid {
    border-top-style: solid;
  }

  .marker-label {
    position: absolute;
    right: 4px;
    transform: translateY(-100%);
    padding: 0 4px;
    background: rgba(12, 13, 18, 0.75);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    pointer-events: none;
    border-radius: 2px;
    white-space: nowrap;
  }

  .axis {
    position: relative;
    color: var(--axis-label-color);
    font-size: var(--axis-label-size);
    font-family: var(--axis-label-font);
    user-select: none;
  }

  .axis-time {
    grid-column: 2;
    right: -1px;
  }

  .colorbar {
    position: relative;
    display: flex;
    gap: 0;
    border-left: none;
    padding: 0 0 0 12px;
  }

  .cb-gradient {
    width: 20px;
    height: 100%;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .cb-labels {
    position: relative;
    flex: 1;
  }

  .cb-tick {
    position: absolute;
    left: 6px;
    transform: translateY(-50%);
    font-size: var(--axis-label-size);
    font-family: var(--axis-label-font);
    color: var(--axis-label-color);
    pointer-events: none;
    white-space: nowrap;
  }

  .cb-tick::before {
    content: "";
    position: absolute;
    left: -6px;
    top: 50%;
    width: 3px;
    height: 1px;
    background: rgba(139, 148, 181, 0.6);
  }

  .tick {
    position: absolute;
    pointer-events: none;
  }

  .tick-freq {
    right: 6px;
    transform: translateY(-50%);
    text-align: right;
  }

  .tick-freq::after {
    content: "";
    position: absolute;
    top: 50%;
    right: -6px;
    width: 4px;
    height: 1px;
    background: rgba(139, 148, 181, 0.6);
  }

  .tick-time {
    top: 3px;
    transform: translateX(-50%);
  }

  .tick-time::before {
    content: "";
    position: absolute;
    top: -3px;
    left: 50%;
    width: 1px;
    height: 4px;
    background: rgba(139, 148, 181, 0.6);
  }
</style>
