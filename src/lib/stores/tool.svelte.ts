export type ToolMode = 'pan' | 'zoom' | 'select';

function createToolStore() {
  let mode = $state<ToolMode>('pan');
  let override = $state<ToolMode | null>(null);

  return {
    get mode() {
      return mode;
    },
    get override() {
      return override;
    },
    get effective() {
      return override ?? mode;
    },
    set(next: ToolMode) {
      mode = next;
    },
    setOverride(next: ToolMode | null) {
      override = next;
    }
  };
}

export const toolStore = createToolStore();
