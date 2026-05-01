<script lang="ts">
  import { onMount } from "svelte";
  import { audioStore } from "$lib/stores/audio.svelte";
  import { pickAudioFile, attachDragDrop } from "$lib/platform/file-input";
  import Spectrogram from "../components/Spectrogram.svelte";
  import type { DecodedAudio } from "$lib/audio/decode";

  let appVersion = import.meta.env.VITE_APP_VERSION ?? "0.1.0";
  let appShellRef: HTMLDivElement | undefined = $state();

  const status = $derived(audioStore.status);
  const audio = $derived<DecodedAudio | null>(
    status.kind === "ready" ? status.audio : null,
  );
  const loading = $derived(status.kind === "loading");

  async function openFile() {
    const handle = await pickAudioFile();
    if (handle) await audioStore.load(handle);
  }

  onMount(() => {
    if (!appShellRef) return;
    return attachDragDrop(appShellRef, (handle) => {
      void audioStore.load(handle);
    });
  });
</script>

<div class="app" bind:this={appShellRef}>
  <header class="bar">
    <h1>Spektrum <span class="version">v{appVersion}</span></h1>
    <button onclick={openFile}>Ouvrir un fichier audio…</button>
  </header>

  <main class="content">
    {#if loading}
      <p class="hint">Décodage en cours…</p>
    {:else if status.kind === "error"}
      <p class="hint error">Erreur : {status.message}</p>
    {:else if !audio}
      <p class="hint">
        Glisser-déposer un fichier <code>.flac</code> ou <code>.mp3</code>,
        ou clique sur "Ouvrir un fichier audio…".
      </p>
    {:else}
      <Spectrogram {audio} {loading} />
    {/if}
  </main>
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--c-bg);
    border-bottom: 1px solid #2a3145;
    flex-shrink: 0;
  }

  h1 {
    margin: 0;
    font-family: "Carter One", sans-serif;
    font-size: 1.25rem;
    color: var(--c-text);
  }

  .version {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 400;
  }

  button {
    padding: 0.4rem 0.8rem;
    background: #2a3145;
    color: var(--c-text);
    border: 1px solid #3b4363;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  button:hover {
    background: #3b4363;
  }

  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--c-surface);
    position: relative;
  }

  .hint {
    margin: auto;
    color: var(--c-text-muted);
    font-size: 0.95rem;
    text-align: center;
    padding: 1.5rem;
  }

  .hint.error {
    color: #ff6b7a;
  }

  .hint code {
    background: #2a3145;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
</style>
