export interface Pyramid {
  levels: Uint8Array[];
  levelTimeFrames: number[];
  freqBins: number;
  timeFrames: number;
}

export function buildPyramidFromMagnitudes(
  magnitudes: Float32Array,
  freqBins: number,
  timeFrames: number,
  dbFloor: number,
  dbCeiling: number,
  maxLevels = 10
): Pyramid {
  const dbRange = dbCeiling - dbFloor || 1;
  const l0 = new Uint8Array(freqBins * timeFrames);
  for (let i = 0; i < l0.length; i++) {
    const norm = (magnitudes[i] - dbFloor) / dbRange;
    l0[i] = Math.max(0, Math.min(255, Math.round(norm * 255)));
  }
  return extendPyramid(l0, freqBins, timeFrames, maxLevels);
}

export function buildPyramidFromL0(
  l0: Uint8Array,
  freqBins: number,
  timeFrames: number,
  maxLevels = 10
): Pyramid {
  return extendPyramid(l0, freqBins, timeFrames, maxLevels);
}

function extendPyramid(
  level0: Uint8Array,
  freqBins: number,
  timeFrames: number,
  maxLevels: number
): Pyramid {
  const l0 = level0;
  const levels: Uint8Array[] = [l0];
  const levelTimeFrames: number[] = [timeFrames];

  for (let lv = 1; lv < maxLevels; lv++) {
    const prev = levels[lv - 1];
    const prevFrames = levelTimeFrames[lv - 1];
    const newFrames = Math.ceil(prevFrames / 2);
    if (newFrames < 2 || newFrames === prevFrames) break;
    const cur = new Uint8Array(freqBins * newFrames);
    for (let f = 0; f < newFrames; f++) {
      const a = 2 * f;
      const b = Math.min(prevFrames - 1, 2 * f + 1);
      const aOffset = a * freqBins;
      const bOffset = b * freqBins;
      const cOffset = f * freqBins;
      for (let k = 0; k < freqBins; k++) {
        const va = prev[aOffset + k];
        const vb = prev[bOffset + k];
        cur[cOffset + k] = va > vb ? va : vb;
      }
    }
    levels.push(cur);
    levelTimeFrames.push(newFrames);
  }

  return { levels, levelTimeFrames, freqBins, timeFrames };
}

export function pickStftLevel(
  pyramid: Pyramid,
  rangeStart: number,
  rangeEnd: number,
  width: number
): number {
  const { levels, levelTimeFrames, timeFrames } = pyramid;
  const visibleFrames = Math.max(1, rangeEnd - rangeStart);
  let level = 0;
  for (let lv = 1; lv < levels.length; lv++) {
    const scale = levelTimeFrames[lv] / timeFrames;
    const framesAtLv = Math.ceil(visibleFrames * scale);
    if (framesAtLv >= width) level = lv;
    else break;
  }
  return level;
}

export function downsampleFromPyramid(
  pyramid: Pyramid,
  targetColumns: number,
  frameRange?: { start: number; end: number },
  out?: Uint8Array
): { data: Uint8Array; width: number; height: number; level: number } {
  const { levels, levelTimeFrames, freqBins, timeFrames } = pyramid;
  const rangeStart = Math.max(0, frameRange?.start ?? 0);
  const rangeEnd = Math.min(timeFrames, frameRange?.end ?? timeFrames);
  const visibleFrames = Math.max(1, rangeEnd - rangeStart);
  const width = Math.min(targetColumns, visibleFrames);
  const needed = width * freqBins;
  const data = out && out.length >= needed ? out : new Uint8Array(needed);

  const level = pickStftLevel(pyramid, rangeStart, rangeEnd, width);

  const scale = levelTimeFrames[level] / timeFrames;
  const buf = levels[level];
  const lvStart = Math.floor(rangeStart * scale);
  const lvEnd = Math.min(levelTimeFrames[level], Math.ceil(rangeEnd * scale));
  const lvVisible = Math.max(1, lvEnd - lvStart);
  const bucketSize = lvVisible / width;

  for (let x = 0; x < width; x++) {
    const start = lvStart + Math.floor(x * bucketSize);
    const end =
      Math.min(lvEnd, lvStart + Math.floor((x + 1) * bucketSize)) || start + 1;
    for (let k = 0; k < freqBins; k++) {
      let maxVal = 0;
      for (let f = start; f < end; f++) {
        const v = buf[f * freqBins + k];
        if (v > maxVal) {
          maxVal = v;
          if (maxVal === 255) break;
        }
      }
      data[k * width + x] = maxVal;
    }
  }

  return { data, width, height: freqBins, level };
}
