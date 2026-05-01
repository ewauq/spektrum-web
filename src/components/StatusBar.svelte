<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { formatDuration } from "$lib/format";
  import { fileName } from "$lib/path";
  import { devWarn } from "$lib/log";
  import { taskStore } from "$lib/stores/tasks.svelte";
  import TaskQueuePopup from "./TaskQueuePopup.svelte";
  import FakeStereoPopup from "./FakeStereoPopup.svelte";
  import type { DecodedAudio } from "$lib/audio/decode";

  let { audio }: { audio: DecodedAudio | null } = $props();

  const headline = $derived(taskStore.headline);
  const extra = $derived(Math.max(0, taskStore.count - 1));
  const indeterminate = $derived(!!headline && Number.isNaN(headline.progress));
  const message = $derived.by(() => {
    if (headline) {
      return extra > 0
        ? `${headline.label} ${t("status.queue_more", { n: String(extra) })}`
        : headline.label;
    }
    return t("status.ready");
  });

  const audioFileName = $derived(audio ? fileName(audio.path) : "");
  const audioFilePath = $derived(audio?.path ?? "");
  const displayPath = $derived.by(() => {
    if (!audioFilePath || !audioFileName) return "";
    let prefix = audioFilePath.slice(
      0,
      Math.max(0, audioFilePath.length - audioFileName.length),
    );
    if (prefix && !/[\\/]$/.test(prefix)) {
      const sep = audioFilePath.includes("\\") ? "\\" : "/";
      prefix += sep;
    }
    return prefix;
  });

  let messageBtn: HTMLButtonElement | undefined = $state();
  let popupOpen = $state(false);
  let fakeStereoBtn: HTMLButtonElement | undefined = $state();
  let fakeStereoPopupOpen = $state(false);

  // Auto-close the popup when no task is left, otherwise it would
  // hang around with an empty list.
  $effect(() => {
    if (taskStore.count === 0) popupOpen = false;
  });

  // Close the fake-stereo popup when the audio changes (e.g. user
  // loads a different file).
  $effect(() => {
    void audio?.path;
    fakeStereoPopupOpen = false;
  });

  function channelsLabel(n: number): string {
    if (n === 1) return t("status.mono");
    if (n === 2) return t("status.stereo");
    return `${n}ch`;
  }

  async function openFolder() {}
</script>

<footer class="statusbar" role="status" aria-live="polite">
  <div class="left">
    {#if headline}
      <button
        bind:this={messageBtn}
        class="message active"
        type="button"
        aria-label={t("status.queue_popup_title")}
        aria-expanded={popupOpen}
        onclick={() => (popupOpen = !popupOpen)}>{message}</button
      >
    {:else}
      <span class="message">{message}</span>
    {/if}
    {#if headline}
      <div class="progress" class:indeterminate>
        <div
          class="bar"
          style:width={indeterminate ? "100%" : headline.progress * 100 + "%"}
        ></div>
      </div>
    {/if}
  </div>

  {#if audio}
    <div class="right">
      <div class="file-info" title={audioFilePath}>
        {#if displayPath}
          <button
            type="button"
            class="file-path"
            onclick={openFolder}
            aria-describedby="file-path-hint"
          ><span class="file-path-text">{displayPath}</span></button>
        {/if}
        <span class="file-name">{audioFileName}</span>
        <span id="file-path-hint" class="sr-only">
          {t("statusbar.open_folder_hint")}
        </span>
      </div>
      <span class="sep" aria-hidden="true"></span>
      <span>{audio.format.toUpperCase()}</span>
      <span class="sep" aria-hidden="true"></span>
      <span>{(audio.sampleRate / 1000).toFixed(1)} kHz</span>
      <span class="sep" aria-hidden="true"></span>
      {#if audio.effectivelyMono}
        <button
          bind:this={fakeStereoBtn}
          class="fake-stereo"
          type="button"
          aria-label={t("statusbar.fake_stereo_warning")}
          aria-expanded={fakeStereoPopupOpen}
          title={t("statusbar.fake_stereo_warning")}
          onclick={() => (fakeStereoPopupOpen = !fakeStereoPopupOpen)}
        >
          <svg
            class="warn-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
            />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span>{channelsLabel(audio.channels)}</span>
        </button>
      {:else}
        <span>{channelsLabel(audio.channels)}</span>
      {/if}
      <span class="sep" aria-hidden="true"></span>
      <span>{formatDuration(audio.duration)}</span>
    </div>
  {/if}
</footer>

{#if popupOpen && headline}
  <TaskQueuePopup
    anchor={messageBtn ?? null}
    onClose={() => (popupOpen = false)}
  />
{/if}

{#if fakeStereoPopupOpen && audio?.effectivelyMono}
  <FakeStereoPopup
    anchor={fakeStereoBtn ?? null}
    onClose={() => (fakeStereoPopupOpen = false)}
  />
{/if}

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    height: 32px;
    padding: 0 var(--sp-md);
    background: var(--c-surface-raised);
    border-top: 1px solid var(--c-border);
    font-size: var(--fs-md);
    color: var(--c-text-muted);
    flex-shrink: 0;
    user-select: none;
  }

  .left {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    min-width: 0;
    flex: 1;
  }

  .message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background: transparent;
    border: none;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  button.message {
    cursor: pointer;
    border-radius: var(--r-sm);
    padding: 0 4px;
    margin: 0 -4px;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
  }

  button.message:hover {
    background: var(--c-border);
    color: var(--c-text);
  }

  button.message:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 1px;
  }

  .message.active {
    color: var(--c-text);
  }

  .progress {
    flex: 0 0 160px;
    height: 7px;
    background: var(--c-border);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress .bar {
    height: 100%;
    background: var(--c-accent);
    border-radius: 3px;
    transition: width 0.1s linear;
  }

  .progress.indeterminate .bar {
    width: 30% !important;
    animation: indet 1.2s ease-in-out infinite;
  }

  @keyframes indet {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(380%);
    }
  }

  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--c-text-muted);
    white-space: nowrap;
  }

  .file-info {
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: 70ch;
  }

  .file-path {
    background: none;
    border: none;
    padding: 0 4px;
    margin: 0 -4px;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    font: inherit;
    text-align: left;
    cursor: pointer;
    color: var(--c-text-dim);
    min-width: 0;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition:
      text-decoration-color 0.15s,
      color 0.15s;
  }

  .file-path-text {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .file-path:hover {
    color: var(--c-text-muted);
    text-decoration-color: var(--c-text-muted);
  }

  .file-path:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 1px;
    border-radius: var(--r-sm);
  }

  .file-name {
    color: var(--c-text);
    flex-shrink: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .sep {
    flex-shrink: 0;
    width: 1px;
    height: 12px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--c-border) 25%,
      var(--c-border) 75%,
      transparent
    );
  }

  /* Warning indicator for redundant stereo. Amber #fbbf24 hits ≈ 9:1
     contrast on the dark statusbar background, well above WCAG AA
     (4.5:1) and AAA (7:1) for non-text but large enough to read. */
  .fake-stereo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    margin: 0 -6px;
    min-height: 24px;
    background: transparent;
    border: none;
    color: #fbbf24;
    font: inherit;
    cursor: pointer;
    border-radius: var(--r-sm);
  }

  .fake-stereo:hover {
    background: rgba(251, 191, 36, 0.12);
  }

  .fake-stereo:focus-visible {
    outline: 2px solid #fbbf24;
    outline-offset: 1px;
  }

  .warn-icon {
    flex-shrink: 0;
  }
</style>
