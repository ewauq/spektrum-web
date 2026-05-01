import type { Snippet } from 'svelte';

/**
 * Active help panel state. The help is rendered in-place inside the
 * grid by AnalysesView (it replaces the cell horizontally adjacent to
 * the source panel) so the user can read the explanation while still
 * looking at the graph.
 */

interface HelpEntry {
  panelId: string;
  content: Snippet;
}

function createHelpStore() {
  let active = $state<HelpEntry | null>(null);

  function open(panelId: string, content: Snippet): void {
    active = { panelId, content };
  }

  function close(): void {
    active = null;
  }

  function toggle(panelId: string, content: Snippet): void {
    if (active?.panelId === panelId) close();
    else open(panelId, content);
  }

  return {
    get active() {
      return active;
    },
    open,
    close,
    toggle
  };
}

export const helpStore = createHelpStore();
