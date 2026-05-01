<script lang="ts" module>
  import type { Snippet } from "svelte";

  export type CellRender =
    | {
        kind: "text";
        value: string;
        mono?: boolean;
        dim?: boolean;
        bold?: boolean;
      }
    | { kind: "link"; value: string; onClick: () => void }
    | {
        kind: "gauge";
        value: number;
        max: number;
        suffix?: string;
        hue?: number;
      }
    | {
        kind: "peak";
        time: string;
        freq: string;
        note?: string | null;
        onTimeClick?: () => void;
        timeTitle?: string;
      }
    | { kind: "snippet"; render: Snippet };

  export type InfoRow =
    | { kind: "row"; key: string; cell: CellRender }
    | { kind: "subheader"; label: string }
    | { kind: "hint"; text: string }
    | { kind: "wide"; render: Snippet };
</script>

<script lang="ts">
  let { rows }: { rows: InfoRow[] } = $props();

  // Pre-compute zebra index ignoring non-row entries.
  const decorated = $derived.by(() => {
    let dataIdx = 0;
    return rows.map((row) => {
      if (row.kind === "row") {
        const zebra = dataIdx % 2 === 1;
        dataIdx += 1;
        return { row, zebra };
      }
      return { row, zebra: false };
    });
  });
</script>

<dl class="info-table">
  {#each decorated as entry, i (i)}
    {@const row = entry.row}
    {#if row.kind === "row"}
      <div class="row" class:zebra={entry.zebra} role="group">
        <dt class="key">{row.key}</dt>
        <dd
          class="val"
          class:mono={row.cell.kind === "text" && row.cell.mono}
          class:dim={row.cell.kind === "text" && row.cell.dim}
          class:bold={row.cell.kind === "text" && row.cell.bold}
          class:text={row.cell.kind === "text" &&
            !row.cell.mono &&
            !row.cell.bold}
          class:link-cell={row.cell.kind === "link"}
        >
          {#if row.cell.kind === "text"}
            {row.cell.value}
          {:else if row.cell.kind === "link"}
            <button class="link" onclick={row.cell.onClick}
              >{row.cell.value}</button
            >
          {:else if row.cell.kind === "gauge"}
            <div class="gauge">
              <div class="bar-bg">
                <div
                  class="bar-fill"
                  style:width="{Math.max(
                    0,
                    Math.min(100, (row.cell.value / row.cell.max) * 100),
                  )}%"
                  style:background={row.cell.hue !== undefined
                    ? `hsl(${row.cell.hue}, 75%, 50%)`
                    : "var(--c-accent)"}
                ></div>
              </div>
              <span
                class="gauge-text mono"
                style:color={row.cell.hue !== undefined
                  ? `hsl(${row.cell.hue}, 75%, 60%)`
                  : "var(--c-text)"}
                >{row.cell.value.toFixed(1)}{row.cell.suffix ?? ""}</span
              >
            </div>
          {:else if row.cell.kind === "peak"}
            <span class="mono">
              {#if row.cell.onTimeClick}
                <button
                  class="peak-time"
                  onclick={row.cell.onTimeClick}
                  title={row.cell.timeTitle}>{row.cell.time}</button
                >
              {:else}
                {row.cell.time}
              {/if}
              · {row.cell.freq}{#if row.cell.note}
                ({row.cell.note}){/if}
            </span>
          {:else if row.cell.kind === "snippet"}
            {@render row.cell.render()}
          {/if}
        </dd>
      </div>
    {:else if row.kind === "subheader"}
      <h4 class="subheader">{row.label}</h4>
    {:else if row.kind === "hint"}
      <p class="hint">{row.text}</p>
    {:else if row.kind === "wide"}
      <div class="wide">{@render row.render()}</div>
    {/if}
  {/each}
</dl>

<style>
  .info-table {
    display: grid;
    grid-template-columns: minmax(96px, max-content) 1fr;
    font-size: var(--fs-sm);
    margin: 0;
    padding: 0;
  }

  .row {
    display: contents;
  }

  .row > .key,
  .row > .val {
    padding: 6px var(--sp-md);
    margin: 0;
    transition: background-color 0.1s ease;
  }

  .row.zebra > .key,
  .row.zebra > .val {
    background: rgba(255, 255, 255, 0.025);
  }

  .row:hover > .key,
  .row:hover > .val {
    background: rgba(255, 255, 255, 0.04);
  }

  .key {
    color: var(--c-text-muted);
    white-space: nowrap;
    font-weight: 400;
  }

  .val {
    color: var(--c-text);
    word-break: break-word;
    min-width: 0;
  }

  .val.mono {
    font-family: var(--font-mono);
  }

  .val.bold {
    font-weight: 500;
    text-align: left;
  }

  .val.dim {
    color: var(--c-text-dim);
  }

  .val.text {
    text-align: left;
  }

  .val.link-cell {
    text-align: left;
  }

  .link {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: transparent;
    transition:
      color 0.15s ease,
      text-decoration-color 0.15s ease;
    word-break: break-all;
  }

  .link:hover {
    color: var(--c-accent);
    text-decoration-color: var(--c-accent);
  }

  .peak-time {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
    text-decoration: underline dotted;
    text-decoration-color: var(--c-text-dim);
    text-underline-offset: 3px;
    transition:
      color 0.15s ease,
      text-decoration-color 0.15s ease;
  }

  .peak-time:hover {
    color: var(--c-accent);
    text-decoration-color: var(--c-accent);
  }

  .peak-time:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
    border-radius: var(--r-sm);
  }

  .link:focus-visible {
    outline: 2px solid var(--c-accent);
    outline-offset: 2px;
    border-radius: var(--r-sm);
  }

  .subheader {
    grid-column: 1 / -1;
    margin: var(--sp-lg) 0 var(--sp-xs);
    padding: 0 var(--sp-md);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .subheader:first-child {
    margin-top: 0;
  }

  .hint {
    grid-column: 1 / -1;
    margin: var(--sp-xs) 0 0;
    padding: 0 var(--sp-md);
    font-size: var(--fs-sm);
    color: var(--c-text-dim);
    font-style: italic;
  }

  .wide {
    grid-column: 1 / -1;
    padding: 6px var(--sp-md);
  }

  .gauge {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
  }

  .bar-bg {
    flex: 1;
    height: 6px;
    background: var(--c-border);
    border-radius: var(--r-sm);
    overflow: hidden;
    min-width: 40px;
  }

  .bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .gauge-text {
    font-size: var(--fs-sm);
    flex-shrink: 0;
  }
</style>
