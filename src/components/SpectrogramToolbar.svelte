<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { toolStore, type ToolMode } from "$lib/stores/tool.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";

  let {
    view3d = $bindable(false),
    viewWaveform = $bindable(false),
    disabled = false,
  }: {
    view3d?: boolean;
    viewWaveform?: boolean;
    disabled?: boolean;
  } = $props();

  // Tools that act on the spectrogram (pan/zoom/select) and view-mode
  // toggles (2D/3D) are not meaningful while the analyses tabs are
  // displayed — the spectrogram is hidden, gestures don't propagate.
  // The Waveform and Analyses toggles remain available so the user
  // can keep adjusting these from the toolbar.
  const interactDisabled = $derived(disabled || uiStore.viewAnalyses);

  // The 2D/3D/Analyses group only makes sense when at least one
  // alternative to 2D exists — otherwise the 2D button toggles
  // nothing.
  const showViewGroup = $derived(
    uiStore.enableSpectrogram3d || uiStore.enableAnalyses,
  );

  function setMode(m: ToolMode) {
    toolStore.set(m);
  }
</script>

<div
  class="toolbar"
  role="toolbar"
  aria-label={t("toolbar.label")}
  data-tooltip-instant
>
  <div class="group">
    <button
      class="tool"
      class:active={toolStore.effective === "pan"}
      onclick={() => setMode("pan")}
      aria-pressed={toolStore.effective === "pan"}
      aria-label={`${t("toolbar.tool_pan")} (H)`}
      data-tooltip={`${t("toolbar.tool_pan")} (H)`}
      disabled={interactDisabled}
    >
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
        <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
        <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
        <path
          d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15"
        />
      </svg>
    </button>

    <button
      class="tool"
      class:active={toolStore.effective === "zoom"}
      onclick={() => setMode("zoom")}
      aria-pressed={toolStore.effective === "zoom"}
      aria-label={`${t("toolbar.tool_zoom")} (Z)`}
      data-tooltip={`${t("toolbar.tool_zoom")} (Z)`}
      disabled={interactDisabled}
    >
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
        <path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1" />
        <path d="M7 22h1a4 4 0 0 0 4-4v-1" />
        <path d="M7 2h1a4 4 0 0 1 4 4v1" />
      </svg>
    </button>
  </div>

  {#if showViewGroup}
    <div class="separator"></div>

    <div class="group">
      <button
        class="tool"
        class:active={!view3d && !uiStore.viewAnalyses}
        onclick={() => {
          view3d = false;
          uiStore.viewAnalyses = false;
        }}
        aria-pressed={!view3d && !uiStore.viewAnalyses}
        aria-label={`${t("titlebar.view_2d")} (2)`}
        data-tooltip={`${t("titlebar.view_2d")} (2)`}
        {disabled}
      >
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
          <path d="M2 21v-6" />
          <path d="M7 21v-15" />
          <path d="M12 21v-18" />
          <path d="M17 21v-10" />
          <path d="M22 21v-8" />
        </svg>
      </button>

      {#if uiStore.enableSpectrogram3d}
        <button
          class="tool"
          class:active={view3d && !uiStore.viewAnalyses}
          onclick={() => {
            view3d = true;
            uiStore.viewAnalyses = false;
          }}
          aria-pressed={view3d && !uiStore.viewAnalyses}
          aria-label={`${t("titlebar.view_3d")} (3)`}
          data-tooltip={`${t("titlebar.view_3d")} (3)`}
          {disabled}
        >
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
            <path d="M13.5 10.5 15 9" />
            <path d="M4 4v15a1 1 0 0 0 1 1h15" />
            <path d="M4.293 19.707 6 18" />
            <path d="m9 15 1.5-1.5" />
          </svg>
        </button>
      {/if}

      {#if uiStore.enableAnalyses}
        <button
          class="tool"
          class:active={uiStore.viewAnalyses}
          onclick={() => (uiStore.viewAnalyses = true)}
          aria-pressed={uiStore.viewAnalyses}
          aria-label={`${t("toolbar.tool_analyses")} (A)`}
          data-tooltip={`${t("toolbar.tool_analyses")} (A)`}
          {disabled}
        >
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
            <path d="M3 3v18h18" />
            <path d="M7 14l3-3 3 3 5-5" />
            <circle cx="7" cy="14" r="1" />
            <circle cx="10" cy="11" r="1" />
            <circle cx="13" cy="14" r="1" />
            <circle cx="18" cy="9" r="1" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  <div class="separator"></div>

  <div class="group">
    <button
      class="tool"
      class:active={viewWaveform}
      onclick={() => (viewWaveform = !viewWaveform)}
      aria-pressed={viewWaveform}
      aria-label={`${t("titlebar.view_waveform")} (W)`}
      data-tooltip={`${t("titlebar.view_waveform")} (W)`}
      {disabled}
    >
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
        <path d="M2 10v3" />
        <path d="M6 6v11" />
        <path d="M10 3v18" />
        <path d="M14 8v7" />
        <path d="M18 5v13" />
        <path d="M22 10v3" />
      </svg>
    </button>
  </div>

  <div class="separator"></div>

  <div class="group">
    <button
      class="tool"
      class:active={toolStore.effective === "select"}
      onclick={() => setMode("select")}
      aria-pressed={toolStore.effective === "select"}
      aria-label={`${t("toolbar.tool_select")} (S)`}
      data-tooltip={`${t("toolbar.tool_select")} (S)`}
      disabled={interactDisabled}
    >
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
        <path d="M19.5 7a24 24 0 0 1 0 10" />
        <path d="M4.5 7a24 24 0 0 0 0 10" />
        <path d="M7 19.5a24 24 0 0 0 10 0" />
        <path d="M7 4.5a24 24 0 0 1 10 0" />
        <rect x="17" y="17" width="5" height="5" rx="1" />
        <rect x="17" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="17" width="5" height="5" rx="1" />
        <rect x="2" y="2" width="5" height="5" rx="1" />
      </svg>
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .separator {
    width: 1px;
    height: 18px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--c-border) 25%,
      var(--c-border) 75%,
      transparent
    );
    margin: 0 4px;
    flex-shrink: 0;
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    color: var(--c-text-muted);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .tool:hover:not(:disabled) {
    background: var(--c-border);
    color: var(--c-text);
  }

  .tool.active {
    background: var(--c-border);
    color: var(--c-accent);
  }

  .tool.active:hover:not(:disabled) {
    background: var(--c-border-hover);
  }

  .tool:focus-visible {
    outline: 2px solid var(--c-text-muted);
    outline-offset: 1px;
  }

  .tool:disabled {
    opacity: 0.35;
    cursor: default;
  }
</style>
