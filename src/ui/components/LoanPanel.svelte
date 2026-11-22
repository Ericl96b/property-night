<script lang="ts">
  // Bank loans (SPEC §7): take a secured or unsecured loan with a schedule preview; pay off
  // existing loans early. Stage 3: opened from Inventory, drawn in the binder's language
  // (collateral as deed thumbnails). The flow and its engine calls are unchanged.
  import type { Action, State } from '../../engine';
  import { installment, loanBlocker, loanLimit, pledgeBlocker, schedule } from '../../engine';
  import ActionButton from './ActionButton.svelte';
  import { money } from '../present';
  import CardSlot from '../cards/CardSlot.svelte';
  import { deedCard } from '../cards/model';

  const chipOf = (why: string | null) => (!why ? null : why.includes('pledged') ? 'Pledged' : why.includes('buildings') ? 'Has houses' : why.includes('mortgaged') ? 'Mortgaged' : "Can't pledge");

  let { gs, seat, onaction, onclose }: { gs: State; seat: number; onaction: (a: Action) => void; onclose: () => void } = $props();

  const r = $derived(gs.rules);
  const p = $derived(gs.players[seat]);
  let secured = $state(!gs.rules.unsecuredLoans);
  let collateral = $state<number[]>([]);
  let amount = $state(0);
  let passes = $state(Math.min(gs.rules.loanTermMax, Math.max(gs.rules.loanTermMin, 5)));
  let payoff = $state<Record<number, number>>({});

  const candidates = $derived(
    gs.board.tiles.filter((t) => t.price !== undefined && gs.tiles[t.index].owner === seat).map((t) => ({ tile: t.index, name: t.name, blocked: pledgeBlocker(gs, seat, t.index) })),
  );
  const pledge = $derived(secured ? collateral : []);
  const limit = $derived(loanLimit(gs, seat, pledge));
  const amt = $derived(Math.min(amount, limit));
  const problem = $derived(loanBlocker(gs, seat, amt, passes, pledge));
  const plan = $derived(amt > 0 ? schedule(amt, passes, r.loanInterestPercent) : null);
  const terms = $derived(Array.from({ length: r.loanTermMax - r.loanTermMin + 1 }, (_, i) => r.loanTermMin + i));

  function toggle(tile: number) {
    collateral = collateral.includes(tile) ? collateral.filter((t) => t !== tile) : [...collateral, tile];
  }
  function step(d: number) {
    amount = Math.max(0, Math.min(limit, amt + d));
  }
</script>

