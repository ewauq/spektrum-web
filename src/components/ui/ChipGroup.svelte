<script lang="ts">
  let {
    options,
    value = $bindable(),
    disabled = false,
    label
  }: {
    options: { value: string; label: string; title?: string }[];
    value: string;
    disabled?: boolean;
    label?: string;
  } = $props();

  function onKeyDown(e: KeyboardEvent, idx: number) {
    let target = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      target = (idx - 1 + options.length) % options.length;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown")
      target = (idx + 1) % options.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = options.length - 1;
    if (target < 0) return;
    e.preventDefault();
    value = options[target].value;
    requestAnimationFrame(() => {
      const next = (e.currentTarget as HTMLElement).parentElement
        ?.children[target] as HTMLButtonElement | undefined;
      next?.focus();
    });
  }
</script>

<div class="chip-group" role="radiogroup" aria-label={label}>
  {#each options as opt, i (opt.value)}
    <button
      class="chip"
      class:active={value === opt.value}
      role="radio"
      aria-checked={value === opt.value}
      tabindex={value === opt.value ? 0 : -1}
      {disabled}
      title={opt.title}
      onclick={() => (value = opt.value)}
      onkeydown={(e) => onKeyDown(e, i)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .chip-group {
    display: inline-flex;
    gap: var(--sp-xs);
    flex-wrap: wrap;
  }

  .chip {
    padding: var(--sp-xs) var(--sp-md);
    min-height: 28px;
    background: var(--c-border);
    color: var(--c-text-accent);
    border: 1px solid var(--c-border-hover);
    border-radius: var(--r-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-family: inherit;
    text-transform: capitalize;
    transition: background 0.1s;
  }

  .chip:hover:not(:disabled) {
    background: var(--c-border-hover);
    color: var(--c-text);
  }

  .chip.active {
    background: var(--c-border-hover);
    border-color: var(--c-accent);
    color: var(--c-text);
  }

  .chip:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
