<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  let { value, disabled = false, onchange }: {
    value: string;
    disabled?: boolean;
    onchange: (hex: string) => void;
  } = $props();

  let draft = $state('');
  let pickerEl: HTMLInputElement | undefined = $state();

  // eslint-disable-next-line svelte/valid-compile -- value IS reactive in $effect
  $effect(() => {
    draft = value;
  });

  function commitDraft(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const hex = (e.currentTarget as HTMLInputElement).value.trim();
    if (/^#?[0-9a-f]{6}$/i.test(hex)) {
      const normalized = hex.startsWith('#') ? hex : `#${hex}`;
      onchange(normalized);
    }
    (e.currentTarget as HTMLInputElement).blur();
  }

  function onPickerChange(e: Event) {
    onchange((e.currentTarget as HTMLInputElement).value);
  }
</script>

<div class="color-input" class:disabled>
  <button
    class="swatch"
    style:background={value}
    onclick={() => pickerEl?.click()}
    {disabled}
    aria-label={t('common.open_color_picker')}
  ></button>
  <input
    bind:this={pickerEl}
    type="color"
    class="hidden-picker"
    {value}
    onchange={onPickerChange}
    {disabled}
    tabindex="-1"
  />
  <input
    type="text"
    class="hex"
    maxlength="7"
    placeholder="#ff3366"
    aria-label={t('common.color_hex')}
    bind:value={draft}
    onkeydown={commitDraft}
    {disabled}
  />
</div>

<style>
  .color-input {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .color-input.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .swatch {
    width: 28px;
    height: 24px;
    border: 1px solid #3b4363;
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }

  .swatch:hover {
    border-color: #6b8bff;
  }

  .hidden-picker {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .hex {
    width: 3.4rem;
    padding: 0.15rem 0.3rem;
    background: #0c0d12;
    border: 1px solid #2a3145;
    border-radius: 3px;
    color: #e6e8ef;
    font-family: ui-monospace, monospace;
    font-size: 0.78rem;
  }

  .hex:focus-visible {
    border-color: var(--c-border-focus);
  }
</style>
