const DATA_FLOOR = -140;
const DATA_CEILING = 0;
const DEFAULT_FLOOR = -120;
const DEFAULT_CEILING = 0;
const MIN_SPAN = 6;

function createRenderStore() {
  let dbFloor = $state(DEFAULT_FLOOR);
  let dbCeiling = $state(DEFAULT_CEILING);

  return {
    get dbFloor() {
      return dbFloor;
    },
    get dbCeiling() {
      return dbCeiling;
    },
    get dataFloor() {
      return DATA_FLOOR;
    },
    get dataCeiling() {
      return DATA_CEILING;
    },
    setFloor(v: number) {
      const clamped = Math.max(DATA_FLOOR, Math.min(DATA_CEILING - MIN_SPAN, v));
      dbFloor = clamped;
      if (dbCeiling - dbFloor < MIN_SPAN) dbCeiling = dbFloor + MIN_SPAN;
    },
    setCeiling(v: number) {
      const clamped = Math.max(DATA_FLOOR + MIN_SPAN, Math.min(DATA_CEILING, v));
      dbCeiling = clamped;
      if (dbCeiling - dbFloor < MIN_SPAN) dbFloor = dbCeiling - MIN_SPAN;
    },
    reset() {
      dbFloor = DEFAULT_FLOOR;
      dbCeiling = DEFAULT_CEILING;
    }
  };
}

export const renderStore = createRenderStore();
