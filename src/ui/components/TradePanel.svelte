<script lang="ts">
  // Trade screen (SPEC §6): two columns (properties, cash, jail cards) plus promises.
  // compose: the proposer edits (counter = same screen, sides swapped); respond: the receiver
  // accepts, rejects or counters; waiting: the proposer waits for the other side.
  import type { State, TradeOffer } from '../../engine';
  import ActionButton from './ActionButton.svelte';
  import { money } from '../present';
  import { emptyOffer, offerProblem, partners, promiseTiles, promiseText, summarize, tradeTiles } from '../trade';

  let {
    gs,
    mode,
    seat,
    initial = null,
    counter = false,
    onsubmit,
    oncancel,
    onaccept,
    onreject,
    oncounter,
  }: {
    gs: State;
    mode: 'compose' | 'respond' | 'waiting';
    seat: number;
    initial?: TradeOffer | null;
    counter?: boolean;
    onsubmit?: (o: TradeOffer) => void;
    oncancel?: () => void;
    onaccept?: () => void;
    onreject?: () => void;
    oncounter?: () => void;
  } = $props();

  const others = $derived(partners(gs, seat));
  let offer = $state<TradeOffer>(initial ? $state.snapshot(initial) : emptyOffer(seat, partners(gs, seat)[0] ?? 0));
  let promiseDraft = $state({ promiser: -1, tile: -1, turns: 3 });

  const mine = $derived(tradeTiles(gs, offer.from));
  const theirs = $derived(tradeTiles(gs, offer.to));
  const problem = $derived(mode === 'compose' ? offerProblem(gs, offer) : null);
  const live = $derived(gs.trade);
  const sum = $derived(live ? summarize(gs, live, seat) : null);

  function setPartner(to: number) {
    offer = emptyOffer(offer.from, to);
  }
  function toggle(side: 'give' | 'get', tile: number) {
    const list = offer[side].tiles;
    const i = list.indexOf(tile);
    if (i >= 0) list.splice(i, 1);
    else list.push(tile);
    offer.promises = offer.promises.filter((p) => promiseTiles(gs, offer, p.from).includes(p.tileId));
  }
  function cash(side: 'give' | 'get', delta: number) {
    const max = gs.players[side === 'give' ? offer.from : offer.to].cash;
    offer[side].cash = Math.max(0, Math.min(max, offer[side].cash + delta));
  }
  function cards(side: 'give' | 'get', delta: number) {
    const max = gs.players[side === 'give' ? offer.from : offer.to].gojf.length;
    offer[side].gojf = Math.max(0, Math.min(max, offer[side].gojf + delta));
  }
  const promiserTiles = $derived(promiseDraft.promiser >= 0 ? promiseTiles(gs, offer, promiseDraft.promiser) : []);
  function addPromise() {
    const from = promiseDraft.promiser;
    if (from < 0 || promiseDraft.tile < 0) return;
    const to = from === offer.from ? offer.to : offer.from;
    offer.promises.push({ kind: 'rentFree', from, to, tileId: promiseDraft.tile, turnsLeft: Math.max(1, Math.min(99, promiseDraft.turns)) });
    promiseDraft = { promiser: -1, tile: -1, turns: 3 };
  }
</script>

