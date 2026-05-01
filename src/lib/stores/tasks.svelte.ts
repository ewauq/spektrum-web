/**
 * Background task tracker driving the status bar.
 *
 * Quiet-start contract: a task is registered immediately by the
 * orchestrator that owns the work, but does not become visible until
 * VISIBLE_THRESHOLD_MS have elapsed. Anything finishing faster than
 * the threshold never reaches the UI — no flicker on cached or short
 * computations.
 *
 * FIFO headline: when several tasks are visible at once the status
 * bar keeps showing the oldest one until it ends, instead of jumping
 * to whatever was most recently started. Stable label, no papillotage.
 *
 * Linger: a task that did become visible stays in `active` for
 * LINGER_MS after end() so the progress bar can animate to 100 %
 * smoothly. A task that never crossed the threshold is removed
 * immediately on end().
 */

export type TaskKind =
  | 'decode'
  | 'stft'
  | 'stft_stereo'
  | 'spec_pyramid'
  | 'wave_pyramid'
  | 'rms'
  | 'avg_spectrum'
  | 'onsets'
  | 'kicks'
  | 'centroid'
  | 'entropy'
  | 'bark'
  | 'chromagram'
  | 'self_similarity'
  | 'novelty'
  | 'tempogram'
  | 'hpss'
  | 'lufs'
  | 'vectorscope'
  | 'goniometer'
  | 'stereo_width'
  | 'soundfield'
  | 'export_png'
  | 'export_data'
  | 'recompute';

interface InternalTask {
  id: number;
  kind: TaskKind;
  label: string;
  startedAt: number;
  visibleAt: number;
  progress: number;
  done: boolean;
  visible: boolean;
}

export interface Task {
  id: number;
  kind: TaskKind;
  label: string;
  startedAt: number;
  visibleAt: number;
  progress: number;
  done: boolean;
}

const VISIBLE_THRESHOLD_MS = 200;
const LINGER_MS = 350;

/**
 * Threshold above which `stftProgress` is treated as "the streaming STFT
 * is done and the magnitudes buffer is fully populated." Slightly under
 * 1.0 so a stalled progress at 0.9995 (rounding on the worker side)
 * still unblocks downstream panels. Imported by every consumer that
 * gates a compute on the STFT being complete.
 */
export const STFT_STREAMING_COMPLETE = 0.999;
// Kinds that should disable interactive controls (toolbar, sidebar).
// Secondary DSP work (LUFS, vectorscope...) does not block the UI.
const BLOCKING_KINDS: ReadonlySet<TaskKind> = new Set([
  'decode',
  'stft',
  'recompute'
]);

function createStore() {
  let nextId = 1;
  let tasks = $state<InternalTask[]>([]);
  // Toggleable from the View menu. When false, every public mutation
  // is a no-op so progress tracking stops costing anything (and the
  // status bar, hidden in that mode, has nothing to render).
  let enabled = $state(true);
  // Timers are tracked outside the reactive array so toggling them
  // doesn't trip change detection. Maps id → timer handle.
  const promoteTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const retireTimers = new Map<number, ReturnType<typeof setTimeout>>();

  function findIndex(id: number): number {
    return tasks.findIndex((t) => t.id === id);
  }

  function start(
    kind: TaskKind,
    label: string,
    opts: { progress?: number; threshold?: number } = {}
  ): number {
    if (!enabled) return -1;
    const id = nextId++;
    const startedAt = performance.now();
    const threshold = opts.threshold ?? VISIBLE_THRESHOLD_MS;
    const visibleAt = startedAt + threshold;
    const progress =
      typeof opts.progress === 'number' ? clamp01(opts.progress) : NaN;

    const task: InternalTask = {
      id,
      kind,
      label,
      startedAt,
      visibleAt,
      progress,
      done: false,
      visible: false
    };

    tasks = [...tasks, task];

    promoteTimers.set(
      id,
      setTimeout(() => {
        promoteTimers.delete(id);
        const idx = findIndex(id);
        if (idx === -1) return;
        const t = tasks[idx];
        if (t.done) return;
        // Replace the slot to trigger reactivity through the proxy.
        tasks[idx] = { ...t, visible: true };
      }, threshold)
    );

    return id;
  }

  function update(id: number, progress: number): void {
    if (id < 0 || !Number.isFinite(progress)) return;
    const idx = findIndex(id);
    if (idx === -1) return;
    const t = tasks[idx];
    if (t.done) return;
    tasks[idx] = { ...t, progress: clamp01(progress) };
  }

  function end(id: number): void {
    if (id < 0) return;
    const promote = promoteTimers.get(id);
    if (promote) {
      clearTimeout(promote);
      promoteTimers.delete(id);
    }
    const idx = findIndex(id);
    if (idx === -1) return;
    const t = tasks[idx];
    if (!t.visible) {
      // Never crossed the threshold: drop on the floor.
      tasks = tasks.filter((x) => x.id !== id);
      return;
    }
    // Visible: linger so the progress bar can animate out, then drop.
    tasks[idx] = { ...t, done: true };
    retireTimers.set(
      id,
      setTimeout(() => {
        retireTimers.delete(id);
        tasks = tasks.filter((x) => x.id !== id);
      }, LINGER_MS)
    );
  }

  function clearAll(): void {
    for (const handle of promoteTimers.values()) clearTimeout(handle);
    for (const handle of retireTimers.values()) clearTimeout(handle);
    promoteTimers.clear();
    retireTimers.clear();
    tasks = [];
  }

  function setEnabled(v: boolean): void {
    if (enabled === v) return;
    enabled = v;
    // Disabling drains anything still pending: pre-existing tasks
    // would otherwise keep `hasBlocking` true forever from the
    // perspective of `loading`, with no UI to close them.
    if (!v) clearAll();
  }

  return {
    /** All currently visible (and not yet retired) tasks, oldest first. */
    get active(): Task[] {
      return tasks
        .filter((t) => t.visible && !t.done)
        .map((t) => ({
          id: t.id,
          kind: t.kind,
          label: t.label,
          startedAt: t.startedAt,
          visibleAt: t.visibleAt,
          progress: t.progress,
          done: t.done
        }));
    },
    /** Oldest visible task, or null if nothing is currently visible. */
    get headline(): Task | null {
      const t = tasks.find((x) => x.visible && !x.done);
      if (!t) return null;
      return {
        id: t.id,
        kind: t.kind,
        label: t.label,
        startedAt: t.startedAt,
        visibleAt: t.visibleAt,
        progress: t.progress,
        done: t.done
      };
    },
    /** Number of visible tasks currently shown. */
    get count(): number {
      let n = 0;
      for (const t of tasks) if (t.visible && !t.done) n++;
      return n;
    },
    /** Any blocking task (decode, stft, recompute) regardless of visibility. */
    get hasBlocking(): boolean {
      return tasks.some((t) => !t.done && BLOCKING_KINDS.has(t.kind));
    },
    /**
     * Progress of the main streaming STFT, 0..1, or 1 when none is
     * running (so panels gating on STFT_STREAMING_COMPLETE fall through
     * naturally).
     */
    get stftProgress(): number {
      const t = tasks.find((x) => x.kind === 'stft' && !x.done);
      if (!t) return 1;
      return Number.isNaN(t.progress) ? 0 : t.progress;
    },
    get enabled() {
      return enabled;
    },
    setEnabled,
    start,
    update,
    end,
    clearAll
  };
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export const taskStore = createStore();