<div class="dim"></div>
<div class="panel loans">
  <div class="head">
    <div>
      <div class="kick">Bank loan</div>
      <div class="eyebrow">{gs.seats[seat].name}'s bank loans</div>
    </div>
    <div class="cashc"><span class="sec">Cash</span><span class="cash">{money(p.cash)}</span></div>
  </div>

  {#if p.loans.length}
    <div class="sec">Your loans</div>
    {#each p.loans as l (l.id)}
      {@const due = installment(l)}
      <div class="loan">
        <div>
          <b>{money(l.principal)}</b> left · {l.rate}% per GO pass · {l.passesLeft} pass{l.passesLeft === 1 ? '' : 'es'} left ·
          {l.secured ? `secured by ${l.collateral.map((t) => gs.board.tiles[t].name).join(', ')}` : 'unsecured'}
          <div class="next">Next installment at GO: {money(due.total)} ({money(due.principal)} + {money(due.interest)} interest)</div>
        </div>
        <div class="pay">
          <input type="number" min="1" max={Math.min(l.principal, p.cash)} value={payoff[l.id] ?? Math.min(l.principal, p.cash)}
            oninput={(e) => (payoff = { ...payoff, [l.id]: Number((e.currentTarget as HTMLInputElement).value) })} aria-label="Payoff amount" />
          <button class="op" disabled={gs.turn.seat !== seat || p.cash <= 0} onclick={() => onaction({ type: 'repayLoan', seat, loanId: l.id, amount: Math.min(l.principal, p.cash, Math.max(1, Math.round(payoff[l.id] ?? Math.min(l.principal, p.cash)))) })}>Pay off</button>
        </div>
      </div>
    {/each}
  {/if}

  <div class="sec">New loan</div>
  <div class="kinds">
    <label><input type="radio" name="kind" checked={!secured} disabled={!r.unsecuredLoans} onchange={() => (secured = false)} /> Unsecured</label>
    <label><input type="radio" name="kind" checked={secured} onchange={() => (secured = true)} /> Secured by property</label>
  </div>
  {#if secured}
    <div class="coll">
      {#each candidates as c (c.tile)}
        <CardSlot item={deedCard(gs, c.tile)} current={collateral.includes(c.tile)} inOffer={collateral.includes(c.tile)} blocked={chipOf(c.blocked)} label={c.name} onclick={() => !c.blocked && toggle(c.tile)} />
      {/each}
      {#if !candidates.length}<div class="none">No properties to pledge.</div>{/if}
    </div>
  {/if}
  <div class="row">
    <span>Amount (limit {money(limit)})</span>
    <button class="op" onclick={() => step(-100)}>−100</button>
    <button class="op" onclick={() => step(-10)}>−10</button>
    <b class="amt">{money(amt)}</b>
    <button class="op" onclick={() => step(10)}>+10</button>
    <button class="op" onclick={() => step(100)}>+100</button>
    <span>over</span>
    <select bind:value={passes} aria-label="Term in GO passes">
      {#each terms as t}<option value={t}>{t} GO passes</option>{/each}
    </select>
  </div>
  {#if plan}
    <div class="plan">
      {#each plan.rows as row}
        <span>Pass {row.pass}: {money(row.total)}</span>
      {/each}
      <b>Total interest {money(plan.totalInterest)}</b>
    </div>
  {/if}
  {#if problem && amt > 0}<div class="problem">{problem}</div>{/if}
  <div class="foot">
    <ActionButton label="Take loan" glyph="confirm" primary disabled={!!problem} onclick={() => onaction({ type: 'takeLoan', seat, amount: amt, passes, collateral: pledge })} />
    <ActionButton label="Close" glyph="back" onclick={onclose} />
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.55);
  }
  .loans {
    background: #fbf6ea;
    border-radius: 16px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1080px;
    max-height: 1020px;
    overflow-y: auto;
    padding: 26px 30px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .kick {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #8e2f23;
  }
  .eyebrow {
    font: 800 34px/1.1 'Fraunces', serif;
    margin-top: 6px;
  }
  .cashc {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .cash {
    font: 800 32px 'Fraunces', serif;
  }
  .sec {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin-top: 6px;
  }
  .loan {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--paper);
    font: 600 17px/1.4 'Source Sans 3', sans-serif;
  }
  .next {
    color: var(--ink-2);
    font-size: 15px;
  }
  .pay {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pay input {
    width: 110px;
  }
  input[type='number'],
  select {
    height: 42px;
    font: 600 17px 'Source Sans 3', sans-serif;
    padding: 0 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
  }
  .kinds {
    display: flex;
    gap: 22px;
    font: 600 18px 'Source Sans 3', sans-serif;
  }
  .coll {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 6px;
    border-radius: 10px;
    background: #f3ead6;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.12);
  }
  .tile {
    height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.15);
    font: 700 16px 'Fraunces', serif;
    cursor: pointer;
  }
  .tile.on {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--forest);
  }
  .tile:disabled {
    opacity: 0.4;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 600 17px 'Source Sans 3', sans-serif;
  }
  .amt {
    min-width: 110px;
    text-align: center;
    font: 800 24px 'Fraunces', serif;
  }
  .op {
    height: 42px;
    min-width: 56px;
    border: 0;
    border-radius: 8px;
    background: #fff;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.25);
    font: 700 16px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .op:disabled {
    opacity: 0.4;
  }
  .plan {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font: 600 15px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .plan b {
    color: var(--ink);
  }
  .problem {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
  .none {
    font: 500 16px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .foot {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }
</style>
