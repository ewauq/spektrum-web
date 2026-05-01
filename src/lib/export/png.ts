import { saveBlob } from '$lib/platform/downloader';
import { buildLut, buildCustomLut, type ColormapName, type ColorStop } from '$lib/colormap';
import { niceTicks, formatTime, formatFrequency } from '$lib/render/axes';
import { formatDuration } from '$lib/format';
import type { FreqMarker } from '$lib/stores/markers.svelte';

export interface ExportOptions {
  imageFormat?: ImageFormat;
  legend?: boolean;
  border?: boolean;
  info?: boolean;
  dbFloor?: number;
  dbCeiling?: number;
  colormap?: ColormapName;
  customStops?: ColorStop[];
  timeStart?: number;
  timeEnd?: number;
  sampleRate?: number;
  filePath?: string;
  format?: string;
  channels?: number;
  bitDepth?: number;
  duration?: number;
  fftSize?: number;
  windowType?: string;
  markers?: FreqMarker[];
  exportMarkers?: boolean;
  freqTop?: number;
  freqBottom?: number;
}

const BORDER_PX = 40;
const LEGEND_W = 60;
const AXIS_LEFT = 56;
const AXIS_BOTTOM = 24;
const INFO_H = 72;
const FONT = '11px ui-monospace, monospace';
const TEXT_COLOR = '#8b94b5';
const DIM_COLOR = '#6b7599';
const BORDER_COLOR = '#2a3145';
const BG = '#000000';

import type { ImageFormat } from '$lib/stores/settings.svelte';

const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

async function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat = 'png'): Promise<Blob> {
  const quality = format === 'png' ? undefined : 0.92;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), MIME[format], quality)
  );
  if (!blob) throw new Error('Image conversion failed');
  return blob;
}

function suggestedFilename(suggestedName: string, format: ImageFormat): string {
  const ext = format === 'jpeg' ? 'jpg' : format;
  return suggestedName.endsWith(`.${ext}`) ? suggestedName : `${suggestedName}.${ext}`;
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  opts: ExportOptions
) {
  const floor = opts.dbFloor ?? -140;
  const ceiling = opts.dbCeiling ?? 0;
  const name = opts.colormap ?? 'viridis';
  const lut =
    name === 'custom' && opts.customStops
      ? buildCustomLut(opts.customStops)
      : buildLut(name as Exclude<ColormapName, 'custom'>);

  const barW = 14;
  const barX = x + 12;

  for (let py = 0; py < height; py++) {
    const t = 1 - py / height;
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)));
    ctx.fillStyle = `rgb(${lut[idx * 4]},${lut[idx * 4 + 1]},${lut[idx * 4 + 2]})`;
    ctx.fillRect(barX, y + py, barW, 1);
  }

  ctx.strokeStyle = 'rgba(139,148,181,0.2)';
  ctx.strokeRect(barX, y, barW, height);

  const ticks = niceTicks(floor, ceiling, Math.max(3, Math.floor(height / 50)));
  ctx.font = FONT;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = 'middle';
  for (const db of ticks) {
    const frac = (db - floor) / (ceiling - floor);
    const ty = y + height - frac * height;
    if (ty >= y && ty <= y + height) {
      ctx.fillStyle = 'rgba(139,148,181,0.35)';
      ctx.fillRect(barX + barW, ty, 3, 1);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`${db}`, barX + barW + 5, ty);
    }
  }

  ctx.fillStyle = DIM_COLOR;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('dB', barX + barW / 2, y + height + 14);
  ctx.textAlign = 'left';
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  opts: ExportOptions
) {
  const sr = opts.sampleRate ?? 44100;
  const nyquist = sr / 2;
  const tStart = opts.timeStart ?? 0;
  const tEnd = opts.timeEnd ?? 1;

  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(ox, oy, w, h);

  ctx.font = FONT;
  ctx.fillStyle = TEXT_COLOR;

  const freqTicks = niceTicks(0, nyquist, Math.max(4, Math.floor(h / 40)));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const hz of freqTicks) {
    const fy = oy + h - (hz / nyquist) * h;
    if (fy >= oy && fy <= oy + h) {
      ctx.fillStyle = 'rgba(139,148,181,0.35)';
      ctx.fillRect(ox - 4, fy, 4, 1);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(formatFrequency(hz), ox - 6, fy);
    }
  }

  const approxTime = Math.max(3, Math.floor(w / 90));
  const innerTimeTicks = niceTicks(tStart, tEnd, approxTime);
  const timeStep =
    innerTimeTicks.length >= 2
      ? innerTimeTicks[1] - innerTimeTicks[0]
      : (tEnd - tStart) / approxTime;
  const timeMargin = timeStep / 2;
  const timeTicks = [
    tStart,
    ...innerTimeTicks.filter(
      (t) => t - tStart > timeMargin && tEnd - t > timeMargin,
    ),
    tEnd,
  ];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of timeTicks) {
    const tx = ox + ((t - tStart) / (tEnd - tStart)) * w;
    if (tx >= ox && tx <= ox + w) {
      ctx.fillStyle = 'rgba(139,148,181,0.35)';
      ctx.fillRect(tx, oy + h, 1, 4);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(formatTime(t, timeStep), tx, oy + h + 5);
    }
  }
}

