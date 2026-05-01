import { dev } from '$app/environment';

/**
 * Log a warning only in dev. Useful for catch blocks where we want to
 * silently swallow the error in production but still see it during
 * development to spot regressions.
 */
export function devWarn(context: string, err: unknown): void {
  if (!dev) return;
  // eslint-disable-next-line no-console
  console.warn(`[spektrum] ${context}`, err);
}
