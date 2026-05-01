<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { uiStore } from "$lib/stores/ui.svelte";
  import MenuButton from "./ui/MenuButton.svelte";

  let {
    viewWaveform = $bindable(false),
    disabled = false,
  }: {
    viewWaveform?: boolean;
    disabled?: boolean;
  } = $props();
</script>

<MenuButton id="view-menu" label={t("titlebar.view")} minWidth={220}>
  {#snippet items({ close })}
    <button
      class="menu-item checked-row"
      role="menuitemcheckbox"
      aria-checked={viewWaveform}
      onclick={() => {
        if (disabled) return;
        close();
        viewWaveform = !viewWaveform;
      }}
      {disabled}
    >
      <span class="menu-check" aria-hidden="true">
        {#if viewWaveform}{@render checkIcon()}{/if}
      </span>
      <span>{t("titlebar.show_waveform")}</span>
      <span class="menu-shortcut">W</span>
    </button>
    <button
      class="menu-item checked-row"
      role="menuitemcheckbox"
      aria-checked={uiStore.showStatusBar}
      onclick={() => {
        if (disabled) return;
        close();
        uiStore.showStatusBar = !uiStore.showStatusBar;
      }}
      {disabled}
    >
      <span class="menu-check" aria-hidden="true">
        {#if uiStore.showStatusBar}{@render checkIcon()}{/if}
      </span>
      <span>{t("titlebar.show_status_bar")}</span>
    </button>
  {/snippet}
</MenuButton>

{#snippet checkIcon()}
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
{/snippet}

