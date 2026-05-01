<script lang="ts">
  let {
    label,
    checked = $bindable(),
    disabled = false
  }: {
    label?: string;
    checked: boolean;
    disabled?: boolean;
  } = $props();
</script>

<label class="toggle" class:disabled>
  <div class="track" class:on={checked}>
    <div class="thumb"></div>
  </div>
  {#if label}<span>{label}</span>{/if}
  <input
    type="checkbox"
    bind:checked
    {disabled}
    class="sr-only"
  />
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
    cursor: pointer;
    font-size: var(--fs-sm);
    color: var(--c-text);
  }

  .toggle.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .track {
    position: relative;
    width: 32px;
    height: 18px;
    background: var(--c-border);
    border-radius: 9px;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .track.on {
    background: var(--c-accent);
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--c-text);
    border-radius: 50%;
    transition: transform 0.15s;
  }

  .track.on .thumb {
    transform: translateX(14px);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
