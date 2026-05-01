<script lang="ts">
  let appVersion = $state(import.meta.env.VITE_APP_VERSION ?? '0.1.0');
</script>

<main>
  <h1>Spektrum Web</h1>
  <p class="version">v{appVersion}</p>
  <p>Bootstrap réussi. Phase 4.2 (modules core) et 4.3 (platform layer) à venir.</p>
</main>

<style>
  main {
    margin: auto;
    padding: 2rem;
    text-align: center;
    color: var(--c-text);
  }

  h1 {
    font-family: "Carter One", sans-serif;
    font-size: 2rem;
    margin: 0;
  }

  .version {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    margin: 0.5rem 0 1.5rem;
  }
</style>
