import { dev } from '$app/environment';
import { uiStore } from '$lib/stores/ui.svelte';
import {
  appendLogRecord,
  readAllLogRecords,
  clearLogRecords,
  type LogRecord
} from '$lib/platform/log-writer';
import { saveBlob } from '$lib/platform/downloader';

type Level = LogRecord['level'];

function emit(level: Level, category: string, message: string, data?: Record<string, unknown>): void {
  if (level === 'error') console.error(`[${category}]`, message, data ?? '');
  else if (dev && level === 'warn') console.warn(`[${category}]`, message, data ?? '');
  else if (dev) console.info(`[${category}]`, message, data ?? '');

  if (!uiStore.debugMode) return;

  const record: LogRecord = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
    ...(data ? { data } : {})
  };
  appendLogRecord(record);
}

export function debugLog(category: string, message: string, data?: Record<string, unknown>): void {
  emit('info', category, message, data);
}

export function debugWarn(category: string, message: string, data?: Record<string, unknown>): void {
  emit('warn', category, message, data);
}

export function debugError(category: string, message: string, data?: Record<string, unknown>): void {
  emit('error', category, message, data);
}

export function buildKind(): 'dev' | 'release' {
  return dev ? 'dev' : 'release';
}

export async function downloadDebugLog(): Promise<number> {
  const records = await readAllLogRecords();
  const jsonl = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  saveBlob(blob, `spektrum-debug-${stamp}.jsonl`);
  return records.length;
}

export async function clearDebugLog(): Promise<void> {
  await clearLogRecords();
}
