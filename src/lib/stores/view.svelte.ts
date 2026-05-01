const MIN_RANGE_SECONDS = 0.05;

function createViewStore() {
  let duration = $state(0);
  let timeStart = $state(0);
  let timeEnd = $state(0);

  function clamp(start: number, end: number) {
    const range = end - start;
    if (range < MIN_RANGE_SECONDS) {
      const c = (start + end) / 2;
      start = c - MIN_RANGE_SECONDS / 2;
      end = c + MIN_RANGE_SECONDS / 2;
    }
    if (start < 0) {
      end -= start;
      start = 0;
    }
    if (end > duration) {
      start -= end - duration;
      end = duration;
    }
    return { start: Math.max(0, start), end: Math.min(duration, end) };
  }

  return {
    get duration() {
      return duration;
    },
    get timeStart() {
      return timeStart;
    },
    get timeEnd() {
      return timeEnd;
    },
    reset(total: number) {
      duration = total;
      timeStart = 0;
      timeEnd = total;
    },
    setRange(start: number, end: number) {
      const clamped = clamp(start, end);
      timeStart = clamped.start;
      timeEnd = clamped.end;
    },
    zoomAt(cursorRatio: number, factor: number) {
      const range = timeEnd - timeStart;
      const cursorTime = timeStart + cursorRatio * range;
      const newRange = Math.min(duration, range * factor);
      const clamped = clamp(
        cursorTime - cursorRatio * newRange,
        cursorTime + (1 - cursorRatio) * newRange
      );
      timeStart = clamped.start;
      timeEnd = clamped.end;
    }
  };
}

export const viewStore = createViewStore();
