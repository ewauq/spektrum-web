/**
 * ITU-R BS.1770-4 / EBU R128 loudness measurement.
 *
 *   - K-weighting: cascade of a high-shelf "pre-filter" centred at
 *     1681.97 Hz (+4 dB, Q = 0.7071) and an RLB high-pass at 38.13 Hz
 *     (Q = 0.5003). Coefficients are derived per sample-rate via the
 *     bilinear transform so every input rate is supported, not just
 *     48 kHz.
 *
 *   - Mean-square is summed per channel (weighting 1.0 for L and R in
 *     a 2.0 stereo programme; mono is treated as a single channel of
 *     weight 1.0). LUFS for a block is LK = -0.691 + 10·log10(MS).
 *
 *   - Momentary (M)  : 400 ms sliding window, hop 100 ms.
 *   - Short-term (S) : 3 s sliding window, same hop grid as M.
 *   - Integrated (I) : double-gating per BS.1770-4 §5.2.
 *       - absolute gate: drop blocks below -70 LUFS;
 *       - relative gate: drop blocks below (Lpre - 10 LU);
 *       - I = -0.691 + 10·log10(mean(MS) over surviving blocks).
 *
 *   - True peak : 4× polyphase oversampling, FIR 48-tap Hann-windowed
 *     sinc (12 taps per phase). Maximum over channels and phases.
 *     dBTP = 20·log10(max(|x_oversampled|)).
 *
 * Returned series share the same time axis (block centres of the
 * momentary window). Frames where the long sliding window is not yet
 * full are flagged at LUFS_NA so the renderer can leave them blank.
 */

export const LUFS_NA = -Infinity;
const ABSOLUTE_GATE = -70;
const RELATIVE_GATE_OFFSET = -10;
const HEAD_OFFSET = -0.691;
const HOP_SECONDS = 0.1;
const MOMENTARY_BLOCKS = 4;
const SHORT_TERM_BLOCKS = 30;
const TP_OVERSAMPLE = 4;
const TP_TAPS_PER_PHASE = 12;

export interface LoudnessSeries {
  /** Center time of each momentary block, length N. */
  times: Float32Array;
  /** Momentary LUFS per block (400 ms window), length N. NaN-equivalent = LUFS_NA. */
  momentaryLufs: Float32Array;
  /** Short-term LUFS per block (3 s window), length N. */
  shortTermLufs: Float32Array;
  /** Integrated LUFS over the whole programme (double-gated). */
  integratedLufs: number;
  /** True peak in dBTP (4× oversampled). */
  truePeakDb: number;
  /** Hop in seconds (= block size, here 100 ms). */
  hopSeconds: number;
  /** Total programme duration in seconds (used for axis bounds). */
  durationSeconds: number;
}

