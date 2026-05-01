const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function formatTimecode(s: number): string {
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs - m * 60;
  const secStr = sec.toFixed(3).padStart(6, '0');
  return `${sign}${m}:${secStr}`;
}

export function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

export function formatDuration(s: number, compact = false): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  if (m === 0) return compact ? `${sec.toFixed(2)}s` : `${sec.toFixed(2)} s`;
  const ss = Math.floor(sec).toString().padStart(2, '0');
  if (compact) return `${m}:${ss}`;
  const cs = Math.floor((sec % 1) * 100).toString().padStart(2, '0');
  return `${m}:${ss}.${cs}`;
}

export function freqToNote(hz: number): { name: string; cents: number } | null {
  if (hz <= 0 || !Number.isFinite(hz)) return null;
  const exact = 12 * Math.log2(hz / 440) + 69;
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  return { name: `${name}${octave}`, cents };
}
