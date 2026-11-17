<script lang="ts">
  // Pause menu (SPEC §9): resume, settings, forfeit (with confirm), new game, fullscreen.
  // Save slots and the rules reference join it in M9.
  import type { State } from '../../engine';
  import type { Settings } from '../../app/settings';
  import ActionButton from './ActionButton.svelte';

  let {
    gs,
    settings,
    onsetting,
    onresume,
    onforfeit,
    onnewgame,
    onfullscreen,
  }: {
    gs: State | null;
    settings: Settings;
    onsetting: (patch: Partial<Settings>) => void;
    onresume: () => void;
    onforfeit: (seat: number) => void;
    onnewgame: () => void;
    onfullscreen: () => void;
  } = $props();

  let confirm = $state<{ kind: 'forfeit'; seat: number } | { kind: 'new' } | null>(null);
  const humans = $derived(gs ? gs.seats.map((s, i) => ({ s, i })).filter(({ s, i }) => s.kind === 'human' && !gs.players[i].bankrupt) : []);
</script>

<div class="dim"></div>
<div class="panel pause">
  <div class="eyebrow">Paused</div>
  {#if confirm}
    <div class="confirm">
      {#if confirm.kind === 'forfeit'}
        <div class="q">Forfeit {gs?.seats[confirm.seat].name}? Their cash returns to the bank, buildings are sold back and every deed is auctioned.</div>
        <ActionButton label="Yes, forfeit" glyph="confirm" primary onclick={() => { const c = confirm; confirm = null; if (c?.kind === 'forfeit') onforfeit(c.seat); }} />
      {:else}
        <div class="q">Leave this game and start a new one? The current game is not saved yet (saving arrives with save slots).</div>
        <ActionButton label="Yes, new game" glyph="confirm" primary onclick={() => { confirm = null; onnewgame(); }} />
      {/if}
      <ActionButton label="Cancel" glyph="back" onclick={() => (confirm = null)} />
    </div>
  {:else}
    <div class="cols">
      <div class="col">
        <ActionButton label="Resume" glyph="confirm" primary onclick={onresume} />
        <ActionButton label="Fullscreen" onclick={onfullscreen} />
        {#if gs && gs.phase !== 'gameOver'}
          {#each humans as h (h.i)}
            <ActionButton label={`Forfeit ${h.s.name}`} onclick={() => (confirm = { kind: 'forfeit', seat: h.i })} />
          {/each}
        {/if}
        <ActionButton label="New game" onclick={() => (confirm = { kind: 'new' })} />
      </div>
      <div class="col settings">
        <label>Speed
          <select value={settings.speed} onchange={(e) => onsetting({ speed: (e.currentTarget as HTMLSelectElement).value as Settings['speed'] })}>
            <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option><option value="instant">Instant</option>
          </select>
        </label>
        <label>Quality
          <select value={settings.quality} onchange={(e) => onsetting({ quality: (e.currentTarget as HTMLSelectElement).value as Settings['quality'] })}>
            <option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option>
          </select>
        </label>
        <label class="chk"><input type="checkbox" checked={settings.boardRotation} onchange={(e) => onsetting({ boardRotation: (e.currentTarget as HTMLInputElement).checked })} /> Board rotation</label>
        <label class="chk"><input type="checkbox" checked={settings.cameraFollow} onchange={(e) => onsetting({ cameraFollow: (e.currentTarget as HTMLInputElement).checked })} /> Camera follow</label>
        <label class="chk"><input type="checkbox" checked={settings.reduceMotion} onchange={(e) => onsetting({ reduceMotion: (e.currentTarget as HTMLInputElement).checked })} /> Reduce motion</label>
        <label>Big payment from $
          <input type="number" min="0" step="50" value={settings.bigPaymentAmount} onchange={(e) => onsetting({ bigPaymentAmount: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })} />
        </label>
        <label>…or % of the payer's cash
          <input type="number" min="0" max="100" step="5" value={settings.bigPaymentPercent} onchange={(e) => onsetting({ bigPaymentPercent: Math.min(100, Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0)) })} />
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.6);
  }
  .pause {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 900px;
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .eyebrow {
    font: 800 40px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .settings label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font: 600 17px/1.2 'Source Sans 3', sans-serif;
    min-height: 44px;
  }
  .settings .chk {
    justify-content: flex-start;
  }
  select,
  input[type='number'] {
    height: 40px;
    width: 140px;
    font: 600 17px 'Source Sans 3', sans-serif;
    padding: 0 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
  }
  input[type='checkbox'] {
    width: 22px;
    height: 22px;
    accent-color: var(--forest);
  }
  .confirm {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .q {
    font: 600 20px/1.4 'Source Sans 3', sans-serif;
  }
</style>
