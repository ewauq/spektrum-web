<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'default',
    active = false,
    disabled = false,
    onclick,
    title,
    children
  }: {
    variant?: 'default' | 'chip' | 'danger' | 'ghost';
    active?: boolean;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    title?: string;
    children: Snippet;
  } = $props();
</script>

<button
  class="btn {variant}"
  class:active
  {disabled}
  {onclick}
  {title}
>
  {@render children()}
</button>

<style>
  .btn {
    padding: var(--sp-xs) var(--sp-md);
    background: var(--c-border);
    color: var(--c-text);
    border: 1px solid var(--c-border-hover);
    border-radius: var(--r-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-family: inherit;
    line-height: 1.4;
    transition: background 0.1s;
  }

  .btn:hover:not(:disabled) {
    background: var(--c-border-hover);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn.active {
    background: var(--c-border-hover);
    border-color: var(--c-accent);
  }

  .chip {
    padding: var(--sp-xs) var(--sp-sm);
    font-size: var(--fs-sm);
    text-transform: capitalize;
  }

  .danger {
    background: #3a2a3a;
    border-color: #573355;
  }

  .danger:hover:not(:disabled) {
    background: #4a3548;
  }

  .ghost {
    background: transparent;
    border-color: transparent;
    color: var(--c-text-muted);
  }

  .ghost:hover:not(:disabled) {
    background: var(--c-border);
    color: var(--c-text);
  }
</style>
