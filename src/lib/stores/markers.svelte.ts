export type MarkerStyle = 'solid' | 'dashed' | 'dotted';

export interface FreqMarker {
  id: string;
  label: string;
  freq: number;
  style: MarkerStyle;
  color: string;
  thickness: number;
  opacity: number;
  visible: boolean;
  labelVisible: boolean;
  preset: boolean;
}

export const MARKERS_CUSTOM_LIMIT = 10;

const PRESETS: readonly FreqMarker[] = [
  { id: 'preset:96',  label: '96 kbps',  freq: 11000, style: 'dashed', color: '#ff4d6d', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true },
  { id: 'preset:128', label: '128 kbps', freq: 16000, style: 'dashed', color: '#ff8a3d', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true },
  { id: 'preset:160', label: '160 kbps', freq: 17000, style: 'dashed', color: '#ffd23f', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true },
  { id: 'preset:192', label: '192 kbps', freq: 18500, style: 'dashed', color: '#7be58a', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true },
  { id: 'preset:256', label: '256 kbps', freq: 19500, style: 'dashed', color: '#4dd4e8', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true },
  { id: 'preset:320', label: '320 kbps', freq: 20500, style: 'dashed', color: '#b892ff', thickness: 2, opacity: 1, visible: false, labelVisible: true, preset: true }
];

function defaultMarkers(): FreqMarker[] {
  return PRESETS.map((p) => ({ ...p }));
}

function randomId(): string {
  // crypto.randomUUID is available in modern webviews (Chromium 92+, WebView2,
  // WebKit 15+) — use it for collision-free IDs even if the user creates
  // markers in rapid succession.
  return 'custom:' + crypto.randomUUID();
}

function createMarkersStore() {
  let markers = $state<FreqMarker[]>(defaultMarkers());

  return {
    get markers() {
      return markers;
    },
    get visible() {
      return markers.filter((m) => m.visible);
    },
    get customCount() {
      return markers.filter((m) => !m.preset).length;
    },
    canAdd(): boolean {
      return this.customCount < MARKERS_CUSTOM_LIMIT;
    },
    add(partial: Partial<FreqMarker> = {}): FreqMarker | null {
      if (!this.canAdd()) return null;
      const m: FreqMarker = {
        id: randomId(),
        label: partial.label ?? 'Marker',
        freq: partial.freq ?? 1000,
        style: partial.style ?? 'solid',
        color: partial.color ?? '#6b8bff',
        thickness: partial.thickness ?? 1,
        opacity: partial.opacity ?? 0.8,
        visible: partial.visible ?? true,
        labelVisible: partial.labelVisible ?? true,
        preset: false
      };
      markers = [...markers, m];
      return m;
    },
    remove(id: string) {
      const m = markers.find((x) => x.id === id);
      if (!m || m.preset) return;
      markers = markers.filter((x) => x.id !== id);
    },
    update(id: string, patch: Partial<FreqMarker>) {
      markers = markers.map((x) =>
        x.id === id ? { ...x, ...patch, id: x.id, preset: x.preset } : x
      );
    },
    toggle(id: string) {
      this.update(id, { visible: !markers.find((x) => x.id === id)?.visible });
    },
    setAll(list: FreqMarker[]) {
      const presetIds = new Set(PRESETS.map((p) => p.id));
      const presets = list.filter((m) => m.preset && presetIds.has(m.id));
      const customs = list
        .filter((m) => !m.preset)
        .slice(0, MARKERS_CUSTOM_LIMIT);
      const byId = new Map(presets.map((m) => [m.id, m]));
      const orderedPresets = PRESETS.map((p) => {
        const found = byId.get(p.id);
        return found ? { ...p, ...found, id: p.id, preset: true } : { ...p };
      });
      markers = [...orderedPresets, ...customs];
    },
    reset() {
      markers = defaultMarkers();
    }
  };
}

export const markersStore = createMarkersStore();
