function createDragState() {
  let draggingId = $state<string | null>(null);
  let hoveredId = $state<string | null>(null);

  return {
    get draggingId() {
      return draggingId;
    },
    get hoveredId() {
      return hoveredId;
    },
    start(id: string) {
      draggingId = id;
      hoveredId = null;
    },
    setHover(id: string | null) {
      hoveredId = id;
    },
    end(): { source: string | null; target: string | null } {
      const source = draggingId;
      const target = hoveredId;
      draggingId = null;
      hoveredId = null;
      return { source, target };
    }
  };
}

export const dragState = createDragState();
