/**
 * Persistent UI preferences that survive sessions: which auxiliary
 * panels the user wants visible by default, axis label appearance, etc.
 * Distinct from view.svelte (current zoom range) and selection.svelte
 * (current selection rect).
 */

export type AxisFontFamily = 'mono' | 'sans';
export type AnalysesTab =
  | 'dynamics'
  | 'spatialization'
  | 'structure'
  | 'tonality';

export type RmsColorScheme = 'spektrum' | 'daw' | 'mastering';
export type RmsReferenceLevel = 'off' | '-14' | '-16' | '-23';
export type CursorInfoMode = 'dock' | 'follow';
export type SpectrumSmoothing = 'off' | '1_3' | '1_6' | '1_12';
export type SpectrumWeighting = 'off' | 'a' | 'c';
export type OnsetsBand = 'all' | 'low' | 'mid' | 'high';
export type OnsetsSensitivity = 'conservative' | 'standard' | 'aggressive';
export type OnsetsMinDistance = 30 | 50 | 100 | 200;
export type LufsTarget = 'off' | '-14' | '-16' | '-23' | '-27';
export type LufsScale = 'wide' | 'zoom';
export type SpatialColormap =
  | 'inferno'
  | 'viridis'
  | 'magma'
  | 'plasma'
  | 'turbo'
  | 'greys';
export type SoundfieldAngleBins = 9 | 18 | 36 | 72;
export type SoundfieldRangeDb = 30 | 45 | 60 | 90;
export type StereoWidthThreshold = 0.5 | 1 | 1.5;
export type CentroidSmoothing = 'off' | 'light' | 'medium' | 'heavy';
export type HpssView = 'both' | 'harmonic' | 'percussive';
export type NoveltyPeakThreshold = 'off' | '0.3' | '0.5' | '0.7';

const RMS_COLOR_SCHEMES: RmsColorScheme[] = ['spektrum', 'daw', 'mastering'];
const RMS_REFERENCE_LEVELS: RmsReferenceLevel[] = ['off', '-14', '-16', '-23'];
const CURSOR_INFO_MODES: CursorInfoMode[] = ['dock', 'follow'];
const SPECTRUM_SMOOTHINGS: SpectrumSmoothing[] = ['off', '1_3', '1_6', '1_12'];
const SPECTRUM_WEIGHTINGS: SpectrumWeighting[] = ['off', 'a', 'c'];
const ONSETS_BANDS: OnsetsBand[] = ['all', 'low', 'mid', 'high'];
const ONSETS_SENSITIVITIES: OnsetsSensitivity[] = [
  'conservative',
  'standard',
  'aggressive'
];
const ONSETS_MIN_DISTANCES: OnsetsMinDistance[] = [30, 50, 100, 200];
const LUFS_TARGETS: LufsTarget[] = ['off', '-14', '-16', '-23', '-27'];
const LUFS_SCALES: LufsScale[] = ['wide', 'zoom'];
const SPATIAL_COLORMAPS: SpatialColormap[] = [
  'inferno',
  'viridis',
  'magma',
  'plasma',
  'turbo',
  'greys'
];
const SOUNDFIELD_ANGLE_BINS: SoundfieldAngleBins[] = [9, 18, 36, 72];
const SOUNDFIELD_RANGE_DBS: SoundfieldRangeDb[] = [30, 45, 60, 90];
const STEREO_WIDTH_THRESHOLDS: StereoWidthThreshold[] = [0.5, 1, 1.5];
const CENTROID_SMOOTHINGS: CentroidSmoothing[] = [
  'off',
  'light',
  'medium',
  'heavy'
];
const HPSS_VIEWS: HpssView[] = ['both', 'harmonic', 'percussive'];
const NOVELTY_PEAK_THRESHOLDS: NoveltyPeakThreshold[] = [
  'off',
  '0.3',
  '0.5',
  '0.7'
];

const ANALYSES_TABS: AnalysesTab[] = [
  'dynamics',
  'spatialization',
  'structure',
  'tonality'
];

