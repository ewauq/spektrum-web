<script lang="ts">
  let { children } = $props();
</script>

<div class="shell">
  {@render children()}
</div>

<style>
  :global(:root) {
    --c-bg: #0c0d12;
    --c-surface: #12131a;
    --c-text: #e6e8ef;
    --c-text-muted: #8b94b5;
    --c-accent: #6b8bff;
    --font-mono: ui-monospace, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    background: var(--c-surface);
    color: var(--c-text);
    font-family: var(--font-sans);
  }

  .shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--c-surface);
  }
</style>
