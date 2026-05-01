<script lang="ts">
  import { dev } from "$app/environment";
  import { onMount } from "svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { setupGlobalTooltips } from "$lib/tooltip";
  import { uiStore, AXIS_FONT_STACK } from "$lib/stores/ui.svelte";

  let { children } = $props();

  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = i18n.locale;
      document.title = i18n.t("app.title");
    }
  });

  // Project axis label appearance preferences as CSS custom properties
  // so any component (Spectrogram 2D, future axes) can pick them up
  // via var(--axis-label-*) without each component subscribing to the
  // store individually.
  $effect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement.style;
    root.setProperty("--axis-label-color", uiStore.axisLabelColor);
    root.setProperty("--axis-label-size", `${uiStore.axisLabelFontSize}px`);
    root.setProperty(
      "--axis-label-font",
      AXIS_FONT_STACK[uiStore.axisLabelFontFamily],
    );
  });

  onMount(() => setupGlobalTooltips());
</script>

<div
  class="shell"
  oncontextmenu={dev ? undefined : (e) => e.preventDefault()}
  role="presentation"
>
  {@render children()}
</div>

<style>
  :global(:root) {
    --c-bg: #0c0d12;
    --c-surface: #12131a;
    --c-surface-raised: #1a1f2e;
    --c-surface-overlay: #151926;

    --c-border: #2a3145;
    --c-border-hover: #3b4363;
    --c-border-focus: #6b8bff;

    --c-text: #e6e8ef;
    --c-text-muted: #8b94b5;
    --c-text-dim: #8590b0;
    --c-text-accent: #b7bfd9;

    --c-accent: #6b8bff;
    --c-danger: #ff6b7a;
    --c-warning: #ffb86b;

    --c-waveform: #dbdbdb;

    --sp-xs: 0.25rem;
    --sp-sm: 0.5rem;
    --sp-md: 0.75rem;
    --sp-lg: 1rem;
    --sp-xl: 1.5rem;

    --r-sm: 2px;
    --r-md: 4px;
    --r-lg: 6px;

    --fs-sm: 0.78rem;
    --fs-md: 0.85rem;
    --fs-lg: 1rem;

    --fs-menu-trigger: 14px;
    --fs-menu-item: 14px;

    --font-mono: ui-monospace, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

    /* Z-index scale: keep overlays above content, modals above overlays,
       dropdowns above modals, and tooltip on top of everything. */
    --z-overlay: 100;
    --z-modal: 200;
    --z-dropdown: 10000;
    --z-tooltip: 100000;

    /* Axis labels appearance, overridable from app settings at runtime. */
    --axis-label-color: #8b94b5;
    --axis-label-size: 11.5px;
    --axis-label-font: ui-monospace, monospace;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: var(--c-surface);
    color: var(--c-text);
    font-family: var(--font-sans);
    user-select: none;
    -webkit-user-select: none;
  }

  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--c-border) transparent;
  }

  :global(::-webkit-scrollbar) {
    width: 10px;
    height: 10px;
  }

  :global(::-webkit-scrollbar-track),
  :global(::-webkit-scrollbar-corner) {
    background: transparent;
  }

  :global(::-webkit-scrollbar-thumb) {
    background-color: var(--c-border);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background-color: var(--c-border-hover);
  }

  :global(::-webkit-scrollbar-button) {
    display: none;
  }

  :global(input, textarea, [contenteditable="true"]) {
    user-select: text;
    -webkit-user-select: text;
  }

  :global(input[type="number"]::-webkit-inner-spin-button),
  :global(input[type="number"]::-webkit-outer-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }

  :global(input[type="number"]) {
    appearance: textfield;
    -moz-appearance: textfield;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(*) {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  :global(:focus-visible) {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
  }

  :global(button:focus:not(:focus-visible)),
  :global(input:focus:not(:focus-visible)) {
    outline: none;
  }

  .shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--c-surface);
  }

  :global(.global-tooltip) {
    position: fixed;
    top: 0;
    left: 0;
    padding: 6px 10px;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-size: var(--fs-md);
    font-family: var(--font-sans);
    font-weight: 400;
    color: var(--c-text);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    max-width: 320px;
    line-height: 1.35;
    pointer-events: none;
    margin-top: -2px;
    opacity: 0;
    transform: translateY(-4px);
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
    z-index: 100000;
  }

  :global(.global-tooltip.visible) {
    opacity: 1;
    transform: translateY(0);
  }
</style>
