<script lang="ts">
  import { t, i18n } from "$lib/i18n/index.svelte";
  import { LOCALE_LABELS, type Locale } from "$lib/i18n/translations";
  import {
    uiStore,
    type AxisFontFamily,
    type CursorInfoMode,
  } from "$lib/stores/ui.svelte";
  import ColorInput from "./ColorInput.svelte";
  import Select from "./ui/Select.svelte";
  import Toggle from "./ui/Toggle.svelte";


  const axisFontOptions = $derived.by(() => [
    { value: "mono", label: t("app_settings.font_mono") },
    { value: "sans", label: t("app_settings.font_sans") },
  ]);

  const cursorInfoOptions = $derived.by(() => [
    { value: "dock", label: t("app_settings.cursor_info_dock") },
    { value: "follow", label: t("app_settings.cursor_info_follow") },
  ]);

  let { onClose }: { onClose: () => void } = $props();

  type CategoryId = "general" | "appearance" | "advanced";
  let activeCat = $state<CategoryId>("general");
  let modalEl: HTMLDivElement | undefined = $state(undefined);
  // Capture the element that opened the modal so we can restore focus on close.
  const previousActive =
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null;

  const categories = $derived.by(() => [
    { id: "general" as const, label: t("app_settings.cat_general") },
    { id: "appearance" as const, label: t("app_settings.cat_appearance") },
    { id: "advanced" as const, label: t("app_settings.cat_advanced") },
  ]);

  function focusableEls(): HTMLElement[] {
    if (!modalEl) return [];
    return Array.from(
      modalEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Tab" && modalEl) {
      const items = focusableEls();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !modalEl.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActive?.focus?.();
    };
  });

  $effect(() => {
    modalEl?.focus();
  });

  function onCatKeyDown(e: KeyboardEvent, idx: number) {
    let target = -1;
    if (e.key === "ArrowDown") target = (idx + 1) % categories.length;
    else if (e.key === "ArrowUp")
      target = (idx - 1 + categories.length) % categories.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = categories.length - 1;
    if (target < 0) return;
    e.preventDefault();
    activeCat = categories[target].id;
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        `#app-cat-${categories[target].id}`,
      );
      btn?.focus();
    });
  }
</script>

<div
  class="overlay"
  role="presentation"
  onclick={onClose}
  onkeydown={(e) => e.key === "Escape" && onClose()}
