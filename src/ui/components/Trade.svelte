<script lang="ts">
  // Trade (Stage 3 §4): "Across the Table + Deal Strip". Replaces TradePanel.
  //   compose — the proposer's mini binder (left), the tray (center), the partner's (right),
  //             the deal strip in plain sentences. Proposer's controller only.
  //   review  — the receiver answers with their own controller: hold to accept, counter, or
  //             decline (focus + Confirm only; Back never decides, Stage 1 rule).
  //   waiting — the proposer waits (bot receiver, or Back pressed on the proposer's pad), with
  //             Withdraw.
  import { PROMISE_GROUP_ORDER, promiseGroupOf, samePromise, type PromiseGroup, type PromiseTerm, type State, type TradeOffer } from '../../engine';
  import type { Intent } from '../../input/keys';
  import { getPortrait } from '../../render/portraits';
  import { layer } from '../menuStack';
  import { focusEl, focusables } from '../focus';
  import { money, type GlyphFamily } from '../present';
  import { GROUP_LABEL, uiGroupColor } from '../groups';
  import {
    dealSentences,
    emptyOffer,
    offerProblem,
    partners,
    promiseGroupsFor,
    promisesOffReason,
    sideOf,
    sideSummary,
    tradeTiles,
  } from '../trade';
  import CardSlot from '../cards/CardSlot.svelte';
  import GameCard from '../cards/GameCard.svelte';
  import PromptBar from '../cards/PromptBar.svelte';
  import { deedCard, voucherCard, type CardItem, type Prompt } from '../cards/model';
  import Coin from '../cards/Coin.svelte';

  type PadOf = (seat: number) => { family: GlyphFamily; label: string | null };

  let {
    gs,
    mode,
    seat,
    initial = null,
    counter = false,
    swap = false,
    padOf,
    isConfirmHeld = () => false,
    registerIntent,
    onsubmit,
    oncancel,
    onaccept,
    onreject,
    oncounter,
  }: {
    gs: State;
    mode: 'compose' | 'review' | 'waiting';
    /** compose: the proposer; review: the receiver; waiting: the proposer. */
    seat: number;
    initial?: TradeOffer | null;
    counter?: boolean;
    swap?: boolean;
    padOf: PadOf;
    isConfirmHeld?: (seat: number) => boolean;
    registerIntent?: (h: ((i: Intent, deviceSeat: number | null) => boolean) | null) => void;
    onsubmit?: (o: TradeOffer) => void;
    oncancel?: () => void;
    onaccept?: () => void;
    onreject?: () => void;
    oncounter?: () => void;
  } = $props();

  // ---- compose state -------------------------------------------------------------------------
  // svelte-ignore state_referenced_locally
  let offer = $state<TradeOffer>(initial ? structuredClone(initial) : emptyOffer(seat, partners(gs, seat)[0] ?? (seat + 1) % gs.seats.length));
  let cashEd = $state<{ who: number; before: number } | null>(null);
  type Draft = { promiser: number; index: number | null; kind: PromiseTerm['kind']; group: PromiseGroup; n: number };
  let draft = $state<Draft | null>(null);
  /** Review: the proposer pressed Back on their pad — show the waiting card with Withdraw. */
  let proposerWaiting = $state(false);

  const live = $derived(mode === 'compose' ? offer : gs.trade);
  const from = $derived(live?.from ?? seat);
  const to = $derived(live?.to ?? seat);
  const problem = $derived(mode === 'compose' ? offerProblem(gs, offer) : null);
  const locked = $derived(promisesOffReason(gs));
  const name = (i: number) => gs.seats[i].name;
  const tok = (i: number) => getPortrait(gs.seats[i].token, gs.seats[i].color);

  // ---- mini binders --------------------------------------------------------------------------
  interface Pocket {
    key: string;
    label: string;
    chip: string | null;
    count: string;
    slots: { key: string; item: CardItem; tile?: number; jail?: number; inOffer: boolean; blocked: string | null }[];
  }
  function pockets(who: number, o: TradeOffer): Pocket[] {
    const side = sideOf(o, who);
    const tiles = tradeTiles(gs, who);
    const out: Pocket[] = [];
    for (const g of PROMISE_GROUP_ORDER) {
      const mine = tiles.filter((t) => t.group === g);
      if (!mine.length) continue;
      const total = gs.board.tiles.filter((t) => promiseGroupOf(gs.board, t.index) === g).length;
      out.push({
        key: g,
        label: GROUP_LABEL[g],
        chip: g === 'railroad' || g === 'utility' ? null : uiGroupColor(gs.board, g),
        count: `${mine.length}/${total}`,
        slots: mine.map((t) => ({ key: `t${t.tile}`, item: deedCard(gs, t.tile), tile: t.tile, inOffer: side.tiles.includes(t.tile), blocked: t.blocked })),
      });
    }
    const jail = gs.players[who].gojf;
    if (jail.length) {
      out.push({
        key: 'jail',
        label: jail.length === 1 ? 'Jail card' : 'Jail cards',
        chip: null,
        count: String(jail.length),
        slots: jail.map((deck, i) => ({ key: `j${i}`, item: { t: 'gojf', deck }, jail: i, inOffer: i < side.gojf, blocked: null })),
      });
    }
    return out;
  }

  // ---- offer edits ---------------------------------------------------------------------------
  function toggleTile(who: number, tile: number, blocked: string | null) {
    if (blocked) return;
    const side = sideOf(offer, who);
    const i = side.tiles.indexOf(tile);
    if (i >= 0) side.tiles.splice(i, 1);
    else side.tiles.push(tile);
  }
  function toggleJail(who: number, i: number) {
    const side = sideOf(offer, who);
    side.gojf = i < side.gojf ? side.gojf - 1 : Math.min(gs.players[who].gojf.length, side.gojf + 1);
  }
  function setPartner(p: number) {
    if (p === offer.to) return;
    offer = emptyOffer(offer.from, p);
  }
  function openCash(who: number) {
    cashEd = { who, before: sideOf(offer, who).cash };
  }
  function stepCash(d: number) {
    if (!cashEd) return;
    const side = sideOf(offer, cashEd.who);
    side.cash = Math.max(0, Math.min(gs.players[cashEd.who].cash, side.cash + d));
  }
  function closeCash(keep: boolean) {
    if (!cashEd) return;
    if (!keep) sideOf(offer, cashEd.who).cash = cashEd.before;
    cashEd = null;
  }

  // ---- voucher sheet -------------------------------------------------------------------------
  const other = (who: number) => (who === offer.from ? offer.to : offer.from);
  function openVoucher(promiser: number, index: number | null = null) {
    if (locked) return;
    if (index !== null) {
      const p = offer.promises[index];
      draft = { promiser: p.from, index, kind: p.kind, group: p.group, n: p.left };
      return;
    }
    const owns = PROMISE_GROUP_ORDER.find((g) => gs.board.tiles.some((t) => promiseGroupOf(gs.board, t.index) === g && gs.tiles[t.index].owner === promiser));
    draft = { promiser, index: null, kind: 'rentFree', group: owns ?? 'brown', n: 3 };
  }
  const draftTerm = $derived<PromiseTerm | null>(draft ? { kind: draft.kind, from: draft.promiser, to: other(draft.promiser), group: draft.group, total: draft.n, left: draft.n } : null);
  const draftProblem = $derived.by(() => {
    if (!draft || !draftTerm) return null;
    const dup = offer.promises.findIndex((p, i) => i !== draft!.index && samePromise(p, draftTerm!));
    if (dup >= 0) return 'That promise is already in the offer. Edit it there.';
    const test: TradeOffer = { ...offer, promises: offer.promises.map((p, i) => (i === draft!.index ? draftTerm! : p)) };
    if (draft.index === null) test.promises = [...test.promises, draftTerm];
    const why = offerProblem(gs, test);
    return why && /promise|group|landings|rounds/.test(why) ? why.charAt(0).toUpperCase() + why.slice(1) + '.' : null;
  });
  function setKind(k: PromiseTerm['kind']) {
    if (!draft) return;
    draft.kind = k;
    const list = promiseGroupsFor(k);
    if (!list.includes(draft.group)) draft.group = list[0];
    draft.n = Math.min(draft.n, k === 'noBuild' ? 20 : 99);
  }
  function stepGroup(d: number): boolean {
    if (!draft) return false;
    const list = promiseGroupsFor(draft.kind);
    const i = list.indexOf(draft.group);
    const j = i + d;
    if (j < 0 || j >= list.length) return false;
    draft.group = list[j];
    return true;
  }
  function stepLength(d: number): boolean {
    if (!draft) return false;
    const max = draft.kind === 'noBuild' ? 20 : 99;
    const n = Math.max(1, Math.min(max, draft.n + d));
    if (n === draft.n) return false;
    draft.n = n;
    return true;
  }
  function saveVoucher() {
    if (!draft || !draftTerm || draftProblem) return;
    if (draft.index === null) offer.promises.push({ ...draftTerm });
    else offer.promises[draft.index] = { ...draftTerm };
    draft = null;
  }
  function removeVoucher() {
    if (!draft || draft.index === null) return;
    offer.promises.splice(draft.index, 1);
    draft = null;
  }
  const onstep = (f: (d: number) => boolean) => (e: Event) => {
    if (f((e as CustomEvent<number>).detail)) e.preventDefault();
  };

  // ---- review: hold to accept ----------------------------------------------------------------
  const HOLD_MS = 800;
  let hold = $state(0);
  let holding = false;
  let mouseDown = false;
  function startHold(source: 'pad' | 'mouse') {
    if (holding || mode !== 'review') return;
    holding = true;
    const t0 = performance.now();
    const step = () => {
      const held = source === 'mouse' ? mouseDown : isConfirmHeld(seat);
      if (!held) {
        holding = false;
        hold = 0;
        return;
      }
      hold = Math.min(1, (performance.now() - t0) / HOLD_MS);
      if (hold >= 1) {
        holding = false;
        onaccept?.();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- controller -----------------------------------------------------------------------------
  let root = $state<HTMLElement | null>(null);
  function jumpColumn(d: 1 | -1) {
    if (!root) return;
    const cols = ['left', 'tray', 'right'];
    const a = document.activeElement as HTMLElement | null;
    const cur = a?.closest<HTMLElement>('[data-col]')?.dataset.col ?? 'left';
    for (let k = 1; k <= 3; k++) {
      const c = cols[(cols.indexOf(cur) + d * k + 3) % 3];
      const el = root.querySelector(`[data-col="${c}"]`);
      const f = el ? focusables(el)[0] : null;
      if (f) {
        focusEl(f);
        return;
      }
    }
  }

  $effect(() => {
    registerIntent?.((i, dev) => {
      if (mode === 'compose') {
        if (cashEd) {
          if (i === 'navLeft' || i === 'navRight') stepCash(i === 'navRight' ? 10 : -10);
          else if (i === 'cycleLeft' || i === 'cycleRight') stepCash(i === 'cycleRight' ? 100 : -100);
          else if (i === 'navUp' || i === 'navDown' || i === 'trade') return true;
          else return false;
          return true;
        }
        if (draft) {
          if (i === 'trade') {
            saveVoucher();
            return true;
          }
          const a = document.activeElement as HTMLElement | null;
          if ((i === 'cycleLeft' || i === 'cycleRight') && a?.dataset.big) {
            stepLength(i === 'cycleRight' ? 5 : -5);
            return true;
          }
          return false;
        }
        if (i === 'cycleLeft' || i === 'cycleRight') {
          jumpColumn(i === 'cycleRight' ? 1 : -1);
          return true;
        }
        if (i === 'trade') {
          if (!problem) onsubmit?.($state.snapshot(offer));
          return true;
        }
        if (i === 'back') {
          // Back leaves the tray first, then cancels (one level at a time).
          const a = document.activeElement as HTMLElement | null;
          if (a?.closest('[data-col="tray"]') && root) {
            const f = focusables(root.querySelector('[data-col="left"]')!)[0];
            if (f) {
              focusEl(f);
              return true;
            }
          }
          return false;
        }
        return false;
      }
      if (mode === 'review' && gs.trade) {
        // The proposer's controller is paused; Back on it opens the waiting card (withdraw).
        if (dev !== null && dev === gs.trade.from) {
          if (i === 'back') proposerWaiting = !proposerWaiting;
          else if (proposerWaiting) return false; // move / confirm on Withdraw or Keep waiting
          return true;
        }
        if (proposerWaiting) return false;
        // Back never decides a trade (Stage 1): it does nothing on review.
        if (i === 'back') return true;
        if (i === 'trade') {
          oncounter?.();
          return true;
        }
        if (i === 'confirm') {
          const a = document.activeElement as HTMLElement | null;
          if (!a || !root?.contains(a)) {
            const acc = root?.querySelector<HTMLElement>('[data-accept]');
            if (acc) focusEl(acc);
            return true;
          }
        }
        return false;
      }
      return false;
    });
    return () => registerIntent?.(null);
  });

  // ---- deal strip ----------------------------------------------------------------------------
  const sentences = $derived(live ? dealSentences(gs, live, mode === 'review' ? seat : null) : []);
  function nameRuns(text: string): { t: string; seat: number | null }[] {
    const names = gs.seats.map((x, i) => ({ n: x.name, i })).sort((a, b) => b.n.length - a.n.length);
    const out: { t: string; seat: number | null }[] = [];
    let rest = text;
    while (rest) {
      let best: { at: number; n: string; i: number } | null = null;
      for (const { n, i } of names) {
        const at = rest.indexOf(n);
        if (at >= 0 && (!best || at < best.at)) best = { at, n, i };
      }
      if (!best) {
        out.push({ t: rest, seat: null });
        break;
      }
      if (best.at) out.push({ t: rest.slice(0, best.at), seat: null });
      out.push({ t: best.n, seat: best.i });
      rest = rest.slice(best.at + best.n.length);
    }
    return out;
  }

  // ---- review figures ------------------------------------------------------------------------
  const cashAfter = (who: number) => {
    if (!live) return gs.players[who].cash;
    const gives = sideOf(live, who).cash;
    const gets = sideOf(live, who === live.from ? live.to : live.from).cash;
    return gs.players[who].cash - gives + gets;
  };
  function sideCards(who: number): CardItem[] {
    if (!live) return [];
    const side = sideOf(live, who);
    const decks = gs.players[who].gojf;
    return [
      ...side.tiles.map((t) => deedCard(gs, t) as CardItem),
      ...(side.cash ? [{ t: 'cash', amount: side.cash } as CardItem] : []),
      ...Array.from({ length: side.gojf }, (_, i) => ({ t: 'gojf', deck: decks[i] ?? 'chance' }) as CardItem),
      ...live.promises.filter((p) => p.from === who).map((p) => voucherCard(gs, p) as CardItem),
    ];
  }

  // ---- prompts -------------------------------------------------------------------------------
  const pad = $derived(padOf(mode === 'review' ? seat : from));
  const prompts = $derived<Prompt[]>(
    mode === 'review'
      ? [
          { glyphs: ['dpadLR'], label: 'Move' },
          { glyphs: ['confirm'], label: 'Hold to accept' },
          { glyphs: ['trade'], label: 'Counter', onclick: () => oncounter?.() },
        ]
      : cashEd
        ? [
            { glyphs: ['dpadLR'], label: '±$10' },
            { glyphs: ['cycleLeft', 'cycleRight'], label: '±$100' },
            { glyphs: ['confirm'], label: 'Done', onclick: () => closeCash(true) },
            { glyphs: ['back'], label: 'Undo', onclick: () => closeCash(false) },
          ]
        : draft
          ? [
              { glyphs: ['dpadUD'], label: 'Step' },
              { glyphs: ['dpadLR'], label: 'Change' },
              { glyphs: ['trade'], label: 'Add to offer', onclick: saveVoucher },
              { glyphs: ['back'], label: 'Cancel', onclick: () => (draft = null) },
            ]
          : [
              { glyphs: ['dpad'], label: 'Move' },
              { glyphs: ['confirm'], label: 'Add / remove' },
              { glyphs: ['cycleLeft', 'cycleRight'], label: 'Jump column' },
              { glyphs: ['trade'], label: 'Propose', onclick: () => !problem && onsubmit?.($state.snapshot(offer)) },
              { glyphs: ['back'], label: 'Cancel', onclick: () => oncancel?.() },
            ],
  );
  const note = $derived(
    mode === 'review'
      ? 'Counter opens the same screen with sides swapped'
      : locked
        ? 'Properties, cash and jail cards still trade normally'
        : offer.promises.length
          ? 'Confirm on a promise in the tray edits it'
          : '',
  );
</script>

{#snippet tokEl(i: number, size: number)}
  <span class="tok" style="width:{size}px;height:{size}px;border-color:{gs.seats[i].color}">{#if tok(i)}<img src={tok(i)} alt="" />{/if}</span>
{/snippet}

{#snippet padBadge(i: number, on: boolean)}
  {@const p = padOf(i)}
  <span class="padbadge" class:on style="--pc:{gs.seats[i].color}">
    <svg width="30" height="21" viewBox="0 0 40 28" aria-hidden="true"><path d="M11 3h18c5 0 8 4 9 10l1.5 8c.6 3.5-3.4 6-6 3.6L28 19H12l-5.5 5.6C3.9 27-.1 24.5.5 21L2 13C3 7 6 3 11 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" /><path d="M10 9v6M7 12h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="28" cy="10" r="1.8" fill="currentColor" /><circle cx="31.5" cy="13.5" r="1.8" fill="currentColor" /></svg>
    <em>{name(i)}{p.label ? ` · ${p.label}` : ''}</em>
  </span>
{/snippet}

{#snippet lockIcon(size: number, color: string)}
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="11" rx="2" fill={color} /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke={color} stroke-width="2.4" /><circle cx="12" cy="15.6" r="1.6" fill="#FBF6EA" /></svg>
{/snippet}

{#snippet swapIcon(size: number)}
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><path d="M5 11h20m-5-5 5 5-5 5M27 21H7m5-5-5 5 5 5" fill="none" stroke="#C39445" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
{/snippet}

{#snippet deal(big: boolean)}
  <div class="deal" class:big>
    <div class="dl"><span class="eyebrow">The deal</span><span class="lab">{mode === 'review' ? `For ${name(seat)}` : 'In plain words'}</span></div>
    <div class="dtx" data-deal>
      {#each sentences as s, k}
        {#each nameRuns(s) as r}{#if r.seat !== null}<span class="pn" style="border-color:{gs.seats[r.seat].color}">{r.t}</span>{:else}{r.t}{/if}{/each}{k < sentences.length - 1 ? ' ' : ''}
      {/each}
      {#if mode === 'compose' && !offer.promises.length && !locked}<span class="muted"> No promises yet.</span>{/if}
    </div>
  </div>
{/snippet}

{#snippet miniBinder(who: number)}
  {@const side = sideOf(offer, who)}
  <div class="mb" data-col={who === offer.from ? 'left' : 'right'}>
    <div class="mbh">
      {@render tokEl(who, 48)}<span class="pname">{name(who)}</span>
      <div class="mcash"><span class="lab">Cash</span><b>{money(gs.players[who].cash)}</b></div>
    </div>
    <div class="pockets">
      {#each pockets(who, offer) as pk (pk.key)}
        <div class="pocket">
          <div class="plab">{#if pk.chip}<span class="chip" style="background:{pk.chip}"></span>{/if}{pk.label} <b>{pk.count}</b></div>
          <div class="pslots">
            {#each pk.slots as x (x.key)}
              <CardSlot
                item={x.item}
                inOffer={x.inOffer}
                blocked={x.blocked}
                label={x.item.t === 'deed' ? x.item.name : 'Get Out of Jail Free'}
                data-focus-key="{who}-{x.key}"
                onclick={() => (x.tile !== undefined ? toggleTile(who, x.tile, x.blocked) : toggleJail(who, x.jail!))}
              />
            {/each}
          </div>
        </div>
      {/each}
      <div class="pocket">
        <div class="plab">Cash</div>
        <div class="pslots">
          <CardSlot
            item={{ t: 'cash', amount: gs.players[who].cash }}
            current={cashEd?.who === who}
            tag={side.cash ? `−${money(side.cash)}` : null}
            tagColor="#2F5D46"
            label="Cash {money(gs.players[who].cash)}"
            data-focus-key="{who}-cash"
            data-autofocus={who === offer.from && !offer.give.tiles.length ? true : undefined}
            onclick={() => openCash(who)}
          />
        </div>
      </div>
      <div class="pocket">
        <div class="plab">Promise</div>
        <div class="pslots">
          {#if locked}
            <CardSlot locked="Promises off" disabled tabindex={-1} />
          {:else}
            <CardSlot label="Add a promise from {name(who)}" data-focus-key="{who}-promise" onclick={() => openVoucher(who)}>
              <span class="addv"><span class="plus">+</span><span>Promise</span></span>
            </CardSlot>
          {/if}
        </div>
      </div>
    </div>
    {#if cashEd?.who === who}
      <div class="layer" use:layer={{ kind: 'dialog', close: () => closeCash(false) }}>
        <div class="cashpop" role="dialog" aria-label="Cash to give">
          <span class="lab">Cash to give {name(other(who))}</span>
          <button class="stepper big" data-autofocus data-focus-key="cash-stepper" onclick={() => closeCash(true)}>
            <span class="arr">◀</span><span class="sval">{money(side.cash)}</span><span class="arr">▶</span>
          </button>
          <div class="cphint">
            <span><Coin glyph="dpadLR" family={pad.family} {swap} />$10</span>
            <span><Coin glyph="cycleLeft" family={pad.family} {swap} /><Coin glyph="cycleRight" family={pad.family} {swap} />$100</span>
            <span>max {money(gs.players[who].cash)}</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet trayCol(who: number)}
  {@const side = sideOf(offer, who)}
  {@const decks = gs.players[who].gojf}
  <div class="trcol">
    <div class="trh"><span class="who"><i style="background:{gs.seats[who].color}"></i>{name(who)} gives</span></div>
    <div class="trgrid">
      {#each side.tiles as t (t)}
        <CardSlot item={deedCard(gs, t)} label="Remove {gs.board.tiles[t].name}" data-focus-key="tray-{who}-t{t}" onclick={() => toggleTile(who, t, null)} />
      {/each}
      {#if side.cash}
        <CardSlot item={{ t: 'cash', amount: side.cash }} label="Edit cash" data-focus-key="tray-{who}-cash" onclick={() => openCash(who)} />
      {/if}
      {#each Array(side.gojf) as _, i}
        <CardSlot item={{ t: 'gojf', deck: decks[i] ?? 'chance' }} label="Remove jail card" data-focus-key="tray-{who}-j{i}" onclick={() => toggleJail(who, 0)} />
      {/each}
      {#each offer.promises as p, i (i)}
        {#if p.from === who}
          <CardSlot item={voucherCard(gs, p)} label="Edit promise" data-focus-key="tray-{who}-p{i}" onclick={() => openVoucher(who, i)} />
        {/if}
      {/each}
      <div class="trdrop">Confirm on a card to add it</div>
    </div>
    <div class="trsum">{sideSummary(gs, offer, who)}</div>
  </div>
{/snippet}

<div class="dim"></div>
<div class="panel tp" bind:this={root} data-screen="trade" data-mode={mode}>
  {#if mode === 'compose'}
    <div class="thead">
      {@render tokEl(offer.from, 64)}
      <div>
        <div class="eyebrow">Trade · {counter ? 'Counter-offer' : 'New offer'}</div>
        <div class="h1">{name(offer.from)} ⇄ {name(offer.to)}</div>
      </div>
      {#if !counter}
        <div class="pick">
          <span class="lab">With</span>
          {#each partners(gs, offer.from) as p (p)}
            <button class="pbtn" class:sel={p === offer.to} aria-pressed={p === offer.to} data-focus-key="partner-{p}" onclick={() => setPartner(p)}>
              {@render tokEl(p, 44)}{name(p)}{#if gs.seats[p].kind === 'bot'}<small>BOT</small>{/if}
            </button>
          {/each}
        </div>
      {/if}
      <div class="spacer"></div>
      {@render padBadge(offer.from, true)}
    </div>
    <div class="tbody">
      {@render miniBinder(offer.from)}
      <div class="mid">
        <div class="tray" data-col="tray">
          {#if locked}<div class="lockline">{@render lockIcon(24, '#8E2F23')}<span><b>{locked.split(':')[0]}:</b>{locked.includes(':') ? locked.slice(locked.indexOf(':') + 1) : ''}</span></div>{/if}
          <div class="trcols">
            {@render trayCol(offer.from)}
            <div class="swap">{@render swapIcon(34)}</div>
            {@render trayCol(offer.to)}
          </div>
        </div>
        <div class="mbtns">
          <button class="btn primary propose" aria-disabled={problem ? 'true' : undefined} data-focus-key="propose" onclick={() => !problem && onsubmit?.($state.snapshot(offer))}>
            <Coin glyph="trade" family={pad.family} {swap} />
            <span class="lbl">{counter ? `Send counter to ${name(offer.to)}` : `Propose to ${name(offer.to)}`}{#if problem}<em class="why">{problem.charAt(0).toUpperCase() + problem.slice(1)}.</em>{/if}</span>
          </button>
          <button class="btn cancel" data-focus-key="cancel" onclick={() => oncancel?.()}><Coin glyph="back" family={pad.family} {swap} /><span class="lbl">Cancel</span></button>
        </div>
      </div>
      {@render miniBinder(offer.to)}
    </div>
    {@render deal(false)}
  {:else if live}
    {@const receiver = live.to}
    {@const proposer = live.from}
    {#if mode === 'review' && !proposerWaiting}
      <div class="banner" style="background:linear-gradient(90deg,{gs.seats[receiver].color},color-mix(in srgb,{gs.seats[receiver].color} 78%,#000))">
        {@render tokEl(receiver, 76)}
        <div class="bt">
          <div class="h1">{name(receiver)}, it's your call</div>
          <div class="bs">{name(proposer)} sent you a trade. Answer with <b>your {pad.label ?? 'controller'}</b>.</div>
        </div>
        <div class="paused">{@render lockIcon(20, '#FBF6EA')}{name(proposer)}'s controller is paused</div>
        {@render padBadge(receiver, true)}
      </div>
    {:else}
      <div class="banner wait" style="background:linear-gradient(90deg,{gs.seats[proposer].color},color-mix(in srgb,{gs.seats[proposer].color} 78%,#000))">
        {@render tokEl(proposer, 76)}
        <div class="bt">
          <div class="h1">Waiting for {name(receiver)}</div>
          <div class="bs">{gs.seats[receiver].kind === 'human' ? `${name(receiver)} is answering with their own controller.` : `${name(receiver)} is thinking it over.`}</div>
        </div>
        {@render padBadge(proposer, true)}
      </div>
    {/if}
    <div class="tbody">
      <div class="rail wait">
        <div class="rch">{@render tokEl(proposer, 48)}<span class="pname">{name(proposer)}</span></div>
        <span class="waitpill">Waiting for {name(receiver)}</span>
        <div class="chg"><div class="cv">{money(gs.players[proposer].cash)} <span class="ar">→</span> {money(cashAfter(proposer))}</div><div class="cs">Cash after the trade</div></div>
      </div>
      <div class="rcenter">
        <div class="tray rtray">
          {#each [proposer, receiver] as who, k (who)}
            {@const cards = sideCards(who)}
            {#if k === 1}<div class="swap">{@render swapIcon(40)}</div>{/if}
            <div class="rhalf">
              <div class="trh"><span class="who"><i style="background:{gs.seats[who].color}"></i>{mode === 'review' ? (who === proposer ? `You get · from ${name(proposer)}` : `You give · to ${name(proposer)}`) : `${name(who)} gives`}</span></div>
              <div class="rcards" class:many={cards.length > 4}>
                {#each cards as c, i (i)}<GameCard item={c} size={cards.length > 4 ? 'thumb' : 'std'} />{/each}
                {#if !cards.length}<div class="trempty">Nothing</div>{/if}
              </div>
            </div>
          {/each}
        </div>
        {#if mode === 'review' && !proposerWaiting}
          <div class="mbtns center">
            <button
              class="btn primary accept"
              data-accept
              data-autofocus
              data-focus-key="accept"
              onclick={(e) => (e.detail === 0 ? startHold('pad') : undefined)}
              onpointerdown={() => ((mouseDown = true), startHold('mouse'))}
              onpointerup={() => (mouseDown = false)}
              onpointerleave={() => (mouseDown = false)}
            >
              <span class="holdring" style="--p:{hold * 100}%"><span><Coin glyph="confirm" family={pad.family} {swap} size={30} /></span></span>
              <span class="lbl">Accept<span class="sub">Hold to accept</span></span>
            </button>
            <button class="btn" data-focus-key="counter" onclick={() => oncounter?.()}><Coin glyph="trade" family={pad.family} {swap} /><span class="lbl">Counter</span><em class="hint">Edit and send back</em></button>
            <button class="btn" data-focus-key="decline" onclick={() => onreject?.()}><span class="cspace"></span><span class="lbl">Decline</span></button>
          </div>
        {:else}
          <div class="mbtns center">
            <button class="btn" data-autofocus data-focus-key="withdraw" onclick={() => oncancel?.()}><span class="lbl">Withdraw offer</span></button>
            {#if proposerWaiting}<button class="btn" data-focus-key="back-review" onclick={() => (proposerWaiting = false)}><span class="lbl">Keep waiting</span></button>{/if}
          </div>
        {/if}
      </div>
      <div class="rail">
        <div class="rch">{@render tokEl(receiver, 48)}<span class="pname">{name(receiver)}{mode === 'review' ? ' · you' : ''}</span></div>
        <div class="chg"><div class="cv">{money(gs.players[receiver].cash)} <span class="ar">→</span> {money(cashAfter(receiver))}</div><div class="cs">Cash after the trade</div></div>
      </div>
    </div>
    {@render deal(true)}
  {/if}
  <div class="tfoot">
    <PromptBar {prompts} family={pad.family} {swap} />
    {#if note}<span class="pnote">{note}</span>{/if}
  </div>

  {#if draft && draftTerm}
    {@const promiser = draft.promiser}
    {@const holder = other(draft.promiser)}
    <div class="layer" use:layer={{ kind: 'dialog', close: () => (draft = null) }}>
      <div class="veil"></div>
      <div class="panel vsheet" role="dialog" aria-label="Promise voucher">
        <div class="vsh">
          <div>
            <div class="eyebrow">Promise voucher · {name(promiser)}'s side</div>
            <div class="h1">{name(promiser)} promises {name(holder)}…</div>
          </div>
          {@render padBadge(offer.from, true)}
        </div>
        <div class="vgrid">
          <div class="vleft">
            <div class="vrow">
              <span class="lab">1 · Kind</span>
              <div class="kinds">
                <button class="kind" class:sel={draft.kind === 'rentFree'} aria-pressed={draft.kind === 'rentFree'} data-autofocus={draft.kind === 'rentFree' ? true : undefined} onclick={() => setKind('rentFree')}>
                  <GameCard item={voucherCard(gs, { ...draftTerm, kind: 'rentFree', group: promiseGroupsFor('rentFree').includes(draft.group) ? draft.group : 'brown' })} size="thumb" />
                  <span><span class="kt rf">Rent-Free</span><span class="kd">{name(holder)} pays {name(promiser)} no rent on a whole group (a color set, all Railroads, or both Utilities) for N of {name(holder)}'s landings.</span></span>
                </button>
                <button class="kind" class:sel={draft.kind === 'noBuild'} aria-pressed={draft.kind === 'noBuild'} data-autofocus={draft.kind === 'noBuild' ? true : undefined} onclick={() => setKind('noBuild')}>
                  <GameCard item={voucherCard(gs, { ...draftTerm, kind: 'noBuild', group: promiseGroupsFor('noBuild').includes(draft.group) ? draft.group : 'brown', total: Math.min(draft.n, 20), left: Math.min(draft.n, 20) })} size="thumb" />
                  <span><span class="kt nb">No Building</span><span class="kd">{name(promiser)} can't build houses or hotels on one color set for N full rounds. Selling is still allowed.</span></span>
                </button>
              </div>
            </div>
            <div class="vrow">
              <span class="lab">2 · Group</span>
              <div class="grow">
                <button class="stepper" data-stepper data-focus-key="v-group" onstep={onstep(stepGroup)} onclick={() => stepGroup(1) || (draft!.group = promiseGroupsFor(draft!.kind)[0])}>
                  <span class="arr">◀</span><span class="sval">{GROUP_LABEL[draft.group]}</span><span class="arr">▶</span>
                </button>
                <div class="swatches">
                  {#each PROMISE_GROUP_ORDER as g (g)}
                    {@const ok = promiseGroupsFor(draft.kind).includes(g)}
                    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                    <span class="sw" class:on={g === draft.group} class:no={!ok} style="background:{uiGroupColor(gs.board, g)}" title={GROUP_LABEL[g]} onclick={() => ok && (draft!.group = g)}>{g === 'railroad' ? 'RR' : g === 'utility' ? 'UT' : ''}</span>
                  {/each}
                </div>
              </div>
              {#if draft.kind === 'noBuild'}<span class="vhelp">No Building works on color sets only, so Railroads and Utilities are skipped.</span>{/if}
            </div>
            <div class="vrow">
              <span class="lab">3 · Length</span>
              <div class="grow">
                <button class="stepper" data-stepper data-big="5" data-focus-key="v-length" onstep={onstep(stepLength)} onclick={() => stepLength(1)}>
                  <span class="arr">◀</span><span class="sval">{draft.kind === 'rentFree' ? `×${draft.n} ${draft.n === 1 ? 'landing' : 'landings'}` : `${draft.n} ${draft.n === 1 ? 'round' : 'rounds'}`}</span><span class="arr">▶</span>
                </button>
                <span class="vhelp">{draft.kind === 'noBuild' ? 'One round = every player takes one turn. 1–20.' : `Only ${name(holder)}'s landings that would owe rent count. 1–99.`} L / R ±5.</span>
              </div>
            </div>
            {#if draftProblem}<div class="vproblem">{draftProblem}</div>{/if}
            <div class="vbtns">
              <button class="btn primary" aria-disabled={draftProblem ? 'true' : undefined} data-focus-key="v-add" onclick={saveVoucher}><Coin glyph="trade" family={pad.family} {swap} /><span class="lbl">{draft.index === null ? 'Add to offer' : 'Save changes'}</span></button>
              {#if draft.index !== null}<button class="btn" data-focus-key="v-remove" onclick={removeVoucher}><span class="cspace"></span><span class="lbl">Remove</span></button>{/if}
              <button class="btn" data-focus-key="v-cancel" onclick={() => (draft = null)}><Coin glyph="back" family={pad.family} {swap} /><span class="lbl">Cancel</span></button>
            </div>
          </div>
          <div class="vright">
            <span class="lab">Preview</span>
            <GameCard item={voucherCard(gs, draftTerm)} size="detail" />
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.45);
  }
  .tp {
    position: absolute;
    left: 24px;
    top: 24px;
    width: 1872px;
    height: 1032px;
    padding: 16px 24px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    background: #fbf6ea;
    border-radius: 16px;
    color: #2b2119;
    font-family: 'Source Sans 3', sans-serif;
    box-shadow: 0 2px 0 rgba(43, 33, 25, 0.08), 0 14px 34px rgba(10, 5, 2, 0.42), 0 3px 8px rgba(10, 5, 2, 0.28);
    overflow: hidden;
  }
  .tp :global(*) {
    box-sizing: border-box;
  }
  em {
    font-style: normal;
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
  .lab {
    font: 700 14px/1.1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #5e4c3b;
  }
  .spacer {
    flex: 1;
  }
  .tok {
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
  .pname {
    font: 800 24px/1 'Fraunces', serif;
  }
  .padbadge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 18px 0 14px;
    border-radius: 24px;
    font: 700 17px/1 'Source Sans 3', sans-serif;
    background: #eadfc6;
    color: #5e4c3b;
    flex: none;
  }
  .padbadge.on {
    background: var(--pc);
    color: #fbf6ea;
    box-shadow: 0 0 0 2px rgba(43, 33, 25, 0.25);
  }
  .thead {
    height: 78px;
    display: flex;
    align-items: center;
    gap: 18px;
    flex: none;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: 24px;
  }
  .pbtn {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 18px 0 8px;
    border: 0;
    border-radius: 10px;
    background: #f3ead6;
    color: #2b2119;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.18);
    font: 800 21px/1 'Fraunces', serif;
    cursor: pointer;
  }
  .pbtn.sel {
    background: #fff;
    box-shadow: inset 0 0 0 3px #2b2119;
  }
  .pbtn small {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    background: #5e4c3b;
    color: #fbf6ea;
    padding: 4px 6px;
    border-radius: 4px;
    letter-spacing: 1px;
  }
  .tbody {
    display: flex;
    gap: 24px;
    flex: 1;
    min-height: 0;
  }
  .mb {
    width: 590px;
    background: #f3ead6;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.12), inset 0 2px 8px rgba(43, 33, 25, 0.08);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
  }
  .mbh {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 52px;
  }
  .mcash {
    margin-left: auto;
    text-align: right;
  }
  .mcash b {
    display: block;
    font: 800 26px/1 'Fraunces', serif;
  }
  .pockets {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    align-content: flex-start;
    overflow: hidden;
  }
  .pocket {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .plab {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    height: 20px;
    padding-left: 5px;
  }
  .plab b {
    font: 800 15px/1 'Fraunces', serif;
    letter-spacing: 0;
    color: #5e4c3b;
  }
  .chip {
    display: inline-block;
    width: 24px;
    height: 16px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1.2px #2b2119;
    flex: none;
  }
  .pslots {
    display: flex;
  }
  .addv {
    width: 92px;
    height: 122px;
    border-radius: 9px;
    border: 2.5px dashed #2f5d46;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #2f5d46;
    font: 800 16px/1.1 'Fraunces', serif;
    text-align: center;
    background: rgba(251, 246, 234, 0.7);
  }
  .addv .plus {
    font: 400 38px/1 'Source Sans 3', sans-serif;
  }
  :global(.slot:focus) .addv {
    border-color: #fbf6ea;
    color: #fbf6ea;
    background: transparent;
  }
  .mid {
    width: 596px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tray {
    flex: 1;
    min-height: 0;
    border-radius: 14px;
    background: linear-gradient(180deg, #4a2e1f, #3b2619);
    box-shadow: inset 0 4px 14px rgba(0, 0, 0, 0.55), inset 0 0 0 3px #8f672a, 0 1px 0 rgba(255, 243, 201, 0.25);
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
  }
  .trh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #fbf6ea;
  }
  .trh .who {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 800 18px/1 'Fraunces', serif;
  }
  .trh .who i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 0 1.5px #fbf6ea;
  }
  .trcols {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .trcol {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 8px;
    min-width: 0;
  }
  .trcol + .swap + .trcol {
    border-left: 1.5px dashed rgba(251, 246, 234, 0.25);
  }
  .swap {
    align-self: center;
    margin: 0 -6px;
  }
  .trgrid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    justify-content: center;
    align-content: flex-start;
    overflow: hidden;
  }
  .trdrop {
    width: 92px;
    height: 122px;
    margin: 5px;
    border: 2px dashed rgba(251, 246, 234, 0.3);
    border-radius: 8px;
    display: grid;
    place-items: center;
    text-align: center;
    color: #eadfc6;
    font: 600 14px/1.25 'Source Sans 3', sans-serif;
    padding: 0 6px;
  }
  .trempty {
    border: 2px dashed rgba(251, 246, 234, 0.35);
    border-radius: 10px;
    height: 122px;
    margin: 5px;
    display: grid;
    place-items: center;
    color: #f3ead6;
    font: 600 16px/1.3 'Source Sans 3', sans-serif;
    width: 100%;
  }
  .trsum {
    color: #f3ead6;
    font: 600 15px/1.3 'Source Sans 3', sans-serif;
    text-align: center;
    margin-top: auto;
  }
  .lockline {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fbf6ea;
    border-radius: 8px;
    padding: 10px 14px;
    font: 700 17px/1.2 'Source Sans 3', sans-serif;
    box-shadow: inset 0 0 0 1.5px #8e2f23;
  }
  .lockline b {
    color: #8e2f23;
  }
  .mbtns {
    display: flex;
    gap: 12px;
  }
  .mbtns.center {
    justify-content: center;
  }
  .btn {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 18px 0 10px;
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
    max-width: 110px;
  }
  .btn .why {
    font: 600 15px/1.15 'Source Sans 3', sans-serif;
    color: #8e2f23;
  }
  .btn .sub {
    font: 600 15px/1.15 'Source Sans 3', sans-serif;
  }
  .btn.primary {
    color: #2f5d46;
    font-weight: 800;
    box-shadow: inset 0 0 0 3px #2f5d46;
  }
  .btn[aria-disabled='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.2);
    color: rgba(43, 33, 25, 0.5);
    cursor: default;
  }
  .btn.propose {
    width: 360px;
  }
  .btn.cancel {
    width: 224px;
  }
  .btn.accept {
    width: 400px;
  }
  .cspace {
    width: 44px;
    height: 44px;
    flex: none;
  }
  .holdring {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex: none;
    background: conic-gradient(#2f5d46 0 var(--p), rgba(47, 93, 70, 0.2) var(--p) 100%);
    display: grid;
    place-items: center;
  }
  :global(.btn:focus) .holdring {
    background: conic-gradient(#fffdf6 0 var(--p), rgba(255, 253, 246, 0.25) var(--p) 100%);
  }
  .holdring > span {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #fbf6ea;
    display: grid;
    place-items: center;
  }
  :global(.btn:focus) .holdring > span {
    background: #2f5d46;
  }
  .cashpop {
    position: absolute;
    z-index: 6;
    left: 16px;
    bottom: 16px;
    background: #fbf6ea;
    border-radius: 12px;
    padding: 12px 14px 14px;
    box-shadow: 0 2px 0 rgba(43, 33, 25, 0.08), 0 14px 30px rgba(10, 5, 2, 0.45);
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 330px;
  }
  .cphint {
    display: flex;
    gap: 16px;
    font: 600 15px/1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    align-items: center;
  }
  .cphint span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .stepper {
    height: 64px;
    width: 260px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: #fff;
    color: #2b2119;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.28);
    font: 800 22px/1 'Fraunces', serif;
    flex: none;
    cursor: pointer;
  }
  .stepper.big {
    width: 302px;
  }
  .stepper .arr {
    font: 400 18px/1 'Source Sans 3', sans-serif;
    color: rgba(43, 33, 25, 0.3);
  }
  :global(.stepper:focus) .arr {
    color: #fffdf6 !important;
  }
  .stepper .sval {
    flex: 1;
    text-align: center;
    white-space: nowrap;
  }
  .deal {
    flex: none;
    background: #f3ead6;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.12);
    padding: 14px 22px;
    display: flex;
    gap: 22px;
    align-items: flex-start;
  }
  .deal .dl .lab {
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .deal .dl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 128px;
    flex: none;
    padding-top: 4px;
  }
  .dtx {
    font: 500 21px/1.42 'Fraunces', serif;
    font-variation-settings: 'opsz' 24;
  }
  .deal.big .dtx {
    font-size: 23px;
  }
  .dtx .pn {
    font-weight: 800;
    padding: 0 2px;
    border-bottom: 3px solid;
  }
  .dtx .muted {
    color: #5e4c3b;
  }
  .tfoot {
    height: 58px;
    border-top: 1.5px solid rgba(43, 33, 25, 0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
    flex: none;
  }
  .pnote {
    font: 600 16px/1.3 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  /* review */
  .banner {
    flex: none;
    margin: -16px -24px 0;
    padding: 16px 28px;
    display: flex;
    align-items: center;
    gap: 20px;
    color: #fbf6ea;
    height: 112px;
  }
  .banner .h1 {
    color: #fbf6ea;
    margin: 0;
  }
  .banner .bt {
    flex: 1;
  }
  .bs {
    font: 600 19px/1.3 'Source Sans 3', sans-serif;
    opacity: 0.95;
    margin-top: 6px;
  }
  .paused {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 700 16px/1.2 'Source Sans 3', sans-serif;
    background: rgba(251, 246, 234, 0.18);
    padding: 10px 14px;
    border-radius: 10px;
  }
  .rail {
    width: 300px;
    background: #f3ead6;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.12);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rch {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .chg {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
    border-top: 1.5px dashed rgba(43, 33, 25, 0.14);
  }
  .cv {
    font: 800 21px/1.15 'Fraunces', serif;
  }
  .cv .ar {
    color: #5e4c3b;
    font-weight: 500;
  }
  .cs {
    font: 600 15px/1.3 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .waitpill {
    align-self: flex-start;
    font: 700 15px/1 'Source Sans 3', sans-serif;
    background: #eadfc6;
    color: #5e4c3b;
    padding: 8px 12px;
    border-radius: 16px;
  }
  .rcenter {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .rtray {
    flex-direction: row;
    padding: 12px 10px;
    align-items: stretch;
  }
  .rhalf {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 10px;
    min-width: 0;
  }
  .rtray .swap + .rhalf {
    border-left: 1.5px dashed rgba(251, 246, 234, 0.25);
  }
  .rcards {
    display: grid;
    grid-template-columns: repeat(2, 200px);
    gap: 12px 16px;
    justify-content: center;
  }
  .rcards.many {
    grid-template-columns: repeat(4, 92px);
  }
  /* voucher sheet */
  .veil {
    position: absolute;
    inset: -24px;
    background: rgba(20, 10, 4, 0.6);
    z-index: 20;
  }
  .vsheet {
    position: absolute;
    z-index: 21;
    left: 276px;
    top: 86px;
    width: 1320px;
    height: 860px;
    padding: 26px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: #fbf6ea;
    border-radius: 16px;
    box-shadow: 0 14px 34px rgba(10, 5, 2, 0.42);
  }
  .vsh {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .vgrid {
    display: flex;
    gap: 36px;
    flex: 1;
    min-height: 0;
  }
  .vleft {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .vrow {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .kinds {
    display: flex;
    gap: 16px;
  }
  .kind {
    flex: 1;
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 10px 16px 10px 10px;
    border: 0;
    border-radius: 12px;
    background: #f3ead6;
    color: #2b2119;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.18);
    min-height: 150px;
    text-align: left;
    cursor: pointer;
  }
  .kind.sel {
    background: #fff;
    box-shadow: inset 0 0 0 3px #2b2119;
  }
  .kt {
    display: block;
    font: 800 22px/1.1 'Fraunces', serif;
  }
  .kt.rf {
    color: #2f5d46;
  }
  .kt.nb {
    color: #8e2f23;
  }
  .kd {
    display: block;
    font: 500 16px/1.35 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    margin-top: 6px;
  }
  .grow {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .swatches {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .sw {
    height: 40px;
    min-width: 40px;
    border-radius: 7px;
    box-shadow: inset 0 0 0 1.5px #2b2119;
    display: grid;
    place-items: center;
    font: 700 14px/1 'Source Sans 3', sans-serif;
    color: #fbf6ea;
    padding: 0 8px;
    cursor: pointer;
  }
  .sw.on {
    box-shadow: inset 0 0 0 1.5px #2b2119, 0 0 0 3px #fbf6ea, 0 0 0 6px #2b2119;
  }
  .sw.no {
    opacity: 0.28;
    cursor: default;
  }
  .vhelp {
    font: 600 16px/1.4 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .vproblem {
    font: 700 16px/1.3 'Source Sans 3', sans-serif;
    color: #8e2f23;
  }
  .vbtns {
    display: flex;
    gap: 12px;
    margin-top: auto;
  }
  .vbtns .btn {
    min-width: 200px;
  }
  .vbtns .primary {
    width: 330px;
  }
  .vright {
    width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    background: #f3ead6;
    border-radius: 14px;
    padding: 18px 0;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.1);
  }
</style>
