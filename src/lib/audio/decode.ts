import { parseFlacMetadata, type FlacMetadata } from './metadata';
import type { DecodeRequest, DecodeResponse, DecodeError } from './decode.worker';
import { perfStore } from '$lib/stores/perf.svelte';
import { debugLog, debugError, buildKind } from '$lib/debug/log';
import { getFile } from '$lib/platform/file-registry';

export interface DecodedAudio {
  pcm: Float32Array;
  pcmLeft?: Float32Array;
  pcmRight?: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
  bitDepth?: number;
  /** Effective average bitrate in kbps, computed as fileBytes·8/duration. */
  bitrate?: number;
  path: string;
  format: 'flac' | 'mp3';
  flacMeta?: FlacMetadata;
  /**
   * True when the file is technically stereo (2 channels) but both
   * channels are sample-for-sample identical. The format is honoured
   * (we still call it stereo) but the StatusBar surfaces a warning so
   * the user knows the spatialization analyses will all be trivial.
   */
  effectivelyMono?: boolean;
}

// Compare side-energy to mid-energy: if the side channel sits more
// than 50 dB below mid the file is effectively mono (50 dB is two
// octaves below the human stereo-perception threshold of ~20-25 dB,
// catching mono masters archived in stereo with analog-tape
// asymmetry without false-positiving on real narrow stereo). 8000
// strided samples give a stable estimate in well under 1 ms even on
// hour-long tracks.
function isEffectivelyMono(left: Float32Array, right: Float32Array): boolean {
  if (left.length !== right.length) return false;
  const N = left.length;
  if (N === 0) return false;
  const SAMPLES = Math.min(8000, N);
  const step = Math.max(1, Math.floor(N / SAMPLES));
  let sumDiffSq = 0;
  let sumMidSq = 0;
  let n = 0;
  for (let i = 0; i < N; i += step) {
    const L = left[i];
    const R = right[i];
    const d = L - R;
    const m = (L + R) * 0.5;
    sumDiffSq += d * d;
    sumMidSq += m * m;
    n++;
  }
  if (n === 0 || sumMidSq < 1e-12) return false;
  return sumDiffSq / sumMidSq < 1e-5;
}

function extension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase();
}

let worker: Worker | null = null;
let nextJobId = 0;
const pending = new Map<
  number,
  { resolve: (value: DecodeResponse) => void; reject: (err: Error) => void }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./decode.worker.ts', import.meta.url), {
    type: 'module'
  });
  worker.onmessage = (event: MessageEvent<DecodeResponse | DecodeError>) => {
    const data = event.data;
    const entry = pending.get(data.jobId);
    if (!entry) return;
    pending.delete(data.jobId);
    if (data.ok) entry.resolve(data);
    else entry.reject(new Error(data.message));
  };
  worker.onerror = (event) => {
    const err = new Error(event.message || 'Decode worker error');
    debugError('decode', 'worker crashed', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      pendingJobs: pending.size
    });
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function decodeInWorker(bytes: Uint8Array, ext: 'flac' | 'mp3'): Promise<DecodeResponse> {
  const w = ensureWorker();
  const jobId = nextJobId++;
  return new Promise<DecodeResponse>((resolve, reject) => {
    pending.set(jobId, { resolve, reject });
    const request: DecodeRequest = { jobId, bytes, ext };
    w.postMessage(request, [bytes.buffer]);
  });
}

export async function decodeFile(handle: string): Promise<DecodedAudio> {
  const ext = extension(handle);
  if (ext !== 'flac' && ext !== 'mp3') {
    throw new Error(`unsupported_format:${ext}`);
  }

  const blob = getFile(handle);
  if (!blob) throw new Error(`unknown_handle:${handle}`);

  const tTotal0 = performance.now();
  const tRead0 = performance.now();
  const u8 = new Uint8Array(await blob.arrayBuffer());
  const tReadMs = performance.now() - tRead0;
  const fileBytes = u8.byteLength;

  const tMeta0 = performance.now();
  const flacMeta = ext === 'flac' ? parseFlacMetadata(u8) ?? undefined : undefined;
  const tMetaMs = performance.now() - tMeta0;

  const tDecode0 = performance.now();
  const result = await decodeInWorker(u8, ext);
  const tDecodeMs = performance.now() - tDecode0;
  perfStore.setDecode(tDecodeMs);
  const duration = result.samplesDecoded / result.sampleRate;
  const bitrate = duration > 0 ? (fileBytes * 8) / duration / 1000 : undefined;

  let channels = result.channels;
  let pcm = result.pcm;
  let pcmLeft = result.pcmLeft;
  let pcmRight = result.pcmRight;
  if (ext === 'mp3' && channels === 2 && pcmLeft && pcmRight) {
    if (isBitExact(pcmLeft, pcmRight)) {
      channels = 1;
      pcm = pcmLeft;
      pcmLeft = undefined;
      pcmRight = undefined;
    }
  }

  const effectivelyMono =
    channels === 2 && pcmLeft && pcmRight ? isEffectivelyMono(pcmLeft, pcmRight) : false;

  const tTotalMs = performance.now() - tTotal0;
  const wt = result.timings;
  const workerInternalMs = wt.postBackAt - wt.msgRecvAt;

  debugLog('decode', 'decoded', {
    build: buildKind(),
    file: { name: handle, sizeBytes: fileBytes, ext },
    audio: {
      sampleRate: result.sampleRate,
      durationS: duration,
      channels,
      bitDepth: result.bitDepth
    },
    main: {
      readMs: round(tReadMs),
      parseMetaMs: round(tMetaMs),
      workerRoundTripMs: round(tDecodeMs),
      totalMs: round(tTotalMs)
    },
    worker: {
      wasCold: wt.wasCold,
      decoderInitOrResetMs: round(wt.decoderInitOrResetMs),
      decodeMs: round(wt.decodeMs),
      mixdownMs: round(wt.mixdownMs),
      internalTotalMs: round(workerInternalMs)
    }
  });

  return {
    pcm,
    pcmLeft,
    pcmRight,
    sampleRate: result.sampleRate,
    channels,
    duration,
    bitDepth: result.bitDepth,
    bitrate,
    path: handle,
    format: ext,
    flacMeta,
    effectivelyMono
  };
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function isBitExact(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
