<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { taskStore } from "$lib/stores/tasks.svelte";

  let {
    anchor,
    onClose,
  }: {
    anchor: HTMLElement | null;
    onClose: () => void;
  } = $props();

  // Anchor the popup just above the trigger label in the statusbar.
  // Recomputed on mount only — the statusbar is fixed-height so the
  // anchor doesn't shift while the popup is open.
  let left = $state(8);
  let bottom = $state(34);

  onMount(() => {
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      left = Math.round(r.left);
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
      const popup = document.querySelector(".task-queue-popup");
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

  // Auto-close when the queue empties — nothing left to display.
  $effect(() => {
    if (taskStore.count === 0) onClose();
  });
</script>

<div
  class="task-queue-popup"
  role="dialog"
  aria-label={t("status.queue_popup_title")}
  style:left="{left}px"
  style:bottom="{bottom}px"
>
  <header class="head">
    <span class="title">{t("status.queue_popup_title")}</span>
  </header>
  <ul class="list">
    {#each taskStore.active as task (task.id)}
      {@const isIndet = Number.isNaN(task.progress)}
      <li class="row">
        <span class="label">{task.label}</span>
        <div class="bar" class:indeterminate={isIndet}>
          <div
            class="fill"
            style:width={isIndet ? "100%" : task.progress * 100 + "%"}
          ></div>
        </div>
      </li>
    {:else}
      <li class="empty">{t("status.no_active")}</li>
    {/each}
  </ul>
</div>

<style>
  .task-queue-popup {
    position: fixed;
    z-index: 50;
    min-width: 280px;
    max-width: 420px;
    max-height: 50vh;
    overflow-y: auto;
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

  .list {
    list-style: none;
    margin: 0;
    padding: var(--sp-xs) 0;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px var(--sp-md);
  }

  .label {
    font-size: var(--fs-sm);
    color: var(--c-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar {
    height: 4px;
    background: var(--c-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--c-accent);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .bar.indeterminate .fill {
    width: 30% !important;
    animation: queue-indet 1.2s ease-in-out infinite;
  }

  @keyframes queue-indet {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(380%);
    }
  }

  .empty {
    padding: var(--sp-md);
    text-align: center;
    color: var(--c-text-dim);
    font-style: italic;
    font-size: var(--fs-sm);
  }
</style>