<div class="dim"></div>
<div class="panel trade">
  {#if mode === 'compose'}
    <div class="head">
      <div class="eyebrow">{counter ? 'Counter offer' : 'Propose a trade'}</div>
      {#if !counter}
        <div class="with">
          With
          {#each others as o (o)}
            <button class="who" class:sel={offer.to === o} onclick={() => setPartner(o)}>{gs.seats[o].name}</button>
          {/each}
        </div>
      {:else}
        <div class="with">With <b>{gs.seats[offer.to].name}</b></div>
      {/if}
    </div>
    <div class="cols">
      {#each [{ side: 'give' as const, who: offer.from, tiles: mine, title: `${gs.seats[offer.from].name} gives` }, { side: 'get' as const, who: offer.to, tiles: theirs, title: `${gs.seats[offer.to].name} gives` }] as col (col.side)}
        <div class="col">
          <div class="ct">{col.title}</div>
          <div class="tiles">
            {#each col.tiles as t (t.tile)}
              <button class="tile" class:on={offer[col.side].tiles.includes(t.tile)} disabled={!!t.blocked} title={t.blocked ?? ''} onclick={() => toggle(col.side, t.tile)}>
                <span class="chip" style="background:{t.color}"></span>{t.name}{#if t.mortgaged}<span class="m">M</span>{/if}
                {#if t.blocked}<span class="why">{t.blocked}</span>{/if}
              </button>
            {/each}
            {#if !col.tiles.length}<div class="none">No properties</div>{/if}
          </div>
          <div class="money">
            <span>Cash</span>
            <button class="step" onclick={() => cash(col.side, -50)}>−50</button>
            <button class="step" onclick={() => cash(col.side, -10)}>−10</button>
            <b>{money(offer[col.side].cash)}</b>
            <button class="step" onclick={() => cash(col.side, 10)}>+10</button>
            <button class="step" onclick={() => cash(col.side, 50)}>+50</button>
          </div>
          {#if gs.players[col.who].gojf.length}
            <div class="money">
              <span>Jail cards</span>
              <button class="step" onclick={() => cards(col.side, -1)}>−1</button>
              <b>{offer[col.side].gojf}</b>
              <button class="step" onclick={() => cards(col.side, 1)}>+1</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {#if gs.rules.promisesAllowed}
      <div class="promises">
        <div class="ct">Promises</div>
        {#each offer.promises as p, i}
          <div class="pline">{promiseText(gs, p)} <button class="link" onclick={() => offer.promises.splice(i, 1)}>Remove</button></div>
        {/each}
        <div class="padd">
          <select bind:value={promiseDraft.promiser} aria-label="Who promises">
            <option value={-1}>Rent-free promise from…</option>
            <option value={offer.from}>{gs.seats[offer.from].name}</option>
            <option value={offer.to}>{gs.seats[offer.to].name}</option>
          </select>
          <select bind:value={promiseDraft.tile} disabled={promiseDraft.promiser < 0} aria-label="On which property">
            <option value={-1}>on property…</option>
            {#each promiserTiles as t}<option value={t}>{gs.board.tiles[t].name}</option>{/each}
          </select>
          <input type="number" min="1" max="99" bind:value={promiseDraft.turns} aria-label="For how many turns" />
          <span>turns</span>
          <button class="link" disabled={promiseDraft.tile < 0} onclick={addPromise}>Add</button>
        </div>
      </div>
    {/if}
    {#if problem}<div class="problem">{problem}</div>{/if}
    <div class="foot">
      <ActionButton label={counter ? 'Send counter' : 'Propose'} glyph="confirm" primary disabled={!!problem} onclick={() => onsubmit?.($state.snapshot(offer))} />
      <ActionButton label="Cancel" glyph="back" onclick={() => oncancel?.()} />
    </div>
  {:else if live && sum}
    <div class="head">
      <div class="eyebrow">{mode === 'respond' ? `Trade offer from ${gs.seats[live.from].name}` : `Waiting for ${gs.seats[live.to].name}`}</div>
    </div>
    <div class="cols">
      <div class="col">
        <div class="ct">{mode === 'respond' ? 'You get' : `${gs.seats[seat].name} gets`}</div>
        {#each sum.gets as l}<div class="line">{l}</div>{/each}
        {#if !sum.gets.length}<div class="none">Nothing</div>{/if}
      </div>
      <div class="col">
        <div class="ct">{mode === 'respond' ? 'You give' : `${gs.seats[seat].name} gives`}</div>
        {#each sum.gives as l}<div class="line">{l}</div>{/each}
        {#if !sum.gives.length}<div class="none">Nothing</div>{/if}
      </div>
    </div>
    {#if sum.promises.length}
      <div class="promises">
        <div class="ct">Promises</div>
        {#each sum.promises as p}<div class="pline">{p}</div>{/each}
      </div>
    {/if}
    <div class="foot" class:three={mode === 'respond'}>
      {#if mode === 'respond'}
        <ActionButton label="Accept" glyph="confirm" primary onclick={() => onaccept?.()} />
        <ActionButton label="Counter" glyph="trade" onclick={() => oncounter?.()} />
        <ActionButton label="Reject" glyph="back" onclick={() => onreject?.()} />
      {:else}
        <ActionButton label="Withdraw offer" glyph="back" onclick={() => oncancel?.()} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.55);
  }
  .trade {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1160px;
    max-height: 1030px;
    padding: 26px 30px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .eyebrow {
    font: 800 32px/1.1 'Fraunces', serif;
  }
  .with {
    display: flex;
    gap: 8px;
    align-items: center;
    font: 600 18px 'Source Sans 3', sans-serif;
  }
  .who {
    height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 17px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .who.sel {
    background: var(--ink);
    color: var(--paper-hi);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    min-height: 0;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .ct {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .tiles {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 440px;
    overflow-y: auto;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 12px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 18px 'Fraunces', serif;
    text-align: left;
    cursor: pointer;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.15);
  }
  .tile.on {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--forest);
  }
  .tile:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .chip {
    width: 22px;
    height: 14px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px var(--ink);
    flex: none;
  }
  .m {
    font: 800 12px/1 'Fraunces', serif;
    color: var(--oxblood);
    border: 1.5px solid var(--oxblood);
    padding: 1px 3px;
  }
  .why {
    margin-left: auto;
    font: 600 13px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .money {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 600 17px 'Source Sans 3', sans-serif;
  }
  .money span {
    width: 90px;
  }
  .money b {
    min-width: 90px;
    text-align: center;
    font: 800 22px 'Fraunces', serif;
  }
  .step {
    height: 40px;
    min-width: 52px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.2);
    font: 700 16px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .promises {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid rgba(43, 33, 25, 0.15);
    padding-top: 10px;
  }
  .pline,
  .line {
    font: 600 18px/1.35 'Source Sans 3', sans-serif;
  }
  .padd {
    display: flex;
    gap: 8px;
    align-items: center;
    font: 600 16px 'Source Sans 3', sans-serif;
  }
  .padd select,
  .padd input {
    height: 40px;
    font: 600 16px 'Source Sans 3', sans-serif;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
    padding: 0 8px;
  }
  .padd input {
    width: 70px;
  }
  .link {
    border: 0;
    background: none;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--forest);
    cursor: pointer;
  }
  .none {
    font: 500 16px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .problem {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
  .foot {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }
  .foot.three {
    grid-template-columns: 2fr 1fr 1fr;
  }
</style>
