/// <reference lib="webworker" />

import type { FLACDecoder } from '@wasm-audio-decoders/flac';
import type { MPEGDecoder } from 'mpg123-decoder';

export interface DecodeRequest {
  jobId: number;
  bytes: Uint8Array;
  ext: 'flac' | 'mp3';
}

export interface DecodeTimings {
  msgRecvAt: number;
  decodeStartAt: number;
  decodeEndAt: number;
  postBackAt: number;
  decoderInitOrResetMs: number;
  decodeMs: number;
  mixdownMs: number;
  wasCold: boolean;
}

export interface DecodeResponse {
  ok: true;
  jobId: number;
  pcm: Float32Array;
  pcmLeft?: Float32Array;
  pcmRight?: Float32Array;
  sampleRate: number;
  channels: number;
  samplesDecoded: number;
  bitDepth?: number;
  timings: DecodeTimings;
}

export interface DecodeError {
  ok: false;
  jobId: number;
  message: string;
}

function mixdownToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const length = channels[0].length;
  const out = new Float32Array(length);
  const n = channels.length;
  for (let c = 0; c < n; c++) {
    const ch = channels[c];
    for (let i = 0; i < length; i++) out[i] += ch[i];
  }
  for (let i = 0; i < length; i++) out[i] /= n;
  return out;
}

// Cache decoder instances. Reusing them via reset() avoids the cost of
// re-fetching the bundled decoder chunks through Tauri's asset:// and
// re-instantiating a fresh WASM heap on every file open.
let flacDecoder: FLACDecoder | null = null;
let mpegDecoder: MPEGDecoder | null = null;

async function decodeFlac(bytes: Uint8Array, perf: { wasCold: boolean; initMs: number; decodeMs: number }) {
  const t0 = performance.now();
  if (flacDecoder) {
    await flacDecoder.reset();
  } else {
    perf.wasCold = true;
    const { FLACDecoder } = await import('@wasm-audio-decoders/flac');
    flacDecoder = new FLACDecoder();
    await flacDecoder.ready;
  }
  const t1 = performance.now();
  perf.initMs = t1 - t0;
  const result = await flacDecoder.decodeFile(bytes);
  perf.decodeMs = performance.now() - t1;
  return result;
}

async function decodeMp3(bytes: Uint8Array, perf: { wasCold: boolean; initMs: number; decodeMs: number }) {
  const t0 = performance.now();
  if (mpegDecoder) {
    await mpegDecoder.reset();
  } else {
    perf.wasCold = true;
    const { MPEGDecoder } = await import('mpg123-decoder');
    mpegDecoder = new MPEGDecoder({ enableGapless: true });
    await mpegDecoder.ready;
  }
  const t1 = performance.now();
  perf.initMs = t1 - t0;
  const result = mpegDecoder.decode(bytes);
  perf.decodeMs = performance.now() - t1;
  return result;
}

// Serialize jobs so the cached decoder isn't reset/used while another
// decode is still in flight. The worker is single-threaded but its
// onmessage handler is async, so without this chain a second postMessage
// would interleave with the first.
let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (event: MessageEvent<DecodeRequest>) => {
  const msgRecvAt = performance.now();
  const { jobId, bytes, ext } = event.data;
  queue = queue.then(async () => {
    try {
      const decodeStartAt = performance.now();
      const perf = { wasCold: false, initMs: 0, decodeMs: 0 };
      const result =
        ext === 'flac' ? await decodeFlac(bytes, perf) : await decodeMp3(bytes, perf);
      const decodeEndAt = performance.now();
      const channelData = result.channelData as Float32Array[];
      const tMix0 = performance.now();
      const pcm = mixdownToMono(channelData);
      const mixdownMs = performance.now() - tMix0;
      const stereo = channelData.length >= 2;
      const pcmLeft = stereo ? channelData[0] : undefined;
      const pcmRight = stereo ? channelData[1] : undefined;
      const transfer: ArrayBuffer[] = [pcm.buffer as ArrayBuffer];
      if (pcmLeft) transfer.push(pcmLeft.buffer as ArrayBuffer);
      if (pcmRight) transfer.push(pcmRight.buffer as ArrayBuffer);
      const postBackAt = performance.now();
      const response: DecodeResponse = {
        ok: true,
        jobId,
        pcm,
        pcmLeft,
        pcmRight,
        sampleRate: result.sampleRate,
        channels: channelData.length,
        samplesDecoded: result.samplesDecoded,
        bitDepth: (result as { bitDepth?: number }).bitDepth,
        timings: {
          msgRecvAt,
          decodeStartAt,
          decodeEndAt,
          postBackAt,
          decoderInitOrResetMs: perf.initMs,
          decodeMs: perf.decodeMs,
          mixdownMs,
          wasCold: perf.wasCold
        }
      };
      (self as unknown as Worker).postMessage(response, transfer);
    } catch (err) {
      const response: DecodeError = {
        ok: false,
        jobId,
        message: err instanceof Error ? err.message : String(err)
      };
      (self as unknown as Worker).postMessage(response);
    }
  });
};
