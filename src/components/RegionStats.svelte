<script lang="ts">
  import { secondsToFrame, type StftResult } from "$lib/dsp/stft";
  import { t } from "$lib/i18n/index.svelte";
  import { formatTimecode, formatHz, formatDuration, freqToNote } from "$lib/format";
  import { viewStore } from "$lib/stores/view.svelte";
  import Section from "./ui/Section.svelte";
  import InfoTable, { type InfoRow } from "./ui/InfoTable.svelte";

  // Half window in seconds when zooming to a peak via the clickable
  // timecode shortcut: peak ± PEAK_ZOOM_HALF gives a 2 * value second view.
  const PEAK_ZOOM_HALF = 1;

  function zoomToPeak(time: number) {
    viewStore.setRange(time - PEAK_ZOOM_HALF, time + PEAK_ZOOM_HALF);
  }

  let {
    title,
    persistKey,
    draggableId,
    onReorder,
    onMoveUp,
    onMoveDown,
    canMoveUp = false,
    canMoveDown = false,
    stft,
    timeStart,
    timeEnd,
    freqStart,
    freqEnd,
    dbFloor,
  }: {
    title: string;
    persistKey?: string;
    draggableId?: string;
    onReorder?: (from: string, to: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    stft: StftResult | null;
    timeStart: number;
    timeEnd: number;
    freqStart: number;
    freqEnd: number;
    dbFloor: number;
  } = $props();

  type Range = {
    timeStart: number;
    timeEnd: number;
    freqStart: number;
    freqEnd: number;
    dbFloor: number;
  };
  let displayed = $state<Range | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let initialized = false;

  $effect(() => {
    const next: Range = { timeStart, timeEnd, freqStart, freqEnd, dbFloor };
    if (!initialized) {
      initialized = true;
      displayed = next;
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      displayed = next;
    }, 50);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  type Info = {
    timeStart: number;
    timeEnd: number;
    duration: number;
    freqStart: number;
    freqEnd: number;
    bandwidth: number;
    meanDb: number | null;
    maxDb: number | null;
    maxTime: number;
    maxFreq: number;
    maxActiveFreq: number | null;
    maxNote: { name: string; cents: number } | null;
    nyquistUsage: number | null;
    frames: number;
    bins: number;
  };

  // Same minPresence threshold as the global computeNyquistUsage in
  // Spectrogram.svelte: a bin counts as "active" when present in at
  // least 5 % of sampled frames of the zone.
  const NYQUIST_PRESENCE_DB_OFFSET = 20;
  const NYQUIST_MIN_PRESENCE = 0.05;

  function computeInfo(s: StftResult, r: Range): Info {
    const t1 = Math.min(r.timeStart, r.timeEnd);
    const t2 = Math.max(r.timeStart, r.timeEnd);
    const f1 = Math.min(r.freqStart, r.freqEnd);
    const f2 = Math.max(r.freqStart, r.freqEnd);
    const floor = r.dbFloor;
    const { magnitudes, freqBins, timeFrames, sampleRate, hopSize, fftSize } =
      s;
    const nyq = sampleRate / 2;
    const fStart = Math.max(0, secondsToFrame(s, t1));
    const fEnd = Math.min(
      timeFrames,
      Math.max(fStart + 1, secondsToFrame(s, t2)),
    );
    const kStart = Math.max(0, Math.round((f1 / nyq) * (freqBins - 1)));
    const kEnd = Math.min(
      freqBins - 1,
      Math.max(kStart, Math.round((f2 / nyq) * (freqBins - 1))),
    );

    let sum = 0;
    let count = 0;
    let maxDb = -Infinity;
    let maxFrame = fStart;
    let maxBin = kStart;
    let maxActiveBin = -1;
    for (let f = fStart; f < fEnd; f++) {
      for (let k = kStart; k <= kEnd; k++) {
        const v = magnitudes[f * freqBins + k];
        if (v < floor) continue;
        sum += v;
        count++;
        if (v > maxDb) {
          maxDb = v;
          maxFrame = f;
          maxBin = k;
        }
        if (k > maxActiveBin) maxActiveBin = k;
      }
    }
    const meanDb = count > 0 ? sum / count : null;
    const maxTime = (maxFrame * hopSize + fftSize / 2) / sampleRate;
    const maxFreq = (maxBin / Math.max(1, freqBins - 1)) * nyq;
    const maxActiveFreq =
      maxActiveBin >= 0
        ? (maxActiveBin / Math.max(1, freqBins - 1)) * nyq
        : null;

    // Nyquist usage: highest bin whose presence over the zone exceeds
    // NYQUIST_MIN_PRESENCE, expressed as % of (freqBins - 1).
    const presenceThreshold = floor + NYQUIST_PRESENCE_DB_OFFSET;
    const sampleStep = Math.max(1, Math.floor((fEnd - fStart) / 200));
    let totalSampled = 0;
    for (let f = fStart; f < fEnd; f += sampleStep) totalSampled++;
    let highestPresentBin = -1;
    if (totalSampled > 0) {
      for (let k = kStart; k <= kEnd; k++) {
        let present = 0;
        for (let f = fStart; f < fEnd; f += sampleStep) {
          if (magnitudes[f * freqBins + k] > presenceThreshold) present++;
        }
        if (present / totalSampled >= NYQUIST_MIN_PRESENCE) {
          highestPresentBin = k;
        }
      }
    }
    const nyquistUsage =
      highestPresentBin >= 0
        ? (highestPresentBin / Math.max(1, freqBins - 1)) * 100
        : null;

    return {
      timeStart: t1,
      timeEnd: t2,
      duration: t2 - t1,
      freqStart: f1,
      freqEnd: f2,
      bandwidth: f2 - f1,
      meanDb,
      maxDb: count > 0 ? maxDb : null,
      maxTime,
      maxFreq,
      maxActiveFreq,
      maxNote: freqToNote(maxFreq),
      nyquistUsage,
      frames: Math.max(0, fEnd - fStart),
      bins: Math.max(0, kEnd - kStart + 1),
    };
  }

  let info = $state<Info | null>(null);

  $effect(() => {
    const s = stft;
    const d = displayed;
    if (!s || !d) {
      info = null;
      return;
    }
    const snapshot = { ...d };
    let cancelled = false;
    const win = window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => {
      if (cancelled) return;
      info = computeInfo(s, snapshot);
    };
    let handle: number;
    if (win.requestIdleCallback) {
      handle = win.requestIdleCallback(run, { timeout: 200 });
    } else {
      handle = setTimeout(run, 0) as unknown as number;
    }
    return () => {
      cancelled = true;
      if (win.cancelIdleCallback && win.requestIdleCallback) {
        win.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  });

  const rows = $derived.by((): InfoRow[] => {
    const d = displayed;
    if (!d) return [];
    const out: InfoRow[] = [];

    out.push({ kind: "subheader", label: t("info.group_time") });
    out.push({
      kind: "row",
      key: t("info.sel_time_start"),
      cell: { kind: "text", value: formatTimecode(d.timeStart), mono: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_time_end"),
      cell: { kind: "text", value: formatTimecode(d.timeEnd), mono: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_duration"),
      cell: {
        kind: "text",
        value: formatDuration(d.timeEnd - d.timeStart),
        mono: true,
      },
    });

    out.push({ kind: "subheader", label: t("info.group_freq") });
    out.push({
      kind: "row",
      key: t("info.sel_freq_start"),
      cell: { kind: "text", value: formatHz(d.freqStart), mono: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_freq_end"),
      cell: { kind: "text", value: formatHz(d.freqEnd), mono: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_bandwidth"),
      cell: {
        kind: "text",
        value: formatHz(d.freqEnd - d.freqStart),
        mono: true,
      },
    });
    out.push({
      kind: "row",
      key: t("info.nyquist_usage"),
      cell:
        info && info.nyquistUsage != null
          ? {
              kind: "gauge",
              value: info.nyquistUsage,
              max: 100,
              suffix: " %",
              hue: info.nyquistUsage * 1.2,
            }
          : { kind: "text", value: "-", mono: true, dim: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_max_active_freq"),
      cell:
        info && info.maxActiveFreq != null
          ? { kind: "text", value: formatHz(info.maxActiveFreq), mono: true }
          : { kind: "text", value: "-", mono: true, dim: true },
    });
    out.push({
      kind: "hint",
      text: t("info.sel_threshold_hint", { floor: dbFloor }),
    });

    out.push({ kind: "subheader", label: t("info.group_energy") });
    out.push({
      kind: "row",
      key: t("info.sel_energy_mean"),
      cell:
        info && info.meanDb != null
          ? {
              kind: "text",
              value: `${info.meanDb.toFixed(1)} ${t("unit.db")}`,
              mono: true,
            }
          : { kind: "text", value: "-", mono: true, dim: true },
    });
    out.push({
      kind: "row",
      key: t("info.sel_energy_max"),
      cell:
        info && info.maxDb != null
          ? {
              kind: "text",
              value: `${info.maxDb.toFixed(1)} ${t("unit.db")}`,
              mono: true,
            }
          : { kind: "text", value: "-", mono: true, dim: true },
    });
    if (info && info.maxDb != null) {
      const peakTime = info.maxTime;
      out.push({
        kind: "row",
        key: t("info.sel_peak_at"),
        cell: {
          kind: "peak",
          time: formatTimecode(info.maxTime),
          freq: formatHz(info.maxFreq),
          note: info.maxNote?.name ?? null,
          onTimeClick: () => zoomToPeak(peakTime),
          timeTitle: t("info.sel_peak_zoom_hint"),
        },
      });
    } else {
      out.push({
        kind: "row",
        key: t("info.sel_peak_at"),
        cell: { kind: "text", value: "-", mono: true, dim: true },
      });
    }
    out.push({
      kind: "row",
      key: t("info.sel_coverage"),
      cell: info
        ? { kind: "text", value: `${info.frames} × ${info.bins}`, mono: true }
        : { kind: "text", value: "-", mono: true, dim: true },
    });

    return out;
  });
</script>

{#if displayed}
  <Section
    {title}
    {persistKey}
    {draggableId}
    {onReorder}
    {onMoveUp}
    {onMoveDown}
    {canMoveUp}
    {canMoveDown}
  >
    <InfoTable {rows} />
  </Section>
{/if}
