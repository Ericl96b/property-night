<script lang="ts">
  // Board and card editors (SPEC §8): per tile name/price/rents/house cost/mortgage, per group
  // color and scaling, railroad and utility values; Chance and Community Chest cards (text +
  // one effect). Classic is read-only (duplicate to edit). Edits autosave.
  import { onMount } from 'svelte';
  import type { Card, CardEffect, DeckId } from '../../engine';
  import type { GroupId } from '../../data/classicBoard';
  import { boardWarnings, deckWarnings, scaleGroup, type BoardPreset, type BoardPresets } from '../../app/boardPresets';
  import { downloadText } from '../../app/presets';
  import ActionButton from './ActionButton.svelte';

  let { presets, selectedId, onselect, onclose }: { presets: BoardPresets; selectedId: string; onselect: (id: string) => void; onclose: () => void } = $props();

  let list = $state<BoardPreset[]>([]);
  let cur = $state<BoardPreset | null>(null);
  let tab = $state<'board' | DeckId>('board');
  let message = $state<string | null>(null);
  let renaming = $state(false);
  let scales = $state<Record<string, number>>({});
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let fileInput: HTMLInputElement;

  async function refresh(id?: string) {
    list = await presets.list();
    const want = id ?? cur?.id ?? selectedId;
    cur = $state.snapshot(list.find((p) => p.id === want) ?? list[0]) as BoardPreset;
  }
  onMount(() => void refresh(selectedId));

  const ro = $derived(!cur || !!cur.builtIn);
  function changed() {
    if (!cur || cur.builtIn) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!cur) return;
      const saved = await presets.save($state.snapshot(cur) as BoardPreset);
      message = 'Saved';
      list = await presets.list();
      void saved;
    }, 300);
  }
  const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const txt = (e: Event) => (e.currentTarget as HTMLInputElement).value;

  async function duplicate() {
    if (!cur) return;
    const p = await presets.duplicate($state.snapshot(cur) as BoardPreset);
    await refresh(p.id);
    message = `Created “${p.name}”`;
  }
  async function remove() {
    if (!cur || cur.builtIn) return;
    await presets.remove(cur);
    if (selectedId === cur.id) onselect('classic-board');
    cur = null;
    await refresh('classic-board');
  }
  async function importFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const p = await presets.importJSON(await file.text());
      await refresh(p.id);
      message = `Imported “${p.name}”`;
    } catch (err) {
      message = (err as Error).message;
    }
    (e.currentTarget as HTMLInputElement).value = '';
  }

  const groups = $derived(cur ? (Object.keys(cur.board.groups) as GroupId[]) : []);
  const warnings = $derived(cur ? (tab === 'board' ? boardWarnings(cur.board) : deckWarnings(cur.decks[tab])) : []);
  const tileOptions = $derived(cur ? cur.board.tiles.map((t) => ({ i: t.index, name: t.name })) : []);

  const KINDS: { kind: CardEffect['kind']; label: string }[] = [
    { kind: 'collect', label: 'Collect $X' },
    { kind: 'pay', label: 'Pay $X' },
    { kind: 'collectFromEach', label: 'Collect $X from each player' },
    { kind: 'payEach', label: 'Pay each player $X' },
    { kind: 'moveTo', label: 'Move to a tile' },
    { kind: 'nearestRailroad', label: 'Nearest railroad (pay 2×)' },
    { kind: 'nearestUtility', label: 'Nearest utility (pay 10× dice)' },
    { kind: 'back', label: 'Go back N spaces' },
    { kind: 'goToJail', label: 'Go to jail' },
    { kind: 'getOutOfJail', label: 'Get Out of Jail Free' },
    { kind: 'repairs', label: 'Pay per house / hotel' },
  ];
  function setKind(card: Card, kind: CardEffect['kind']) {
    const defaults: Record<string, CardEffect> = {
      collect: { kind: 'collect', amount: 50 },
      pay: { kind: 'pay', amount: 50 },
      collectFromEach: { kind: 'collectFromEach', amount: 10 },
      payEach: { kind: 'payEach', amount: 50 },
      moveTo: { kind: 'moveTo', tile: 0 },
      back: { kind: 'back', spaces: 3 },
      repairs: { kind: 'repairs', perHouse: 25, perHotel: 100 },
    };
    card.effect = defaults[kind] ?? ({ kind } as CardEffect);
    changed();
  }
