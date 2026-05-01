import { devWarn } from '$lib/log';

const STORAGE_KEY = 'spektrum:settings';
const DEBOUNCE_MS = 500;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPayload: unknown = undefined;

function flush(): void {
  if (pendingPayload === undefined) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingPayload));
  } catch (err) {
    devWarn('localStorage.setItem', err);
  }
  pendingPayload = undefined;
}

const store = {
  async get<T>(_key: string): Promise<T | undefined> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch (err) {
      devWarn('localStorage.getItem', err);
      return undefined;
    }
  },
  async set(_key: string, value: unknown): Promise<void> {
    pendingPayload = value;
  },
  async save(): Promise<void> {
    flush();
  }
};
import { renderStore } from './render.svelte';
import {
  settingsStore,
  type Quality,
  type WaveformDisplayMode,
  type WaveformColorMode,
  type WaveformPalette
} from './settings.svelte';
import { markersStore, type FreqMarker } from './markers.svelte';
import {
  uiStore,
  type AxisFontFamily,
  type AnalysesTab,
  type RmsColorScheme,
  type RmsReferenceLevel,
  type CursorInfoMode,
  type SpectrumSmoothing,
  type SpectrumWeighting,
  type OnsetsBand,
  type OnsetsSensitivity,
  type OnsetsMinDistance,
  type LufsTarget,
  type LufsScale,
  type SpatialColormap,
  type SoundfieldAngleBins,
  type SoundfieldRangeDb,
  type StereoWidthThreshold,
  type CentroidSmoothing,
  type HpssView,
  type NoveltyPeakThreshold
} from './ui.svelte';
import { i18n } from '$lib/i18n/index.svelte';
import type { Locale } from '$lib/i18n/translations';
import type { ColormapName, ColorStop } from '$lib/colormap';
import type { WindowType } from '$lib/dsp/window';

async function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flush();
  }, DEBOUNCE_MS);
}

