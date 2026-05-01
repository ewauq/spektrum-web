<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  let open = $state(false);

  const shortcuts = [
    { keys: ['Drag'], action: 'shortcuts.pan' },
    { keys: ['Scroll'], action: 'shortcuts.zoom' },
    { keys: ['Shift', 'Drag'], action: 'shortcuts.selection' },
    { keys: ['Alt', 'Drag'], action: 'shortcuts.zoom_region' },
    { keys: ['Space'], action: 'shortcuts.reset_zoom' },
    { keys: ['Origin'], action: 'shortcuts.pan_origin' },
    { keys: ['End'], action: 'shortcuts.pan_end' },
    { keys: ['Escape'], action: 'shortcuts.clear_selection' },
    { keys: ['H'], action: 'toolbar.tool_pan' },
    { keys: ['Z'], action: 'toolbar.tool_zoom' },
    { keys: ['S'], action: 'toolbar.tool_select' },
    { keys: ['2'], action: 'titlebar.view_2d' },
    { keys: ['3'], action: 'titlebar.view_3d' },
    { keys: ['W'], action: 'titlebar.view_waveform' },
    { keys: ['A'], action: 'toolbar.tool_analyses' },
    { keys: ['F9'], action: 'shortcuts.toggle_debug' },
    { keys: ['Ctrl', 'O'], action: 'shortcuts.open_file' }
  ];
</script>

<button class="trigger" class:active={open} onclick={() => (open = !open)} aria-label={t('shortcuts.title')} data-tooltip={t('shortcuts.title')}>
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>
  </svg>
</button>

{#if open}
  <div class="panel">
    <div class="header">
      <span class="title">{t('shortcuts.title')}</span>
      <button class="close" onclick={() => (open = false)} aria-label={t('titlebar.close')}>
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5">
          <line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/>
        </svg>
      </button>
    </div>
    {#each shortcuts as s}
      <div class="row">
        <div class="keys">
          {#each s.keys as key}
            <kbd>{key}</kbd>
          {/each}
        </div>
        <span class="action">{t(s.action)}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    cursor: pointer;
    border-radius: var(--r-sm);
  }

  .trigger:hover {
    color: var(--c-text);
    background: var(--c-border);
  }

  .trigger.active {
    color: var(--c-accent);
    background: var(--c-border);
  }

  .panel {
    position: fixed;
    bottom: 48px;
    right: 12px;
    z-index: 31;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    padding: var(--sp-md);
    min-width: 260px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--sp-sm);
  }

  .title {
    font-size: var(--fs-md);
    font-weight: 600;
    color: var(--c-text);
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    cursor: pointer;
    border-radius: var(--r-sm);
  }

  .close:hover {
    color: var(--c-text);
    background: var(--c-border);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: var(--sp-xs) 0;
  }

  .keys {
    display: flex;
    gap: var(--sp-xs);
  }

  kbd {
    display: inline-block;
    padding: 2px 8px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--c-text);
    line-height: 1.4;
  }

  .action {
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }
</style>