export interface LoudnessOptions {
  /** Override true-peak oversampling factor (default 4). */
  truePeakOversample?: number;
}

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function highShelfCoeffs(
  sampleRate: number,
  f0: number,
  gainDb: number,
  q: number
): BiquadCoeffs {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  const sqrtA = Math.sqrt(A);
  const b0 = A * (A + 1 + (A - 1) * cosw + 2 * sqrtA * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cosw);
  const b2 = A * (A + 1 + (A - 1) * cosw - 2 * sqrtA * alpha);
  const a0 = A + 1 - (A - 1) * cosw + 2 * sqrtA * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cosw);
  const a2 = A + 1 - (A - 1) * cosw - 2 * sqrtA * alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function highPassCoeffs(
  sampleRate: number,
  f0: number,
  q: number
): BiquadCoeffs {
  const w0 = (2 * Math.PI * f0) / sampleRate;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * q);
  const b0 = (1 + cosw) / 2;
  const b1 = -(1 + cosw);
  const b2 = (1 + cosw) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyBiquad(
  input: Float32Array,
  output: Float32Array,
  c: BiquadCoeffs
): void {
  // Direct Form I, single channel. Output may alias input (we read each
  // input sample before writing, and the recurrence only touches past
  // outputs).
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

function kWeight(pcm: Float32Array, sampleRate: number): Float32Array {
  // ITU-R BS.1770 reference: pre-filter then RLB high-pass.
  const pre = highShelfCoeffs(
    sampleRate,
    1681.974450955533,
    4.0,
    1 / Math.SQRT2
  );
  const rlb = highPassCoeffs(sampleRate, 38.13547087602444, 0.5003270373238773);
  const stage1 = new Float32Array(pcm.length);
  applyBiquad(pcm, stage1, pre);
  const stage2 = new Float32Array(pcm.length);
  applyBiquad(stage1, stage2, rlb);
  return stage2;
}

function lufsFromMs(ms: number): number {
  if (ms <= 0) return LUFS_NA;
  return HEAD_OFFSET + 10 * Math.log10(ms);
}

function blockMeanSquare(
  weighted: Float32Array,
  startSample: number,
  blockSamples: number
): number {
  let sum = 0;
  const end = Math.min(weighted.length, startSample + blockSamples);
  for (let i = startSample; i < end; i++) {
    const v = weighted[i];
    sum += v * v;
  }
  return sum / blockSamples;
}

function buildPolyphaseTaps(): Float32Array[] {
  // Hann-windowed sinc, low-pass at fs/8 (so it survives 4× upsampling
  // up to original Nyquist). Coefficient order: phase k contains taps
  // h[k], h[k+L], h[k+2L], ... where L = TP_OVERSAMPLE.
  const L = TP_OVERSAMPLE;
  const M = TP_TAPS_PER_PHASE;
  const total = L * M;
  const center = (total - 1) / 2;
  const h = new Float32Array(total);
  for (let n = 0; n < total; n++) {
    const t = (n - center) / L;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (total - 1)));
    h[n] = sinc * w;
  }
  // Normalize each phase so identity input keeps unit gain after the
  // 4× expansion: the upsampled output should have the same peak as
  // the input on a held DC value. Sum of h restricted to one phase
  // times L equals 1.
  const phases: Float32Array[] = [];
  for (let k = 0; k < L; k++) {
    const tap = new Float32Array(M);
    let s = 0;
    for (let i = 0; i < M; i++) {
      tap[i] = h[i * L + k];
      s += tap[i];
    }
    const g = s > 0 ? 1 / s : 1;
    for (let i = 0; i < M; i++) tap[i] *= g;
    phases.push(tap);
  }
  return phases;
}

