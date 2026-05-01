<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { viewStore } from "$lib/stores/view.svelte";
  import { perfStore } from "$lib/stores/perf.svelte";
  import { toolStore } from "$lib/stores/tool.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { waveformPyramidStore } from "$lib/stores/waveform-pyramid.svelte";
  import {
    buildWaveformPyramid,
    sampleWaveformRange,
    type WaveformPyramid,
  } from "$lib/dsp/waveform-pyramid";
  import { centroidStore } from "$lib/stores/centroid.svelte";
  import { kicksStore } from "$lib/stores/kicks.svelte";
  import { STFT_STREAMING_COMPLETE } from "$lib/stores/tasks.svelte";
  import type { StftResult } from "$lib/dsp/stft";
  import type { DecodedAudio } from "$lib/audio/decode";
  import {
    paletteCss,
    frequencyToPaletteT,
  } from "$lib/render/waveform-palette";

  let {
    audio,
    stft = null,
    streamingProgress = 1,
    hoverTime = $bindable(),
    interactive = true,
    onContextMenu,
  }: {
    audio: DecodedAudio | null;
    stft?: StftResult | null;
    streamingProgress?: number;
    hoverTime?: number | null;
    interactive?: boolean;
    onContextMenu?: (pos: { x: number; y: number }) => void;
  } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let plot: HTMLDivElement | undefined = $state();
  let renderScheduled = false;
  let waveColor = "#dbdbdb";

  // Warm orange — distinct from clipping markers (red) and the
  // dB guide colors (red / orange-yellow at 0 / -1 dBFS).
  const KICK_MARKER_COLOR = "rgba(255, 156, 74, 0.85)";

  let plotWidth = $state(1);
  let plotHeight = $state(1);

  type DualLane = {
    pcmA: Float32Array;
    pcmB: Float32Array;
    pyramidA: WaveformPyramid;
    pyramidB: WaveformPyramid;
  };

  let pyramid: WaveformPyramid | null = null;
  let dualLane: DualLane | null = null;
  let dualLaneFor: { pcm: Float32Array; mode: string } | null = null;
  let minBuf: Float32Array | null = null;
  let maxBuf: Float32Array | null = null;

  // Offscreen canvas reused across lane draws: lets us combine per-pixel
  // colored bars with the smooth envelope mask via destination-in
  // compositing in isolation, then blit the result to the main canvas
  // in a single drawImage. Much cheaper than ctx.clip() + N fillRects
  // on the main canvas, where every rect re-evaluates the clip mask.
  let offCanvas: HTMLCanvasElement | null = null;
  function getOffCtx(
    width: number,
    height: number,
  ): CanvasRenderingContext2D | null {
    if (!offCanvas) offCanvas = document.createElement("canvas");
    if (offCanvas.width !== width || offCanvas.height !== height) {
      offCanvas.width = width;
      offCanvas.height = height;
    }
    const c = offCanvas.getContext("2d");
    if (!c) return null;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, width, height);
    return c;
  }

  // Build a closed path on `ctx` that follows the top envelope from
  // x=0 to x=width, then drops to the bottom envelope and runs back.
  // Each segment between pixel centers is a quadratic curve passing
  // through the boundary midpoint with control = the actual sampled
  // value. The min/max values themselves are NOT modified — the curve
  // is purely a drawing-time interpolation between exact samples.
  // Caller decides whether to fill, stroke, or clip the path.
  function buildSmoothEnvelopePath(
    ctx: CanvasRenderingContext2D,
    mid: number,
    halfH: number,
    width: number,
    minBuf: Float32Array,
    maxBuf: Float32Array,
  ): void {
    ctx.beginPath();
    // Top contour, left → right.
    ctx.moveTo(0, mid - maxBuf[0] * halfH);
    for (let i = 0; i < width - 1; i++) {
      const cy = mid - maxBuf[i] * halfH;
      const nx = i + 1;
      const ny = mid - ((maxBuf[i] + maxBuf[i + 1]) / 2) * halfH;
      ctx.quadraticCurveTo(i + 0.5, cy, nx, ny);
    }
    ctx.quadraticCurveTo(
      width - 0.5,
      mid - maxBuf[width - 1] * halfH,
      width,
      mid - maxBuf[width - 1] * halfH,
    );
    // Right edge, vertical down.
    ctx.lineTo(width, mid - minBuf[width - 1] * halfH);
    // Bottom contour, right → left.
    for (let i = width - 1; i > 0; i--) {
      const cy = mid - minBuf[i] * halfH;
      const nx = i;
      const ny = mid - ((minBuf[i] + minBuf[i - 1]) / 2) * halfH;
      ctx.quadraticCurveTo(i + 0.5, cy, nx, ny);
    }
    ctx.quadraticCurveTo(
      0.5,
      mid - minBuf[0] * halfH,
      0,
      mid - minBuf[0] * halfH,
    );
    ctx.closePath();
  }

  const dualEnabled = $derived(
    settingsStore.waveformDisplayMode !== "mono" &&
      !!audio?.pcmLeft &&
      !!audio?.pcmRight,
  );

  const lanes = $derived.by(() => {
    if (settingsStore.waveformDisplayMode === "leftRight") {
      return {
        labelA: "L",
        tooltipA: t("waveform.lane_left_tooltip"),
        labelB: "R",
        tooltipB: t("waveform.lane_right_tooltip"),
        tintA: null as string | null,
        tintB: null as string | null,
      };
    }
    return {
      labelA: "M",
      tooltipA: t("waveform.lane_mid_tooltip"),
      labelB: "S",
      tooltipB: t("waveform.lane_side_tooltip"),
      tintA: "rgba(107, 139, 255, 0.07)" as string | null,
      tintB: "rgba(255, 90, 108, 0.07)" as string | null,
    };
  });

  const visibleRange = $derived(viewStore.timeEnd - viewStore.timeStart);

  function xToTime(x: number): number {
    return viewStore.timeStart + (x / plotWidth) * visibleRange;
  }

  function ensureBufs(width: number) {
    if (!minBuf || minBuf.length < width) {
      minBuf = new Float32Array(width);
      maxBuf = new Float32Array(width);
    }
  }

  function sampleAt(pcm: Float32Array, idx: number, total: number): number {
    const i0 = Math.floor(idx);
    const i1 = Math.min(total - 1, i0 + 1);
    const frac = idx - i0;
    return pcm[i0] * (1 - frac) + pcm[i1] * frac;
  }

  function draw() {
    if (!canvas) return;
    const t0 = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(plotWidth * dpr));
    const height = Math.max(1, Math.floor(plotHeight * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    if (!audio || visibleRange <= 0) return;

    const sr = audio.sampleRate;
    const startSample = Math.max(0, Math.floor(viewStore.timeStart * sr));
    const endSample = Math.min(audio.pcm.length, Math.ceil(viewStore.timeEnd * sr));
    if (endSample <= startSample) return;

    const span = endSample - startSample;
    const samplesPerPixel = span / width;

    let level = -1;
    if (dualEnabled && dualLane) {
      const half = height / 2;
      level = drawTrack(ctx, dpr, width, 0, half,
                        dualLane.pcmA, dualLane.pyramidA,
                        startSample, endSample, sr, span, samplesPerPixel,
                        lanes.tintA);
      drawTrack(ctx, dpr, width, half, half,
                dualLane.pcmB, dualLane.pyramidB,
                startSample, endSample, sr, span, samplesPerPixel,
                lanes.tintB);
      // Median line separating the two lanes.
      ctx.strokeStyle = "rgba(139, 148, 181, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, half);
      ctx.lineTo(width, half);
      ctx.stroke();
    } else {
      level = drawTrack(ctx, dpr, width, 0, height, audio.pcm, pyramid,
                        startSample, endSample, sr, span, samplesPerPixel,
                        null);
    }

    if (perfStore.debugMode) {
      perfStore.setWaveLevel(level, samplesPerPixel);
    }
    perfStore.setWaveDraw(performance.now() - t0);
  }

  const NICE_TIME_STEPS = [
    0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30,
    60, 120, 300, 600, 1800, 3600,
  ];

  function pickTimeStep(range: number, target: number): number {
    const rough = range / target;
    for (const s of NICE_TIME_STEPS) {
      if (s >= rough) return s;
    }
    return NICE_TIME_STEPS[NICE_TIME_STEPS.length - 1];
  }

  function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    yTop: number,
    laneHeight: number,
    timeStart: number,
    timeEnd: number,
  ) {
    const range = timeEnd - timeStart;
    if (range <= 0) return;
    const timeDivisions = settingsStore.waveformGridTimeDivisions;
    const ampStep = settingsStore.waveformGridAmpStep;
    if (timeDivisions <= 0 && ampStep <= 0) return;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    if (timeDivisions > 0) {
      const step = pickTimeStep(range, timeDivisions);
      const firstTick = Math.ceil(timeStart / step) * step;
      for (let t = firstTick; t <= timeEnd; t += step) {
        const x = Math.round(((t - timeStart) / range) * width) + 0.5;
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yTop + laneHeight);
      }
    }

    if (ampStep > 0) {
      const mid = yTop + laneHeight / 2;
      const halfH = laneHeight / 2;
      for (let lvl = -1 + ampStep; lvl < 1; lvl += ampStep) {
        const y = Math.round(mid - lvl * halfH) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
    }

    ctx.stroke();
  }

  function drawTrack(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    width: number,
    yTop: number,
    laneHeight: number,
    pcmSrc: Float32Array,
    pyramidSrc: WaveformPyramid | null,
    startSample: number,
    endSample: number,
    sr: number,
    span: number,
    samplesPerPixel: number,
    tint: string | null,
  ): number {
    const total = pcmSrc.length;
    const mid = yTop + laneHeight / 2;
    const halfH = laneHeight / 2;

    // 0. Background tint (visually distinguishes Mid and Side lanes).
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, yTop, width, laneHeight);
    }

    drawGrid(
      ctx,
      width,
      yTop,
      laneHeight,
      viewStore.timeStart,
      viewStore.timeEnd,
    );

    const centroidData = centroidStore.data;
    const colorByCentroid =
      settingsStore.waveformColorMode === "spectral" &&
      centroidData !== null &&
      stft !== null;
    const palette = settingsStore.waveformPalette;

    function colorForPixel(x: number): string {
      if (!colorByCentroid || !stft) return waveColor;
      const tCenter = (startSample + (x + 0.5) * (span / width)) / sr;
      const frameIdx = Math.max(
        0,
        Math.min(stft.timeFrames - 1, Math.round((tCenter * sr) / stft.hopSize)),
      );
      const cHz = centroidData![frameIdx];
      if (cHz <= 0) return waveColor;
      return paletteCss(palette, frequencyToPaletteT(cHz));
    }

    let level = -1;

    // 1. Vertical true-peak markers (background, semi-transparent).
    if (
      settingsStore.waveformShowClippingMarkers &&
      samplesPerPixel >= 1 &&
      pyramidSrc !== null
    ) {
      ensureBufs(width);
      level = sampleWaveformRange(
        pyramidSrc,
        pcmSrc,
        startSample,
        endSample,
        width,
        minBuf!,
        maxBuf!,
      );
      const TP = 0.965; // ≈ -0.3 dBTP, seuil streaming
      const fillStyle = "rgba(255, 90, 108, 0.32)";
      const edgeStyle = "rgba(255, 90, 108, 0.95)";
      const edgeWidth = Math.max(1, Math.round(dpr));
      const edgeBarHeight = Math.max(4, Math.round(6 * dpr));
      ctx.fillStyle = fillStyle;
      let runStart = -1;
      const flush = (x: number) => {
        if (runStart < 0) return;
        const w = x - runStart;
        // Semi-transparent fill spanning the lane height.
        ctx.fillStyle = fillStyle;
        ctx.fillRect(runStart, yTop, w, laneHeight);
        // Opaque edge strips left and right to mark the start/end of the run.
        ctx.fillStyle = edgeStyle;
        ctx.fillRect(runStart, yTop, edgeWidth, laneHeight);
        ctx.fillRect(x - edgeWidth, yTop, edgeWidth, laneHeight);
        // Solid red rails at the top and bottom, VU-meter style.
        ctx.fillRect(runStart, yTop, w, edgeBarHeight);
        ctx.fillRect(runStart, yTop + laneHeight - edgeBarHeight, w, edgeBarHeight);
        runStart = -1;
      };
      for (let x = 0; x < width; x++) {
        const peak = Math.max(Math.abs(maxBuf![x]), Math.abs(minBuf![x]));
        const above = peak >= TP;
        if (above && runStart < 0) runStart = x;
        if (!above && runStart >= 0) flush(x);
      }
      if (runStart >= 0) flush(width);
    }

    // 2. Min/max envelope (absolute peaks).
    // At high zoom (<= 8 samples per pixel) draw an interpolated polyline
    // rather than per-pixel vertical strokes: the curve stays continuous,
    // no disjoint stripes.
    if (samplesPerPixel < 8) {
      ctx.lineWidth = Math.max(1, dpr);
      if (colorByCentroid) {
        for (let x = 0; x < width - 1; x++) {
          const idx0 = startSample + (x / width) * span;
          const idx1 = startSample + ((x + 1) / width) * span;
          const v0 = sampleAt(pcmSrc, idx0, total);
          const v1 = sampleAt(pcmSrc, idx1, total);
          ctx.strokeStyle = colorForPixel(x);
          ctx.beginPath();
          ctx.moveTo(x, mid - v0 * halfH);
          ctx.lineTo(x + 1, mid - v1 * halfH);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = waveColor;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const sampleIdx = startSample + (x / width) * span;
          const v = sampleAt(pcmSrc, sampleIdx, total);
          const y = mid - v * halfH;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else {
      ensureBufs(width);
      level = sampleWaveformRange(
        pyramidSrc,
        pcmSrc,
        startSample,
        endSample,
        width,
        minBuf!,
        maxBuf!,
      );
      ctx.lineWidth = 1;
      const smooth = settingsStore.waveformSmooth && width >= 2;

      let spectralSmoothDrawn = false;
      if (colorByCentroid && smooth) {
        // Spectral coloring + smooth via offscreen compositing.
        // 1. Paint per-pixel colored bars on the offscreen canvas in
        //    lane-relative coords (offMid = laneHeight/2).
        // 2. Apply the smooth envelope path as alpha mask via
        //    destination-in (keeps existing pixels only where source
        //    is opaque).
        // 3. Blit the masked result onto the main canvas at yTop.
        // Avoids the per-fillRect clip-evaluation cost of ctx.clip(),
        // which was the bottleneck combining N rects with a 2*width
        // quadratic clip path.
        const oCtx = getOffCtx(width, laneHeight);
        if (oCtx && offCanvas) {
          const offMid = laneHeight / 2;
          for (let x = 0; x < width; x++) {
            const yMax = offMid - maxBuf![x] * halfH;
            const yMin = offMid - minBuf![x] * halfH;
            const h = Math.max(1, yMin - yMax);
            oCtx.fillStyle = colorForPixel(x);
            oCtx.fillRect(x, yMax, 1, h);
          }
          oCtx.globalCompositeOperation = "destination-in";
          buildSmoothEnvelopePath(
            oCtx,
            offMid,
            halfH,
            width,
            minBuf!,
            maxBuf!,
          );
          oCtx.fillStyle = "#000";
          oCtx.fill();
          oCtx.globalCompositeOperation = "source-over";
          ctx.drawImage(offCanvas, 0, yTop);
          spectralSmoothDrawn = true;
        }
      }

      if (spectralSmoothDrawn) {
        // already handled
      } else if (colorByCentroid) {
        // Per-pixel colored envelope: fillRect avoids the beginPath/stroke
        // overhead of a per-pixel ctx.stroke() call (~5-10x faster).
        for (let x = 0; x < width; x++) {
          const yMax = mid - maxBuf![x] * halfH;
          const yMin = mid - minBuf![x] * halfH;
          const h = Math.max(1, yMin - yMax);
          ctx.fillStyle = colorForPixel(x);
          ctx.fillRect(x, yMax, 1, h);
        }
      } else if (smooth) {
        // Neutral coloring + smooth: a single filled shape with the
        // smooth top/bottom contours.
        ctx.fillStyle = waveColor;
        buildSmoothEnvelopePath(ctx, mid, halfH, width, minBuf!, maxBuf!);
        ctx.fill();
      } else {
        ctx.strokeStyle = waveColor;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const yMax = mid - maxBuf![x] * halfH;
          const yMin = mid - minBuf![x] * halfH;
          ctx.moveTo(x + 0.5, yMax);
          ctx.lineTo(x + 0.5, Math.max(yMax + 1, yMin));
        }
        ctx.stroke();
      }
    }

    // 4. Kick markers (vertical orange ticks at each detected low-band
    // onset). The data comes from kicksStore, which runs the worker
    // job lazily when the user toggles the option on.
    if (settingsStore.waveformShowKicks && kicksStore.data) {
      const kicks = kicksStore.data.onsets;
      const tStart = startSample / sr;
      const tEnd = endSample / sr;
      const tSpan = Math.max(1e-9, tEnd - tStart);
      const tickWidth = Math.max(1, Math.round(dpr));
      ctx.fillStyle = KICK_MARKER_COLOR;
      for (let i = 0; i < kicks.length; i++) {
        const t = kicks[i];
        if (t < tStart) continue;
        if (t > tEnd) break;
        const x = Math.round(((t - tStart) / tSpan) * width) - (tickWidth >> 1);
        ctx.fillRect(x, yTop, tickWidth, laneHeight);
      }
    }

    // 5. Horizontal clipping guides (0 dBFS red, -1 dBFS dashed orange).
    if (settingsStore.waveformShowClippingGuides) {
      const drawGuide = (lvl: number, color: string, dashed: boolean) => {
        const yT = mid - lvl * halfH;
        const yB = mid + lvl * halfH;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash(dashed ? [4 * dpr, 3 * dpr] : []);
        ctx.beginPath();
        ctx.moveTo(0, yT);
        ctx.lineTo(width, yT);
        ctx.moveTo(0, yB);
        ctx.lineTo(width, yB);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      drawGuide(1.0, "rgba(255, 90, 108, 0.55)", false); // 0 dBFS
      drawGuide(0.891, "rgba(255, 184, 107, 0.55)", true); // -1 dBFS
    }

    return level;
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      draw();
    });
  }

  type Interaction =
    | { kind: "none" }
    | { kind: "pan"; startX: number; startTime: number; startEnd: number }
    | { kind: "zoom"; startTime: number; endTime: number };

  let interaction: Interaction = $state({ kind: "none" });
  const zoomRect = $derived.by(() => {
    if (interaction.kind !== "zoom") return null;
    const x1 = ((interaction.startTime - viewStore.timeStart) / Math.max(1e-9, visibleRange)) * plotWidth;
    const x2 = ((interaction.endTime - viewStore.timeStart) / Math.max(1e-9, visibleRange)) * plotWidth;
    return { x: Math.min(x1, x2), w: Math.abs(x2 - x1) };
  });

  function onPointerDown(e: PointerEvent) {
    if (!interactive) return;
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    target.setPointerCapture(e.pointerId);
    const isZoom = toolStore.mode === "zoom" || e.altKey;
    if (isZoom) {
      const t0 = xToTime(localX);
      interaction = { kind: "zoom", startTime: t0, endTime: t0 };
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
    if (!interactive) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (localX >= 0 && localX <= plotWidth) {
      hoverTime = xToTime(localX);
    }
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
    } else if (interaction.kind === "zoom") {
      const clampedX = Math.max(0, Math.min(plotWidth, localX));
      interaction = {
        kind: "zoom",
        startTime: interaction.startTime,
        endTime: xToTime(clampedX),
      };
    }
  }

  function onPointerLeave() {
    hoverTime = null;
  }

  function resetZoom() {
    if (!interactive) return;
    if (viewStore.duration > 0) {
      viewStore.setRange(0, viewStore.duration);
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!interactive) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId))
      target.releasePointerCapture(e.pointerId);
    if (interaction.kind === "zoom") {
      const t1 = Math.min(interaction.startTime, interaction.endTime);
      const t2 = Math.max(interaction.startTime, interaction.endTime);
      if (t2 - t1 > 0.01) viewStore.setRange(t1, t2);
    }
    interaction = { kind: "none" };
  }

  function onWheel(e: WheelEvent) {
    if (!interactive) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const factor = Math.exp(e.deltaY * 0.0015);
    viewStore.zoomAt(ratio, factor);
  }

  onMount(() => {
    const resolved = getComputedStyle(document.documentElement)
      .getPropertyValue("--c-waveform")
      .trim();
    if (resolved) waveColor = resolved;

    if (!plot) return;
    const plotEl = plot;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      plotWidth = rect.width;
      plotHeight = rect.height;
    });
    observer.observe(plotEl);

    const rect = plotEl.getBoundingClientRect();
    plotWidth = rect.width;
    plotHeight = rect.height;

    return () => {
      observer.disconnect();
    };
  });

  // The mono pyramid is built once per audio in the global
  // waveformPyramidStore (kicked off by +page.svelte the moment the PCM
  // is decoded). Mirror its readiness here so drawTrack picks it up.
  $effect(() => {
    if (!audio) {
      pyramid = null;
      return;
    }
    pyramid = waveformPyramidStore.pyramid;
    scheduleRender();
  });

  // Spectral centroid is computed in the DSP worker only when the
  // user picks the spectral color mode, and only once the streaming
  // STFT is complete (mid-stream frames clamped at dbFloor would skew
  // the centroid towards Nyquist). The centroidStore caches the
  // result per-STFT, so toggling the mode off/on never recomputes.
  $effect(() => {
    if (settingsStore.waveformColorMode !== "spectral") return;
    if (!stft || streamingProgress < STFT_STREAMING_COMPLETE) return;
    centroidStore.ensure(stft);
  });

  // Same contract for kick markers: only fire the worker job when the
  // user has the toggle on and the STFT is final. runOnsets is told
  // to restrict its spectral flux to the kick band.
  $effect(() => {
    if (!settingsStore.waveformShowKicks) return;
    if (!stft || streamingProgress < STFT_STREAMING_COMPLETE) return;
    kicksStore.ensure(stft);
  });

  $effect(() => {
    const mode = settingsStore.waveformDisplayMode;
    if (mode === "mono" || !audio?.pcmLeft || !audio?.pcmRight) {
      dualLane = null;
      dualLaneFor = null;
      return;
    }
    if (dualLaneFor?.pcm === audio.pcm && dualLaneFor?.mode === mode) return;

    const L = audio.pcmLeft;
    const R = audio.pcmRight;
    const n = Math.min(L.length, R.length);
    let pcmA: Float32Array;
    let pcmB: Float32Array;
    if (mode === "leftRight") {
      pcmA = L.subarray(0, n);
      pcmB = R.subarray(0, n);
    } else {
      // Mastering convention: Mid = (L+R)/2, Side = (L-R)/2. Peaks stay
      // bounded by max(|L|, |R|) so the clipping indicators remain
      // consistent with L/R mode.
      pcmA = new Float32Array(n);
      pcmB = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pcmA[i] = (L[i] + R[i]) * 0.5;
        pcmB[i] = (L[i] - R[i]) * 0.5;
      }
    }
    dualLaneFor = { pcm: audio.pcm, mode };
    dualLane = null;
    scheduleRender();

    const win = window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const buildDual = () => {
      if (dualLaneFor?.pcm !== audio.pcm || dualLaneFor?.mode !== mode) return;
      dualLane = {
        pcmA,
        pcmB,
        pyramidA: buildWaveformPyramid(pcmA),
        pyramidB: buildWaveformPyramid(pcmB),
      };
      scheduleRender();
    };
    let dualHandle: number | null = null;
    let rafHandle: number | null = null;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      if (win.requestIdleCallback) {
        dualHandle = win.requestIdleCallback(buildDual, { timeout: 200 });
      } else {
        dualHandle = setTimeout(buildDual, 0) as unknown as number;
      }
    });
    return () => {
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
      if (dualHandle != null) {
        if (win.cancelIdleCallback && win.requestIdleCallback) {
          win.cancelIdleCallback(dualHandle);
        } else {
          clearTimeout(dualHandle);
        }
      }
    };
  });

  $effect(() => {
    void plotWidth;
    void plotHeight;
    void viewStore.timeStart;
    void viewStore.timeEnd;
    void audio;
    void settingsStore.waveformColorMode;
    void settingsStore.waveformPalette;
    void settingsStore.waveformDisplayMode;
    void settingsStore.waveformShowClippingGuides;
    void settingsStore.waveformShowClippingMarkers;
    void settingsStore.waveformShowKicks;
    void settingsStore.waveformSmooth;
    void settingsStore.waveformGridTimeDivisions;
    void settingsStore.waveformGridAmpStep;
    void centroidStore.data;
    void kicksStore.data;
    scheduleRender();
  });
