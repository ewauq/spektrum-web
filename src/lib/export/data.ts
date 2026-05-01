/**
 * Type-only stub for shared settings: the web app does not export
 * spectrogram data (CSV/NPY) yet, but settings.svelte.ts references
 * DataFormat to type a stored preference. Will be replaced by the
 * real web implementation in Phase 4.3 when we wire export PNG / data.
 */
export type DataFormat = 'csv' | 'npy';
