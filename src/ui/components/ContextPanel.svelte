<script lang="ts">
  // Right column (SPEC §10.8): current tile card, action buttons with controller prompts,
  // recent log.
  import type { Action, State } from '../../engine';
  import ActionButton from './ActionButton.svelte';
  import Deed from './Deed.svelte';
  import { deedInfo, focusTile, phasePrompt, primaryButtons } from '../present';

  let {
    gs,
    actions,
    busy,
    actingName,
    error,
    onaction,
    extra,
  }: {
    gs: State;
    actions: Action[];
    busy: boolean;
    actingName: string | null;
    error: string | null;
    onaction: (a: Action) => void;
    extra?: import('svelte').Snippet;
  } = $props();

  const tile = $derived(focusTile(gs));
  const deed = $derived(gs.board.tiles[tile].price !== undefined ? deedInfo(gs, tile) : null);
  const buttons = $derived(primaryButtons(gs, actions));
  const log = $derived(gs.log.slice(-5).reverse());
</script>

<div class="panel context">
  <div class="prompt">{phasePrompt(gs)}</div>
  {#if deed}
    <div class="deed"><Deed {deed} scale={0.9} /></div>
  {:else}
    <div class="tile-name">{gs.board.tiles[tile].name}</div>
  {/if}
  {#if actingName && buttons.length}
    <div class="acting">{actingName}</div>
  {/if}
  <div class="actions">
    {#each buttons as b (b.label)}
      <ActionButton label={b.label} glyph={b.glyph} primary={b.primary} disabled={busy} onclick={() => onaction(b.action)} />
    {/each}
    {#if extra}{@render extra()}{/if}
  </div>
  {#if error}<div class="error">{error}</div>{/if}
  <div class="log">
    {#each log as l, i (l.turn + ':' + i + l.text)}
      <div style="opacity:{1 - i * 0.16}">{l.text}</div>
    {/each}
  </div>
</div>

<style>
  .context {
    right: 32px;
    top: 32px;
    bottom: 32px;
    width: 340px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .prompt {
    font: 800 24px/1.15 'Fraunces', serif;
    font-variation-settings: 'opsz' 48;
  }
  .deed {
    display: flex;
    justify-content: center;
  }
  .tile-name {
    font: 700 20px/1.2 'Fraunces', serif;
    color: var(--ink-2);
  }
  .acting {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .error {
    font: 600 15px/1.3 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
  .log {
    margin-top: auto;
    font: 500 15px/1.4 'Source Sans 3', sans-serif;
    border-top: 1px solid rgba(43, 33, 25, 0.15);
    padding-top: 10px;
  }
</style>