function truePeak(
  pcm: Float32Array,
  oversample: number,
  phases: Float32Array[]
): number {
  if (pcm.length === 0) return -Infinity;
  let peak = 0;
  // Sample peak first: gives a lower bound and a comparison point.
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }
  // Phase 0 reproduces the input (its taps are a Hann-windowed kronecker
  // delta after normalisation, so the value differs slightly — we still
  // include it for symmetry).
  const M = phases[0].length;
  for (let k = 0; k < oversample; k++) {
    const tap = phases[k];
    for (let n = 0; n < pcm.length; n++) {
      let acc = 0;
      for (let i = 0; i < M; i++) {
        const idx = n - i;
        if (idx < 0) break;
        acc += pcm[idx] * tap[i];
      }
      const a = Math.abs(acc);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

export function computeLoudness(
  pcmLeft: Float32Array,
  pcmRight: Float32Array | null,
  sampleRate: number,
  options: LoudnessOptions = {}
): LoudnessSeries {
  const oversample = options.truePeakOversample ?? TP_OVERSAMPLE;
  const blockSamples = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const totalBlocks = Math.floor(pcmLeft.length / blockSamples);
  const durationSeconds = pcmLeft.length / sampleRate;

  const empty: LoudnessSeries = {
    times: new Float32Array(0),
    momentaryLufs: new Float32Array(0),
    shortTermLufs: new Float32Array(0),
    integratedLufs: LUFS_NA,
    truePeakDb: -Infinity,
    hopSeconds: HOP_SECONDS,
    durationSeconds
  };

  if (totalBlocks < 1) return empty;

  // 1) K-weighting per channel.
  const leftK = kWeight(pcmLeft, sampleRate);
  const rightK = pcmRight ? kWeight(pcmRight, sampleRate) : null;

  // 2) Per-block weighted mean-square.
  const blockMs = new Float32Array(totalBlocks);
  for (let b = 0; b < totalBlocks; b++) {
    const start = b * blockSamples;
    const left = blockMeanSquare(leftK, start, blockSamples);
    const right = rightK ? blockMeanSquare(rightK, start, blockSamples) : 0;
    blockMs[b] = left + right;
  }

  // 3) Sliding momentary (4 blocks) and short-term (30 blocks) — running
  //    sum updated incrementally for O(N).
  const momentaryLufs = new Float32Array(totalBlocks);
  const shortTermLufs = new Float32Array(totalBlocks);
  const times = new Float32Array(totalBlocks);

  let mSum = 0;
  let sSum = 0;
  for (let b = 0; b < totalBlocks; b++) {
    times[b] = (b * blockSamples + blockSamples / 2) / sampleRate;
    mSum += blockMs[b];
    if (b >= MOMENTARY_BLOCKS) mSum -= blockMs[b - MOMENTARY_BLOCKS];
    sSum += blockMs[b];
    if (b >= SHORT_TERM_BLOCKS) sSum -= blockMs[b - SHORT_TERM_BLOCKS];

    const mWindow = Math.min(MOMENTARY_BLOCKS, b + 1);
    const sWindow = Math.min(SHORT_TERM_BLOCKS, b + 1);
    momentaryLufs[b] =
      b + 1 >= MOMENTARY_BLOCKS ? lufsFromMs(mSum / mWindow) : LUFS_NA;
    shortTermLufs[b] =
      b + 1 >= SHORT_TERM_BLOCKS ? lufsFromMs(sSum / sWindow) : LUFS_NA;
  }

  // 4) Integrated loudness with double gating. We rebuild the per-momentary
  //    400 ms mean-square so each gate decision uses the same averages
  //    that drive the momentary curve (BS.1770-4 §5.2 gates on momentary
  //    blocks, not on individual 100 ms blocks).
  const momentaryMs = new Float32Array(totalBlocks);
  let runMs = 0;
  for (let b = 0; b < totalBlocks; b++) {
    runMs += blockMs[b];
    if (b >= MOMENTARY_BLOCKS) runMs -= blockMs[b - MOMENTARY_BLOCKS];
    const w = Math.min(MOMENTARY_BLOCKS, b + 1);
    momentaryMs[b] = b + 1 >= MOMENTARY_BLOCKS ? runMs / w : 0;
  }
  let integratedLufs = LUFS_NA;
  let absSum = 0;
  let absCount = 0;
  for (let b = MOMENTARY_BLOCKS - 1; b < totalBlocks; b++) {
    const lk = lufsFromMs(momentaryMs[b]);
    if (lk > ABSOLUTE_GATE) {
      absSum += momentaryMs[b];
      absCount++;
    }
  }
  if (absCount > 0) {
    const lpre = lufsFromMs(absSum / absCount);
    const relativeGate = lpre + RELATIVE_GATE_OFFSET;
    let relSum = 0;
    let relCount = 0;
    for (let b = MOMENTARY_BLOCKS - 1; b < totalBlocks; b++) {
      const lk = lufsFromMs(momentaryMs[b]);
      if (lk > ABSOLUTE_GATE && lk > relativeGate) {
        relSum += momentaryMs[b];
        relCount++;
      }
    }
    if (relCount > 0) integratedLufs = lufsFromMs(relSum / relCount);
  }

  // 5) True peak across all channels.
  const phases = buildPolyphaseTaps();
  let tpAmp = truePeak(pcmLeft, oversample, phases);
  if (pcmRight) {
    const tpR = truePeak(pcmRight, oversample, phases);
    if (tpR > tpAmp) tpAmp = tpR;
  }
  const truePeakDb = tpAmp > 0 ? 20 * Math.log10(tpAmp) : -Infinity;

  return {
    times,
    momentaryLufs,
    shortTermLufs,
    integratedLufs,
    truePeakDb,
    hopSeconds: HOP_SECONDS,
    durationSeconds
  };
}
