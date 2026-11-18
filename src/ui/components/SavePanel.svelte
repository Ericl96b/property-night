<script lang="ts">
  // Save into one of 10 named slots, or export the game as JSON (SPEC §9).
  import { onMount } from 'svelte';
  import { MAX_SLOTS, type SaveFile, type Saves } from '../../app/saves';
  import ActionButton from './ActionButton.svelte';

  let { saves, onsave, onexport, onclose }: { saves: Saves; onsave: (slot: number, name: string) => Promise<void>; onexport: () => void; onclose: () => void } = $props();

  let existing = $state<Record<number, SaveFile>>({});
  let names = $state<Record<number, string>>({});
  let message = $state<string | null>(null);

  async function refresh() {
    const map: Record<number, SaveFile> = {};
    for (const f of await saves.slots()) map[Number(f.id.replace('slot-', ''))] = f;
    existing = map;
  }
  onMount(() => void refresh());
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1);
</script>

<div class="dim"></div>
<div class="panel savep">
  <div class="title">Save game</div>
  <div class="list">
    {#each slots as n}
      <div class="row">
        <span class="no">{n}</span>
        <input value={names[n] ?? existing[n]?.name ?? `Game ${n}`} oninput={(e) => (names = { ...names, [n]: (e.currentTarget as HTMLInputElement).value })} aria-label="Slot {n} name" />
        <span class="info">{existing[n] ? existing[n].summary : 'Empty'}</span>
        <button class="op" onclick={async () => { await onsave(n, (names[n] ?? existing[n]?.name ?? `Game ${n}`).trim() || `Game ${n}`); message = `Saved to slot ${n}`; await refresh(); }}>{existing[n] ? 'Overwrite' : 'Save'}</button>
      </div>
    {/each}
  </div>
  {#if message}<div class="msg">{message}</div>{/if}
  <div class="foot">
    <ActionButton label="Export save file" onclick={onexport} />
    <ActionButton label="Close" glyph="back" onclick={onclose} />
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.6);
  }
  .savep {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 960px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .title {
    font: 800 36px/1 'Fraunces', serif;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 30px 260px 1fr 130px;
    gap: 10px;
    align-items: center;
    font: 600 16px 'Source Sans 3', sans-serif;
  }
  .no {
    font: 800 20px 'Fraunces', serif;
  }
  input {
    height: 42px;
    font: 600 16px 'Source Sans 3', sans-serif;
    padding: 0 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
  }
  .info {
    color: var(--ink-2);
  }
  .op {
    height: 44px;
    border: 0;
    border-radius: 8px;
    background: var(--forest);
    color: var(--paper-hi);
    font: 700 16px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .msg {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--forest);
  }
  .foot {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
</style>
