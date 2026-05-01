<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { devWarn } from "$lib/log";
  import Logo from "./Logo.svelte";

  let { version = "", onClose }: { version?: string; onClose: () => void } =
    $props();

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  function openLink(url: string) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      devWarn(`openLink(${url})`, err);
    }
  }

  $effect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
</script>

<div
  class="backdrop"
  role="presentation"
  onclick={onBackdropClick}
  onkeydown={onKey}
>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-title"
  >
    <button class="close" onclick={onClose} aria-label={t("common.close")}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <line x1="2" y1="2" x2="12" y2="12" />
        <line x1="12" y1="2" x2="2" y2="12" />
      </svg>
    </button>
    <Logo size={128} gradientId="about-logo-gradient" />
    <h2 id="about-title" class="name">Spektrum</h2>
    {#if version}
      <div class="version">v{version}</div>
    {/if}
    <div class="credits">
      <div>
        {t("about.created_by")}
        <button
          class="link"
          onclick={() => openLink("https://github.com/ewauq")}>ewauq</button
        >
      </div>
      <div>
        {t("about.with")} <strong>Claude</strong>
        {t("about.by_anthropic")}
      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(12, 13, 18, 0.7);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--sp-xl) calc(var(--sp-xl) * 1.5);
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
    min-width: 320px;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    cursor: pointer;
  }

  .close:hover {
    color: var(--c-text);
    background: var(--c-border);
  }

  .name {
    margin: var(--sp-xs) 0 0;
    font-size: 1.8rem;
    font-weight: 400;
    color: var(--c-text);
    font-family: "Carter One", system-ui, sans-serif;
    line-height: 1;
  }

  .version {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--c-text-dim);
  }

  .credits {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: var(--sp-md);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    text-align: center;
  }

  .credits strong {
    color: var(--c-text);
    font-weight: 500;
  }

  .link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--c-accent);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition: text-decoration-color 0.15s;
  }

  .link:hover {
    text-decoration-color: var(--c-accent);
  }
</style>
