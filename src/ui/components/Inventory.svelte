<script lang="ts">
  // Inventory (Stage 3 §3): the player's binder. Replaces ManagePanel and keeps every action it
  // had (build, sell, mortgage, unmortgage, bank loans, raising money for a debt).
  // D-pad moves between slots; Confirm opens the card's action list (its own menu layer, so Back
  // returns to the binder); L/R view other players' binders, view-only.
  import { installment, type Action, type State } from '../../engine';
  import type { Intent } from '../../input/keys';
  import { getPortrait } from '../../render/portraits';
  import { tick } from 'svelte';
  import { layer } from '../menuStack';
  import { focusEl } from '../focus';
  import { debtInfo, money, type GlyphFamily } from '../present';
  import { binderRows, binderStats, slotDetail, type BinderSlot } from '../inventory';
  import CardSlot from '../cards/CardSlot.svelte';
  import GameCard from '../cards/GameCard.svelte';
  import PromptBar from '../cards/PromptBar.svelte';
  import type { Prompt } from '../cards/model';

  let {
    gs,
    seat,
    busy = false,
    family = 'playstation',
    swap = false,
    padLabel = null,
    onaction,
    onclose,
    onloan,
    registerIntent,
  }: {
    gs: State;
    seat: number;
    busy?: boolean;
    family?: GlyphFamily;
    swap?: boolean;
    padLabel?: string | null;
    onaction: (a: Action) => void;
    onclose: () => void;
    onloan?: () => void;
    registerIntent?: (h: ((i: Intent) => boolean) | null) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let viewSeat = $state(seat);
  let focusedKey = $state<string | null>(null);
  let actionsOpen = $state(false);
  let panelEl = $state<HTMLElement | null>(null);

  const viewing = $derived(viewSeat !== seat);
  const rows = $derived(binderRows(gs, viewSeat, seat));
  const left = $derived(rows.slice(0, 6));
  const right = $derived(rows.slice(6));
  const stats = $derived(binderStats(gs, viewSeat));
  const debt = $derived(debtInfo(gs));
  const raising = $derived(debt !== null && debt.debtor === seat);
  const owner = $derived(gs.seats[viewSeat]);
  const allSlots = $derived(rows.flatMap((r) => r.slots));
  const firstOwned = $derived(allSlots.find((x) => x.item)?.key ?? null);
  const focused = $derived(allSlots.find((x) => x.key === focusedKey && x.item) ?? allSlots.find((x) => x.key === firstOwned) ?? null);
  const detail = $derived(focused ? slotDetail(gs, viewSeat, seat, focused) : null);
  const loans = $derived(gs.players[seat].loans);
  const canLoan = $derived(gs.rules.loans && !viewing && !!onloan && (raising || (gs.turn.seat === seat && ['preRoll', 'postRoll', 'buy'].includes(gs.phase))));
  const portrait = $derived(getPortrait(owner.token, owner.color));

  const live = (i: number) => !gs.players[i].bankrupt;
  function cycle(step: 1 | -1) {
    const n = gs.seats.length;
    let i = viewSeat;
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (live(i) || i === seat) break;
    }
    viewSeat = i;
    focusedKey = null;
    actionsOpen = false;
    // Focus follows to the new binder's first card, so focus and the detail pane agree.
    void tick().then(() => {
      const el = panelEl?.querySelector<HTMLElement>('[data-autofocus]') ?? panelEl?.querySelector<HTMLElement>('.slot[data-focus-key]');
      if (el) focusEl(el);
    });
  }

  function onslot(x: BinderSlot) {
    focusedKey = x.key;
    if (!viewing && detail && detail.actions.length) actionsOpen = true;
  }

  $effect(() => {
    registerIntent?.((i) => {
      if (actionsOpen) return false;
      if (i === 'cycleLeft' || i === 'cycleRight') {
        cycle(i === 'cycleRight' ? 1 : -1);
        return true;
      }
      return false;
    });
    return () => registerIntent?.(null);
  });

  const prompts = $derived<Prompt[]>(
    actionsOpen
      ? [
          { glyphs: ['dpadUD'], label: 'Choose action' },
          { glyphs: ['confirm'], label: 'Select' },
          { glyphs: ['back'], label: 'Back to binder', onclick: () => (actionsOpen = false) },
        ]
      : [
          { glyphs: ['dpad'], label: 'Move' },
          ...(viewing ? [] : [{ glyphs: ['confirm'] as Prompt['glyphs'], label: 'Actions' }]),
          { glyphs: ['cycleLeft', 'cycleRight'], label: viewing ? 'Other players' : 'Other players (view only)' },
          ...(raising ? [] : [{ glyphs: ['back'] as Prompt['glyphs'], label: 'Close', onclick: onclose }]),
        ],
  );
