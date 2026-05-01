import { saveBlob } from '$lib/platform/downloader';
import type { StftResult } from '$lib/dsp/stft';
import { secondsToFrame, frameToSeconds } from '$lib/dsp/stft';

export type DataFormat = 'csv' | 'npy';

interface DataExportOptions {
  stft: StftResult;
  timeStart: number;
  timeEnd: number;
  format: DataFormat;
  suggestedName: string;
}

function buildCsv(stft: StftResult, frameStart: number, frameEnd: number): Uint8Array {
  const { magnitudes, freqBins, hopSize, sampleRate, fftSize } = stft;
  const lines: string[] = [];

  lines.push(`# Spektrum STFT export`);
  lines.push(`# sampleRate=${sampleRate} fftSize=${fftSize} hopSize=${hopSize} freqBins=${freqBins}`);
  lines.push(`# rows=frequency_bins(0_to_nyquist) cols=time_frames values=dB`);

  const frameTimes: string[] = [];
  for (let f = frameStart; f < frameEnd; f++) {
    frameTimes.push(frameToSeconds(stft, f).toFixed(4));
  }
  lines.push(`time,${frameTimes.join(',')}`);

  const nyquist = sampleRate / 2;
  for (let k = 0; k < freqBins; k++) {
    const hz = (k / (freqBins - 1)) * nyquist;
    const vals: string[] = [];
    for (let f = frameStart; f < frameEnd; f++) {
      vals.push(magnitudes[f * freqBins + k].toFixed(2));
    }
    lines.push(`${hz.toFixed(1)},${vals.join(',')}`);
  }

  return new TextEncoder().encode(lines.join('\n'));
}

function buildNpy(stft: StftResult, frameStart: number, frameEnd: number): Uint8Array {
  const { magnitudes, freqBins } = stft;
  const frames = frameEnd - frameStart;
  const rows = freqBins;
  const cols = frames;

  const headerObj = `{'descr': '<f4', 'fortran_order': False, 'shape': (${rows}, ${cols}), }`;
  const prepadLen = 10 + headerObj.length + 1;
  const padded = Math.ceil(prepadLen / 64) * 64;
  const headerStr = headerObj.padEnd(padded - 10 - 1, ' ') + '\n';

  const headerBytes = new TextEncoder().encode(headerStr);
  const dataSize = rows * cols * 4;
  const total = 10 + headerBytes.length + dataSize;
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  u8[0] = 0x93;
  u8.set(new TextEncoder().encode('NUMPY'), 1);
  u8[6] = 1;
  u8[7] = 0;
  view.setUint16(8, headerBytes.length, true);
  u8.set(headerBytes, 10);

  const floats = new Float32Array(buf, 10 + headerBytes.length, rows * cols);
  for (let k = 0; k < rows; k++) {
    for (let f = 0; f < cols; f++) {
      floats[k * cols + f] = magnitudes[(frameStart + f) * freqBins + k];
    }
  }

  return new Uint8Array(buf);
}

export async function exportData(opts: DataExportOptions): Promise<string | null> {
  const { stft, timeStart, timeEnd, format, suggestedName } = opts;
  const frameStart = Math.max(0, secondsToFrame(stft, timeStart));
  const frameEnd = Math.min(stft.timeFrames, secondsToFrame(stft, timeEnd));

  const ext = format === 'npy' ? 'npy' : 'csv';
  const bytes =
    format === 'npy'
      ? buildNpy(stft, frameStart, frameEnd)
      : buildCsv(stft, frameStart, frameEnd);

  const mime = ext === 'npy' ? 'application/octet-stream' : 'text/csv';
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const filename = `${suggestedName}.${ext}`;
  saveBlob(blob, filename);
  return filename;
}
