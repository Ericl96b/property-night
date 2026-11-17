<script lang="ts">
  // Manage (build, sell, mortgage) and the blocking raise-money panel (SPEC §9).
  import type { Action, State } from '../../engine';
  import ActionButton from './ActionButton.svelte';
  import { debtInfo, manageGroups, money } from '../present';

  let {
    gs,
    seat,
    busy,
    onaction,
    onclose,
  }: { gs: State; seat: number; busy: boolean; onaction: (a: Action) => void; onclose: () => void } = $props();

  const groups = $derived(manageGroups(gs, seat));
  const debt = $derived(debtInfo(gs));
  const raising = $derived(debt !== null && debt.debtor === seat);
  const cash = $derived(gs.players[seat].cash);
</script>

<div class="dim"></div>
<div class="panel manage">
  <div class="head">
    <div>
      <div class="eyebrow">{raising ? 'Raise money' : 'Manage'}</div>
      <div class="title">{gs.seats[seat].name}</div>
    </div>
    <div class="cash">{money(cash)}</div>
  </div>
  {#if raising && debt}
    <div class="debt">
      Owes <b>{money(debt.amount)}</b> to {debt.to}. Short by <b>{money(Math.max(0, debt.amount - cash))}</b>.
      {#if !debt.canCover}<span class="warn">Selling and mortgaging everything still falls short.</span>{/if}
    </div>
  {/if}
  <div class="list">
    {#if !groups.length}<div class="empty">No properties yet.</div>{/if}
    {#each groups as g (g.key)}
      <div class="group">
        <div class="gh"><span class="chip" style="background:{g.color}"></span>{g.label}{#if g.full}<span class="full">Full set</span>{/if}</div>
        {#each g.rows as r (r.tile)}
          <div class="row" class:mortgaged={r.mortgaged}>
            <div class="name">{r.name}</div>
            <div class="bld">
              {#if r.buildings === 5}<span class="hotel">HOTEL</span>{:else}{#each Array(r.buildings) as _}<span class="house"></span>{/each}{/if}
              {#if r.mortgaged}<span class="m">M</span>{/if}
            </div>
            <div class="ops">
              {#each r.ops as op (op.label)}
                <button class="op" disabled={!op.ok || busy} title={op.reason ?? ''} onclick={() => onaction(op.action)}>{op.label}</button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <div class="foot">
    {#if raising && debt && !debt.canCover}
      <ActionButton label="Declare bankruptcy" glyph="confirm" onclick={() => onaction({ type: 'declareBankruptcy', seat })} />
    {/if}
    {#if !raising}
      <ActionButton label="Done" glyph="back" onclick={onclose} />
    {/if}
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.45);
  }
  .manage {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 980px;
    max-height: 980px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .title {
    font: 800 36px/1.1 'Fraunces', serif;
    font-variation-settings: 'opsz' 72;
  }
  .cash {
    font: 800 36px/1 'Fraunces', serif;
  }
  .debt {
    font: 600 19px/1.4 'Source Sans 3', sans-serif;
    padding: 12px 16px;
    border-radius: 8px;
    background: #f6e3dc;
  }
  .warn {
    display: block;
    color: var(--oxblood);
  }
  .list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-right: 6px;
  }
  .empty {
    font: 600 18px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .gh {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 700 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin-bottom: 6px;
  }
  .chip {
    width: 22px;
    height: 14px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  .full {
    font-size: 12px;
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--forest);
    color: var(--paper-hi);
    letter-spacing: 1px;
  }
  .row {
    display: grid;
    grid-template-columns: 220px 120px 1fr;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--paper);
  }
  .mortgaged .name {
    color: var(--ink-2);
    text-decoration: line-through;
  }
  .name {
    font: 700 19px/1.1 'Fraunces', serif;
  }
  .bld {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .house {
    width: 14px;
    height: 14px;
    background: #2e8b4e;
    clip-path: polygon(50% 0, 100% 45%, 100% 100%, 0 100%, 0 45%);
  }
  .hotel {
    font: 800 12px/1 'Source Sans 3', sans-serif;
    padding: 4px 6px;
    background: #b4322a;
    color: #fff;
    border-radius: 3px;
  }
  .m {
    font: 800 13px/1 'Fraunces', serif;
    color: var(--oxblood);
    border: 1.5px solid var(--oxblood);
    padding: 1px 4px;
  }
  .ops {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .op {
    height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: #fff;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.25);
    font: 700 16px/1 'Source Sans 3', sans-serif;
    color: var(--ink);
    cursor: pointer;
  }
  .op:hover:not(:disabled) {
    background: #efe3c8;
  }
  .op:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