</script>

<div
  class="plot"
  class:non-interactive={!interactive}
  class:cursor-text={interactive && toolStore.effective === "zoom"}
  role="img"
  aria-label={t("waveform.label")}
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
  {#if zoomRect}
    <div
      class="zoom-overlay"
      style:left="{zoomRect.x}px"
      style:width="{zoomRect.w}px"
    ></div>
  {/if}
  {#if dualEnabled}
    <span
      class="lane-badge top"
      data-tooltip={lanes.tooltipA}>{lanes.labelA}</span>
    <span
      class="lane-badge bottom"
      data-tooltip={lanes.tooltipB}
      data-tooltip-placement="top">{lanes.labelB}</span>
  {/if}
</div>

<style>
  .plot {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
    background: #000;
    box-sizing: border-box;
  }

  .plot:active {
    cursor: grabbing;
  }

  .plot.cursor-text,
  .plot.cursor-text:active {
    cursor: text;
  }

  /* When the waveform is non-interactive (analyses view) the grab/text
     cursors are misleading: nothing happens on drag. Show the default
     pointer instead. */
  .plot.non-interactive,
  .plot.non-interactive:active {
    cursor: default;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .zoom-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(180, 200, 255, 0.15);
    border-left: 1px solid rgba(220, 230, 255, 0.85);
    border-right: 1px solid rgba(220, 230, 255, 0.85);
    pointer-events: none;
  }

  .lane-badge {
    position: absolute;
    left: 6px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(12, 13, 18, 0.7);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--c-text-muted);
    cursor: help;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .lane-badge.top {
    top: 6px;
  }

  .lane-badge.bottom {
    bottom: 6px;
  }
</style>
