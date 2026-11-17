<script lang="ts">
  // Overlay root: fixed 1920 × 1080 logical stage, scaled uniformly (SPEC §10.8).
  import { onMount, setContext } from 'svelte';
  import { BID_INCREMENTS, type Action, type SeatConfig } from '../engine';
  import type { GameController, GameView } from '../app/controller';
  import type { Settings } from '../app/settings';
  import type { Intent } from '../input/keys';
  import { decide } from '../app/ownership';
  import { glyphFamily, type InputManager, type PadInfo } from '../input/manager';
  import { moveFocus, type Dir } from './focus';
  import LogPanel from './components/LogPanel.svelte';
  import TradePanel from './components/TradePanel.svelte';
  import { counterOf, partners } from './trade';
  import type { TradeOffer } from '../engine';
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
    input,
    settings,
    onstart,
    onsetting,
    onnewgame,
    onfullscreen,
  }: {
    controller: GameController;
    input: InputManager;
    settings: Settings;
    onstart: (seats: SeatConfig[], randomOrder: boolean) => void;
    onsetting: (patch: Partial<Settings>) => void;
    onnewgame: () => void;
    onfullscreen: () => void;
  } = $props();

  // Raw: the game state is replaced wholesale, never mutated, so no deep proxy is needed.
  let view = $state.raw<GameView | null>(null);
  let started = $state(false);
  let scale = $state(1);
  let offset = $state({ x: 0, y: 0 });
  let manageSeat = $state<number | null>(null);
  let paused = $state(false);
  let incIndex = $state<Record<number, number>>({});
  let cashOverride = $state<number[] | null>(null);
  let shake = $state<number | null>(null);
  let lastMoment: unknown = null;
  let pads = $state<PadInfo[]>([]);
  let logOpen = $state(false);
  let waitingSeat = $state<number | null>(null);
  let navFocus = false;
  let compose = $state<{ seat: number; initial: TradeOffer | null; counter: boolean } | null>(null);
  const glyphCtx = $state({ family: 'playstation' as 'playstation' | 'nintendo', swap: false });
  setContext('glyphs', glyphCtx);

  onMount(() => {
    input.onPadsChanged = () => (pads = [...input.pads.values()]);
    pads = [...input.pads.values()];
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
  const canPropose = $derived(
    !!gs &&
      (gs.phase === 'preRoll' || gs.phase === 'postRoll') &&
      gs.rules.tradingAllowed &&
      gs.seats[gs.turn.seat].kind === 'human' &&
      partners(gs, gs.turn.seat).length > 0,
  );

  function openTrade(seat: number) {
    if (!gs) return;
    if (gs.phase === 'trade' && gs.trade!.to === seat) compose = { seat, initial: counterOf(gs.trade!), counter: true };
    else if (canPropose && gs.turn.seat === seat) compose = { seat, initial: null, counter: false };
  }

  function submitTrade(o: TradeOffer) {
    if (!compose) return;
    const err = compose.counter ? controller.dispatch({ type: 'counterTrade', seat: compose.seat, offer: o }) : controller.dispatch({ type: 'proposeTrade', seat: compose.seat, offer: o });
    if (!err) compose = null;
  }

  $effect(() => {
    // Prompts use the acting controller's glyphs (SPEC §4).
    const dev = actor !== null ? input.deviceForSeat(actor) : null;
    glyphCtx.family = dev ? glyphFamily(dev.kind) : 'playstation';
    glyphCtx.swap = settings.swapNintendo;
    void pads;
  });

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

  function bidAmount(seat: number): number | null {
    const a = gs!.auction!;
    const inc = BID_INCREMENTS[incIndex[seat] ?? 1];
    const base = a.highBidder === null ? 0 : a.highBid; // opening bid = the increment (at least the minimum)
    const amt = Math.max(a.minBid, base + inc);
    return amt <= gs!.players[seat].cash ? amt : null;
  }

  const PANELS = ['.remap', '.pause', '.padlost', '.logp', '.trade', '.manage', '.auction', '.setup', '.context', '.banner'];
  function topPanel(): Element | null {
    const stage = document.querySelector('.stage');
    if (!stage) return null;
    for (const sel of PANELS) {
      const el = stage.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /** D-pad / arrows move focus; Confirm then clicks the focused control. */
  function navigate(i: Intent): boolean {
    const dir = ({ navUp: 'up', navDown: 'down', navLeft: 'left', navRight: 'right' } as Record<string, Dir>)[i];
    if (!dir) return false;
    const panel = topPanel();
    if (panel && moveFocus(panel, dir)) navFocus = true;
    return true;
  }

  function clickFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    const panel = topPanel();
    if (!navFocus || !el || !panel || !panel.contains(el) || !(el instanceof HTMLButtonElement) || el.disabled) return false;
    el.click();
    return true;
  }

  /** A bound controller for a human seat disconnected: pause until it returns. */
  export function padLost(seat: number) {
    if (!gs || gs.phase === 'gameOver' || gs.players[seat]?.bankrupt) return;
    waitingSeat = seat;
    controller.setPaused(true);
  }

  export function padBack(seat: number) {
    if (waitingSeat === seat) {
      waitingSeat = null;
      controller.setPaused(paused);
    }
  }

  /**
   * Keyboard / controller intents. `deviceSeat` is the seat the controller is bound to
   * (null for keyboard and mouse, which always work as a fallback). Returns true when handled.
   */
  export function intent(i: Intent, deviceSeat: number | null = null): boolean {
    if (!started || !view || !gs) {
      // Setup screen: navigation and Confirm on the focused control.
      if (navigate(i)) return true;
      if (i === 'confirm') return clickFocused();
      return false;
    }
    if (waitingSeat !== null) {
      if (deviceSeat === null && (i === 'confirm' || i === 'back')) {
        waitingSeat = null;
        controller.setPaused(paused);
      }
      return true;
    }
    if (i === 'pause') {
      setPaused(!paused);
      return true;
    }
    if (paused) {
      if (navigate(i)) return true;
      if (i === 'confirm') return clickFocused();
      if (i === 'back') setPaused(false);
      return true;
    }
    if (i === 'log') {
      logOpen = !logOpen;
      return true;
    }
    if (logOpen) {
      if (i === 'back') logOpen = false;
      return true;
    }
    if (view.busy || view.card || view.moment) {
      if (i === 'confirm' || i === 'back') {
        controller.skip();
        return true;
      }
      return false;
    }
    const d = decide(gs, deviceSeat, i);
    if (!d.allowed || d.seat === null) return true; // other players' controllers are read-only here
    const seat = d.seat;
    if (navigate(i)) return true;
    if (i === 'confirm' && clickFocused()) {
      navFocus = false;
      return true;
    }
    navFocus = false;
    if (gs.phase === 'auction') {
      if (gs.seats[seat].kind !== 'human') return true;
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
      return true;
    }
    if (manageSeat !== null) {
      if (i === 'back' || i === 'manage') {
        manageSeat = null;
        return true;
      }
      return true;
    }
    if (compose) {
      if (i === 'back') compose = null;
      return true;
    }
    if (gs.phase === 'trade') {
      const t = gs.trade!;
      if (seat === t.to && gs.seats[seat].kind === 'human') {
        if (i === 'confirm') act({ type: 'acceptTrade', seat });
        else if (i === 'back') act({ type: 'rejectTrade', seat });
        else if (i === 'trade') openTrade(seat);
      } else if (seat === t.from && i === 'back') act({ type: 'cancelTrade', seat });
      return true;
    }
    if (i === 'trade') {
      openTrade(seat);
      return true;
    }
    const seatActions = controller.actionsFor(seat);
    if (i === 'manage') {
      if (seatActions.some((a) => ['build', 'sell', 'mortgage', 'unmortgage'].includes(a.type)) && gs.phase !== 'debt') manageSeat = seat;
      return true;
    }
    if (gs.phase === 'gameOver') {
      if (i === 'confirm') onnewgame();
      return true;
    }
    const buttons = primaryButtons(gs, seatActions);
    if (i === 'confirm' && buttons[0]) {
      act(buttons[0].action);
      return true;
    }
    if (i === 'back') {
      const b = buttons.find((x) => x.glyph === 'back');
      if (b) act(b.action);
      return true;
    }
    return false;
  }
</script>

<div class="stage" style="transform: translate({offset.x}px, {offset.y}px) scale({scale})">
  {#if !started || !view || !gs}
    <Setup {onstart} {input} {pads} />
  {:else}
    <PlayerCards players={players(gs)} {cashOverride} {shake} />
    <ContextPanel {gs} {actions} busy={view.busy} {actingName} error={view.error} onaction={act}>
      {#snippet extra()}
        {#if manageable && gs.phase !== 'debt'}
          <ActionButton label="Manage properties" glyph="manage" disabled={view!.busy} onclick={openManage} />
        {/if}
        {#if canPropose && actor === gs.turn.seat}
          <ActionButton label="Trade" glyph="trade" disabled={view!.busy} onclick={() => openTrade(gs.turn.seat)} />
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
    {#if compose && !view.busy}
      <TradePanel {gs} mode="compose" seat={compose.seat} initial={compose.initial} counter={compose.counter} onsubmit={submitTrade} oncancel={() => (compose = null)} />
    {:else if gs.phase === 'trade' && !view.busy}
      {#if gs.seats[gs.trade!.to].kind === 'human'}
        <TradePanel {gs} mode="respond" seat={gs.trade!.to}
          onaccept={() => act({ type: 'acceptTrade', seat: gs.trade!.to })}
          onreject={() => act({ type: 'rejectTrade', seat: gs.trade!.to })}
          oncounter={() => openTrade(gs.trade!.to)} />
      {:else}
        <TradePanel {gs} mode="waiting" seat={gs.trade!.from} oncancel={() => act({ type: 'cancelTrade', seat: gs.trade!.from })} />
      {/if}
    {/if}
    {#if panelSeat !== null && !view.busy}
      <ManagePanel {gs} seat={panelSeat} busy={view.busy} onaction={act} onclose={() => (manageSeat = null)} />
    {/if}
    {#if logOpen}
      <LogPanel {gs} onclose={() => (logOpen = false)} />
    {/if}
    {#if waitingSeat !== null}
      <div class="dimall"></div>
      <div class="panel padlost">
        <div class="pl-title">{gs.seats[waitingSeat].name}: reconnect controller</div>
        <div class="pl-sub">The game is paused until the same controller is back.</div>
        <ActionButton label="Continue with keyboard and mouse" onclick={() => { waitingSeat = null; controller.setPaused(paused); }} />
      </div>
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
  .dimall {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.6);
  }
  .padlost {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 760px;
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    text-align: center;
  }
  .pl-title {
    font: 800 38px/1.1 'Fraunces', serif;
  }
  .pl-sub {
    font: 600 18px/1.4 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .menu img {
    width: 34px;
    height: 34px;
  }
</style>