const AXIS_FONT_FAMILIES: AxisFontFamily[] = ['mono', 'sans'];

export const AXIS_FONT_STACK: Record<AxisFontFamily, string> = {
  mono: 'ui-monospace, monospace',
  sans: 'var(--font-sans)'
};

const DEFAULT_AXIS_COLOR = '#8b94b5';
const DEFAULT_AXIS_SIZE = 11.5;
const AXIS_SIZE_MIN = 8;
const AXIS_SIZE_MAX = 20;

function clampSize(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_AXIS_SIZE;
  return Math.max(AXIS_SIZE_MIN, Math.min(AXIS_SIZE_MAX, v));
}

function createUiStore() {
  let viewWaveform = $state(false);
  let viewAnalyses = $state(false);
  let analysesTab = $state<AnalysesTab>('dynamics');
  let sidebarCollapsed = $state(false);
  let showStatusBar = $state(true);
  let axisLabelColor = $state(DEFAULT_AXIS_COLOR);
  let axisLabelFontSize = $state(DEFAULT_AXIS_SIZE);
  let axisLabelFontFamily = $state<AxisFontFamily>('mono');
  let rmsWindowSeconds = $state(0.4);
  let rmsColorScheme = $state<RmsColorScheme>('spektrum');
  let rmsShowPeak = $state(true);
  let rmsShowRms = $state(true);
  let rmsShowBand = $state(true);
  let rmsShowGrid = $state(true);
  let rmsShowCrestStat = $state(false);
  let rmsReferenceLevel = $state<RmsReferenceLevel>('off');
  let expandedPanelId = $state<string | null>(null);
  let cursorInfoMode = $state<CursorInfoMode>('dock');
  let enableSpectrogram3d = $state(false);
  let enableAnalyses = $state(false);
  let debugMode = $state(false);

  let avgSpectrumColorScheme = $state<RmsColorScheme>('spektrum');
  let avgSpectrumShowPeak = $state(true);
  let avgSpectrumShowRms = $state(true);
  let avgSpectrumShowBand = $state(true);
  let avgSpectrumShowGrid = $state(true);
  let avgSpectrumSmoothing = $state<SpectrumSmoothing>('1_3');
  let avgSpectrumWeighting = $state<SpectrumWeighting>('off');

  let onsetsColorScheme = $state<RmsColorScheme>('spektrum');
  let onsetsBand = $state<OnsetsBand>('all');
  let onsetsSensitivity = $state<OnsetsSensitivity>('standard');
  let onsetsMinDistanceMs = $state<OnsetsMinDistance>(50);
  let onsetsShowEnvelope = $state(true);
  let onsetsShowMarkers = $state(true);
  let onsetsShowGrid = $state(true);

  let lufsColorScheme = $state<RmsColorScheme>('spektrum');
  let lufsTarget = $state<LufsTarget>('off');
  let lufsScale = $state<LufsScale>('wide');
  let lufsShowMomentary = $state(true);
  let lufsShowShortTerm = $state(true);
  let lufsShowIntegrated = $state(true);
  let lufsShowTruePeakGuide = $state(true);
  let lufsShowGrid = $state(true);

  let vectorscopeColorScheme = $state<RmsColorScheme>('spektrum');
  let vectorscopeShowLow = $state(true);
  let vectorscopeShowMid = $state(true);
  let vectorscopeShowHigh = $state(true);
  let vectorscopeShowDiagonals = $state(true);
  let vectorscopeShowGrid = $state(true);
  let vectorscopeShowCorrelation = $state(true);

  let goniometerColormap = $state<SpatialColormap>('inferno');
  let goniometerShowGrid = $state(true);
  let goniometerShowCrosshair = $state(true);
  let goniometerShowPeaks = $state(true);

  let stereoWidthColorScheme = $state<RmsColorScheme>('spektrum');
  let stereoWidthSmoothing = $state<SpectrumSmoothing>('off');
  let stereoWidthThreshold = $state<StereoWidthThreshold>(1);
  let stereoWidthShowCurve = $state(true);
  let stereoWidthShowBand = $state(true);
  let stereoWidthShowThreshold = $state(true);
  let stereoWidthShowGrid = $state(true);
  let stereoWidthShowAvg = $state(true);

  let soundfieldColormap = $state<SpatialColormap>('inferno');
  let soundfieldAngleBins = $state<SoundfieldAngleBins>(36);
  let soundfieldRangeDb = $state<SoundfieldRangeDb>(60);
  let soundfieldShowFreqRings = $state(true);
  let soundfieldShowDirLabels = $state(true);
  let soundfieldShowFreqLabels = $state(true);

  // Tonality tab.
  let centroidColorScheme = $state<RmsColorScheme>('spektrum');
  let centroidShowCurve = $state(true);
  let centroidShowGrid = $state(true);
  let centroidShowNoteLines = $state(true);
  let centroidSmoothing = $state<CentroidSmoothing>('light');

  let entropyColorScheme = $state<RmsColorScheme>('spektrum');
  let entropyShowCurve = $state(true);
  let entropyShowGrid = $state(true);
  let entropyNormalize = $state(true);

  let barkColormap = $state<SpatialColormap>('inferno');
  let barkShowGrid = $state(true);
  let barkShowBandLabels = $state(true);

  let chromagramColormap = $state<SpatialColormap>('inferno');
  let chromagramShowLabels = $state(true);
  let chromagramShowGrid = $state(true);

  // Structure tab.
  let selfSimilarityColormap = $state<SpatialColormap>('inferno');
  let selfSimilarityShowGrid = $state(true);

  let noveltyColorScheme = $state<RmsColorScheme>('spektrum');
  let noveltyShowCurve = $state(true);
  let noveltyShowGrid = $state(true);
  let noveltyPeakThreshold = $state<NoveltyPeakThreshold>('0.3');

  let tempogramColormap = $state<SpatialColormap>('inferno');
  let tempogramShowDominant = $state(true);
  let tempogramShowGrid = $state(true);

  let hpssColormap = $state<SpatialColormap>('inferno');
  let hpssView = $state<HpssView>('both');
  let hpssShowGrid = $state(true);

  return {
    get viewWaveform() {
      return viewWaveform;
    },
    set viewWaveform(v: boolean) {
      viewWaveform = v;
    },
    get sidebarCollapsed() {
      return sidebarCollapsed;
    },
    set sidebarCollapsed(v: boolean) {
      sidebarCollapsed = v;
    },
    get showStatusBar() {
      return showStatusBar;
    },
    set showStatusBar(v: boolean) {
      showStatusBar = v;
    },
    get viewAnalyses() {
      return viewAnalyses;
    },
    set viewAnalyses(v: boolean) {
      viewAnalyses = v;
    },
    get analysesTab() {
      return analysesTab;
    },
    set analysesTab(v: AnalysesTab) {
      analysesTab = ANALYSES_TABS.includes(v) ? v : 'dynamics';
    },
    get axisLabelColor() {
      return axisLabelColor;
    },
    set axisLabelColor(v: string) {
      axisLabelColor = v;
    },
    get axisLabelFontSize() {
      return axisLabelFontSize;
    },
    set axisLabelFontSize(v: number) {
      axisLabelFontSize = clampSize(v);
    },
    get axisLabelFontFamily() {
      return axisLabelFontFamily;
    },
    set axisLabelFontFamily(v: AxisFontFamily) {
      axisLabelFontFamily = AXIS_FONT_FAMILIES.includes(v) ? v : 'mono';
    },
    resetAxisLabel() {
      axisLabelColor = DEFAULT_AXIS_COLOR;
      axisLabelFontSize = DEFAULT_AXIS_SIZE;
      axisLabelFontFamily = 'mono';
    },
    get rmsWindowSeconds() {
      return rmsWindowSeconds;
    },
    set rmsWindowSeconds(v: number) {
      rmsWindowSeconds = Number.isFinite(v) && v > 0 ? v : 0.4;
    },
    get rmsColorScheme() {
      return rmsColorScheme;
    },
    set rmsColorScheme(v: RmsColorScheme) {
      rmsColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get rmsShowPeak() {
      return rmsShowPeak;
    },
    set rmsShowPeak(v: boolean) {
      rmsShowPeak = v;
    },
    get rmsShowRms() {
      return rmsShowRms;
    },
    set rmsShowRms(v: boolean) {
      rmsShowRms = v;
    },
    get rmsShowBand() {
      return rmsShowBand;
    },
    set rmsShowBand(v: boolean) {
      rmsShowBand = v;
    },
    get rmsShowGrid() {
      return rmsShowGrid;
    },
    set rmsShowGrid(v: boolean) {
      rmsShowGrid = v;
    },
    get rmsShowCrestStat() {
      return rmsShowCrestStat;
    },
    set rmsShowCrestStat(v: boolean) {
      rmsShowCrestStat = v;
    },
    get rmsReferenceLevel() {
      return rmsReferenceLevel;
    },
    set rmsReferenceLevel(v: RmsReferenceLevel) {
      rmsReferenceLevel = RMS_REFERENCE_LEVELS.includes(v) ? v : 'off';
    },
    get expandedPanelId() {
      return expandedPanelId;
    },
    set expandedPanelId(v: string | null) {
      expandedPanelId = v;
    },
    get cursorInfoMode() {
      return cursorInfoMode;
    },
    set cursorInfoMode(v: CursorInfoMode) {
      cursorInfoMode = CURSOR_INFO_MODES.includes(v) ? v : 'dock';
    },
    get enableSpectrogram3d() {
      return enableSpectrogram3d;
    },
    set enableSpectrogram3d(v: boolean) {
      enableSpectrogram3d = v;
    },
    get enableAnalyses() {
      return enableAnalyses;
    },
    set enableAnalyses(v: boolean) {
      enableAnalyses = v;
    },
    get debugMode() {
      return debugMode;
    },
    set debugMode(v: boolean) {
      debugMode = v;
    },
    get avgSpectrumColorScheme() {
      return avgSpectrumColorScheme;
    },
    set avgSpectrumColorScheme(v: RmsColorScheme) {
      avgSpectrumColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get avgSpectrumShowPeak() {
      return avgSpectrumShowPeak;
    },
    set avgSpectrumShowPeak(v: boolean) {
      avgSpectrumShowPeak = v;
    },
    get avgSpectrumShowRms() {
      return avgSpectrumShowRms;
    },
    set avgSpectrumShowRms(v: boolean) {
      avgSpectrumShowRms = v;
    },
    get avgSpectrumShowBand() {
      return avgSpectrumShowBand;
    },
    set avgSpectrumShowBand(v: boolean) {
      avgSpectrumShowBand = v;
    },
    get avgSpectrumShowGrid() {
      return avgSpectrumShowGrid;
    },
    set avgSpectrumShowGrid(v: boolean) {
      avgSpectrumShowGrid = v;
    },
    get avgSpectrumSmoothing() {
      return avgSpectrumSmoothing;
    },
    set avgSpectrumSmoothing(v: SpectrumSmoothing) {
      avgSpectrumSmoothing = SPECTRUM_SMOOTHINGS.includes(v) ? v : '1_3';
    },
    get avgSpectrumWeighting() {
      return avgSpectrumWeighting;
    },
    set avgSpectrumWeighting(v: SpectrumWeighting) {
      avgSpectrumWeighting = SPECTRUM_WEIGHTINGS.includes(v) ? v : 'off';
    },
    get onsetsColorScheme() {
      return onsetsColorScheme;
    },
    set onsetsColorScheme(v: RmsColorScheme) {
      onsetsColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get onsetsBand() {
      return onsetsBand;
    },
    set onsetsBand(v: OnsetsBand) {
      onsetsBand = ONSETS_BANDS.includes(v) ? v : 'all';
    },
    get onsetsSensitivity() {
      return onsetsSensitivity;
    },
    set onsetsSensitivity(v: OnsetsSensitivity) {
      onsetsSensitivity = ONSETS_SENSITIVITIES.includes(v) ? v : 'standard';
    },
    get onsetsMinDistanceMs() {
      return onsetsMinDistanceMs;
    },
    set onsetsMinDistanceMs(v: OnsetsMinDistance) {
      onsetsMinDistanceMs = ONSETS_MIN_DISTANCES.includes(v) ? v : 50;
    },
    get onsetsShowEnvelope() {
      return onsetsShowEnvelope;
    },
    set onsetsShowEnvelope(v: boolean) {
      onsetsShowEnvelope = v;
    },
    get onsetsShowMarkers() {
      return onsetsShowMarkers;
    },
    set onsetsShowMarkers(v: boolean) {
      onsetsShowMarkers = v;
    },
    get onsetsShowGrid() {
      return onsetsShowGrid;
    },
    set onsetsShowGrid(v: boolean) {
      onsetsShowGrid = v;
    },

    get lufsColorScheme() {
      return lufsColorScheme;
    },
    set lufsColorScheme(v: RmsColorScheme) {
      lufsColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get lufsTarget() {
      return lufsTarget;
    },
    set lufsTarget(v: LufsTarget) {
      lufsTarget = LUFS_TARGETS.includes(v) ? v : 'off';
    },
    get lufsScale() {
      return lufsScale;
    },
    set lufsScale(v: LufsScale) {
      lufsScale = LUFS_SCALES.includes(v) ? v : 'wide';
    },
    get lufsShowMomentary() {
      return lufsShowMomentary;
    },
    set lufsShowMomentary(v: boolean) {
      lufsShowMomentary = v;
    },
    get lufsShowShortTerm() {
      return lufsShowShortTerm;
    },
    set lufsShowShortTerm(v: boolean) {
      lufsShowShortTerm = v;
    },
    get lufsShowIntegrated() {
      return lufsShowIntegrated;
    },
    set lufsShowIntegrated(v: boolean) {
      lufsShowIntegrated = v;
    },
    get lufsShowTruePeakGuide() {
      return lufsShowTruePeakGuide;
    },
    set lufsShowTruePeakGuide(v: boolean) {
      lufsShowTruePeakGuide = v;
    },
    get lufsShowGrid() {
      return lufsShowGrid;
    },
    set lufsShowGrid(v: boolean) {
      lufsShowGrid = v;
    },

    get vectorscopeColorScheme() {
      return vectorscopeColorScheme;
    },
    set vectorscopeColorScheme(v: RmsColorScheme) {
      vectorscopeColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get vectorscopeShowLow() {
      return vectorscopeShowLow;
    },
    set vectorscopeShowLow(v: boolean) {
      vectorscopeShowLow = v;
    },
    get vectorscopeShowMid() {
      return vectorscopeShowMid;
    },
    set vectorscopeShowMid(v: boolean) {
      vectorscopeShowMid = v;
    },
    get vectorscopeShowHigh() {
      return vectorscopeShowHigh;
    },
    set vectorscopeShowHigh(v: boolean) {
      vectorscopeShowHigh = v;
    },
    get vectorscopeShowDiagonals() {
      return vectorscopeShowDiagonals;
    },
    set vectorscopeShowDiagonals(v: boolean) {
      vectorscopeShowDiagonals = v;
    },
    get vectorscopeShowGrid() {
      return vectorscopeShowGrid;
    },
    set vectorscopeShowGrid(v: boolean) {
      vectorscopeShowGrid = v;
    },
    get vectorscopeShowCorrelation() {
      return vectorscopeShowCorrelation;
    },
    set vectorscopeShowCorrelation(v: boolean) {
      vectorscopeShowCorrelation = v;
    },

    get goniometerColormap() {
      return goniometerColormap;
    },
    set goniometerColormap(v: SpatialColormap) {
      goniometerColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get goniometerShowGrid() {
      return goniometerShowGrid;
    },
    set goniometerShowGrid(v: boolean) {
      goniometerShowGrid = v;
    },
    get goniometerShowCrosshair() {
      return goniometerShowCrosshair;
    },
    set goniometerShowCrosshair(v: boolean) {
      goniometerShowCrosshair = v;
    },
    get goniometerShowPeaks() {
      return goniometerShowPeaks;
    },
    set goniometerShowPeaks(v: boolean) {
      goniometerShowPeaks = v;
    },

    get stereoWidthColorScheme() {
      return stereoWidthColorScheme;
    },
    set stereoWidthColorScheme(v: RmsColorScheme) {
      stereoWidthColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get stereoWidthSmoothing() {
      return stereoWidthSmoothing;
    },
    set stereoWidthSmoothing(v: SpectrumSmoothing) {
      stereoWidthSmoothing = SPECTRUM_SMOOTHINGS.includes(v) ? v : 'off';
    },
    get stereoWidthThreshold() {
      return stereoWidthThreshold;
    },
    set stereoWidthThreshold(v: StereoWidthThreshold) {
      stereoWidthThreshold = STEREO_WIDTH_THRESHOLDS.includes(v) ? v : 1;
    },
    get stereoWidthShowCurve() {
      return stereoWidthShowCurve;
    },
    set stereoWidthShowCurve(v: boolean) {
      stereoWidthShowCurve = v;
    },
    get stereoWidthShowBand() {
      return stereoWidthShowBand;
    },
    set stereoWidthShowBand(v: boolean) {
      stereoWidthShowBand = v;
    },
    get stereoWidthShowThreshold() {
      return stereoWidthShowThreshold;
    },
    set stereoWidthShowThreshold(v: boolean) {
      stereoWidthShowThreshold = v;
    },
    get stereoWidthShowGrid() {
      return stereoWidthShowGrid;
    },
    set stereoWidthShowGrid(v: boolean) {
      stereoWidthShowGrid = v;
    },
    get stereoWidthShowAvg() {
      return stereoWidthShowAvg;
    },
    set stereoWidthShowAvg(v: boolean) {
      stereoWidthShowAvg = v;
    },

    get soundfieldColormap() {
      return soundfieldColormap;
    },
    set soundfieldColormap(v: SpatialColormap) {
      soundfieldColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get soundfieldAngleBins() {
      return soundfieldAngleBins;
    },
    set soundfieldAngleBins(v: SoundfieldAngleBins) {
      soundfieldAngleBins = SOUNDFIELD_ANGLE_BINS.includes(v) ? v : 36;
    },
    get soundfieldRangeDb() {
      return soundfieldRangeDb;
    },
    set soundfieldRangeDb(v: SoundfieldRangeDb) {
      soundfieldRangeDb = SOUNDFIELD_RANGE_DBS.includes(v) ? v : 60;
    },
    get soundfieldShowFreqRings() {
      return soundfieldShowFreqRings;
    },
    set soundfieldShowFreqRings(v: boolean) {
      soundfieldShowFreqRings = v;
    },
    get soundfieldShowDirLabels() {
      return soundfieldShowDirLabels;
    },
    set soundfieldShowDirLabels(v: boolean) {
      soundfieldShowDirLabels = v;
    },
    get soundfieldShowFreqLabels() {
      return soundfieldShowFreqLabels;
    },
    set soundfieldShowFreqLabels(v: boolean) {
      soundfieldShowFreqLabels = v;
    },

    get centroidColorScheme() {
      return centroidColorScheme;
    },
    set centroidColorScheme(v: RmsColorScheme) {
      centroidColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get centroidShowCurve() {
      return centroidShowCurve;
    },
    set centroidShowCurve(v: boolean) {
      centroidShowCurve = v;
    },
    get centroidShowGrid() {
      return centroidShowGrid;
    },
    set centroidShowGrid(v: boolean) {
      centroidShowGrid = v;
    },
    get centroidShowNoteLines() {
      return centroidShowNoteLines;
    },
    set centroidShowNoteLines(v: boolean) {
      centroidShowNoteLines = v;
    },
    get centroidSmoothing() {
      return centroidSmoothing;
    },
    set centroidSmoothing(v: CentroidSmoothing) {
      centroidSmoothing = CENTROID_SMOOTHINGS.includes(v) ? v : 'light';
    },

    get entropyColorScheme() {
      return entropyColorScheme;
    },
    set entropyColorScheme(v: RmsColorScheme) {
      entropyColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get entropyShowCurve() {
      return entropyShowCurve;
    },
    set entropyShowCurve(v: boolean) {
      entropyShowCurve = v;
    },
    get entropyShowGrid() {
      return entropyShowGrid;
    },
    set entropyShowGrid(v: boolean) {
      entropyShowGrid = v;
    },
    get entropyNormalize() {
      return entropyNormalize;
    },
    set entropyNormalize(v: boolean) {
      entropyNormalize = v;
    },

    get barkColormap() {
      return barkColormap;
    },
    set barkColormap(v: SpatialColormap) {
      barkColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get barkShowGrid() {
      return barkShowGrid;
    },
    set barkShowGrid(v: boolean) {
      barkShowGrid = v;
    },
    get barkShowBandLabels() {
      return barkShowBandLabels;
    },
    set barkShowBandLabels(v: boolean) {
      barkShowBandLabels = v;
    },

    get chromagramColormap() {
      return chromagramColormap;
    },
    set chromagramColormap(v: SpatialColormap) {
      chromagramColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get chromagramShowLabels() {
      return chromagramShowLabels;
    },
    set chromagramShowLabels(v: boolean) {
      chromagramShowLabels = v;
    },
    get chromagramShowGrid() {
      return chromagramShowGrid;
    },
    set chromagramShowGrid(v: boolean) {
      chromagramShowGrid = v;
    },

    get selfSimilarityColormap() {
      return selfSimilarityColormap;
    },
    set selfSimilarityColormap(v: SpatialColormap) {
      selfSimilarityColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get selfSimilarityShowGrid() {
      return selfSimilarityShowGrid;
    },
    set selfSimilarityShowGrid(v: boolean) {
      selfSimilarityShowGrid = v;
    },

    get noveltyColorScheme() {
      return noveltyColorScheme;
    },
    set noveltyColorScheme(v: RmsColorScheme) {
      noveltyColorScheme = RMS_COLOR_SCHEMES.includes(v) ? v : 'spektrum';
    },
    get noveltyShowCurve() {
      return noveltyShowCurve;
    },
    set noveltyShowCurve(v: boolean) {
      noveltyShowCurve = v;
    },
    get noveltyShowGrid() {
      return noveltyShowGrid;
    },
    set noveltyShowGrid(v: boolean) {
      noveltyShowGrid = v;
    },
    get noveltyPeakThreshold() {
      return noveltyPeakThreshold;
    },
    set noveltyPeakThreshold(v: NoveltyPeakThreshold) {
      noveltyPeakThreshold = NOVELTY_PEAK_THRESHOLDS.includes(v) ? v : '0.3';
    },

    get tempogramColormap() {
      return tempogramColormap;
    },
    set tempogramColormap(v: SpatialColormap) {
      tempogramColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get tempogramShowDominant() {
      return tempogramShowDominant;
    },
    set tempogramShowDominant(v: boolean) {
      tempogramShowDominant = v;
    },
    get tempogramShowGrid() {
      return tempogramShowGrid;
    },
    set tempogramShowGrid(v: boolean) {
      tempogramShowGrid = v;
    },

    get hpssColormap() {
      return hpssColormap;
    },
    set hpssColormap(v: SpatialColormap) {
      hpssColormap = SPATIAL_COLORMAPS.includes(v) ? v : 'inferno';
    },
    get hpssView() {
      return hpssView;
    },
    set hpssView(v: HpssView) {
      hpssView = HPSS_VIEWS.includes(v) ? v : 'both';
    },
    get hpssShowGrid() {
      return hpssShowGrid;
    },
    set hpssShowGrid(v: boolean) {
      hpssShowGrid = v;
    }
  };
}

export const uiStore = createUiStore();
