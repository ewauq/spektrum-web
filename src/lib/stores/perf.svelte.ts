interface MemInfo {
  pcm: number;
  stft: number;
  specPyr: number;
  wavePyr: number;
}

export interface PanelTiming {
  computeMs: number;
  renderMs: number;
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

// 5 seconds of history at 60 fps. Long enough to spot intermittent
// stutters and steady-state vs spike behaviour.
const FRAME_BUF = 300;

function createPerfStore() {
  let debugMode = $state(false);
  let fps = $state(0);
  let frameTimeP99 = $state(0);
  // Increments on every frame tick. Subscribe to it to know when the
  // rolling frame-time buffer has changed (the buffer itself is a
  // mutable Float32Array and would not trigger reactivity on writes).
  let tickCount = $state(0);
  let lastSpecDrawMs = $state(0);
  let lastWaveDrawMs = $state(0);
  let decodeMs = $state(0);
  let stftMs = $state(0);
  let specPyramidMs = $state(0);
  let wavePyramidMs = $state(0);
  let specLevel = $state(-1);
  let waveLevel = $state(-1);
  let framesPerPixel = $state(0);
  let samplesPerPixel = $state(0);
  let canvasDpr = $state(1);
  let canvasCssW = $state(0);
  let canvasCssH = $state(0);
  let mem = $state<MemInfo>({ pcm: 0, stft: 0, specPyr: 0, wavePyr: 0 });
  let heapUsed = $state(0);
  let heapTotal = $state(0);
  // Panel-level timings, keyed by panelId. Each panel writes its own
  // compute (DSP / worker round-trip) and render (canvas draw) timings.
  // Intentionally NOT a $state: render is called on every RAF, so a
  // reactive write at 60 fps × N panels would cascade through the
  // bridge's $effect (it reads the same field) and starve the main
  // thread. The bridge already publishes once per tickCount tick, so
  // a plain mutable map suffices — the snapshot picked up at tick
  // time is at most one frame stale.
  const panelTimings: Record<string, PanelTiming> = {};

  const frameBuf = new Float32Array(FRAME_BUF);
  let bufIdx = 0;
  let bufFill = 0;
  let lastFrame = 0;
  let rafHandle: number | null = null;
  let sortScratch: number[] = new Array(FRAME_BUF);

  function tick(now: number) {
    if (lastFrame > 0) {
      const dt = now - lastFrame;
      frameBuf[bufIdx] = dt;
      bufIdx = (bufIdx + 1) % FRAME_BUF;
      if (bufFill < FRAME_BUF) bufFill++;

      let sum = 0;
      for (let i = 0; i < bufFill; i++) {
        sortScratch[i] = frameBuf[i];
        sum += frameBuf[i];
      }
      fps = sum > 0 ? Math.round((bufFill * 1000) / sum) : 0;

      sortScratch.length = bufFill;
      sortScratch.sort((a, b) => a - b);
      const pIdx = Math.min(bufFill - 1, Math.floor(bufFill * 0.99));
      frameTimeP99 = sortScratch[pIdx] ?? 0;

      const mem2 = (performance as Performance & { memory?: PerformanceMemory })
        .memory;
      if (mem2) {
        heapUsed = mem2.usedJSHeapSize;
        heapTotal = mem2.totalJSHeapSize;
      }
      tickCount++;
    }
    lastFrame = now;
    if (debugMode) rafHandle = requestAnimationFrame(tick);
  }

  function start() {
    if (rafHandle !== null) return;
    lastFrame = 0;
    bufIdx = 0;
    bufFill = 0;
    rafHandle = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    fps = 0;
    frameTimeP99 = 0;
  }

  function getFrameTimes(out: Float32Array): number {
    const fill = bufFill;
    if (out.length < fill) return 0;
    if (bufFill < FRAME_BUF) {
      // Buffer not yet wrapped: indices 0..fill-1 are oldest..latest.
      for (let i = 0; i < fill; i++) out[i] = frameBuf[i];
    } else {
      // Wrapped: bufIdx points to the oldest slot (next to overwrite).
      for (let i = 0; i < fill; i++) {
        out[i] = frameBuf[(bufIdx + i) % FRAME_BUF];
      }
    }
    return fill;
  }

  return {
    get debugMode() { return debugMode; },
    get fps() { return fps; },
    get frameTimeP99() { return frameTimeP99; },
    get tickCount() { return tickCount; },
    /** Number of slots used in the rolling buffer (max FRAME_BUF). */
    get frameBufFill() { return bufFill; },
    /** Total buffer capacity, exposed so callers can size their outArray. */
    frameBufCapacity: FRAME_BUF,
    getFrameTimes,
    get lastSpecDrawMs() { return lastSpecDrawMs; },
    get lastWaveDrawMs() { return lastWaveDrawMs; },
    get decodeMs() { return decodeMs; },
    get stftMs() { return stftMs; },
    get specPyramidMs() { return specPyramidMs; },
    get wavePyramidMs() { return wavePyramidMs; },
    get specLevel() { return specLevel; },
    get waveLevel() { return waveLevel; },
    get framesPerPixel() { return framesPerPixel; },
    get samplesPerPixel() { return samplesPerPixel; },
    get canvasDpr() { return canvasDpr; },
    get canvasCssW() { return canvasCssW; },
    get canvasCssH() { return canvasCssH; },
    get mem() { return mem; },
    get heapUsed() { return heapUsed; },
    get heapTotal() { return heapTotal; },

    toggleDebug() {
      debugMode = !debugMode;
      if (debugMode) start();
      else stop();
    },

    setSpecDraw(ms: number) { lastSpecDrawMs = ms; },
    setWaveDraw(ms: number) { lastWaveDrawMs = ms; },
    setDecode(ms: number) { decodeMs = ms; },
    setStft(ms: number) { stftMs = ms; },
    setSpecPyramid(ms: number) { specPyramidMs = ms; },
    setWavePyramid(ms: number) { wavePyramidMs = ms; },
    setSpecLevel(lvl: number, fpp: number) {
      specLevel = lvl;
      framesPerPixel = fpp;
    },
    setWaveLevel(lvl: number, spp: number) {
      waveLevel = lvl;
      samplesPerPixel = spp;
    },
    setCanvas(cssW: number, cssH: number, dpr: number) {
      canvasCssW = cssW;
      canvasCssH = cssH;
      canvasDpr = dpr;
    },
    setMemPcm(bytes: number) { mem = { ...mem, pcm: bytes }; },
    setMemStft(bytes: number) { mem = { ...mem, stft: bytes }; },
    setMemSpecPyr(bytes: number) { mem = { ...mem, specPyr: bytes }; },
    setMemWavePyr(bytes: number) { mem = { ...mem, wavePyr: bytes }; },
    get panelTimings() { return panelTimings; },
    setPanelCompute(panelId: string, ms: number) {
      const entry = panelTimings[panelId] ?? { computeMs: 0, renderMs: 0 };
      entry.computeMs = ms;
      panelTimings[panelId] = entry;
    },
    setPanelRender(panelId: string, ms: number) {
      const entry = panelTimings[panelId] ?? { computeMs: 0, renderMs: 0 };
      entry.renderMs = ms;
      panelTimings[panelId] = entry;
    },
    resetSession() {
      decodeMs = 0;
      stftMs = 0;
      specPyramidMs = 0;
      wavePyramidMs = 0;
      mem = { pcm: 0, stft: 0, specPyr: 0, wavePyr: 0 };
      for (const key of Object.keys(panelTimings)) delete panelTimings[key];
    }
  };
}

export const perfStore = createPerfStore();
