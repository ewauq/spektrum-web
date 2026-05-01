<script lang="ts">
  import { onMount, tick } from "svelte";

  let {
    options,
    value = $bindable(),
    disabled = false,
    label,
    onchange,
  }: {
    options: { value: string; label: string; preview?: string }[];
    value: string;
    disabled?: boolean;
    label?: string;
    onchange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let activeIndex = $state(-1);
  let listboxId = `listbox-${Math.random().toString(36).slice(2, 9)}`;
  let triggerEl: HTMLButtonElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();
  let dropdownPos = $state({ top: 0, left: 0, width: 0 });

  const selected = $derived(options.find((o) => o.value === value));
  const selectedIdx = $derived(options.findIndex((o) => o.value === value));

  function measure() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    dropdownPos = {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    };
  }

  async function openDropdown() {
    if (disabled || open) return;
    measure();
    activeIndex = selectedIdx >= 0 ? selectedIdx : 0;
    open = true;
    await tick();
    focusOption(activeIndex);
  }

  function closeDropdown() {
    if (!open) return;
    open = false;
    triggerEl?.focus();
  }

  function focusOption(idx: number) {
    if (!dropdownEl) return;
    const node = dropdownEl.querySelector<HTMLElement>(
      `[data-option-index="${idx}"]`,
    );
    node?.focus();
    node?.scrollIntoView({ block: "nearest" });
  }

  function pick(v: string) {
    value = v;
    onchange?.(v);
    closeDropdown();
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      openDropdown();
    }
  }

  function onListKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }
    if (e.key === "Tab") {
      // Tab moves focus out of the listbox: close without committing.
      open = false;
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      focusOption(activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      focusOption(activeIndex);
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      focusOption(activeIndex);
    } else if (e.key === "End") {
      e.preventDefault();
      activeIndex = options.length - 1;
      focusOption(activeIndex);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < options.length) {
        pick(options[activeIndex].value);
      }
    }
  }

  function onClickOutside(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (triggerEl?.contains(target)) return;
    if (dropdownEl?.contains(target)) return;
    open = false;
  }

  function onScrollOrResize(e: Event) {
    if (!open) return;
    if (dropdownEl?.contains(e.target as Node)) return;
    open = false;
  }

  onMount(() => {
    document.addEventListener("pointerdown", onClickOutside);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onClickOutside);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  });
</script>

<button
  bind:this={triggerEl}
  class="trigger"
  class:open
  class:disabled
  type="button"
  {disabled}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={listboxId}
  aria-label={label}
  onclick={() => (open ? closeDropdown() : openDropdown())}
  onkeydown={onTriggerKeyDown}
>
  {#if selected?.preview}
    <div class="preview" style:background={selected.preview}></div>
  {/if}
  <span class="label">{selected?.label ?? "-"}</span>
  <svg
    class="chevron"
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <polyline points="2,3.5 5,6.5 8,3.5" />
  </svg>
</button>

{#if open}
  <div
    id={listboxId}
    class="dropdown"
    bind:this={dropdownEl}
    role="listbox"
    aria-label={label}
    tabindex="-1"
    style:top="{dropdownPos.top}px"
    style:left="{dropdownPos.left}px"
    style:min-width="{dropdownPos.width}px"
    onkeydown={onListKeyDown}
  >
    {#each options as opt, i (opt.value)}
      <button
        class="option"
        class:active={opt.value === value}
        type="button"
        role="option"
        aria-selected={opt.value === value}
        tabindex={i === activeIndex ? 0 : -1}
        data-option-index={i}
        onclick={() => pick(opt.value)}
        onmouseenter={() => (activeIndex = i)}
      >
        {#if opt.preview}
          <div class="preview" style:background={opt.preview}></div>
        {/if}
        <span>{opt.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--c-bg);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-family: inherit;
    min-width: 9rem;
    text-align: left;
  }

  .trigger.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .trigger:hover {
    border-color: var(--c-border-hover);
  }

  .trigger.open {
    border-color: var(--c-border-focus);
  }

  .label {
    flex: 1;
  }

  .chevron {
    color: var(--c-text-muted);
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  .trigger.open .chevron {
    transform: rotate(180deg);
  }

  .dropdown {
    position: fixed;
    background: var(--c-surface-raised);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    max-height: 240px;
    overflow-y: auto;
    padding: var(--sp-xs) 0;
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
    padding: var(--sp-xs) var(--sp-sm);
    background: none;
    color: var(--c-text-accent);
    border: none;
    cursor: pointer;
    font-size: var(--fs-sm);
    font-family: inherit;
    text-align: left;
  }

  .option:hover,
  .option:focus-visible {
    background: var(--c-border);
    color: var(--c-text);
    outline: none;
  }

  .option.active {
    color: var(--c-text);
    background: rgba(107, 139, 255, 0.12);
  }

  .option[aria-selected="true"] {
    font-weight: 500;
  }

  .preview {
    width: 64px;
    height: 14px;
    border-radius: var(--r-sm);
    flex-shrink: 0;
  }
</style>
