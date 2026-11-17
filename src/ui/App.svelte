<script lang="ts">
  // Overlay root: fixed 1920 × 1080 logical stage, scaled uniformly (SPEC §10.8).
  import { onMount } from 'svelte';
  import { BID_INCREMENTS, type Action, type SeatConfig } from '../engine';
  import type { GameController, GameView } from '../app/controller';
  import type { Settings } from '../app/settings';
  import type { Intent } from '../input/keys';
  import PlayerCards from './components/PlayerCards.svelte';
  import ContextPanel from './components/ContextPanel.svelte';
  import DrawnCard from './components/DrawnCard.svelte';
  import Setup from './components/Setup.svelte';
  import AuctionPanel from './components/AuctionPanel.svelte';
  import ManagePanel from './components/ManagePanel.svelte';
  import PauseMenu from './components/PauseMenu.svelte';
  import MomentLayer from './components/MomentLayer.svelte';
  import ActionButton from './components/ActionButton.svelte';
  import { players, primaryButtons } from './present';
  import { symbolUrl } from '../render/symbols';

  let {
    controller,
    settings,
    onstart,
    onsetting,
    onnewgame,
    onfullscreen,
  }: {
    controller: GameController;
    settings: Settings;
    onstart: (seats: SeatConfig[], randomOrder: boolean) => void;
    onsetting: (patch: Partial<Settings>) => void;
    onnewgame: () => void;
    onfullscreen: () => void;
  } = $props();

  let view = $state<GameView | null>(null);
  let started = $state(false);
  let scale = $state(1);
  let offset = $state({ x: 0, y: 0 });
  let manageSeat = $state<number | null>(null);
  let paused = $state(false);
  let incIndex = $state<Record<number, number>>({});
  let cashOverride = $state<number[] | null>(null);
  let shake = $state<number | null>(null);
  let lastMoment: unknown = null;

  onMount(() => {
    const unsub = controller.subscribe((v) => {
      view = v;
      started = !!v.state;
      if (v.moment !== lastMoment) {
        lastMoment = v.moment;
        if (v.moment?.kind === 'payment') tickCash(v.moment.before, v.moment.after, v.moment.duration, typeof v.moment.from === 'number' ? v.moment.from : null);
      }
    });
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      scale = Math.min(w / 1920, h / 1080);
      offset = { x: (w - 1920 * scale) / 2, y: (h - 1080 * scale) / 2 };
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      unsub();
      window.removeEventListener('resize', fit);
    };
  });

  /** Counters tick from before to after during the middle of the payment moment. */
  function tickCash(before: number[], after: number[], duration: number, payer: number | null) {
    const k = controller.speed === 'instant' ? 1000 : { slow: 0.6, normal: 1, fast: 2 }[controller.speed];
    const total = (duration / k) * 1000;
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / total;
      const u = Math.min(1, Math.max(0, (t - 0.35) / 0.55));
      const e = 1 - (1 - u) ** 3;
      cashOverride = before.map((b, i) => Math.round(b + (after[i] - b) * e));
      if (t < 1) requestAnimationFrame(step);
      else {
        cashOverride = null;
        if (payer !== null && after[payer] < 100) {
          shake = payer;
          setTimeout(() => (shake = null), 500);
        }
      }
    };
    requestAnimationFrame(step);
  }

  const gs = $derived(view?.state ?? null);
  const actor = $derived(view?.humanActors[0] ?? null);
  const actions = $derived(view && actor !== null ? controller.actionsFor(actor) : []);
  const actingName = $derived(gs && actor !== null && actor !== gs.turn.seat ? gs.seats[actor].name : null);
  const auctionHumans = $derived(gs?.phase === 'auction' ? gs.auction!.active.filter((i) => gs.seats[i].kind === 'human') : []);
  const debtSeat = $derived(gs?.phase === 'debt' && gs.seats[gs.debts[0].from].kind === 'human' ? gs.debts[0].from : null);
  const manageable = $derived(actor !== null && actions.some((a) => ['build', 'sell', 'mortgage', 'unmortgage'].includes(a.type)));
  const panelSeat = $derived(debtSeat ?? manageSeat);

  $effect(() => {
    // Close Manage when it no longer applies (turn moved on, phase changed).
    if (manageSeat !== null && gs && !['preRoll', 'buy', 'postRoll'].includes(gs.phase)) manageSeat = null;
  });

  function act(a: Action) {
    controller.dispatch(a);
  }

  function openManage() {
    if (actor !== null && manageable) manageSeat = actor;
  }

  function setPaused(p: boolean) {
    paused = p;
    controller.setPaused(p);
  }

  function auctionKeyboardSeat(): number | null {
    return auctionHumans.find((i) => gs!.auction!.highBidder !== i) ?? auctionHumans[0] ?? null;
  }

  function bidAmount(seat: number): number | null {
    const a = gs!.auction!;
    const inc = BID_INCREMENTS[incIndex[seat] ?? 1];
    const base = a.highBidder === null ? a.minBid - inc : a.highBid;
    const amt = Math.max(a.minBid, base + inc);
    return amt <= gs!.players[seat].cash ? amt : null;
  }

  /** Keyboard / controller intents for the overlay. Returns true when handled. */
  export function intent(i: Intent): boolean {
    if (!view || !started || !gs) return false;
    if (i === 'pause') {
      setPaused(!paused);
      return true;
    }
    if (paused) {
      if (i === 'back') setPaused(false);
      return true;
    }
    if (view.busy || view.card || view.moment) {
      if (i === 'confirm' || i === 'back') {
        controller.skip();
        return true;
      }
      return false;
    }
    if (gs.phase === 'auction') {
      const seat = auctionKeyboardSeat();
      if (seat === null) return false;
      if (i === 'cycleLeft' || i === 'cycleRight') {
        const cur = incIndex[seat] ?? 1;
        incIndex = { ...incIndex, [seat]: (cur + (i === 'cycleRight' ? 1 : BID_INCREMENTS.length - 1)) % BID_INCREMENTS.length };
        return true;
      }
      if (i === 'confirm') {
        const amt = bidAmount(seat);
        if (amt !== null && gs.auction!.highBidder !== seat) act({ type: 'bid', seat, amount: amt });
        return true;
      }
      if (i === 'back') {
        if (gs.auction!.highBidder !== seat) act({ type: 'pass', seat });
        return true;
      }
      return false;
    }
    if (manageSeat !== null) {
      if (i === 'back' || i === 'manage') {
        manageSeat = null;
        return true;
      }
      return false;
    }
    if (i === 'manage') {
      openManage();
      return true;
    }
    const buttons = primaryButtons(gs, actions);
    if (i === 'confirm' && buttons[0]) {
      act(buttons[0].action);
      return true;
    }
    if (i === 'back') {
      const b = buttons.find((x) => x.glyph === 'back');
      if (b) {
        act(b.action);
        return true;
      }
    }
    return false;
  }
