<script lang="ts">
  // Full-screen auction over the dimmed scene (SPEC §6): deed, current high bid and bidder,
  // each seat's cash, countdown ring. Every human is live at once.
  import { onDestroy } from 'svelte';
  import type { State } from '../../engine';
  import { BID_INCREMENTS } from '../../engine';
  import { getPortrait } from '../../render/portraits';
  import Deed from './Deed.svelte';
  import { deedInfo, money } from '../present';
  import { GLYPH_SYMBOL } from '../present';
  import { symbolUrl } from '../../render/symbols';

  let {
    gs,
    deadline,
    humans,
    incIndex,
    busy,
    onbid,
    onpass,
    oninc,
  }: {
    gs: State;
    deadline: number | null;
    humans: number[];
    incIndex: Record<number, number>;
    busy: boolean;
    onbid: (seat: number, amount: number) => void;
    onpass: (seat: number) => void;
    oninc: (seat: number, index: number) => void;
  } = $props();

  const a = $derived(gs.auction!);
  const total = $derived(gs.rules.auctionTimer * 1000);
  let now = $state(performance.now());
  const tick = setInterval(() => (now = performance.now()), 100);
  onDestroy(() => clearInterval(tick));
  const left = $derived(deadline === null ? null : Math.max(0, deadline - now));
  const frac = $derived(left === null || !total ? 1 : left / total);

  function amountFor(seat: number): number | null {
    const inc = BID_INCREMENTS[incIndex[seat] ?? 1];
    const base = a.highBidder === null ? a.minBid - inc : a.highBid;
    const amt = Math.max(a.minBid, base + inc);
    return amt <= gs.players[seat].cash ? amt : null;
  }
</script>

<div class="dim"></div>
<div class="panel auction">
  <div class="eyebrow">Auction</div>
  <div class="body">
    <Deed deed={deedInfo(gs, a.tile)} scale={0.95} />
    <div class="mid">
      <div class="ring">
        <svg viewBox="0 0 120 120" width="190" height="190" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(43,33,25,.12)" stroke-width="8" />
          <circle cx="60" cy="60" r="52" fill="none" stroke={frac < 0.3 ? '#8E2F23' : '#2F5D46'} stroke-width="8" stroke-linecap="round"
            stroke-dasharray={2 * Math.PI * 52} stroke-dashoffset={2 * Math.PI * 52 * (1 - frac)} transform="rotate(-90 60 60)" />
        </svg>
        <div class="inside">
          <div class="label">High bid</div>
          <div class="bid">{a.highBidder === null ? '—' : money(a.highBid)}</div>
          <div class="by">{a.highBidder === null ? `Opens at ${money(a.minBid)}` : gs.seats[a.highBidder].name}</div>
          {#if left !== null}<div class="secs">{Math.ceil(left / 1000)} s</div>{/if}
        </div>
      </div>
      <div class="seats">
        {#each gs.seats as s, i}
          {#if !gs.players[i].bankrupt && s.kind !== 'bankBot'}
            <div class="seat" class:high={a.highBidder === i} class:out={!a.active.includes(i)}>
              {#if getPortrait(s.token, s.color)}<img src={getPortrait(s.token, s.color)} alt="" />{:else}<span class="dot" style="background:{s.color}"></span>{/if}
              <span class="n">{s.name}</span>
              <span class="st">{a.highBidder === i ? 'High bidder' : a.active.includes(i) ? (s.kind === 'bot' ? 'Bot' : 'Bidding') : 'Passed'}</span>
              <span class="c">{money(gs.players[i].cash)}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
  {#if humans.length}
    <div class="controls">
      {#each humans as seat (seat)}
        <div class="human">
          <div class="hn">{gs.seats[seat].name}</div>
          <div class="incs">
            {#each BID_INCREMENTS as inc, k}
              <button class="inc" class:sel={(incIndex[seat] ?? 1) === k} onclick={() => oninc(seat, k)}>+{money(inc)}</button>
            {/each}
          </div>
          <button class="go" disabled={busy || amountFor(seat) === null || a.highBidder === seat} onclick={() => onbid(seat, amountFor(seat)!)}>
            <img src={symbolUrl(GLYPH_SYMBOL.confirm)} alt="" />
            {a.highBidder === seat ? 'You lead' : amountFor(seat) === null ? 'Not enough cash' : `Bid ${money(amountFor(seat)!)}`}
          </button>
          <button class="pass" disabled={busy || a.highBidder === seat} onclick={() => onpass(seat)}>
            <img src={symbolUrl(GLYPH_SYMBOL.back)} alt="" /> Pass
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.55);
  }
  .auction {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1180px;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .eyebrow {
    font: 700 16px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .body {
    display: flex;
    gap: 36px;
    align-items: center;
  }
  .mid {
    flex: 1;
    display: flex;
    gap: 28px;
    align-items: center;
  }
  .ring {
    position: relative;
    width: 190px;
    height: 190px;
    flex: none;
  }
  .inside {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .label {
    font: 700 13px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .bid {
    font: 800 44px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .by {
    font: 700 15px/1.2 'Source Sans 3', sans-serif;
    max-width: 140px;
  }
  .secs {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
    margin-top: 4px;
  }
  .seats {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seat {
    display: grid;
    grid-template-columns: 44px 1fr 110px 100px;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--paper);
    border: 2px solid transparent;
  }
  .seat.high {
    border-color: var(--forest);
    background: #fff;
  }
  .seat.out {
    opacity: 0.45;
  }
  .seat img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  .dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }
  .n {
    font: 700 19px/1 'Fraunces', serif;
  }
  .st {
    font: 600 14px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .c {
    font: 700 18px/1 'Fraunces', serif;
    text-align: right;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid rgba(43, 33, 25, 0.15);
    padding-top: 16px;
  }
  .human {
    display: grid;
    grid-template-columns: 170px 1fr 260px 150px;
    gap: 12px;
    align-items: center;
  }
  .hn {
    font: 700 20px/1 'Fraunces', serif;
  }
  .incs {
    display: flex;
    gap: 6px;
  }
  .inc {
    flex: 1;
    height: 52px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.2);
    font: 700 17px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .inc.sel {
    background: var(--ink);
    color: var(--paper-hi);
  }
  .go,
  .pass {
    height: 64px;
    border: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    font: 700 19px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .go {
    background: var(--forest);
    color: var(--paper-hi);
  }
  .pass {
    background: var(--paper);
    color: var(--ink);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.2);
  }
  .go img,
  .pass img {
    width: 40px;
    height: 40px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