</script>

{#snippet slotEl(x: BinderSlot)}
  {#if x.item}
    <CardSlot
      item={x.item}
      pledged={x.pledged}
      tag={x.tag?.text ?? null}
      tagColor={x.tag?.color}
      current={actionsOpen && focused?.key === x.key}
      label={x.item.t === 'deed' ? x.item.name : undefined}
      data-autofocus={x.key === (focusedKey ?? firstOwned) ? true : undefined}
      data-focus-key={x.key}
      onfocus={() => (focusedKey = x.key)}
      onclick={() => onslot(x)}
    />
  {:else if x.empty}
    <div class="ghost"><CardSlot empty={x.empty} tabindex={-1} disabled /></div>
  {/if}
{/snippet}

{#snippet page(list: typeof rows)}
  <div class="bpage">
    {#each list as r (r.key)}
      <div class="brow">
        <div class="blab">
          <div class="bgname">{#if r.chip}<span class="chip" style="background:{r.chip}"></span>{/if}{r.label}</div>
          <div class="bcount">{r.owned}<small>{r.unit}</small></div>
          <div class="btags">
            {#if r.full}<span class="tag" style="background:#2F5D46">FULL SET</span>{/if}
            {#each r.tags as t}<span class="tag" style="background:{t.color}">{t.text}</span>{/each}
          </div>
        </div>
        <div class="slots" class:wide={r.key === 'promises'}>
          {#each r.slots as x (x.key)}{@render slotEl(x)}{/each}
          {#if !r.slots.length && r.emptyNote}<div class="nopr">{r.emptyNote}</div>{/if}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

<div class="dim"></div>
<div class="panel inv" bind:this={panelEl} data-screen="inventory" data-view-seat={viewSeat}>
  <div class="ihead">
    <span class="tok" style="border-color:{owner.color}">{#if portrait}<img src={portrait} alt="" />{/if}</span>
    <div class="titles">
      <div class="eyebrow">{viewing ? 'View only' : raising ? 'Raise money' : 'Inventory'}</div>
      <div class="h1">{viewing ? `Viewing ${owner.name}'s binder` : `${owner.name}'s binder`}</div>
    </div>
    {#if raising && debt}
      <div class="debtbar" role="status">
        <div>
          <div class="dt">Raise {money(debt.amount)} to pay {debt.to}</div>
          <div class="ds">{debt.canCover ? 'Sell buildings or mortgage deeds. This closes once the debt is covered.' : 'Selling and mortgaging everything still falls short.'}</div>
        </div>
        <div class="need"><span class="lab">Still needed</span><span class="nv">{money(Math.max(0, debt.amount - gs.players[seat].cash))}</span></div>
        {#if !debt.canCover}
          <button class="btn danger" onclick={() => onaction({ type: 'declareBankruptcy', seat })}><span class="lbl">Declare bankruptcy</span></button>
        {/if}
      </div>
    {/if}
    <div class="spacer"></div>
    <div class="stat"><span class="lab">Deeds</span><span class="statv">{stats.deeds}</span></div>
    <div class="stat"><span class="lab">Full sets</span><span class="statv">{stats.fullSets}</span></div>
    <div class="stat"><span class="lab">{stats.hotels ? 'Houses · Hotels' : 'Houses'}</span><span class="statv">{stats.houses}{#if stats.hotels} · {stats.hotels}{/if}</span></div>
    <div class="stat last"><span class="lab">Cash</span><span class="amt">{owner.kind === 'bankBot' && !gs.bankBackingEnded ? '∞' : money(stats.cash)}</span></div>
    {#if canLoan}
      <button class="btn loanbtn" data-focus-key="loan" onclick={() => onloan?.()}><span class="lbl">Bank loan</span></button>
    {/if}
  </div>
  <div class="ibody">
    <div class="binder">
      {@render page(left)}
      <div class="spine"><span class="ring"></span><span class="ring"></span><span class="ring"></span></div>
      {@render page(right)}
    </div>
    <div class="dpane">
      {#if !viewing && loans.length}
        <div class="loans">
          {#each loans as l (l.id)}
            {@const inst = installment(l)}
            <div class="loan">
              <span class="lk">Bank loan</span>
              <span><b>{money(l.principal)}</b> left</span>
              <span><b>{l.passesLeft}</b> {l.passesLeft === 1 ? 'pass' : 'passes'}</span>
              <span>next <b>{money(inst.principal + inst.interest)}</b></span>
              {#if onloan && gs.turn.seat === seat}<button class="link" onclick={() => onloan?.()}>Pay off</button>{/if}
            </div>
          {/each}
        </div>
      {/if}
      {#if detail}
        <div class="dphead">
          {#if detail.chip}<span class="chip big" style="background:{detail.chip}"></span>{:else if detail.icon}<img src={detail.icon} alt="" width="34" height="34" />{/if}
          <div>
            <div class="dpt">{detail.title}</div>
            <div class="dps">{detail.sub}</div>
          </div>
        </div>
        <div class="dprow">
          <GameCard item={detail.item} size="detail" />
          <div class="side">
            {#each detail.side as si}
              <div class="si">
                <div class="lab">{si.label}</div>
                {#if si.buildings}
                  <div class="sib">
                    {#if si.buildings === 5}
                      <svg width="42" height="26" viewBox="0 0 26 16" aria-hidden="true"><path d="M1.5 7 13 2l11.5 5v7.5h-23z" fill="#B4322A" stroke="#6E1B15" stroke-width="1.2" stroke-linejoin="round" /></svg>
                    {:else}
                      {#each Array(si.buildings) as _}<svg width="26" height="26" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8.2 8 2.4l6.5 5.8v6.3h-13z" fill="#2E8B4E" stroke="#1B4D2E" stroke-width="1.2" stroke-linejoin="round" /></svg>{/each}
                    {/if}
                  </div>
                {:else}
                  <div class="sv {si.tone ?? ''}">{si.value}</div>
                {/if}
                {#if si.sub}<div class="ss">{si.sub}</div>{/if}
              </div>
            {/each}
          </div>
        </div>
        {#snippet actionList(interactive: boolean)}
          <div class="acts">
            {#each detail!.actions as a, k (a.label)}
              {#if interactive}
                <button
                  class="btn act"
                  aria-disabled={!a.ok || busy ? 'true' : undefined}
                  data-autofocus={k === detail!.actions.findIndex((x) => x.ok) ? true : undefined}
                  data-focus-key="act-{a.label}"
                  onclick={() => a.ok && !busy && a.action && onaction(a.action)}
                >
                  <span class="lbl">{a.label}{#if a.why}<em class="why">{a.why}</em>{/if}</span>
                  {#if a.chip}<em class="rchip">{a.chip}</em>{/if}
                  {#if a.hint && a.ok}<em class="hint">{a.hint}</em>{/if}
                </button>
              {:else}
                <div class="btn act" class:dis={!a.ok}>
                  <span class="lbl">{a.label}{#if a.why}<em class="why">{a.why}</em>{/if}</span>
                  {#if a.chip}<em class="rchip">{a.chip}</em>{/if}
                  {#if a.hint && a.ok}<em class="hint">{a.hint}</em>{/if}
                </div>
              {/if}
            {/each}
            {#if detail!.note}<div class="pnote">{detail!.note}</div>{/if}
          </div>
        {/snippet}
        {#if actionsOpen && !viewing}
          <div class="layer" use:layer={{ kind: 'menu', close: () => (actionsOpen = false) }}>
            {@render actionList(true)}
          </div>
        {:else}
          {@render actionList(false)}
        {/if}
      {:else}
        <div class="nothing">{viewing ? `${owner.name} has no cards yet.` : 'No cards yet. Deeds you buy land here.'}</div>
      {/if}
    </div>
  </div>
  <div class="foot">
    <PromptBar {prompts} {family} {swap} />
    <span class="padbadge" style="--pc:{gs.seats[seat].color}">
      <svg width="30" height="21" viewBox="0 0 40 28" aria-hidden="true"><path d="M11 3h18c5 0 8 4 9 10l1.5 8c.6 3.5-3.4 6-6 3.6L28 19H12l-5.5 5.6C3.9 27-.1 24.5.5 21L2 13C3 7 6 3 11 3z" fill="none" stroke="#FBF6EA" stroke-width="2.2" stroke-linejoin="round" /><path d="M10 9v6M7 12h6" stroke="#FBF6EA" stroke-width="2.2" stroke-linecap="round" /><circle cx="28" cy="10" r="1.8" fill="#FBF6EA" /><circle cx="31.5" cy="13.5" r="1.8" fill="#FBF6EA" /></svg>
      <em>{gs.seats[seat].name}{padLabel ? ` · ${padLabel}` : ''}</em>
    </span>
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.45);
  }
  .inv {
    position: absolute;
    left: 24px;
    top: 24px;
    width: 1872px;
    height: 1032px;
    padding: 18px 24px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    background: #fbf6ea;
    border-radius: 16px;
    color: #2b2119;
    font-family: 'Source Sans 3', sans-serif;
    box-shadow: 0 2px 0 rgba(43, 33, 25, 0.08), 0 14px 34px rgba(10, 5, 2, 0.42), 0 3px 8px rgba(10, 5, 2, 0.28);
  }
  .inv :global(*) {
    box-sizing: border-box;
  }
  em {
    font-style: normal;
  }
  .ihead {
    height: 78px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex: none;
  }
  .tok {
    width: 64px;
    height: 64px;
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    border: 4px solid;
    background: radial-gradient(circle at 40% 35%, #fffdf6, #eadfc6);
    overflow: hidden;
    flex: none;
    box-shadow: 0 2px 5px rgba(10, 5, 2, 0.3);
  }
  .tok img {
    width: 86%;
    height: 86%;
    object-fit: contain;
    margin-top: 6%;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #8e2f23;
  }
  .h1 {
    font: 800 38px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 72;
    margin-top: 6px;
    white-space: nowrap;
  }
  .spacer {
    flex: 1;
  }
  .lab {
    font: 700 14px/1.1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #5e4c3b;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 18px;
    border-left: 1.5px solid rgba(43, 33, 25, 0.14);
  }
  .stat.last {
    padding-right: 0;
  }
  .statv {
    font: 800 26px/1 'Fraunces', serif;
  }
  .amt {
    font: 800 38px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 72;
  }
  .debtbar {
    display: flex;
    align-items: center;
    gap: 22px;
    margin-left: 16px;
    padding: 10px 14px 10px 18px;
    border-radius: 12px;
    background: #8e2f23;
    color: #fbf6ea;
  }
  .debtbar .dt {
    font: 800 24px/1.1 'Fraunces', serif;
  }
  .debtbar .ds {
    font: 600 15px/1.25 'Source Sans 3', sans-serif;
    opacity: 0.9;
    max-width: 380px;
  }
  .need {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .need .lab {
    color: #f3d3d6;
  }
  .nv {
    font: 800 30px/1 'Fraunces', serif;
  }
  .btn {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 18px;
    border: 0;
    border-radius: 10px;
    background: #f3ead6;
    color: #2b2119;
    font: 600 20px/1.1 'Source Sans 3', sans-serif;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.18);
    text-align: left;
    flex: none;
    cursor: pointer;
  }
  .btn .lbl {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .btn .hint {
    font: 600 15px/1.2 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    text-align: right;
  }
  .btn .why {
    font: 600 15px/1.15 'Source Sans 3', sans-serif;
    color: #8e2f23;
  }
  .btn[aria-disabled='true'],
  .btn.dis {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.2);
    color: rgba(43, 33, 25, 0.5);
    cursor: default;
  }
  .btn[aria-disabled='true'] .why,
  .btn.dis .why {
    color: #8e2f23;
  }
  .rchip {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    padding: 5px 8px;
    border-radius: 6px;
    background: #fbf6ea;
    color: #8e2f23;
    box-shadow: 0 0 0 1.5px #8e2f23;
  }
  .btn.danger {
    height: 52px;
    background: #fbf6ea;
    color: #8e2f23;
    font-weight: 800;
  }
  .loanbtn {
    height: 52px;
    margin-left: 6px;
  }
  .ibody {
    display: flex;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }
  .binder {
    width: 1236px;
    display: flex;
  }
  .bpage {
    width: 598px;
    height: 100%;
    background: #f3ead6;
    border-radius: 10px;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.12), inset 0 2px 8px rgba(43, 33, 25, 0.08);
    padding: 6px 12px;
    display: flex;
    flex-direction: column;
  }
  .spine {
    width: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
  }
  .ring {
    width: 34px;
    height: 16px;
    border-radius: 9px;
    border: 4px solid #b48a3e;
    box-shadow: inset 0 1px 0 #fff3c9, 0 2px 3px rgba(10, 5, 2, 0.4);
  }
  .brow {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1.5px dashed rgba(43, 33, 25, 0.14);
  }
  .brow:last-child {
    border-bottom: 0;
  }
  .blab {
    width: 122px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bgname {
    display: flex;
    align-items: center;
    gap: 7px;
    font: 700 14px/1.1 'Source Sans 3', sans-serif;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }
  .chip {
    display: inline-block;
    width: 24px;
    height: 16px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    flex: none;
  }
  .chip.big {
    width: 30px;
    height: 20px;
  }
  .bcount {
    font: 800 24px/1 'Fraunces', serif;
  }
  .bcount small {
    font: 600 15px/1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    margin-left: 4px;
  }
  .btags {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: 700 14px/1.15 'Source Sans 3', sans-serif;
    padding: 4px 8px;
    border-radius: 5px;
    color: #fbf6ea;
  }
  .slots {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .slots.wide {
    flex: 1;
  }
  .ghost {
    display: contents;
  }
  .ghost :global(.slot) {
    cursor: default;
  }
  .nopr {
    height: 122px;
    flex: 1;
    margin: 5px;
    border: 2px dashed rgba(43, 33, 25, 0.2);
    border-radius: 8px;
    display: grid;
    place-items: center;
    font: 600 16px/1.3 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    text-align: center;
    padding: 0 20px;
  }
  .dpane {
    width: 564px;
    background: #f6eedb;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.1);
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }
  .loans {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .loan {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #fbf6ea;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.14);
    font: 600 15px/1.2 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .loan b {
    color: #2b2119;
  }
  .lk {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #8e2f23;
  }
  .link {
    border: 0;
    background: none;
    font: 700 16px/1 'Source Sans 3', sans-serif;
    color: #2f5d46;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 8px;
    margin-left: auto;
  }
  .dphead {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dpt {
    font: 800 26px/1.05 'Fraunces', serif;
  }
  .dps {
    font: 600 16px/1.2 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    margin-top: 3px;
  }
  .dprow {
    display: flex;
    gap: 16px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 156px;
    padding-top: 4px;
  }
  .sv {
    font: 800 27px/1.05 'Fraunces', serif;
    margin-top: 5px;
  }
  .sv.ox {
    color: #8e2f23;
  }
  .sv.fo {
    color: #2f5d46;
  }
  .ss {
    font: 600 15px/1.3 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    margin-top: 4px;
  }
  .sib {
    display: flex;
    gap: 2px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-top: 2px;
  }
  .act {
    width: 100%;
  }
  .pnote {
    font: 600 16px/1.35 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .nothing {
    margin: auto;
    font: 600 18px/1.3 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .foot {
    height: 60px;
    flex: none;
    border-top: 1.5px solid rgba(43, 33, 25, 0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 6px;
    position: relative;
  }
  .padbadge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 18px 0 14px;
    border-radius: 24px;
    font: 700 17px/1 'Source Sans 3', sans-serif;
    background: var(--pc);
    color: #fbf6ea;
    box-shadow: 0 0 0 2px rgba(43, 33, 25, 0.25);
  }
</style>
