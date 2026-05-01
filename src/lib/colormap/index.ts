import {
  interpolateViridis,
  interpolateMagma,
  interpolateInferno,
  interpolatePlasma,
  interpolateTurbo,
  interpolateGreys
} from 'd3-scale-chromatic';
import { rgb } from 'd3-color';

export interface ColorStop {
  position: number;
  color: string;
}

export const DEFAULT_CUSTOM_STOPS: ColorStop[] = [
  { position: 0, color: '#000000' },
  { position: 0.5, color: '#ff6600' },
  { position: 1, color: '#ffffff' }
];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

export function buildCustomLut(stops: ColorStop[]): Uint8Array {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) sorted.push({ position: 0, color: '#000000' }, { position: 1, color: '#ffffff' });
  if (sorted.length === 1) sorted.push({ position: 1, color: sorted[0].color });
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let li = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (t >= sorted[j].position) li = j;
    }
    const left = sorted[li];
    const right = sorted[Math.min(li + 1, sorted.length - 1)];
    const range = right.position - left.position;
    const frac = range > 0 ? (t - left.position) / range : 0;
    const lc = hexToRgb(left.color);
    const rc = hexToRgb(right.color);
    lut[i * 4] = Math.round(lc[0] + (rc[0] - lc[0]) * frac);
    lut[i * 4 + 1] = Math.round(lc[1] + (rc[1] - lc[1]) * frac);
    lut[i * 4 + 2] = Math.round(lc[2] + (rc[2] - lc[2]) * frac);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export type ColormapName =
  | 'custom'
  | 'viridis'
  | 'magma'
  | 'inferno'
  | 'plasma'
  | 'turbo'
  | 'greys';

const INTERPOLATORS: Record<Exclude<ColormapName, 'custom'>, (t: number) => string> = {
  viridis: interpolateViridis,
  magma: interpolateMagma,
  inferno: interpolateInferno,
  plasma: interpolatePlasma,
  turbo: interpolateTurbo,
  greys: interpolateGreys
};

export const COLORMAP_NAMES: ColormapName[] = [
  'viridis',
  'magma',
  'inferno',
  'plasma',
  'turbo',
  'greys',
  'custom'
];

export function sampleColormapHex(
  name: ColormapName,
  t: number,
  customStops?: ColorStop[]
): string {
  if (name === 'custom' && customStops && customStops.length >= 2) {
    const sorted = [...customStops].sort((a, b) => a.position - b.position);
    let li = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (t >= sorted[j].position) li = j;
    }
    const left = sorted[li];
    const right = sorted[Math.min(li + 1, sorted.length - 1)];
    const range = right.position - left.position;
    const frac = range > 0 ? (t - left.position) / range : 0;
    const lc = hexToRgb(left.color);
    const rc = hexToRgb(right.color);
    const r = Math.round(lc[0] + (rc[0] - lc[0]) * frac);
    const g = Math.round(lc[1] + (rc[1] - lc[1]) * frac);
    const b = Math.round(lc[2] + (rc[2] - lc[2]) * frac);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
  const interp = INTERPOLATORS[name as Exclude<ColormapName, 'custom'>];
  return interp ? interp(t) : '#888888';
}

export function colormapGradientCss(name: Exclude<ColormapName, 'custom'>): string {
  const interp = INTERPOLATORS[name];
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => interp(t));
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

export function colormapVerticalCss(
  name: ColormapName,
  customStops?: ColorStop[]
): string {
  if (name === 'custom' && customStops) {
    const sorted = [...customStops].sort((a, b) => a.position - b.position);
    return `linear-gradient(to top, ${sorted.map((s) => `${s.color} ${(s.position * 100).toFixed(1)}%`).join(', ')})`;
  }
  const interp = INTERPOLATORS[name as Exclude<ColormapName, 'custom'>];
  if (!interp) return 'linear-gradient(to top, #000, #fff)';
  const stops = Array.from({ length: 9 }, (_, i) => interp(i / 8));
  return `linear-gradient(to top, ${stops.join(', ')})`;
}

export function buildLut(name: Exclude<ColormapName, 'custom'>): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  const interp = INTERPOLATORS[name];
  for (let i = 0; i < 256; i++) {
    const c = rgb(interp(i / 255));
    lut[i * 4] = c.r;
    lut[i * 4 + 1] = c.g;
    lut[i * 4 + 2] = c.b;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}