>
  <div
    class="modal"
    bind:this={modalEl}
    role="dialog"
    aria-modal="true"
    aria-label={t("app_settings.title")}
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <header class="header">
      <h2>{t("app_settings.title")}</h2>
      <button
        class="close"
        onclick={onClose}
        aria-label={t("titlebar.close")}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <line x1="0" y1="0" x2="14" y2="14" />
          <line x1="14" y1="0" x2="0" y2="14" />
        </svg>
      </button>
    </header>

    <div class="body">
      <div class="categories" role="tablist" aria-orientation="vertical">
        {#each categories as cat, i (cat.id)}
          <button
            class="cat"
            class:active={activeCat === cat.id}
            id="app-cat-{cat.id}"
            role="tab"
            aria-selected={activeCat === cat.id}
            aria-controls="app-panel-{cat.id}"
            tabindex={activeCat === cat.id ? 0 : -1}
            onclick={() => (activeCat = cat.id)}
            onkeydown={(e) => onCatKeyDown(e, i)}
          >
            {cat.label}
          </button>
        {/each}
      </div>

      <div
        class="content"
        id="app-panel-{activeCat}"
        role="tabpanel"
        aria-labelledby="app-cat-{activeCat}"
        tabindex="0"
      >
        {#if activeCat === "general"}
          <section>
            <h3 class="section-title">{t("settings.language")}</h3>
            <div class="lang-row">
              {#each Object.entries(LOCALE_LABELS) as [code, label] (code)}
                <button
                  class="lang"
                  class:active={i18n.locale === code}
                  onclick={() => (i18n.locale = code as Locale)}
                >
                  {label}
                </button>
              {/each}
            </div>
          </section>
        {:else if activeCat === "appearance"}
          <section>
            <h3 class="section-title">{t("app_settings.axis_labels")}</h3>
            <div class="field">
              <label for="axis-color">{t("app_settings.axis_color")}</label>
              <ColorInput
                value={uiStore.axisLabelColor}
                onchange={(hex) => (uiStore.axisLabelColor = hex)}
              />
            </div>
            <div class="field">
              <label for="axis-size">{t("app_settings.axis_size")}</label>
              <input
                id="axis-size"
                type="number"
                min="8"
                max="20"
                step="0.5"
                value={uiStore.axisLabelFontSize}
                onchange={(e) => {
                  const v = Number(
                    (e.currentTarget as HTMLInputElement).value,
                  );
                  if (Number.isFinite(v)) uiStore.axisLabelFontSize = v;
                }}
              />
              <span class="unit">px</span>
            </div>
            <div class="field">
              <label for="axis-font">{t("app_settings.axis_font")}</label>
              <Select
                options={axisFontOptions}
                value={uiStore.axisLabelFontFamily}
                onchange={(v) =>
                  (uiStore.axisLabelFontFamily = v as AxisFontFamily)}
              />
            </div>
            <div class="field">
              <button
                class="reset"
                onclick={() => uiStore.resetAxisLabel()}
              >
                {t("app_settings.axis_reset")}
              </button>
            </div>
          </section>
          <section>
            <h3 class="section-title">{t("app_settings.cursor_info")}</h3>
            <div class="field">
              <label for="cursor-info-mode">
                {t("app_settings.cursor_info_mode")}
              </label>
              <Select
                options={cursorInfoOptions}
                value={uiStore.cursorInfoMode}
                onchange={(v) =>
                  (uiStore.cursorInfoMode = v as CursorInfoMode)}
              />
            </div>
          </section>
        {:else if activeCat === "advanced"}
          <section>
            <h3 class="section-title">{t("app_settings.debug_section")}</h3>
            <div class="field-stack">
              <div class="field-row">
                <label for="enable-debug">
                  {t("app_settings.debug_mode")}
                </label>
                <Toggle bind:checked={uiStore.debugMode} />
              </div>
              <p class="hint">
                {t("app_settings.debug_mode_hint")}
              </p>
            </div>
          </section>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
  }

  .modal {
    width: min(720px, 90vw);
    height: min(560px, 80vh);
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal:focus-visible {
    outline: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-md) var(--sp-lg);
    border-bottom: 1px solid var(--c-border);
    flex-shrink: 0;
  }

  .header h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--c-text);
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    cursor: pointer;
    border-radius: var(--r-sm);
  }

  .close:hover {
    background: var(--c-border);
    color: var(--c-text);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .categories {
    display: flex;
    flex-direction: column;
    padding: var(--sp-sm);
    gap: 2px;
    border-right: 1px solid var(--c-border);
    background: var(--c-bg);
    overflow-y: auto;
  }

  .cat {
    position: relative;
    text-align: left;
    padding: var(--sp-sm) var(--sp-md);
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    font-family: inherit;
    font-size: 14px;
    cursor: pointer;
    border-radius: var(--r-sm);
    transition: color 0.1s ease;
  }

  .cat::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 2px;
    height: 0;
    background: var(--c-accent);
    border-radius: 1px;
    transition: height 0.12s ease;
  }

  .cat:hover {
    color: var(--c-text);
  }

  .cat.active {
    color: var(--c-text);
  }

  .cat.active::after {
    height: calc(100% - var(--sp-sm) * 2);
  }

  .content {
    padding: var(--sp-lg);
    overflow-y: auto;
  }

  .content:focus-visible {
    outline: none;
  }

  .section-title {
    margin: 0 0 var(--sp-sm) 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lang-row {
    display: flex;
    gap: var(--sp-xs);
  }

  .lang {
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--c-border);
    color: var(--c-text-accent);
    border: 1px solid var(--c-border-hover);
    border-radius: var(--r-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-family: inherit;
  }

  .lang:hover {
    background: var(--c-border-hover);
    color: var(--c-text);
  }

  .lang.active {
    background: var(--c-border-hover);
    border-color: var(--c-accent);
    color: var(--c-text);
  }

  .field-stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-sm);
  }

  .field-row label {
    color: var(--c-text);
    font-size: var(--fs-md);
  }

  .hint {
    margin: 0 0 var(--sp-sm);
    color: var(--c-text-dim);
    font-size: var(--fs-sm);
    font-style: italic;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    margin-bottom: var(--sp-sm);
  }

  .field label {
    flex: 0 0 9rem;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .field input[type="number"] {
    width: 4rem;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-align: right;
  }

  .field input[type="number"]:focus-visible {
    border-color: var(--c-border-focus);
    outline: none;
  }

  .field .unit {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .reset {
    margin-left: 9rem;
    padding: var(--sp-xs) var(--sp-md);
    background: var(--c-border);
    border: 1px solid var(--c-border-hover);
    color: var(--c-text-accent);
    border-radius: var(--r-md);
    font-family: inherit;
    font-size: var(--fs-sm);
    cursor: pointer;
  }

  .reset:hover {
    background: var(--c-border-hover);
    color: var(--c-text);
  }
</style>
