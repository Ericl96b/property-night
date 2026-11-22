<script lang="ts">
  // Pause menu (SPEC §9): resume, settings, forfeit (with confirm), new game, fullscreen.
  // Save slots and the rules reference join it in M9.
  import type { State } from '../../engine';
  import type { Settings } from '../../app/settings';
  import ActionButton from './ActionButton.svelte';
  import { layer } from '../menuStack';

  let {
    gs,
    settings,
    onsetting,
    onresume,
    onforfeit,
    onnewgame,
    onfullscreen,
    onsave,
    onbenchmark,
  }: {
    gs: State | null;
    settings: Settings;
    onsetting: (patch: Partial<Settings>) => void;
    onresume: () => void;
    onforfeit: (seat: number) => void;
    onnewgame: () => void;
    onfullscreen: () => void;
    onsave?: () => void;
    /** Settings → Performance → Run benchmark… (disabled during a game). */
    onbenchmark?: () => void;
  } = $props();

  const VOLUMES: { key: 'volumeMaster' | 'volumeMusic' | 'volumeEffects'; label: string }[] = [
    { key: 'volumeMaster', label: 'Volume' },
    { key: 'volumeMusic', label: 'Music' },
    { key: 'volumeEffects', label: 'Sound effects' },
  ];
  const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const BRIGHTNESS = [70, 80, 90, 100, 110, 120, 130];

  let confirm = $state<{ kind: 'forfeit'; seat: number } | { kind: 'new' } | null>(null);
  const humans = $derived(gs ? gs.seats.map((s, i) => ({ s, i })).filter(({ s, i }) => s.kind === 'human' && !gs.players[i].bankrupt) : []);
</script>

