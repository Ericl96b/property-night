<script lang="ts">
  // Full-screen auction over the dimmed scene (SPEC §6, Stage 1 §3): a large leader panel (who is
  // winning and for how much), the bidder list (Leading / Outbid / Passed), and one bid menu per
  // human, headed "[Name]'s bid" in their color. Each option states the total it bids; Pass sits
  // apart on its own line so overshooting the raises can't reach it. Every human is live at once.
  import { onDestroy } from 'svelte';
  import { bidChoices, type State } from '../../engine';
  import { getPortrait } from '../../render/portraits';
  import Deed from './Deed.svelte';
  import { deedInfo, money } from '../present';

  let {
    gs,
    deadline,
    humans,
    busy,
    onbid,
    onpass,
  }: {
    gs: State;
    deadline: number | null;
    humans: number[];
    busy: boolean;
    onbid: (seat: number, amount: number) => void;
    onpass: (seat: number) => void;
  } = $props();

  const a = $derived(gs.auction!);
  const total = $derived(gs.rules.auctionTimer * 1000);
  let now = $state(performance.now());
  const tick = setInterval(() => (now = performance.now()), 100);
  onDestroy(() => clearInterval(tick));
  const left = $derived(deadline === null ? null : Math.max(0, deadline - now));
  const frac = $derived(left === null || !total ? 1 : left / total);

  const leader = $derived(a.highBidder === null ? null : gs.seats[a.highBidder]);
  const bidders = $derived(gs.seats.map((s, i) => ({ s, i })).filter(({ s, i }) => !gs.players[i].bankrupt && s.kind !== 'bankBot'));
  // Focus starts on the first human's smallest affordable raise, never on Pass (§3D).
  const autofocusSeat = $derived(humans.find((h) => bidChoices(gs, h).some((c) => c.affordable)) ?? null);

  function status(i: number): { kind: 'leading' | 'outbid' | 'passed' | 'bidding'; text: string } {
    const last = a.lastBids?.[i];
    if (a.highBidder === i) return { kind: 'leading', text: 'Leading' };
    if (!a.active.includes(i)) return { kind: 'passed', text: last ? `Passed · bid ${money(last)}` : 'Passed' };
    if (last) return { kind: 'outbid', text: `Outbid · bid ${money(last)}` };
    return { kind: 'bidding', text: gs.seats[i].kind === 'bot' ? 'Bot · no bid yet' : 'No bid yet' };
  }
</script>

