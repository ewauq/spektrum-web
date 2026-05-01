import type { WaveformPalette } from '$lib/stores/settings.svelte';

type RGB = [number, number, number];
type Stop = [number, RGB];

const PALETTES: Record<WaveformPalette, Stop[]> = {
  turbo: [
    [0, [48, 18, 59]],
    [0.13, [70, 107, 227]],
    [0.31, [70, 184, 255]],
    [0.5, [44, 220, 174]],
    [0.66, [183, 232, 76]],
    [0.84, [255, 178, 44]],
    [1, [122, 4, 3]]
  ],
  rainbow: [
    [0, [125, 0, 235]],
    [0.2, [50, 80, 255]],
    [0.4, [50, 200, 255]],
    [0.55, [80, 230, 110]],
    [0.7, [240, 230, 60]],
    [0.85, [240, 130, 50]],
    [1, [220, 50, 50]]
  ],
  fire: [
    [0, [10, 0, 0]],
    [0.25, [120, 20, 0]],
    [0.5, [220, 80, 10]],
    [0.75, [255, 180, 60]],
    [1, [255, 250, 220]]
  ]
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function paletteRGB(palette: WaveformPalette, t: number): RGB {
  const stops = PALETTES[palette];
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (x <= t1) {
      const f = (x - t0) / Math.max(1e-9, t1 - t0);
      return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
    }
  }
  return stops[stops.length - 1][1];
}

export function paletteCss(palette: WaveformPalette, t: number): string {
  const [r, g, b] = paletteRGB(palette, t);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function paletteGradientCss(
  palette: WaveformPalette,
  direction: 'to right' | 'to top' = 'to right'
): string {
  const stops = PALETTES[palette];
  const stopList = stops
    .map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`)
    .join(', ');
  return `linear-gradient(${direction}, ${stopList})`;
}

/**
 * Mappe une fréquence (Hz) sur l'intervalle [0, 1] de la palette en log.
 * Plage par défaut : 100 Hz à 8000 Hz, qui correspond aux centroïdes
 * habituels d'un mix musical.
 */
export function frequencyToPaletteT(
  freqHz: number,
  minHz = 100,
  maxHz = 8000
): number {
  if (!Number.isFinite(freqHz) || freqHz <= 0) return 0;
  const v = Math.max(minHz, Math.min(maxHz, freqHz));
  return (Math.log(v) - Math.log(minHz)) / (Math.log(maxHz) - Math.log(minHz));
}
