export interface Selection {
  timeStart: number;
  timeEnd: number;
  freqStart: number;
  freqEnd: number;
}

function createSelectionStore() {
  let current = $state<Selection | null>(null);

  function normalize(s: Selection): Selection {
    return {
      timeStart: Math.min(s.timeStart, s.timeEnd),
      timeEnd: Math.max(s.timeStart, s.timeEnd),
      freqStart: Math.min(s.freqStart, s.freqEnd),
      freqEnd: Math.max(s.freqStart, s.freqEnd)
    };
  }

  return {
    get current() {
      return current;
    },
    set(selection: Selection) {
      current = normalize(selection);
    },
    clear() {
      current = null;
    }
  };
}

export const selectionStore = createSelectionStore();
