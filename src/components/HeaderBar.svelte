<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import ShortcutsPanel from "./ShortcutsPanel.svelte";
  import Logo from "./Logo.svelte";
  import HelpMenu from "./HelpMenu.svelte";
  import FileMenu from "./FileMenu.svelte";
  import ViewMenu from "./ViewMenu.svelte";
  import SpectrogramToolbar from "./SpectrogramToolbar.svelte";

  let {
    onOpenFile,
    onCloseFile,
    onAppSettings,
    hasFile = false,
    loading = false,
    viewWaveform = $bindable(false),
  }: {
    onOpenFile: () => void;
    onCloseFile: () => void;
    onAppSettings: () => void;
    hasFile?: boolean;
    loading?: boolean;
    viewWaveform?: boolean;
  } = $props();

  const version = import.meta.env.VITE_APP_VERSION ?? "0.1.0";

  onMount(() => {
    document.title = `Spektrum v${version}`;
  });
</script>

<div class="bar">
  <div class="logo">
    <Logo size={40} />
  </div>

  <div class="menus" role="menubar" aria-label={t("titlebar.menubar")}>
    <FileMenu
      {onOpenFile}
      {onCloseFile}
      {onAppSettings}
      onQuit={() => {}}
      canClose={hasFile}
    />
    <ViewMenu bind:viewWaveform disabled={!hasFile} />
    <HelpMenu {version} />
  </div>

  <div class="spacer"></div>

  {#if hasFile}
    <div class="toolbar-wrap">
      <SpectrogramToolbar bind:viewWaveform disabled={loading} />
    </div>
  {/if}

  <button
    class="bar-button"
    onclick={() => (uiStore.sidebarCollapsed = !uiStore.sidebarCollapsed)}
    aria-label={uiStore.sidebarCollapsed
      ? t("titlebar.show_sidebar")
      : t("titlebar.hide_sidebar")}
    aria-pressed={!uiStore.sidebarCollapsed}
    data-tooltip={uiStore.sidebarCollapsed
      ? t("titlebar.show_sidebar")
      : t("titlebar.hide_sidebar")}
    disabled={!hasFile}
  >
    {#if uiStore.sidebarCollapsed}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M15 3v18" />
        <path d="m10 15-3-3 3-3" />
      </svg>
    {:else}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M15 3v18" />
        <path d="m8 9 3 3-3 3" />
      </svg>
    {/if}
  </button>

  <ShortcutsPanel />
</div>

<style>
  .bar {
    position: relative;
    display: flex;
    align-items: center;
    height: 47px;
    padding: 0 var(--sp-md);
    gap: var(--sp-sm);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }

  .menus {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: var(--sp-lg);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .logo :global(svg) {
    flex-shrink: 0;
  }

  .spacer {
    flex: 1;
    min-width: var(--sp-sm);
  }

  .toolbar-wrap {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
  }

  .bar-button {
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

  .bar-button:hover:not(:disabled) {
    color: var(--c-text);
    background: var(--c-border);
  }

  .bar-button:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
