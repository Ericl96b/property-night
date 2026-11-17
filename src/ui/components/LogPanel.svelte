<script lang="ts">
  // Read-only game log (newest first). Any controller can open it (Select).
  import type { State } from '../../engine';
  import ActionButton from './ActionButton.svelte';

  let { gs, onclose }: { gs: State; onclose: () => void } = $props();
  const lines = $derived([...gs.log].reverse());
</script>

<div class="dim"></div>
<div class="panel logp">
  <div class="title">Game log</div>
  <div class="lines">
    {#each lines as l, i (i)}
      <div class="line"><span class="t">Turn {l.turn}</span><span>{l.text}</span></div>
    {/each}
  </div>
  <ActionButton label="Close" glyph="back" onclick={onclose} />
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.5);
  }
  .logp {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 820px;
    height: 860px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .title {
    font: 800 34px/1 'Fraunces', serif;
  }
  .lines {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 10px;
    font: 500 17px/1.35 'Source Sans 3', sans-serif;
  }
  .t {
    color: var(--ink-2);
    font-weight: 600;
  }
</style>