interface PersistedSettings {
  render?: {
    dbFloor: number;
    dbCeiling: number;
  };
  settings?: {
    colormap: ColormapName;
    customStops?: ColorStop[];
    smoothing: boolean;
    quality: Quality;
    windowType: WindowType;
    exportLegend?: boolean;
    exportInfo?: boolean;
    exportMarkers?: boolean;
  };
  waveform?: {
    displayMode?: WaveformDisplayMode;
    colorMode?: WaveformColorMode;
    palette?: WaveformPalette;
    showLegend?: boolean;
    showClippingGuides?: boolean;
    showClippingMarkers?: boolean;
    showKicks?: boolean;
    smooth?: boolean;
    gridTimeDivisions?: number;
    gridAmpStep?: number;
  };
  ui?: {
    viewWaveform?: boolean;
    viewAnalyses?: boolean;
    sidebarCollapsed?: boolean;
    showStatusBar?: boolean;
    analysesTab?: AnalysesTab;
    axisLabelColor?: string;
    axisLabelFontSize?: number;
    axisLabelFontFamily?: AxisFontFamily;
    rmsWindowSeconds?: number;
    rmsColorScheme?: RmsColorScheme;
    rmsShowPeak?: boolean;
    rmsShowRms?: boolean;
    rmsShowBand?: boolean;
    rmsShowGrid?: boolean;
    rmsShowCrestStat?: boolean;
    rmsReferenceLevel?: RmsReferenceLevel;
    cursorInfoMode?: CursorInfoMode;
    enableSpectrogram3d?: boolean;
    enableAnalyses?: boolean;
    debugMode?: boolean;
    avgSpectrumColorScheme?: RmsColorScheme;
    avgSpectrumShowPeak?: boolean;
    avgSpectrumShowRms?: boolean;
    avgSpectrumShowBand?: boolean;
    avgSpectrumShowGrid?: boolean;
    avgSpectrumSmoothing?: SpectrumSmoothing;
    avgSpectrumWeighting?: SpectrumWeighting;
    onsetsColorScheme?: RmsColorScheme;
    onsetsBand?: OnsetsBand;
    onsetsSensitivity?: OnsetsSensitivity;
    onsetsMinDistanceMs?: OnsetsMinDistance;
    onsetsShowEnvelope?: boolean;
    onsetsShowMarkers?: boolean;
    onsetsShowGrid?: boolean;
    lufsColorScheme?: RmsColorScheme;
    lufsTarget?: LufsTarget;
    lufsScale?: LufsScale;
    lufsShowMomentary?: boolean;
    lufsShowShortTerm?: boolean;
    lufsShowIntegrated?: boolean;
    lufsShowTruePeakGuide?: boolean;
    lufsShowGrid?: boolean;
    vectorscopeColorScheme?: RmsColorScheme;
    vectorscopeShowLow?: boolean;
    vectorscopeShowMid?: boolean;
    vectorscopeShowHigh?: boolean;
    vectorscopeShowDiagonals?: boolean;
    vectorscopeShowGrid?: boolean;
    vectorscopeShowCorrelation?: boolean;
    goniometerColormap?: SpatialColormap;
    goniometerShowGrid?: boolean;
    goniometerShowCrosshair?: boolean;
    goniometerShowPeaks?: boolean;
    stereoWidthColorScheme?: RmsColorScheme;
    stereoWidthSmoothing?: SpectrumSmoothing;
    stereoWidthThreshold?: StereoWidthThreshold;
    stereoWidthShowCurve?: boolean;
    stereoWidthShowBand?: boolean;
    stereoWidthShowThreshold?: boolean;
    stereoWidthShowGrid?: boolean;
    stereoWidthShowAvg?: boolean;
    soundfieldColormap?: SpatialColormap;
    soundfieldAngleBins?: SoundfieldAngleBins;
    soundfieldRangeDb?: SoundfieldRangeDb;
    soundfieldShowFreqRings?: boolean;
    soundfieldShowDirLabels?: boolean;
    soundfieldShowFreqLabels?: boolean;
    centroidColorScheme?: RmsColorScheme;
    centroidShowCurve?: boolean;
    centroidShowGrid?: boolean;
    centroidShowNoteLines?: boolean;
    centroidSmoothing?: CentroidSmoothing;
    entropyColorScheme?: RmsColorScheme;
    entropyShowCurve?: boolean;
    entropyShowGrid?: boolean;
    entropyNormalize?: boolean;
    barkColormap?: SpatialColormap;
    barkShowGrid?: boolean;
    barkShowBandLabels?: boolean;
    chromagramColormap?: SpatialColormap;
    chromagramShowLabels?: boolean;
    chromagramShowGrid?: boolean;
    selfSimilarityColormap?: SpatialColormap;
    selfSimilarityShowGrid?: boolean;
    noveltyColorScheme?: RmsColorScheme;
    noveltyShowCurve?: boolean;
    noveltyShowGrid?: boolean;
    noveltyPeakThreshold?: NoveltyPeakThreshold;
    tempogramColormap?: SpatialColormap;
    tempogramShowDominant?: boolean;
    tempogramShowGrid?: boolean;
    hpssColormap?: SpatialColormap;
    hpssView?: HpssView;
    hpssShowGrid?: boolean;
  };
  markers?: FreqMarker[];
  locale?: Locale;
}

