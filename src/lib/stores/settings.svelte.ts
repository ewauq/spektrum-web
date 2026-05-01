import { DEFAULT_CUSTOM_STOPS, type ColormapName, type ColorStop } from '$lib/colormap';
import type { WindowType } from '$lib/dsp/window';
import type { DataFormat } from '$lib/export/data';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export type Quality = 'time' | 'balanced' | 'frequency';

export type WaveformDisplayMode = 'mono' | 'leftRight' | 'midSide';
const WAVEFORM_DISPLAY_MODES: WaveformDisplayMode[] = ['mono', 'leftRight', 'midSide'];
export type WaveformColorMode = 'neutral' | 'spectral';
export type WaveformPalette = 'turbo' | 'rainbow' | 'fire';

export const WAVEFORM_PALETTES: WaveformPalette[] = ['turbo', 'rainbow', 'fire'];

export const QUALITY_PRESETS: Record<Quality, { fftSize: number; hopSize: number }> = {
  time: { fftSize: 1024, hopSize: 256 },
  balanced: { fftSize: 2048, hopSize: 512 },
  frequency: { fftSize: 4096, hopSize: 1024 }
};

function createSettingsStore() {
  let colormap = $state<ColormapName>('turbo');
  let customStops = $state<ColorStop[]>([...DEFAULT_CUSTOM_STOPS]);
  let smoothing = $state(true);
  let quality = $state<Quality>('balanced');
  let windowType = $state<WindowType>('hann');
  let exportLegend = $state(false);
  let exportInfo = $state(false);
  let exportMarkers = $state(true);
  let imageFormat = $state<ImageFormat>('png');
  let dataFormat = $state<DataFormat>('csv');
  let waveformDisplayMode = $state<WaveformDisplayMode>('mono');
  let waveformColorMode = $state<WaveformColorMode>('neutral');
  let waveformPalette = $state<WaveformPalette>('turbo');
  let waveformShowLegend = $state(true);
  let waveformShowClippingGuides = $state(false);
  let waveformShowClippingMarkers = $state(false);
  let waveformShowKicks = $state(false);
  let waveformSmooth = $state(false);
  let waveformGridTimeDivisions = $state(10);
  let waveformGridAmpStep = $state(0.5);

  return {
    get colormap() {
      return colormap;
    },
    set colormap(v: ColormapName) {
      colormap = v;
    },
    get customStops() {
      return customStops;
    },
    set customStops(v: ColorStop[]) {
      customStops = v;
    },
    get smoothing() {
      return smoothing;
    },
    set smoothing(v: boolean) {
      smoothing = v;
    },
    get quality() {
      return quality;
    },
    set quality(v: Quality) {
      quality = v in QUALITY_PRESETS ? v : 'balanced';
    },
    get windowType() {
      return windowType;
    },
    set windowType(v: WindowType) {
      windowType = v;
    },
    get exportLegend() {
      return exportLegend;
    },
    set exportLegend(v: boolean) {
      exportLegend = v;
    },
    get exportInfo() {
      return exportInfo;
    },
    set exportInfo(v: boolean) {
      exportInfo = v;
    },
    get exportMarkers() {
      return exportMarkers;
    },
    set exportMarkers(v: boolean) {
      exportMarkers = v;
    },
    get imageFormat() {
      return imageFormat;
    },
    set imageFormat(v: ImageFormat) {
      imageFormat = v;
    },
    get dataFormat() {
      return dataFormat;
    },
    set dataFormat(v: DataFormat) {
      dataFormat = v;
    },
    get fftSize() {
      return QUALITY_PRESETS[quality].fftSize;
    },
    get hopSize() {
      return QUALITY_PRESETS[quality].hopSize;
    },
    get waveformDisplayMode() {
      return waveformDisplayMode;
    },
    set waveformDisplayMode(v: WaveformDisplayMode) {
      waveformDisplayMode = WAVEFORM_DISPLAY_MODES.includes(v) ? v : 'mono';
    },
    get waveformColorMode() {
      return waveformColorMode;
    },
    set waveformColorMode(v: WaveformColorMode) {
      waveformColorMode = v;
    },
    get waveformPalette() {
      return waveformPalette;
    },
    set waveformPalette(v: WaveformPalette) {
      waveformPalette = WAVEFORM_PALETTES.includes(v) ? v : 'turbo';
    },
    get waveformShowLegend() {
      return waveformShowLegend;
    },
    set waveformShowLegend(v: boolean) {
      waveformShowLegend = v;
    },
    get waveformShowClippingGuides() {
      return waveformShowClippingGuides;
    },
    set waveformShowClippingGuides(v: boolean) {
      waveformShowClippingGuides = v;
    },
    get waveformShowClippingMarkers() {
      return waveformShowClippingMarkers;
    },
    set waveformShowClippingMarkers(v: boolean) {
      waveformShowClippingMarkers = v;
    },
    get waveformShowKicks() {
      return waveformShowKicks;
    },
    set waveformShowKicks(v: boolean) {
      waveformShowKicks = v;
    },
    get waveformSmooth() {
      return waveformSmooth;
    },
    set waveformSmooth(v: boolean) {
      waveformSmooth = v;
    },
    get waveformGridTimeDivisions() {
      return waveformGridTimeDivisions;
    },
    set waveformGridTimeDivisions(v: number) {
      waveformGridTimeDivisions = v;
    },
    get waveformGridAmpStep() {
      return waveformGridAmpStep;
    },
    set waveformGridAmpStep(v: number) {
      waveformGridAmpStep = v;
    }
  };
}

export const settingsStore = createSettingsStore();
