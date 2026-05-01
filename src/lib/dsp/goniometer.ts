/**
 * Mid/Side density accumulator. Conventions per CLAUDE.md (mastering):
 *   M = (L + R) / 2     (vertical axis, growing upward)
 *   S = (L - R) / 2     (horizontal axis)
 *
 * Sub-samples the PCM to ~80 k points and bins them into a single
 * (gridSize × gridSize) Uint16 density buffer. The panel colorises
 * via a LUT (inferno).
 *
 * Peaks of M and S are returned so the panel can label its scale
 * without having to walk the buffer again.
 */

export interface GoniometerResult {
  density: Uint16Array;
  gridSize: number;
  maxCount: number;
  midPeak: number;
  sidePeak: number;
  sampleCount: number;
}

export interface GoniometerOptions {
  targetPoints?: number;
  gridSize?: number;
}

const DEFAULT_TARGET_POINTS = 80_000;
const DEFAULT_GRID_SIZE = 256;

export function computeGoniometer(
  pcmLeft: Float32Array,
  pcmRight: Float32Array,
  options: GoniometerOptions = {}
): GoniometerResult {
  const target = options.targetPoints ?? DEFAULT_TARGET_POINTS;
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const len = Math.min(pcmLeft.length, pcmRight.length);
  const stride = Math.max(1, Math.floor(len / target));
  const density = new Uint16Array(gridSize * gridSize);

  let maxCount = 0;
  let midPeak = 0;
  let sidePeak = 0;
  let sampleCount = 0;

  for (let i = 0; i < len; i += stride) {
    const l = pcmLeft[i];
    const r = pcmRight[i];
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;

    const am = Math.abs(mid);
    const as = Math.abs(side);
    if (am > midPeak) midPeak = am;
    if (as > sidePeak) sidePeak = as;

    // Side maps to x in [-1, +1] → [0, gridSize-1]
    // Mid maps to y but growing upward → grid y = (1 - mid) / 2 mapped
    // to row index, since the canvas blit will not flip.
    const gx = Math.max(
      0,
      Math.min(gridSize - 1, Math.round((side + 1) * 0.5 * (gridSize - 1)))
    );
    const gy = Math.max(
      0,
      Math.min(gridSize - 1, Math.round((1 - mid) * 0.5 * (gridSize - 1)))
    );
    const cell = gy * gridSize + gx;
    const v = ++density[cell];
    if (v > maxCount) maxCount = v;
    sampleCount++;
  }

  return { density, gridSize, maxCount, midPeak, sidePeak, sampleCount };
}