export async function loadSettings(): Promise<void> {
  try {
    const data = await store.get<PersistedSettings>('v1');
    if (!data) return;

    if (data.render) {
      renderStore.setFloor(data.render.dbFloor);
      renderStore.setCeiling(data.render.dbCeiling);
    }

    if (data.settings) {
      settingsStore.colormap = data.settings.colormap;
      if (data.settings.customStops) settingsStore.customStops = data.settings.customStops;
      settingsStore.smoothing = data.settings.smoothing;
      settingsStore.quality = data.settings.quality as Quality;
      settingsStore.windowType = data.settings.windowType;
      if (data.settings.exportLegend != null) settingsStore.exportLegend = data.settings.exportLegend;
      if (data.settings.exportInfo != null) settingsStore.exportInfo = data.settings.exportInfo;
      if (data.settings.exportMarkers != null) settingsStore.exportMarkers = data.settings.exportMarkers;
    }

    if (data.waveform) {
      const w = data.waveform;
      if (w.displayMode) settingsStore.waveformDisplayMode = w.displayMode;
      if (w.colorMode) settingsStore.waveformColorMode = w.colorMode;
      if (w.palette) settingsStore.waveformPalette = w.palette;
      if (w.showLegend != null) settingsStore.waveformShowLegend = w.showLegend;
      if (w.showClippingGuides != null)
        settingsStore.waveformShowClippingGuides = w.showClippingGuides;
      if (w.showClippingMarkers != null)
        settingsStore.waveformShowClippingMarkers = w.showClippingMarkers;
      if (w.showKicks != null) settingsStore.waveformShowKicks = w.showKicks;
      if (w.smooth != null) settingsStore.waveformSmooth = w.smooth;
      if (w.gridTimeDivisions != null)
        settingsStore.waveformGridTimeDivisions = w.gridTimeDivisions;
      if (w.gridAmpStep != null)
        settingsStore.waveformGridAmpStep = w.gridAmpStep;
    }

    if (data.markers && Array.isArray(data.markers)) {
      markersStore.setAll(data.markers);
    }

    if (data.ui) {
      const u = data.ui;
      if (u.viewWaveform != null) uiStore.viewWaveform = u.viewWaveform;
      if (u.viewAnalyses != null) uiStore.viewAnalyses = u.viewAnalyses;
      if (u.sidebarCollapsed != null)
        uiStore.sidebarCollapsed = u.sidebarCollapsed;
      if (u.showStatusBar != null) uiStore.showStatusBar = u.showStatusBar;
      if (u.analysesTab) uiStore.analysesTab = u.analysesTab;
      if (u.axisLabelColor) uiStore.axisLabelColor = u.axisLabelColor;
      if (u.axisLabelFontSize != null)
        uiStore.axisLabelFontSize = u.axisLabelFontSize;
      if (u.axisLabelFontFamily)
        uiStore.axisLabelFontFamily = u.axisLabelFontFamily;
      if (u.rmsWindowSeconds != null)
        uiStore.rmsWindowSeconds = u.rmsWindowSeconds;
      if (u.rmsColorScheme) uiStore.rmsColorScheme = u.rmsColorScheme;
      if (u.rmsShowPeak != null) uiStore.rmsShowPeak = u.rmsShowPeak;
      if (u.rmsShowRms != null) uiStore.rmsShowRms = u.rmsShowRms;
      if (u.rmsShowBand != null) uiStore.rmsShowBand = u.rmsShowBand;
      if (u.rmsShowGrid != null) uiStore.rmsShowGrid = u.rmsShowGrid;
      if (u.rmsShowCrestStat != null)
        uiStore.rmsShowCrestStat = u.rmsShowCrestStat;
      if (u.rmsReferenceLevel)
        uiStore.rmsReferenceLevel = u.rmsReferenceLevel;
      if (u.cursorInfoMode) uiStore.cursorInfoMode = u.cursorInfoMode;
      if (u.enableSpectrogram3d != null)
        uiStore.enableSpectrogram3d = u.enableSpectrogram3d;
      if (u.enableAnalyses != null)
        uiStore.enableAnalyses = u.enableAnalyses;
      if (u.debugMode != null) uiStore.debugMode = u.debugMode;
      if (u.avgSpectrumColorScheme)
        uiStore.avgSpectrumColorScheme = u.avgSpectrumColorScheme;
      if (u.avgSpectrumShowPeak != null)
        uiStore.avgSpectrumShowPeak = u.avgSpectrumShowPeak;
      if (u.avgSpectrumShowRms != null)
        uiStore.avgSpectrumShowRms = u.avgSpectrumShowRms;
      if (u.avgSpectrumShowBand != null)
        uiStore.avgSpectrumShowBand = u.avgSpectrumShowBand;
      if (u.avgSpectrumShowGrid != null)
        uiStore.avgSpectrumShowGrid = u.avgSpectrumShowGrid;
      if (u.avgSpectrumSmoothing)
        uiStore.avgSpectrumSmoothing = u.avgSpectrumSmoothing;
      if (u.avgSpectrumWeighting)
        uiStore.avgSpectrumWeighting = u.avgSpectrumWeighting;
      if (u.onsetsColorScheme)
        uiStore.onsetsColorScheme = u.onsetsColorScheme;
      if (u.onsetsBand) uiStore.onsetsBand = u.onsetsBand;
      if (u.onsetsSensitivity)
        uiStore.onsetsSensitivity = u.onsetsSensitivity;
      if (u.onsetsMinDistanceMs != null)
        uiStore.onsetsMinDistanceMs = u.onsetsMinDistanceMs;
      if (u.onsetsShowEnvelope != null)
        uiStore.onsetsShowEnvelope = u.onsetsShowEnvelope;
      if (u.onsetsShowMarkers != null)
        uiStore.onsetsShowMarkers = u.onsetsShowMarkers;
      if (u.onsetsShowGrid != null)
        uiStore.onsetsShowGrid = u.onsetsShowGrid;

      if (u.lufsColorScheme) uiStore.lufsColorScheme = u.lufsColorScheme;
      if (u.lufsTarget) uiStore.lufsTarget = u.lufsTarget;
      if (u.lufsScale) uiStore.lufsScale = u.lufsScale;
      if (u.lufsShowMomentary != null)
        uiStore.lufsShowMomentary = u.lufsShowMomentary;
      if (u.lufsShowShortTerm != null)
        uiStore.lufsShowShortTerm = u.lufsShowShortTerm;
      if (u.lufsShowIntegrated != null)
        uiStore.lufsShowIntegrated = u.lufsShowIntegrated;
      if (u.lufsShowTruePeakGuide != null)
        uiStore.lufsShowTruePeakGuide = u.lufsShowTruePeakGuide;
      if (u.lufsShowGrid != null) uiStore.lufsShowGrid = u.lufsShowGrid;

      if (u.vectorscopeColorScheme)
        uiStore.vectorscopeColorScheme = u.vectorscopeColorScheme;
      if (u.vectorscopeShowLow != null)
        uiStore.vectorscopeShowLow = u.vectorscopeShowLow;
      if (u.vectorscopeShowMid != null)
        uiStore.vectorscopeShowMid = u.vectorscopeShowMid;
      if (u.vectorscopeShowHigh != null)
        uiStore.vectorscopeShowHigh = u.vectorscopeShowHigh;
      if (u.vectorscopeShowDiagonals != null)
        uiStore.vectorscopeShowDiagonals = u.vectorscopeShowDiagonals;
      if (u.vectorscopeShowGrid != null)
        uiStore.vectorscopeShowGrid = u.vectorscopeShowGrid;
      if (u.vectorscopeShowCorrelation != null)
        uiStore.vectorscopeShowCorrelation = u.vectorscopeShowCorrelation;

      if (u.goniometerColormap)
        uiStore.goniometerColormap = u.goniometerColormap;
      if (u.goniometerShowGrid != null)
        uiStore.goniometerShowGrid = u.goniometerShowGrid;
      if (u.goniometerShowCrosshair != null)
        uiStore.goniometerShowCrosshair = u.goniometerShowCrosshair;
      if (u.goniometerShowPeaks != null)
        uiStore.goniometerShowPeaks = u.goniometerShowPeaks;

      if (u.stereoWidthColorScheme)
        uiStore.stereoWidthColorScheme = u.stereoWidthColorScheme;
      if (u.stereoWidthSmoothing)
        uiStore.stereoWidthSmoothing = u.stereoWidthSmoothing;
      if (u.stereoWidthThreshold != null)
        uiStore.stereoWidthThreshold = u.stereoWidthThreshold;
      if (u.stereoWidthShowCurve != null)
        uiStore.stereoWidthShowCurve = u.stereoWidthShowCurve;
      if (u.stereoWidthShowBand != null)
        uiStore.stereoWidthShowBand = u.stereoWidthShowBand;
      if (u.stereoWidthShowThreshold != null)
        uiStore.stereoWidthShowThreshold = u.stereoWidthShowThreshold;
      if (u.stereoWidthShowGrid != null)
        uiStore.stereoWidthShowGrid = u.stereoWidthShowGrid;
      if (u.stereoWidthShowAvg != null)
        uiStore.stereoWidthShowAvg = u.stereoWidthShowAvg;

      if (u.soundfieldColormap)
        uiStore.soundfieldColormap = u.soundfieldColormap;
      if (u.soundfieldAngleBins != null)
        uiStore.soundfieldAngleBins = u.soundfieldAngleBins;
      if (u.soundfieldRangeDb != null)
        uiStore.soundfieldRangeDb = u.soundfieldRangeDb;
      if (u.soundfieldShowFreqRings != null)
        uiStore.soundfieldShowFreqRings = u.soundfieldShowFreqRings;
      if (u.soundfieldShowDirLabels != null)
        uiStore.soundfieldShowDirLabels = u.soundfieldShowDirLabels;
      if (u.soundfieldShowFreqLabels != null)
        uiStore.soundfieldShowFreqLabels = u.soundfieldShowFreqLabels;

      if (u.centroidColorScheme)
        uiStore.centroidColorScheme = u.centroidColorScheme;
      if (u.centroidShowCurve != null)
        uiStore.centroidShowCurve = u.centroidShowCurve;
      if (u.centroidShowGrid != null)
        uiStore.centroidShowGrid = u.centroidShowGrid;
      if (u.centroidShowNoteLines != null)
        uiStore.centroidShowNoteLines = u.centroidShowNoteLines;
      if (u.centroidSmoothing)
        uiStore.centroidSmoothing = u.centroidSmoothing;

      if (u.entropyColorScheme)
        uiStore.entropyColorScheme = u.entropyColorScheme;
      if (u.entropyShowCurve != null)
        uiStore.entropyShowCurve = u.entropyShowCurve;
      if (u.entropyShowGrid != null)
        uiStore.entropyShowGrid = u.entropyShowGrid;
      if (u.entropyNormalize != null)
        uiStore.entropyNormalize = u.entropyNormalize;

      if (u.barkColormap) uiStore.barkColormap = u.barkColormap;
      if (u.barkShowGrid != null) uiStore.barkShowGrid = u.barkShowGrid;
      if (u.barkShowBandLabels != null)
        uiStore.barkShowBandLabels = u.barkShowBandLabels;

      if (u.chromagramColormap)
        uiStore.chromagramColormap = u.chromagramColormap;
      if (u.chromagramShowLabels != null)
        uiStore.chromagramShowLabels = u.chromagramShowLabels;
      if (u.chromagramShowGrid != null)
        uiStore.chromagramShowGrid = u.chromagramShowGrid;

      if (u.selfSimilarityColormap)
        uiStore.selfSimilarityColormap = u.selfSimilarityColormap;
      if (u.selfSimilarityShowGrid != null)
        uiStore.selfSimilarityShowGrid = u.selfSimilarityShowGrid;

      if (u.noveltyColorScheme)
        uiStore.noveltyColorScheme = u.noveltyColorScheme;
      if (u.noveltyShowCurve != null)
        uiStore.noveltyShowCurve = u.noveltyShowCurve;
      if (u.noveltyShowGrid != null)
        uiStore.noveltyShowGrid = u.noveltyShowGrid;
      if (u.noveltyPeakThreshold)
        uiStore.noveltyPeakThreshold = u.noveltyPeakThreshold;

      if (u.tempogramColormap)
        uiStore.tempogramColormap = u.tempogramColormap;
      if (u.tempogramShowDominant != null)
        uiStore.tempogramShowDominant = u.tempogramShowDominant;
      if (u.tempogramShowGrid != null)
        uiStore.tempogramShowGrid = u.tempogramShowGrid;

      if (u.hpssColormap) uiStore.hpssColormap = u.hpssColormap;
      if (u.hpssView) uiStore.hpssView = u.hpssView;
      if (u.hpssShowGrid != null) uiStore.hpssShowGrid = u.hpssShowGrid;
    }

    if (data.locale) i18n.setFromPersist(data.locale);
  } catch {
    /* first launch or corrupted file */
  }
}

