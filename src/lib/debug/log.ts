import { dev } from '$app/environment';

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, category: string, message: string, data?: Record<string, unknown>): void {
  if (level === 'error') console.error(`[${category}]`, message, data ?? '');
  else if (dev && level === 'warn') console.warn(`[${category}]`, message, data ?? '');
  else if (dev) console.info(`[${category}]`, message, data ?? '');
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

export async function getDebugLogPath(): Promise<string> {
  return '';
}

export async function getDebugLogDir(): Promise<string> {
  return '';
}
