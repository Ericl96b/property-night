<script lang="ts">
  // End-of-game stats (SPEC §9): rent paid/received, most profitable tile, money over time,
  // auction vs direct purchases, loans.
  import type { State } from '../../engine';
  import { money } from '../present';
  import { moneyChart, mostProfitableTile, statsRows } from '../stats';
  import ActionButton from './ActionButton.svelte';

  let { gs, onclose, onmenu }: { gs: State; onclose: () => void; onmenu: () => void } = $props();

  const rows = $derived(statsRows(gs));
  const best = $derived(mostProfitableTile(gs));
  const chart = $derived(moneyChart(gs, 1000, 300));
  const anyLoans = $derived(rows.some((r) => r.loansTaken > 0));
  const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : `$${n}`);
</script>

<div class="dim"></div>
<div class="panel statsp">
  <div class="eyebrow">Game over · turn {gs.turnNumber}</div>
  <div class="title">Game stats</div>

  <table>
    <thead>
      <tr>
        <th class="who">Player</th>
        <th>Rent received</th>
        <th>Rent paid</th>
        <th>Bought</th>
        <th>At auction</th>
        {#if anyLoans}<th>Loans</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.seat)}
        <tr class:out={r.bankrupt}>
          <td class="who">
            <span class="dot" style="background:{r.color}"></span>{r.name}
            {#if r.winner}<span class="tag win">WINNER</span>{:else if r.bankrupt}<span class="tag">OUT</span>{/if}
            {#if r.kind === 'bot'}<span class="tag">BOT</span>{:else if r.kind === 'bankBot'}<span class="tag bank">BANK</span>{/if}
          </td>
          <td>{money(r.rentReceived)}</td>
          <td>{money(r.rentPaid)}</td>
          <td>{r.directBuys}</td>
          <td>{r.auctionBuys}</td>
          {#if anyLoans}
            <td>{r.loansTaken ? `${r.loansTaken} · ${money(r.borrowed)} (${money(r.loanInterest)} interest)` : '—'}</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="best">
    {#if best}
      Most profitable tile: <b>{best.name}</b>, {money(best.rent)} in rent{#if best.owner !== null}, now owned by {gs.seats[best.owner].name}{/if}.
    {:else}
      No rent was paid this game.
    {/if}
  </div>

  <div class="chart-title">Money over time</div>
  <svg class="chart" viewBox="0 0 {chart.width} {chart.height}" role="img" aria-label="Cash per player over the game">
    {#each chart.yTicks as t}
      <line x1="64" x2={chart.width - 12} y1={t.y} y2={t.y} class="grid" />
      <text x="56" y={t.y + 5} class="ylab">{short(t.value)}</text>
    {/each}
    {#each chart.xTicks as t}
      <text x={t.x} y={chart.height - 6} class="xlab">{t.turn}</text>
    {/each}
    {#each chart.lines as l (l.seat)}
      <polyline points={l.points} fill="none" stroke={l.color} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
    {/each}
  </svg>
  <div class="legend">
    {#each chart.lines as l (l.seat)}<span><i style="background:{l.color}"></i>{l.name}</span>{/each}
    <span class="xnote">Turn</span>
  </div>

  <div class="btns">
    <ActionButton label="Main menu" glyph="confirm" primary onclick={onmenu} />
    <ActionButton label="Back to the board" glyph="back" onclick={onclose} />
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.55);
  }
  .statsp {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1080px;
    max-height: 1040px;
    overflow-y: auto;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .title {
    font: 800 40px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  table {
    border-collapse: collapse;
    font: 600 18px 'Source Sans 3', sans-serif;
    font-variant-numeric: tabular-nums;
  }
  th {
    font: 700 13px 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--ink-2);
    text-align: right;
    padding: 6px 10px;
    border-bottom: 1.5px solid rgba(43, 33, 25, 0.2);
  }
  td {
    text-align: right;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(43, 33, 25, 0.1);
  }
  .who {
    text-align: left;
  }
  td.who {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  tr.out td {
    color: var(--ink-2);
  }
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex: none;
  }
  .tag {
    font: 700 11px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--ink-2);
    color: var(--paper-hi);
  }
  .tag.win {
    background: var(--forest);
  }
  .tag.bank {
    background: var(--brass);
  }
  .best {
    font: 500 18px/1.4 'Source Sans 3', sans-serif;
  }
  .chart-title {
    font: 700 18px 'Source Sans 3', sans-serif;
    margin-top: 4px;
  }
  .chart {
    width: 100%;
    height: auto;
    background: rgba(255, 255, 255, 0.55);
    border-radius: 8px;
  }
  .grid {
    stroke: rgba(43, 33, 25, 0.14);
    stroke-width: 1;
  }
  .ylab,
  .xlab {
    font: 600 14px 'Source Sans 3', sans-serif;
    fill: var(--ink-2);
  }
  .ylab {
    text-anchor: end;
  }
  .xlab {
    text-anchor: middle;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    font: 600 16px 'Source Sans 3', sans-serif;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 22px;
    height: 4px;
    border-radius: 2px;
  }
  .legend .xnote {
    margin-left: auto;
    color: var(--ink-2);
  }
  .btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 6px;
  }
</style>
