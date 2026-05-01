<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import MenuButton from "./ui/MenuButton.svelte";

  let { version = "" }: { version?: string } = $props();

  let aboutOpen = $state(false);
  let triggerEl = $state<HTMLButtonElement | undefined>(undefined);

  function openAbout(close: () => void) {
    close();
    aboutOpen = true;
  }
</script>

<MenuButton id="help-menu" label={t("help.label")} minWidth={160} bind:triggerEl>
  {#snippet items({ close })}
    <button class="menu-item" role="menuitem" onclick={() => openAbout(close)}>
      {t("about.title")}
    </button>
  {/snippet}
</MenuButton>

{#if aboutOpen}
  {#await import("./AboutDialog.svelte") then { default: AboutDialog }}
    <AboutDialog
      {version}
      onClose={() => {
        aboutOpen = false;
        triggerEl?.focus();
      }}
    />
  {/await}
{/if}
