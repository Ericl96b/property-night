<script lang="ts">
  // Main menu (SPEC §9): Continue, New game, Load, Import; settings live in the pause menu.
  import { onMount } from 'svelte';
  import type { SaveFile, Saves } from '../../app/saves';
  import ActionButton from './ActionButton.svelte';
  import { layer } from '../menuStack';

  let {
    saves,
    oncontinue,
    onnew,
    onload,
    onimport,
    onsettings,
    ontestboard,
    onsoundtest,
  }: {
    saves: Saves;
    oncontinue: () => void;
    onnew: () => void;
    onload: (f: SaveFile) => void;
    onimport: (text: string) => string | null;
    onsettings: () => void;
    ontestboard: () => void;
    /** Dev builds only (audio Phase 0 §9). */
    onsoundtest?: () => void;
  } = $props();

  let canContinue = $state(false);
  let list = $state<SaveFile[]>([]);
  let loading = $state(false);
  let message = $state<string | null>(null);
  let fileInput: HTMLInputElement;

  async function refresh() {
    canContinue = !!(await saves.continueGame());
    list = await saves.slots();
  }
  onMount(() => void refresh());

  async function importFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    message = onimport(await file.text());
    (e.currentTarget as HTMLInputElement).value = '';
  }
  const when = (t: number) => new Date(t).toLocaleString();
</script>

<div class="panel menu">
  <h1>Property Night</h1>
  {#if !loading}
    <div class="buttons">
      {#if canContinue}<ActionButton label="Continue" glyph="confirm" primary onclick={oncontinue} />{/if}
      <ActionButton label="New game" glyph={canContinue ? undefined : 'confirm'} primary={!canContinue} onclick={onnew} />
      <ActionButton label="Load game" disabled={!list.length} onclick={() => (loading = true)} />
      <ActionButton label="Test board" onclick={ontestboard} />
      {#if import.meta.env.DEV && onsoundtest}<ActionButton label="Sound test" onclick={onsoundtest} />{/if}
      <ActionButton label="Import save…" onclick={() => fileInput.click()} />
      <ActionButton label="Settings" onclick={onsettings} />
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importFile} />
    </div>
  {:else}
    <div class="layer" use:layer={{ kind: 'menu', close: () => (loading = false) }}>
    <div class="slots">
      {#each list as f (f.id)}
        <div class="slot">
          <button class="load" onclick={() => onload(f)}>
            <b>{f.name}</b><span>{f.summary}</span><span class="t">{when(f.updatedAt)}</span>
          </button>
          <button class="link" onclick={async () => { await saves.remove(f.id); await refresh(); }}>Delete</button>
        </div>
      {/each}
    </div>
    <ActionButton label="Back" glyph="back" onclick={() => (loading = false)} />
    </div>
  {/if}
  {#if message}<div class="msg">{message}</div>{/if}
</div>

<style>
  .menu {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 620px;
    padding: 36px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  h1 {
    margin: 0;
    text-align: center;
    font: 800 64px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 144;
  }
  .buttons,
  .slots {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .slots {
    max-height: 640px;
    overflow-y: auto;
  }
  .slot {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .load {
    flex: 1;
    display: grid;
    gap: 2px;
    text-align: left;
    padding: 10px 14px;
    border: 0;
    border-radius: 10px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.18);
    font: 600 16px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .load b {
    font: 700 20px 'Fraunces', serif;
  }
  .t {
    color: var(--ink-2);
    font-size: 14px;
  }
  .link {
    border: 0;
    background: none;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
    cursor: pointer;
  }
  .msg {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
</style>