<div class="dim"></div>
<div class="panel pause">
  <div class="eyebrow">Paused</div>
  {#if confirm}
    <div class="confirm" use:layer={{ kind: 'dialog', close: () => (confirm = null) }}>
      {#if confirm.kind === 'forfeit'}
        <div class="q">Forfeit {gs?.seats[confirm.seat].name}? Their cash returns to the bank, buildings are sold back and every deed is auctioned.</div>
        <ActionButton label="Yes, forfeit" glyph="confirm" primary onclick={() => { const c = confirm; confirm = null; if (c?.kind === 'forfeit') onforfeit(c.seat); }} />
      {:else}
        <div class="q">Leave this game? It is autosaved, so Continue on the main menu brings it back.</div>
        <ActionButton label="Yes, quit to menu" glyph="confirm" primary onclick={() => { confirm = null; onnewgame(); }} />
      {/if}
      <ActionButton label="Cancel" glyph="back" onclick={() => (confirm = null)} />
    </div>
  {:else}
    <div class="cols">
      <div class="col">
        <ActionButton label="Resume" glyph="confirm" primary onclick={onresume} />
        {#if gs && onsave}<ActionButton label="Save game…" onclick={onsave} />{/if}
        <ActionButton label="Fullscreen" onclick={onfullscreen} />
        {#if gs && gs.phase !== 'gameOver'}
          {#each humans as h (h.i)}
            <ActionButton label={`Forfeit ${h.s.name}`} onclick={() => (confirm = { kind: 'forfeit', seat: h.i })} />
          {/each}
        {/if}
        {#if gs}<ActionButton label="Quit to menu" onclick={() => (confirm = { kind: 'new' })} />{/if}
      </div>
      <div class="col settings">
        <label>Speed
          <select value={settings.speed} onchange={(e) => onsetting({ speed: (e.currentTarget as HTMLSelectElement).value as Settings['speed'] })}>
            <option value="slow">Relaxed</option><option value="normal">Normal</option><option value="fast">Fast</option><option value="instant">Instant</option>
          </select>
        </label>
        <label>Quality
          <select value={settings.quality} onchange={(e) => onsetting({ quality: (e.currentTarget as HTMLSelectElement).value as Settings['quality'] })}>
            <option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option>
          </select>
        </label>
        <label>Ambient occlusion
          <select value={settings.ambientOcclusion ? 'on' : 'off'} onchange={(e) => onsetting({ ambientOcclusion: (e.currentTarget as HTMLSelectElement).value === 'on' })}>
            <option value="off">Off</option><option value="on">On</option>
          </select>
        </label>
        <label>Brightness
          <select value={String(Math.round(settings.brightness * 10) * 10)} onchange={(e) => onsetting({ brightness: Number((e.currentTarget as HTMLSelectElement).value) / 100 })}>
            {#each BRIGHTNESS as p}<option value={String(p)}>{p}%</option>{/each}
          </select>
        </label>
        <label>Tone mapping
          <select value={settings.toneMapping} onchange={(e) => onsetting({ toneMapping: (e.currentTarget as HTMLSelectElement).value as Settings['toneMapping'] })}>
            <option value="aces">Filmic (ACES)</option><option value="agx">AgX</option><option value="neutral">Neutral</option>
          </select>
        </label>
        {#each VOLUMES as v (v.key)}
          <label>{v.label}
            <select value={String(Math.round(settings[v.key] * 10) * 10)} onchange={(e) => onsetting({ [v.key]: Number((e.currentTarget as HTMLSelectElement).value) / 100 })}>
              {#each STEPS as p}<option value={String(p)}>{p === 0 ? 'Off' : `${p}%`}</option>{/each}
            </select>
          </label>
        {/each}
        <label class="chk"><input type="checkbox" checked={settings.boardRotation} onchange={(e) => onsetting({ boardRotation: (e.currentTarget as HTMLInputElement).checked })} /> Board rotation</label>
        <label class="chk"><input type="checkbox" checked={settings.cameraFollow} onchange={(e) => onsetting({ cameraFollow: (e.currentTarget as HTMLInputElement).checked })} /> Camera follow</label>
        <label class="chk"><input type="checkbox" checked={settings.undo} onchange={(e) => onsetting({ undo: (e.currentTarget as HTMLInputElement).checked })} /> Undo last decision</label>
        <label class="chk"><input type="checkbox" checked={settings.swapNintendo} onchange={(e) => onsetting({ swapNintendo: (e.currentTarget as HTMLInputElement).checked })} /> Swap Confirm/Back on Nintendo pads</label>
        <label class="chk"><input type="checkbox" checked={settings.everyPayment} onchange={(e) => onsetting({ everyPayment: (e.currentTarget as HTMLInputElement).checked })} /> Show bills for every payment</label>
        <label class="chk"><input type="checkbox" checked={settings.reduceMotion} onchange={(e) => onsetting({ reduceMotion: (e.currentTarget as HTMLInputElement).checked })} /> Reduce motion</label>
        <label>Big payment from $
          <input type="number" min="0" step="50" value={settings.bigPaymentAmount} onchange={(e) => onsetting({ bigPaymentAmount: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })} />
        </label>
        <label>…or % of the payer's cash
          <input type="number" min="0" max="100" step="5" value={settings.bigPaymentPercent} onchange={(e) => onsetting({ bigPaymentPercent: Math.min(100, Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0)) })} />
        </label>
        <div class="section">Performance</div>
        <label>Performance overlay
          <select value={settings.perfOverlay} onchange={(e) => onsetting({ perfOverlay: (e.currentTarget as HTMLSelectElement).value as Settings['perfOverlay'] })}>
            <option value="off">Off</option><option value="fps">FPS</option><option value="detailed">Detailed</option>
          </select>
        </label>
        <ActionButton label="Run benchmark…" disabled={!!gs || !onbenchmark} onclick={() => onbenchmark?.()} />
        {#if gs}<div class="note">Quit to menu to run the benchmark.</div>{/if}
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
  .settings {
    max-height: 760px;
    overflow-y: auto;
    padding-right: 8px;
  }
  .section {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1.5px solid rgba(43, 33, 25, 0.2);
    font: 700 13px 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .note {
    font: 600 15px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
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
