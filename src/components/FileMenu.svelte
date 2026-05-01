<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import MenuButton from "./ui/MenuButton.svelte";

  let {
    onOpenFile,
    onCloseFile,
    onAppSettings,
    canClose = false,
  }: {
    onOpenFile: () => void;
    onCloseFile: () => void;
    onAppSettings: () => void;
    canClose?: boolean;
  } = $props();
</script>

<MenuButton id="file-menu" label={t("titlebar.file")} minWidth={180}>
  {#snippet items({ close })}
    <button
      class="menu-item"
      role="menuitem"
      onclick={() => {
        close();
        onOpenFile();
      }}
    >
      {t("titlebar.open_file")}
    </button>
    <button
      class="menu-item"
      role="menuitem"
      onclick={() => {
        if (!canClose) return;
        close();
        onCloseFile();
      }}
      disabled={!canClose}
    >
      {t("titlebar.close_file")}
    </button>
    <div class="menu-separator" role="separator"></div>
    <button
      class="menu-item"
      role="menuitem"
      onclick={() => {
        close();
        onAppSettings();
      }}
    >
      {t("titlebar.app_settings")}
    </button>
  {/snippet}
</MenuButton>
