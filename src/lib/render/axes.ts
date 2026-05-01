export function niceTicks(min: number, max: number, maxCount: number): number[] {
  if (max <= min || maxCount <= 0) return [];
  const range = max - min;
  const roughStep = range / maxCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let step: number;
  if (normalized < 1.5) step = 1;
  else if (normalized < 3) step = 2;
  else if (normalized < 7) step = 5;
  else step = 10;
  step *= magnitude;

  const ticks: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let t = first; t <= max + step * 1e-6; t += step) {
    ticks.push(Math.round(t / step) * step);
  }
  return ticks;
}

export function formatTime(seconds: number, step = 1): string {
  const decimals = step >= 1 ? 0 : Math.min(3, -Math.floor(Math.log10(step)));
  if (seconds < 1 && step < 0.1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(decimals)}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const padLen = decimals > 0 ? 3 + decimals : 2;
  return `${m}:${s.toFixed(decimals).padStart(padLen, '0')}`;
}

export function formatFrequency(hz: number): string {
  if (hz >= 1000) return `${Math.round(hz / 1000)}k`;
  return `${Math.round(hz)}`;
}