</script>

<div class="stage" style="transform: translate({offset.x}px, {offset.y}px) scale({scale})">
  {#if !started || !view || !gs}
    <Setup {onstart} />
  {:else}
    <PlayerCards players={players(gs)} {cashOverride} {shake} />
    <ContextPanel {gs} {actions} busy={view.busy} {actingName} error={view.error} onaction={act}>
      {#snippet extra()}
        {#if manageable && gs.phase !== 'debt'}
          <ActionButton label="Manage properties" glyph="manage" disabled={view!.busy} onclick={openManage} />
        {/if}
      {/snippet}
    </ContextPanel>
    {#if gs.phase === 'auction' && !view.busy}
      <AuctionPanel
        {gs}
        deadline={view.auctionDeadline}
        humans={auctionHumans}
        {incIndex}
        busy={view.busy}
        onbid={(seat, amount) => act({ type: 'bid', seat, amount })}
        onpass={(seat) => act({ type: 'pass', seat })}
        oninc={(seat, k) => (incIndex = { ...incIndex, [seat]: k })}
      />
    {/if}
    {#if panelSeat !== null && !view.busy}
      <ManagePanel {gs} seat={panelSeat} busy={view.busy} onaction={act} onclose={() => (manageSeat = null)} />
    {/if}
    {#if view.card}
      <div class="center"><DrawnCard card={view.card} playerName={gs.seats[view.card.seat].name} /></div>
    {/if}
    {#if view.moment}
      {#key view.moment}
        <MomentLayer moment={view.moment} {gs} speed={controller.speed === 'instant' ? Infinity : { slow: 0.6, normal: 1, fast: 2 }[controller.speed]} />
      {/key}
    {/if}
    {#if gs.phase === 'gameOver'}
      <div class="center">
        <div class="panel banner">
          <div class="eyebrow">Game over</div>
          <div class="big">{gs.winner === null ? 'No winner' : `${gs.seats[gs.winner].name} wins!`}</div>
          <div class="again"><ActionButton label="New game" glyph="confirm" primary onclick={onnewgame} /></div>
        </div>
      </div>
    {/if}
    <button class="menu" aria-label="Pause menu" onclick={() => setPaused(true)}><img src={symbolUrl('ui-menu')} alt="" /></button>
    {#if paused}
      <PauseMenu
        {gs}
        {settings}
        {onsetting}
        onresume={() => setPaused(false)}
        onforfeit={(seat) => { setPaused(false); act({ type: 'forfeit', seat }); }}
        onnewgame={() => { setPaused(false); onnewgame(); }}
        {onfullscreen}
      />
    {/if}
  {/if}
</div>

<style>
  .center {
    position: absolute;
    left: 380px;
    right: 380px;
    top: 0;
    bottom: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .banner {
    position: relative;
    padding: 36px 56px;
    text-align: center;
    pointer-events: auto;
  }
  .eyebrow {
    font: 700 16px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .big {
    margin-top: 10px;
    font: 800 56px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .again {
    margin-top: 22px;
    width: 360px;
    margin-inline: auto;
  }
  .menu {
    position: absolute;
    left: 50%;
    top: 18px;
    transform: translateX(-50%);
    width: 64px;
    height: 48px;
    border: 0;
    border-radius: 10px;
    background: rgba(251, 246, 234, 0.85);
    box-shadow: var(--panel-shadow);
    display: grid;
    place-items: center;
    cursor: pointer;
    pointer-events: auto;
  }
  .menu img {
    width: 34px;
    height: 34px;
  }
</style>