<div class="dim"></div>
<div class="panel auction">
  <!-- A. Leader panel: the biggest thing in the auction; pulses when the lead changes. -->
  <div class="leaderbar">
    {#key a.highBidder}
      <div class="leader" class:none={!leader} style={leader ? `--pc:${leader.color}` : ''}>
        {#if leader && a.highBidder !== null}
          {#if getPortrait(leader.token, leader.color)}<img class="lp" src={getPortrait(leader.token, leader.color)} alt="" />{:else}<span class="ldot"></span>{/if}
          <div class="lwho">
            <div class="ltag">Leading</div>
            <div class="lname">{leader.name}</div>
          </div>
          <div class="lbid">{money(a.highBid)}</div>
        {:else}
          <div class="lwho">
            <div class="ltag muted">Auction</div>
            <div class="lname nobids">No bids yet</div>
          </div>
          <div class="lopen">Opening bid <b>{money(a.minBid)}</b></div>
        {/if}
      </div>
    {/key}
    {#if left !== null}
      <div class="ring" aria-label="{Math.ceil(left / 1000)} seconds left">
        <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(43,33,25,.12)" stroke-width="10" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={frac < 0.3 ? '#8E2F23' : '#2F5D46'} stroke-width="10" stroke-linecap="round"
            stroke-dasharray={2 * Math.PI * 50} stroke-dashoffset={2 * Math.PI * 50 * (1 - frac)} transform="rotate(-90 60 60)" />
        </svg>
        <div class="secs">{Math.ceil(left / 1000)}<small>s</small></div>
      </div>
    {/if}
  </div>

  <div class="body">
    {#if a.kind === 'house' || a.kind === 'hotel'}
      <div class="lot">
        <div class="lk">{a.kind === 'hotel' ? 'Hotel' : 'House'}</div>
        <div class="ln">Only {a.kind === 'hotel' ? gs.bank.hotels : gs.bank.houses} left in the bank</div>
        <div class="lh">The highest bid buys it and builds right away:</div>
        {#each a.active as i}
          <div class="lt">{gs.seats[i].name} → {gs.board.tiles[a.buildFor?.[i] ?? a.tile].name}</div>
        {/each}
      </div>
    {:else}
      <Deed deed={deedInfo(gs, a.tile)} scale={0.8} />
    {/if}

    <!-- B. Bidder list -->
    <div class="seats">
      {#each bidders as { s, i } (i)}
        {@const st = status(i)}
        <div class="seat {st.kind}" style="--pc:{s.color}">
          {#if getPortrait(s.token, s.color)}<img src={getPortrait(s.token, s.color)} alt="" />{:else}<span class="dot"></span>{/if}
          <span class="n">{s.name}</span>
          <span class="st">{st.text}</span>
          <span class="c">{money(gs.players[i].cash)}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- C/D. One bid menu per human, in their color -->
  {#if humans.length}
    <div class="controls" class:two={humans.length > 1}>
      {#each humans as seat (seat)}
        {@const s = gs.seats[seat]}
        {@const choices = bidChoices(gs, seat)}
        <div class="human" data-bid-seat={seat} style="--pc:{s.color}">
          <div class="hn"><span class="sw"></span>{s.name}'s bid</div>
          {#if a.highBidder === seat}
            <div class="leading">You're leading at {money(a.highBid)}. Waiting for the others…</div>
          {:else}
            <div class="opts">
              {#each choices as c, k}
                <button
                  class="opt"
                  data-autofocus={seat === autofocusSeat && k === choices.findIndex((x) => x.affordable) ? '' : undefined}
                  disabled={busy || !c.affordable}
                  onclick={() => onbid(seat, c.amount)}
                >
                  <span class="amt">Bid {money(c.amount)}</span>
                  <span class="inc">{c.affordable ? `(+${money(c.raise)})` : `Need ${money(c.amount - gs.players[seat].cash)} more`}</span>
                </button>
              {/each}
            </div>
            <div class="passrow">
              <button class="pass" disabled={busy} onclick={() => onpass(seat)}>Pass</button>
            </div>
          {/if}
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
    width: 1240px;
    max-height: 1040px;
    overflow-y: auto;
    padding: 24px 30px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* A. Leader panel */
  .leaderbar {
    display: flex;
    gap: 18px;
    align-items: center;
  }
  .leader {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 20px;
    min-height: 124px;
    padding: 12px 26px 12px 16px;
    border-radius: 14px;
    background: #fff;
    box-shadow:
      inset 0 0 0 4px var(--pc, rgba(43, 33, 25, 0.2)),
      inset 14px 0 0 var(--pc, rgba(43, 33, 25, 0.2));
    animation: lead 300ms ease-out;
  }
  .leader.none {
    background: var(--paper);
    animation: none;
  }
  @keyframes lead {
    0% {
      transform: translateX(-14px) scale(0.98);
      background: #fff4c9;
    }
    60% {
      transform: translateX(3px) scale(1.015);
    }
    100% {
      transform: none;
      background: #fff;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .leader {
      animation: none;
    }
  }
  .lp {
    width: 100px;
    height: 100px;
    margin-left: 10px;
    object-fit: contain;
  }
  .ldot {
    width: 64px;
    height: 64px;
    margin-left: 20px;
    border-radius: 50%;
    background: var(--pc);
  }
  .lwho {
    flex: 1;
    min-width: 0;
  }
  .ltag {
    display: inline-block;
    padding: 5px 12px;
    border-radius: 999px;
    background: var(--forest);
    color: var(--paper-hi);
    font: 800 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .ltag.muted {
    background: transparent;
    color: var(--oxblood);
    padding-left: 0;
  }
  .lname {
    margin-top: 8px;
    font: 800 40px/1.05 'Fraunces', serif;
    color: var(--pc);
    /* Player colors range from pale to dark: a thin ink edge keeps every one readable. */
    -webkit-text-stroke: 1px rgba(43, 33, 25, 0.55);
    paint-order: stroke fill;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lname.nobids {
    color: var(--ink);
    -webkit-text-stroke: 0;
  }
  .lbid {
    font: 800 84px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 144;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .lopen {
    font: 600 26px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .lopen b {
    font: 800 52px/1 'Fraunces', serif;
    color: var(--ink);
    margin-left: 8px;
  }
  .ring {
    position: relative;
    width: 96px;
    height: 96px;
    flex: none;
  }
  .secs {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 800 30px/1 'Fraunces', serif;
  }
  .secs small {
    font-size: 15px;
  }

  .body {
    display: flex;
    gap: 28px;
    align-items: center;
  }
  .lot {
    width: 260px;
    min-height: 260px;
    padding: 22px;
    border-radius: 9px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px var(--ink);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lk {
    font: 800 40px/1 'Fraunces', serif;
    color: var(--forest);
  }
  .ln,
  .lh {
    font: 600 16px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .lt {
    font: 700 17px/1.3 'Fraunces', serif;
  }

  /* B. Bidder list */
  .seats {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .seat {
    display: grid;
    grid-template-columns: 48px 1fr 220px 100px;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    border-radius: 9px;
    background: var(--paper);
    box-shadow: inset 5px 0 0 var(--pc);
  }
  .seat img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  .dot {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--pc);
  }
  .n {
    font: 800 21px/1 'Fraunces', serif;
    color: var(--pc);
    -webkit-text-stroke: 0.6px rgba(43, 33, 25, 0.55);
    paint-order: stroke fill;
  }
  .st {
    font: 700 16px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .c {
    font: 700 18px/1 'Fraunces', serif;
    text-align: right;
  }
  .seat.leading {
    background: #fff;
    box-shadow:
      inset 0 0 0 3px var(--forest),
      inset 8px 0 0 var(--pc);
  }
  .seat.leading .st {
    color: var(--forest);
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .seat.outbid .st {
    color: var(--oxblood);
  }
  .seat.passed {
    opacity: 0.45;
    filter: grayscale(0.8);
  }
  .seat.passed .n {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }

  /* C/D. Bid menus */
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    border-top: 1px solid rgba(43, 33, 25, 0.15);
    padding-top: 14px;
  }
  .controls.two {
    grid-template-columns: 1fr 1fr;
  }
  .human {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 12px 20px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.55);
    box-shadow:
      inset 8px 0 0 var(--pc),
      inset 0 0 0 1.5px rgba(43, 33, 25, 0.15);
  }
  .hn {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 800 24px/1 'Fraunces', serif;
    color: var(--pc);
    -webkit-text-stroke: 0.7px rgba(43, 33, 25, 0.55);
    paint-order: stroke fill;
  }
  .sw {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--pc);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.4);
  }
  .opts {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 8px;
  }
  .opt {
    height: 72px;
    border: 0;
    border-radius: 10px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.22);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  }
  .amt {
    font: 800 21px/1 'Source Sans 3', sans-serif;
  }
  .inc {
    font: 600 14px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .opt:disabled {
    opacity: 1;
    background: rgba(243, 234, 214, 0.5);
    color: rgba(43, 33, 25, 0.4);
    cursor: default;
  }
  /* The reason stays readable on a dimmed option (§2D). */
  .opt:disabled .inc {
    color: var(--oxblood);
    font-weight: 700;
  }
  /* Pass: apart from the raises (own line, divider), and a different, outlined style. */
  .passrow {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
    border-top: 2px dashed rgba(43, 33, 25, 0.2);
  }
  .pass {
    width: 180px;
    height: 52px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--oxblood);
    box-shadow: inset 0 0 0 2px var(--oxblood);
    font: 800 18px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
  }
  .pass:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .leading {
    min-height: 72px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-radius: 10px;
    background: #fff;
    box-shadow: inset 0 0 0 2px var(--forest);
    font: 700 20px/1.2 'Source Sans 3', sans-serif;
    color: var(--forest);
  }
</style>