export async function saveSettings(): Promise<void> {
  const data: PersistedSettings = {
    render: {
      dbFloor: renderStore.dbFloor,
      dbCeiling: renderStore.dbCeiling
    },
    settings: {
      colormap: settingsStore.colormap,
      customStops: settingsStore.customStops,
      smoothing: settingsStore.smoothing,
      quality: settingsStore.quality,
      windowType: settingsStore.windowType,
      exportLegend: settingsStore.exportLegend,
      exportInfo: settingsStore.exportInfo,
      exportMarkers: settingsStore.exportMarkers
    },
    waveform: {
      displayMode: settingsStore.waveformDisplayMode,
      colorMode: settingsStore.waveformColorMode,
      palette: settingsStore.waveformPalette,
      showLegend: settingsStore.waveformShowLegend,
      showClippingGuides: settingsStore.waveformShowClippingGuides,
      showClippingMarkers: settingsStore.waveformShowClippingMarkers,
      showKicks: settingsStore.waveformShowKicks,
      smooth: settingsStore.waveformSmooth,
      gridTimeDivisions: settingsStore.waveformGridTimeDivisions,
      gridAmpStep: settingsStore.waveformGridAmpStep
    },
    markers: markersStore.markers,
    ui: {
      viewWaveform: uiStore.viewWaveform,
      viewAnalyses: uiStore.viewAnalyses,
      sidebarCollapsed: uiStore.sidebarCollapsed,
      showStatusBar: uiStore.showStatusBar,
      analysesTab: uiStore.analysesTab,
      axisLabelColor: uiStore.axisLabelColor,
      axisLabelFontSize: uiStore.axisLabelFontSize,
      axisLabelFontFamily: uiStore.axisLabelFontFamily,
      rmsWindowSeconds: uiStore.rmsWindowSeconds,
      rmsColorScheme: uiStore.rmsColorScheme,
      rmsShowPeak: uiStore.rmsShowPeak,
      rmsShowRms: uiStore.rmsShowRms,
      rmsShowBand: uiStore.rmsShowBand,
      rmsShowGrid: uiStore.rmsShowGrid,
      rmsShowCrestStat: uiStore.rmsShowCrestStat,
      rmsReferenceLevel: uiStore.rmsReferenceLevel,
      cursorInfoMode: uiStore.cursorInfoMode,
      enableSpectrogram3d: uiStore.enableSpectrogram3d,
      enableAnalyses: uiStore.enableAnalyses,
      debugMode: uiStore.debugMode,
      avgSpectrumColorScheme: uiStore.avgSpectrumColorScheme,
      avgSpectrumShowPeak: uiStore.avgSpectrumShowPeak,
      avgSpectrumShowRms: uiStore.avgSpectrumShowRms,
      avgSpectrumShowBand: uiStore.avgSpectrumShowBand,
      avgSpectrumShowGrid: uiStore.avgSpectrumShowGrid,
      avgSpectrumSmoothing: uiStore.avgSpectrumSmoothing,
      avgSpectrumWeighting: uiStore.avgSpectrumWeighting,
      onsetsColorScheme: uiStore.onsetsColorScheme,
      onsetsBand: uiStore.onsetsBand,
      onsetsSensitivity: uiStore.onsetsSensitivity,
      onsetsMinDistanceMs: uiStore.onsetsMinDistanceMs,
      onsetsShowEnvelope: uiStore.onsetsShowEnvelope,
      onsetsShowMarkers: uiStore.onsetsShowMarkers,
      onsetsShowGrid: uiStore.onsetsShowGrid,
      lufsColorScheme: uiStore.lufsColorScheme,
      lufsTarget: uiStore.lufsTarget,
      lufsScale: uiStore.lufsScale,
      lufsShowMomentary: uiStore.lufsShowMomentary,
      lufsShowShortTerm: uiStore.lufsShowShortTerm,
      lufsShowIntegrated: uiStore.lufsShowIntegrated,
      lufsShowTruePeakGuide: uiStore.lufsShowTruePeakGuide,
      lufsShowGrid: uiStore.lufsShowGrid,
      vectorscopeColorScheme: uiStore.vectorscopeColorScheme,
      vectorscopeShowLow: uiStore.vectorscopeShowLow,
      vectorscopeShowMid: uiStore.vectorscopeShowMid,
      vectorscopeShowHigh: uiStore.vectorscopeShowHigh,
      vectorscopeShowDiagonals: uiStore.vectorscopeShowDiagonals,
      vectorscopeShowGrid: uiStore.vectorscopeShowGrid,
      vectorscopeShowCorrelation: uiStore.vectorscopeShowCorrelation,
      goniometerColormap: uiStore.goniometerColormap,
      goniometerShowGrid: uiStore.goniometerShowGrid,
      goniometerShowCrosshair: uiStore.goniometerShowCrosshair,
      goniometerShowPeaks: uiStore.goniometerShowPeaks,
      stereoWidthColorScheme: uiStore.stereoWidthColorScheme,
      stereoWidthSmoothing: uiStore.stereoWidthSmoothing,
      stereoWidthThreshold: uiStore.stereoWidthThreshold,
      stereoWidthShowCurve: uiStore.stereoWidthShowCurve,
      stereoWidthShowBand: uiStore.stereoWidthShowBand,
      stereoWidthShowThreshold: uiStore.stereoWidthShowThreshold,
      stereoWidthShowGrid: uiStore.stereoWidthShowGrid,
      stereoWidthShowAvg: uiStore.stereoWidthShowAvg,
      soundfieldColormap: uiStore.soundfieldColormap,
      soundfieldAngleBins: uiStore.soundfieldAngleBins,
      soundfieldRangeDb: uiStore.soundfieldRangeDb,
      soundfieldShowFreqRings: uiStore.soundfieldShowFreqRings,
      soundfieldShowDirLabels: uiStore.soundfieldShowDirLabels,
      soundfieldShowFreqLabels: uiStore.soundfieldShowFreqLabels,
      centroidColorScheme: uiStore.centroidColorScheme,
      centroidShowCurve: uiStore.centroidShowCurve,
      centroidShowGrid: uiStore.centroidShowGrid,
      centroidShowNoteLines: uiStore.centroidShowNoteLines,
      centroidSmoothing: uiStore.centroidSmoothing,
      entropyColorScheme: uiStore.entropyColorScheme,
      entropyShowCurve: uiStore.entropyShowCurve,
      entropyShowGrid: uiStore.entropyShowGrid,
      entropyNormalize: uiStore.entropyNormalize,
      barkColormap: uiStore.barkColormap,
      barkShowGrid: uiStore.barkShowGrid,
      barkShowBandLabels: uiStore.barkShowBandLabels,
      chromagramColormap: uiStore.chromagramColormap,
      chromagramShowLabels: uiStore.chromagramShowLabels,
      chromagramShowGrid: uiStore.chromagramShowGrid,
      selfSimilarityColormap: uiStore.selfSimilarityColormap,
      selfSimilarityShowGrid: uiStore.selfSimilarityShowGrid,
      noveltyColorScheme: uiStore.noveltyColorScheme,
      noveltyShowCurve: uiStore.noveltyShowCurve,
      noveltyShowGrid: uiStore.noveltyShowGrid,
      noveltyPeakThreshold: uiStore.noveltyPeakThreshold,
      tempogramColormap: uiStore.tempogramColormap,
      tempogramShowDominant: uiStore.tempogramShowDominant,
      tempogramShowGrid: uiStore.tempogramShowGrid,
      hpssColormap: uiStore.hpssColormap,
      hpssView: uiStore.hpssView,
      hpssShowGrid: uiStore.hpssShowGrid
    },
    locale: i18n.explicit ? i18n.locale : undefined
  };

  try {
    await store.set('v1', data);
    await scheduleSave();
  } catch (err) {
    devWarn('saveSettings', err);
  }
}


