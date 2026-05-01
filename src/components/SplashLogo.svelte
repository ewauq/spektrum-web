<script lang="ts">
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { sampleColormapHex } from "$lib/colormap";

  let {
    gradientId = "splashLogoGrad",
  }: { gradientId?: string } = $props();

  // Four colormap stops sampled and applied as a vertical gradient on
  // the waveform stroke. Reactive: changing the active colormap re-tints
  // the logo live.
  const stops = $derived(
    [0.15, 0.4, 0.65, 0.9].map((t) =>
      sampleColormapHex(
        settingsStore.colormap,
        t,
        settingsStore.customStops,
      ),
    ),
  );
</script>

<svg
  class="splash-logo-svg"
  viewBox="0 0 48.461617 38.258739"
  fill="none"
  aria-hidden="true"
  preserveAspectRatio="xMidYMid meet"
>
  <defs>
    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color={stops[0]} />
      <stop offset="35%" stop-color={stops[1]} />
      <stop offset="70%" stop-color={stops[2]} />
      <stop offset="100%" stop-color={stops[3]} />
    </linearGradient>
  </defs>
  <g transform="translate(-78.798005,-40.214228)">
    <path
      d="m 80.798005,62.904286 3.492071,-10e-6 3.4674,-5.56295 3.337081,7.78652 3.33708,-10.67865 2.89213,14.46067 6.674163,-26.69663 3.11461,34.26068 5.5618,-21.13484 4.44943,13.34832 3.55956,-5.78427 4.57629,-0.0393"
      stroke="url(#{gradientId})"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>
</svg>

<style>
  .splash-logo-svg {
    width: min(60vw, 280px);
    height: auto;
    display: block;
  }
</style>