function drawInfo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  opts: ExportOptions
) {
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillStyle = '#e6e8ef';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const sr = opts.sampleRate ?? 44100;
  const lines: string[] = [];

  if (opts.filePath) lines.push(opts.filePath);

  const parts: string[] = [];
  if (opts.format) parts.push(opts.format.toUpperCase());
  if (sr) parts.push(`${sr} Hz`);
  if (opts.channels) parts.push(`${opts.channels} ch`);
  if (opts.bitDepth) parts.push(`${opts.bitDepth} bits`);
  if (opts.duration) parts.push(formatDuration(opts.duration, true));
  if (parts.length) lines.push(parts.join('  |  '));

  const analysis: string[] = [];
  if (opts.fftSize) analysis.push(`FFT ${opts.fftSize}`);
  if (opts.windowType) analysis.push(`Window: ${opts.windowType}`);
  analysis.push(`Scale: ${opts.dbFloor ?? -140} to ${opts.dbCeiling ?? 0} dB`);
  analysis.push(`Nyquist: ${Math.round(sr / 2)} Hz`);
  lines.push(analysis.join('  |  '));

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * 20, width);
  }
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  imgX: number,
  imgY: number,
  srcW: number,
  srcH: number,
  opts: ExportOptions
) {
  if (!opts.markers || opts.exportMarkers === false) return;
  const visible = opts.markers.filter((m) => m.visible);
  if (visible.length === 0) return;

  const freqTop = opts.freqTop ?? (opts.sampleRate ?? 44100) / 2;
  const freqBottom = opts.freqBottom ?? 0;
  if (freqTop <= freqBottom) return;

  for (const m of visible) {
    if (m.freq < freqBottom || m.freq > freqTop) continue;
    const y = imgY + srcH - ((m.freq - freqBottom) / (freqTop - freqBottom)) * srcH;
    ctx.globalAlpha = m.opacity;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = m.thickness;
    ctx.setLineDash(
      m.style === 'dashed' ? [6, 4] : m.style === 'dotted' ? [1, 3] : []
    );
    ctx.beginPath();
    ctx.moveTo(imgX, y);
    ctx.lineTo(imgX + srcW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (m.labelVisible) {
      ctx.font = FONT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const text = m.label;
      const textW = ctx.measureText(text).width;
      const pad = 4;
      const tx = imgX + srcW - 4;
      const ty = y - 2;
      ctx.fillStyle = 'rgba(12, 13, 18, 0.7)';
      ctx.fillRect(tx - textW - pad, ty - 13, textW + pad * 2, 14);
      ctx.fillStyle = m.color;
      ctx.fillText(text, tx, ty);
    }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function composeExport(
  source: HTMLCanvasElement,
  srcRegion: { x: number; y: number; w: number; h: number } | null,
  opts: ExportOptions
): HTMLCanvasElement {
  const srcX = srcRegion?.x ?? 0;
  const srcY = srcRegion?.y ?? 0;
  const srcW = srcRegion?.w ?? source.width;
  const srcH = srcRegion?.h ?? source.height;

  const legend = opts.legend ?? false;
  const border = opts.border ?? false;
  const info = opts.info ?? false;

  const pad = border ? BORDER_PX : 0;
  const axisLeft = legend ? AXIS_LEFT : 0;
  const axisBottom = legend ? AXIS_BOTTOM : 0;
  const legendRight = legend ? LEGEND_W : 0;
  const infoBottom = info ? INFO_H : 0;

  const totalW = pad * 2 + axisLeft + srcW + legendRight;
  const totalH = pad * 2 + srcH + axisBottom + infoBottom;

  const target = document.createElement('canvas');
  target.width = totalW;
  target.height = totalH;
  const ctx = target.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, totalW, totalH);

  const imgX = pad + axisLeft;
  const imgY = pad;

  ctx.drawImage(source, srcX, srcY, srcW, srcH, imgX, imgY, srcW, srcH);

  drawMarkers(ctx, imgX, imgY, srcW, srcH, opts);

  if (legend) {
    drawAxes(ctx, imgX, imgY, srcW, srcH, opts);
    drawLegend(ctx, imgX + srcW, imgY, srcH, opts);
  }

  if (info) {
    drawInfo(ctx, pad, imgY + srcH + axisBottom + 8, totalW - pad * 2, opts);
  }

  return target;
}

function hasVisibleMarkers(opts: ExportOptions): boolean {
  return (
    opts.exportMarkers !== false &&
    !!opts.markers &&
    opts.markers.some((m) => m.visible)
  );
}

export async function exportFullPng(
  source: HTMLCanvasElement,
  suggestedName: string,
  opts: ExportOptions = {}
): Promise<string | null> {
  const fmt = opts.imageFormat ?? 'png';
  const withMarkers = hasVisibleMarkers(opts);
  const needsCompose = opts.legend || opts.border || withMarkers;
  const effective: ExportOptions = withMarkers
    ? {
        ...opts,
        freqTop: (opts.sampleRate ?? 44100) / 2,
        freqBottom: 0
      }
    : opts;
  const target = needsCompose ? composeExport(source, null, effective) : source;
  const blob = await canvasToBlob(target, fmt);
  const filename = suggestedFilename(suggestedName, fmt);
  saveBlob(blob, filename);
  return filename;
}

export async function exportRegionPng(
  source: HTMLCanvasElement,
  region: { x: number; y: number; width: number; height: number },
  suggestedName: string,
  opts: ExportOptions = {}
): Promise<string | null> {
  const w = Math.max(1, Math.round(region.width));
  const h = Math.max(1, Math.round(region.height));

  const fmt = opts.imageFormat ?? 'png';
  const withMarkers = hasVisibleMarkers(opts);
  const needsCompose = opts.legend || opts.border || withMarkers;

  const effective: ExportOptions = withMarkers
    ? (() => {
        const nyq = (opts.sampleRate ?? 44100) / 2;
        const canvasH = source.height;
        const freqTop = nyq * (1 - region.y / canvasH);
        const freqBottom = nyq * (1 - (region.y + h) / canvasH);
        return { ...opts, freqTop, freqBottom };
      })()
    : opts;

  const target = needsCompose
    ? composeExport(source, { x: region.x, y: region.y, w, h }, effective)
    : (() => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(source, region.x, region.y, w, h, 0, 0, w, h);
        return c;
      })();

  const blob = await canvasToBlob(target, fmt);
  const filename = suggestedFilename(suggestedName, fmt);
  saveBlob(blob, filename);
  return filename;
}
