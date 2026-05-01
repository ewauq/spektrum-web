export interface WaveformPyramid {
  levels: Float32Array[];
  levelSamplesPerBin: number[];
  totalSamples: number;
}

export function buildWaveformPyramid(
  pcm: Float32Array,
  maxLevels = 14
): WaveformPyramid {
  const total = pcm.length;
  const levels: Float32Array[] = [];
  const levelSamplesPerBin: number[] = [];
  let prev: Float32Array | null = null;
  let prevBins = 0;

  for (let lv = 0; lv < maxLevels; lv++) {
    const samplesPerBin = 1 << (lv + 1);
    const bins = Math.ceil(total / samplesPerBin);
    if (bins < 2) break;
    const data = new Float32Array(bins * 2);

    if (lv === 0) {
      for (let b = 0; b < bins; b++) {
        const s0 = b * 2;
        const s1 = Math.min(total, s0 + 2);
        let mn = pcm[s0];
        let mx = mn;
        for (let i = s0 + 1; i < s1; i++) {
          const v = pcm[i];
          if (v < mn) mn = v;
          else if (v > mx) mx = v;
        }
        data[b * 2] = mn;
        data[b * 2 + 1] = mx;
      }
    } else {
      const p = prev!;
      const last = prevBins - 1;
      for (let b = 0; b < bins; b++) {
        const ai = b * 4;
        const bi = Math.min(last, b * 2 + 1) * 2;
        const mn1 = p[ai];
        const mx1 = p[ai + 1];
        const mn2 = p[bi];
        const mx2 = p[bi + 1];
        data[b * 2] = mn1 < mn2 ? mn1 : mn2;
        data[b * 2 + 1] = mx1 > mx2 ? mx1 : mx2;
      }
    }

    levels.push(data);
    levelSamplesPerBin.push(samplesPerBin);
    prev = data;
    prevBins = bins;
  }

  return { levels, levelSamplesPerBin, totalSamples: total };
}

export function pickWaveformLevel(
  pyr: WaveformPyramid | null,
  samplesPerPixel: number
): number {
  if (!pyr) return -1;
  let chosen = -1;
  for (let i = 0; i < pyr.levelSamplesPerBin.length; i++) {
    if (pyr.levelSamplesPerBin[i] <= samplesPerPixel) chosen = i;
    else break;
  }
  return chosen;
}

export function sampleWaveformRange(
  pyr: WaveformPyramid | null,
  pcm: Float32Array,
  startSample: number,
  endSample: number,
  width: number,
  outMin: Float32Array,
  outMax: Float32Array
): number {
  const total = pcm.length;
  const span = Math.max(1, endSample - startSample);
  const samplesPerPixel = span / width;

  const chosen = pickWaveformLevel(pyr, samplesPerPixel);

  if (chosen === -1) {
    for (let x = 0; x < width; x++) {
      const s0 = Math.max(0, startSample + Math.floor(x * samplesPerPixel));
      const s1 = Math.min(
        total,
        startSample + Math.floor((x + 1) * samplesPerPixel)
      );
      if (s1 <= s0) {
        const v = pcm[Math.min(total - 1, Math.max(0, s0))] ?? 0;
        outMin[x] = v;
        outMax[x] = v;
        continue;
      }
      let mn = pcm[s0];
      let mx = mn;
      for (let i = s0 + 1; i < s1; i++) {
        const v = pcm[i];
        if (v < mn) mn = v;
        else if (v > mx) mx = v;
      }
      outMin[x] = mn;
      outMax[x] = mx;
    }
    return chosen;
  }

  const data = pyr!.levels[chosen];
  const spb = pyr!.levelSamplesPerBin[chosen];
  const totalBins = data.length / 2;
  const binsPerPixel = samplesPerPixel / spb;
  const startBin = startSample / spb;

  for (let x = 0; x < width; x++) {
    const b0 = Math.max(0, Math.floor(startBin + x * binsPerPixel));
    const b1 = Math.min(
      totalBins,
      Math.max(b0 + 1, Math.floor(startBin + (x + 1) * binsPerPixel) + 1)
    );
    let mn = data[b0 * 2];
    let mx = data[b0 * 2 + 1];
    for (let b = b0 + 1; b < b1; b++) {
      const mni = data[b * 2];
      const mxi = data[b * 2 + 1];
      if (mni < mn) mn = mni;
      if (mxi > mx) mx = mxi;
    }
    outMin[x] = mn;
    outMax[x] = mx;
  }
  return chosen;
}
