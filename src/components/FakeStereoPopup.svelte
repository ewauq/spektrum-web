<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/index.svelte";

  let {
    anchor,
    onClose,
  }: {
    anchor: HTMLElement | null;
    onClose: () => void;
  } = $props();

  // The popup is wider than the trigger and the trigger sits near the
  // right edge of the statusbar, so left-aligning would push the popup
  // past the viewport. Clamp it inside the viewport with an 8 px pad.
  const POPUP_W = 360;
  const PAD = 8;

  let left = $state(8);
  let bottom = $state(34);

  onMount(() => {
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      let proposed = r.left;
      const maxLeft = window.innerWidth - POPUP_W - PAD;
      if (proposed > maxLeft) proposed = maxLeft;
      if (proposed < PAD) proposed = PAD;
      left = Math.round(proposed);
      bottom = Math.round(window.innerHeight - r.top + 4);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (anchor && anchor.contains(target)) return;
      const popup = document.querySelector(".fake-stereo-popup");
      if (popup && popup.contains(target)) return;
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  });
</script>

<div
  class="fake-stereo-popup"
  role="dialog"
  aria-label={t("statusbar.fake_stereo_title")}
  style:left="{left}px"
  style:bottom="{bottom}px"
>
  <header class="head">
    <span class="title">{t("statusbar.fake_stereo_title")}</span>
  </header>
  <p class="body">{t("statusbar.fake_stereo_body")}</p>
</div>

<style>
  .fake-stereo-popup {
    position: fixed;
    z-index: 50;
    width: 360px;
    max-width: 92vw;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .head {
    padding: var(--sp-sm) var(--sp-md);
    border-bottom: 1px solid var(--c-border);
  }

  .title {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .body {
    margin: 0;
    padding: var(--sp-md);
    color: var(--c-text);
    font-size: var(--fs-md);
    line-height: 1.5;
  }
</style>