</script>

<div class="dim"></div>
<div class="panel boards">
  <div class="side">
    <div class="eyebrow">Board presets</div>
    {#each list as p (p.id)}
      <button class="preset" class:sel={cur?.id === p.id} onclick={() => { cur = $state.snapshot(p) as BoardPreset; renaming = false; message = null; }}>
        {p.name}{#if p.builtIn}<span class="ro">built-in</span>{/if}{#if p.id === selectedId}<span class="use">in use</span>{/if}
      </button>
    {/each}
    <div class="sideacts">
      <button class="link" onclick={duplicate}>Duplicate</button>
      <button class="link" onclick={() => fileInput.click()}>Import…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importFile} />
    </div>
  </div>
  {#if cur}
    <div class="main">
      <div class="head">
        {#if renaming && !ro}
          <input class="name" value={cur.name} onchange={async (e) => { await presets.rename($state.snapshot(cur!) as BoardPreset, txt(e)); renaming = false; await refresh(cur!.id); }} />
        {:else}
          <h2>{cur.name}</h2>
        {/if}
        <div class="acts">
          {#if !ro}<button class="link" onclick={() => (renaming = !renaming)}>Rename</button><button class="link" onclick={remove}>Delete</button>{/if}
          <button class="link" onclick={() => downloadText(`${cur!.name.replace(/[^\w-]+/g, '-')}.board.json`, presets.exportJSON(cur!))}>Export</button>
        </div>
      </div>
      <div class="tabs">
        <button class:on={tab === 'board'} onclick={() => (tab = 'board')}>Board</button>
        <button class:on={tab === 'chance'} onclick={() => (tab = 'chance')}>Chance</button>
        <button class:on={tab === 'chest'} onclick={() => (tab = 'chest')}>Community Chest</button>
      </div>
      {#if ro}<div class="note">The built-in board. Read-only — duplicate it to make your own.</div>{/if}
      {#if message}<div class="note ok">{message}</div>{/if}
      {#each warnings as w}<div class="note warn">{w}</div>{/each}
      <div class="body">
        {#if tab === 'board'}
          <div class="sec">Center emblem</div>
          <div class="grid2">
            <label>Title <input value={cur.board.title} disabled={ro} oninput={(e) => { cur!.board.title = txt(e); changed(); }} /></label>
            <label>Subtitle <input value={cur.board.subtitle} disabled={ro} oninput={(e) => { cur!.board.subtitle = txt(e); changed(); }} /></label>
          </div>
          <div class="sec">Color groups</div>
          {#each groups as g}
            <div class="grp">
              <input type="color" value={cur.board.groups[g].color} disabled={ro} oninput={(e) => { cur!.board.groups[g].color = txt(e).toUpperCase(); changed(); }} aria-label="{g} color" />
              <span class="gname">{g}</span>
              <label class="chk"><input type="checkbox" checked={cur.board.groups[g].lightText} disabled={ro} onchange={(e) => { cur!.board.groups[g].lightText = (e.currentTarget as HTMLInputElement).checked; changed(); }} /> Light text</label>
              <label class="chk">Scale <input type="number" min="10" max="1000" step="5" value={scales[g] ?? 100} disabled={ro} oninput={(e) => (scales = { ...scales, [g]: num(e) })} />%</label>
              <button class="link" disabled={ro} onclick={() => { scaleGroup(cur!.board, g, (scales[g] ?? 100) / 100); scales = { ...scales, [g]: 100 }; changed(); }}>Apply</button>
            </div>
          {/each}
          <div class="sec">Streets <span class="hint">price · rent / 1–4 houses / hotel · house cost · mortgage</span></div>
          {#each cur.board.tiles.filter((t) => t.type === 'street') as t (t.index)}
            <div class="street">
              <span class="chip" style="background:{cur.board.groups[t.group!].color}"></span>
              <input class="tname" value={t.name} disabled={ro} oninput={(e) => { t.name = txt(e); changed(); }} aria-label="Name" />
              <input type="number" value={t.price} disabled={ro} oninput={(e) => { t.price = num(e); changed(); }} aria-label="Price" />
              {#each t.rents! as _, k}
                <input type="number" value={t.rents![k]} disabled={ro} oninput={(e) => { t.rents![k] = num(e); changed(); }} aria-label="Rent {k}" />
              {/each}
              <input type="number" value={t.houseCost} disabled={ro} oninput={(e) => { t.houseCost = num(e); changed(); }} aria-label="House cost" />
              <input type="number" value={t.mortgage} disabled={ro} oninput={(e) => { t.mortgage = num(e); changed(); }} aria-label="Mortgage" />
            </div>
          {/each}
          <div class="sec">Railroads <span class="hint">price · rent with 1 / 2 / 3 / 4 owned · mortgage</span></div>
          {#each cur.board.tiles.filter((t) => t.type === 'railroad') as t (t.index)}
            <div class="street rr">
              <input class="tname" value={t.name} disabled={ro} oninput={(e) => { t.name = txt(e); changed(); }} aria-label="Name" />
              <input type="number" value={t.price} disabled={ro} oninput={(e) => { t.price = num(e); changed(); }} aria-label="Price" />
              {#each t.rents! as _, k}<input type="number" value={t.rents![k]} disabled={ro} oninput={(e) => { t.rents![k] = num(e); changed(); }} aria-label="Rent {k}" />{/each}
              <input type="number" value={t.mortgage} disabled={ro} oninput={(e) => { t.mortgage = num(e); changed(); }} aria-label="Mortgage" />
            </div>
          {/each}
          <div class="sec">Utilities <span class="hint">price · mortgage</span></div>
          {#each cur.board.tiles.filter((t) => t.type === 'utility') as t (t.index)}
            <div class="street ut">
              <input class="tname" value={t.name} disabled={ro} oninput={(e) => { t.name = txt(e); changed(); }} aria-label="Name" />
              <input type="number" value={t.price} disabled={ro} oninput={(e) => { t.price = num(e); changed(); }} aria-label="Price" />
              <input type="number" value={t.mortgage} disabled={ro} oninput={(e) => { t.mortgage = num(e); changed(); }} aria-label="Mortgage" />
            </div>
          {/each}
          <div class="grid2">
            <label>Rent × dice, one utility <input type="number" value={cur.board.utilityMultipliers?.[0] ?? 4} disabled={ro} oninput={(e) => { cur!.board.utilityMultipliers = [num(e), cur!.board.utilityMultipliers?.[1] ?? 10]; changed(); }} /></label>
            <label>Rent × dice, both utilities <input type="number" value={cur.board.utilityMultipliers?.[1] ?? 10} disabled={ro} oninput={(e) => { cur!.board.utilityMultipliers = [cur!.board.utilityMultipliers?.[0] ?? 4, num(e)]; changed(); }} /></label>
          </div>
          <div class="sec">Taxes <span class="hint">amounts are set in the rules (Income Tax, Luxury Tax)</span></div>
          {#each cur.board.tiles.filter((t) => t.type === 'tax') as t (t.index)}
            <div class="street ut"><input class="tname" value={t.name} disabled={ro} oninput={(e) => { t.name = txt(e); changed(); }} aria-label="Name" /></div>
          {/each}
        {:else}
          {#each cur.decks[tab] as card, i}
            <div class="card">
              <textarea rows="2" value={card.text} disabled={ro} oninput={(e) => { card.text = (e.currentTarget as HTMLTextAreaElement).value; changed(); }} aria-label="Card text"></textarea>
              <div class="eff">
                <select value={card.effect.kind} disabled={ro} onchange={(e) => setKind(card, (e.currentTarget as HTMLSelectElement).value as CardEffect['kind'])} aria-label="Effect">
                  {#each KINDS as k}<option value={k.kind}>{k.label}</option>{/each}
                </select>
                {#if 'amount' in card.effect}
                  <label>$ <input type="number" value={card.effect.amount} disabled={ro} oninput={(e) => { (card.effect as { amount: number }).amount = num(e); changed(); }} /></label>
                {:else if card.effect.kind === 'moveTo'}
                  <select value={card.effect.tile} disabled={ro} onchange={(e) => { (card.effect as { tile: number }).tile = Number((e.currentTarget as HTMLSelectElement).value); changed(); }} aria-label="Tile">
                    {#each tileOptions as o}<option value={o.i}>{o.name}</option>{/each}
                  </select>
                {:else if card.effect.kind === 'back'}
                  <label><input type="number" value={card.effect.spaces} disabled={ro} oninput={(e) => { (card.effect as { spaces: number }).spaces = num(e); changed(); }} /> spaces</label>
                {:else if card.effect.kind === 'repairs'}
                  <label>$ <input type="number" value={card.effect.perHouse} disabled={ro} oninput={(e) => { (card.effect as { perHouse: number }).perHouse = num(e); changed(); }} /> / house</label>
                  <label>$ <input type="number" value={card.effect.perHotel} disabled={ro} oninput={(e) => { (card.effect as { perHotel: number }).perHotel = num(e); changed(); }} /> / hotel</label>
                {/if}
                {#if !ro}<button class="link" onclick={() => { cur!.decks[tab as DeckId].splice(i, 1); changed(); }}>Remove</button>{/if}
              </div>
            </div>
          {/each}
          {#if !ro}<button class="link" onclick={() => { cur!.decks[tab as DeckId].push({ text: 'New card. Collect $50.', effect: { kind: 'collect', amount: 50 } }); changed(); }}>+ Add card</button>{/if}
        {/if}
      </div>
      <div class="foot">
        <ActionButton label="Use this board" glyph="confirm" primary onclick={() => { onselect(cur!.id); onclose(); }} />
        <ActionButton label="Close" glyph="back" onclick={onclose} />
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
  .boards {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1780px;
    height: 1020px;
    padding: 24px;
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    border-right: 1px solid rgba(43, 33, 25, 0.15);
    padding-right: 16px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
    margin-bottom: 8px;
  }
  .preset {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 18px 'Fraunces', serif;
    text-align: left;
    cursor: pointer;
  }
  .preset.sel {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--forest);
  }
  .ro,
  .use {
    font: 700 11px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--ink-2);
    color: var(--paper-hi);
  }
  .use {
    background: var(--forest);
    margin-left: auto;
  }
  .sideacts,
  .acts {
    display: flex;
    gap: 8px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font: 800 32px/1.1 'Fraunces', serif;
  }
  .name {
    height: 46px;
    font: 800 24px 'Fraunces', serif;
  }
  .tabs {
    display: flex;
    gap: 6px;
  }
  .tabs button {
    height: 46px;
    padding: 0 18px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 17px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--ink);
    color: var(--paper-hi);
  }
  .link {
    border: 0;
    background: none;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--forest);
    cursor: pointer;
    padding: 6px 8px;
  }
  .note {
    font: 600 15px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .note.ok {
    color: var(--forest);
  }
  .note.warn {
    color: var(--oxblood);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding-right: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sec {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin: 14px 0 4px;
  }
  .hint {
    letter-spacing: 0;
    text-transform: none;
    font-weight: 500;
  }
  input,
  select,
  textarea {
    height: 38px;
    font: 600 15px 'Source Sans 3', sans-serif;
    padding: 0 6px;
    border-radius: 6px;
    border: 1.5px solid rgba(43, 33, 25, 0.25);
    background: #fff;
    min-width: 0;
  }
  textarea {
    height: auto;
    padding: 6px;
    width: 100%;
    resize: vertical;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .grid2 label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font: 600 15px 'Source Sans 3', sans-serif;
  }
  .grp {
    display: grid;
    grid-template-columns: 60px 140px 140px 200px 80px;
    gap: 10px;
    align-items: center;
    font: 600 15px 'Source Sans 3', sans-serif;
  }
  .grp input[type='color'] {
    width: 56px;
    padding: 2px;
  }
  .grp input[type='number'] {
    width: 80px;
  }
  .gname {
    text-transform: capitalize;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .street {
    display: grid;
    grid-template-columns: 18px 220px repeat(9, 1fr);
    gap: 6px;
    align-items: center;
  }
  .street.rr {
    grid-template-columns: 220px repeat(6, 110px);
  }
  .street.ut {
    grid-template-columns: 220px 110px 110px;
  }
  .chip {
    width: 18px;
    height: 30px;
    border-radius: 3px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    background: var(--paper);
  }
  .eff {
    display: flex;
    gap: 10px;
    align-items: center;
    font: 600 15px 'Source Sans 3', sans-serif;
  }
  .eff input {
    width: 90px;
  }
  .foot {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }
</style>
