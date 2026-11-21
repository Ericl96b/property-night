<script lang="ts">
  // Overlay root: fixed 1920 × 1080 logical stage, scaled uniformly (SPEC §10.8).
  import { onMount, setContext } from 'svelte';
  import { BID_INCREMENTS, type Action, type SeatConfig } from '../engine';
  import type { GameController, GameView } from '../app/controller';
  import type { Settings } from '../app/settings';
  import type { Intent } from '../input/keys';
  import { decide } from '../app/ownership';
  import { glyphFamily, type InputManager, type PadInfo } from '../input/manager';
  import { cycleFocus, moveFocus, type Dir } from './focus';
  import { stageFit } from './stage';
  import { SPEED_FACTOR } from '../director/queue';
  import LogPanel from './components/LogPanel.svelte';
  import StatsPanel from './components/StatsPanel.svelte';
  import TradePanel from './components/TradePanel.svelte';
  import LoanPanel from './components/LoanPanel.svelte';
  import MainMenu from './components/MainMenu.svelte';
  import SavePanel from './components/SavePanel.svelte';
  import type { SaveFile, Saves } from '../app/saves';
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
  import { gameOverText, players, primaryButtons } from './present';
  import { symbolUrl } from '../render/symbols';
  import BenchmarkPanel from './components/BenchmarkPanel.svelte';
  import TestBoardControls from './components/TestBoard.svelte';
  import PerfOverlay from './components/PerfOverlay.svelte';
  import type { PerfApi } from '../bench/perfApi';
  import type { TestBoard } from '../bench/testBoard';
  import type { State } from '../engine';

  let {
    controller,
    input,
    presets,
    boards,
    saves,
    oncontinue,
    onloadsave,
    onimport,
    onsaveslot,
    onexport,
    settings,
    onstart,
    onsetting,
    onnewgame,
    onfullscreen,
    perf,
  }: {
    controller: GameController;
    input: InputManager;
    presets: import('../app/presets').RulesPresets;
    boards: import('../app/boardPresets').BoardPresets;
    saves: Saves;
    oncontinue: () => void;
    onloadsave: (f: SaveFile) => void;
    onimport: (text: string) => string | null;
    onsaveslot: (slot: number, name: string) => Promise<void>;
    onexport: () => void;
    settings: Settings;
    onstart: (seats: SeatConfig[], randomOrder: boolean, rulesId: string, boardId: string) => void;
    onsetting: (patch: Partial<Settings>) => void;
    onnewgame: () => void;
    onfullscreen: () => void;
    perf: PerfApi;
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
  let statsOpen = $state(false);
  function toMenu() {
    statsOpen = false;
    screen = 'menu';
    onnewgame();
  }
  let waitingSeat = $state<number | null>(null);
  let navFocus = false;
  let loanSeat = $state<number | null>(null);
  let screen = $state<'menu' | 'setup' | 'testboard'>('menu');

  // Batch 4: benchmark, test board and performance overlay.
  let benchOpen = $state(false);
  let benchRunning = $state(false);
  let benchFrom: 'menu' | 'testboard' = 'menu';
  let benchState = $state.raw<State | null>(null);
  let benchPanel = $state<{ back: () => void } | null>(null);
  let tb = $state.raw<TestBoard | null>(null);
  let tbV = $state(0);
  let tbDetailed = $state(false);
  /** Called by the benchmark runner: moments during the run belong to its own board state. */
  export function setBenchState(s: State | null) {
    benchState = s;
  }
  /** The test board's fields changed (main.ts forwards TestBoard.onChange). */
  export function testBoardChanged() {
    tbV++;
  }
  function openTestBoard() {
    menuSettings = false;
    tb = perf.enterTestBoard();
    tbDetailed = settings.perfOverlay === 'detailed';
    screen = 'testboard';
    tbV++;
  }
  function exitTestBoard() {
    perf.leaveTestBoard();
    tb = null;
    screen = 'menu';
  }
  function openBench(from: 'menu' | 'testboard') {
    benchFrom = from;
    menuSettings = false;
    // The benchmark builds its own scene; the test board's layout comes back afterwards.
    if (from === 'testboard') tb?.exit();
    benchOpen = true;
  }
  function closeBench() {
    benchOpen = false;
    benchRunning = false;
    if (benchFrom === 'testboard' && screen === 'testboard') {
      tb = perf.enterTestBoard();
      tbV++;
    } else perf.clearScene();
  }
  // `settings` is a plain object owned by main.ts; mirror the overlay setting reactively.
  let overlaySetting = $state(settings.perfOverlay);
  function setSetting(patch: Partial<Settings>) {
    onsetting(patch);
    if (patch.perfOverlay) overlaySetting = patch.perfOverlay;
  }
  /** Overlay mode: the setting, forced to at least FPS in the test board (§4.4). */
  const perfMode = $derived<'off' | 'fps' | 'detailed'>(screen === 'testboard' && !started ? (tbDetailed ? 'detailed' : 'fps') : overlaySetting);
  $effect(() => {
    perf.renderer.setOverlay(perfMode !== 'off');
  });
  $effect(() => {
    // Detailed in the test board renders continuously so the numbers are live; anything else
    // stays render-on-demand (the benchmark manages continuous mode itself while it runs).
    const live = screen === 'testboard' && perfMode === 'detailed' && !benchOpen;
    if (!benchRunning) perf.renderer.setContinuous(live);
    perf.setNudgeAnyPad(screen === 'testboard' && !benchOpen);
  });
  let savingOpen = $state(false);
  let menuSettings = $state(false);
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
        if (v.moment?.kind === 'payment' || v.moment?.kind === 'transfer') tickCash(v.moment.before, v.moment.after, v.moment.duration, typeof v.moment.from === 'number' ? v.moment.from : null);
      }
      // Counters hold the last payment's balances until the shown state catches up.
      if (v.state !== heldState && !ticking) cashOverride = null;
    });
    const fit = () => {
      const f = stageFit(window.innerWidth, window.innerHeight);
      scale = f.scale;
      offset = f.offset;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      unsub();
      window.removeEventListener('resize', fit);
    };
  });

  /** Counters tick from before to after during the middle of the payment moment. */
  let heldState: unknown = null;
  let ticking = false;
  let tickId = 0;
  function tickCash(before: number[], after: number[], duration: number, payer: number | null) {
    const k = controller.speed === 'instant' ? 1000 : SPEED_FACTOR[controller.speed];
    const total = (duration / k) * 1000;
    const t0 = performance.now();
    const id = ++tickId;
    ticking = true;
    heldState = view?.state ?? null;
    const step = () => {
      if (id !== tickId) return; // a newer payment took over
      const t = (performance.now() - t0) / total;
      const u = Math.min(1, Math.max(0, (t - 0.35) / 0.55));
      const e = 1 - (1 - u) ** 3;
      cashOverride = before.map((b, i) => Math.round(b + (after[i] - b) * e));
      if (t < 1) requestAnimationFrame(step);
      else {
        ticking = false;
        // Hold the new balances; they clear once the shown state catches up.
        cashOverride = [...after];
        heldState = view?.state ?? null;
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

  const PANELS = ['.benchp', '.testb', '.remap', '.savep', '.pause', '.padlost', '.statsp', '.logp', '.loans', '.trade', '.manage', '.auction', '.setup', '.context', '.banner'];
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
   * Test board (§4.3): left/right select the previous/next property, up/down step through the
   * controls, LB/RB (Q/E) rotate, Square/Y (B key) adds and Triangle/X (V key) removes a
   * building, Back leaves.
   */
  function testBoardIntent(i: Intent, t: TestBoard): boolean {
    switch (i) {
      case 'back':
        exitTestBoard();
        return true;
      case 'navLeft':
      case 'navRight':
        t.step(i === 'navRight' ? 1 : -1);
        return true;
      case 'navUp':
      case 'navDown': {
        const panel = document.querySelector('.stage .testb');
        if (panel && cycleFocus(panel, i === 'navDown' ? 1 : -1)) navFocus = true;
        return true;
      }
      case 'cycleLeft':
      case 'cycleRight':
        t.rotate(i === 'cycleRight' ? 1 : -1);
        return true;
      case 'manage':
        t.addBuilding();
        return true;
      case 'trade':
        t.removeBuilding();
        return true;
      case 'confirm':
        return clickFocused();
      default:
        return true;
    }
  }

  /**
   * Keyboard / controller intents. `deviceSeat` is the seat the controller is bound to
   * (null for keyboard and mouse, which always work as a fallback). Returns true when handled.
   */
  export function intent(i: Intent, deviceSeat: number | null = null): boolean {
    if (benchOpen && !started) {
      if (i === 'back') {
        benchPanel?.back();
        return true;
      }
      if (benchRunning) return true;
      if (navigate(i)) return true;
      if (i === 'confirm') return clickFocused();
      return true;
    }
    if (screen === 'testboard' && tb && !started) return testBoardIntent(i, tb);
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
    if (statsOpen) {
      if (navigate(i)) return true;
      if (i === 'confirm' && !clickFocused()) toMenu();
      if (i === 'back' || i === 'manage') statsOpen = false;
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
    if (loanSeat !== null) {
      if (i === 'back') loanSeat = null;
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
    if (gs.phase === 'gameOver' && i === 'manage') {
      statsOpen = true;
      return true;
    }
    if (i === 'manage') {
      if (seatActions.some((a) => ['build', 'sell', 'mortgage', 'unmortgage'].includes(a.type)) && gs.phase !== 'debt') manageSeat = seat;
      return true;
    }
    if (gs.phase === 'gameOver') {
      if (i === 'confirm') toMenu();
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
    {#if screen === 'testboard' && tb}
      {#if !benchOpen}
        <TestBoardControls {tb} v={tbV} {boards} detailed={tbDetailed} ondetailed={(on) => (tbDetailed = on)} onbenchmark={() => openBench('testboard')} onexit={exitTestBoard} />
      {/if}
    {:else if screen === 'menu'}
      {#if !benchOpen}
        <MainMenu {saves} {oncontinue} onnew={() => (screen = 'setup')} onload={onloadsave} {onimport} onsettings={() => (menuSettings = true)} ontestboard={openTestBoard} />
      {/if}
      {#if menuSettings}
        <PauseMenu gs={null} {settings} onsetting={setSetting} onresume={() => (menuSettings = false)} onforfeit={() => {}} onnewgame={() => {}} {onfullscreen} onbenchmark={() => openBench('menu')} />
      {/if}
    {:else}
      <Setup {onstart} {input} {pads} {presets} {boards} />
      <button class="menuback" onclick={() => (screen = 'menu')}>‹ Main menu</button>
    {/if}
    {#if benchOpen}
      <BenchmarkPanel bind:this={benchPanel} {perf} onclose={closeBench} onrunning={(on) => (benchRunning = on)} />
    {/if}
    {#if benchState && view?.moment}
      {#key view.moment}
        <MomentLayer moment={view.moment} gs={benchState} speed={SPEED_FACTOR[controller.speed]} />
      {/key}
    {/if}
  {:else}
    <PlayerCards players={players(gs)} {cashOverride} {shake} />
    <ContextPanel {gs} {actions} busy={view.busy} {actingName} error={view.error} onaction={act}>
      {#snippet extra()}
        {#if manageable && gs.phase !== 'debt'}
          <ActionButton label="Manage properties" glyph="manage" disabled={view!.busy} onclick={openManage} />
        {/if}
        {#if gs.phase === 'speedChoice' && gs.turn.speedChoice?.anyTile && actor === gs.turn.seat}
          <select class="anytile" aria-label="Move to any space" onchange={(e) => act({ type: 'speedChoice', seat: gs.turn.seat, target: Number((e.currentTarget as HTMLSelectElement).value) })}>
            <option value="">Triples! Choose any space…</option>
            {#each gs.board.tiles as t}<option value={t.index}>{t.name}</option>{/each}
          </select>
        {/if}
        {#if view!.undo}
          <ActionButton label={`Undo ${view!.undo}`} onclick={() => controller.undo()} />
        {/if}
        {#if gs.rules.loans && actor === gs.turn.seat && ['preRoll', 'postRoll', 'buy'].includes(gs.phase) && gs.seats[gs.turn.seat].kind === 'human'}
          <ActionButton label="Bank loans" disabled={view!.busy} onclick={() => (loanSeat = gs.turn.seat)} />
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
      <ManagePanel {gs} seat={panelSeat} busy={view.busy} onaction={act} onclose={() => (manageSeat = null)} onloan={() => (loanSeat = panelSeat)} />
    {/if}
    {#if loanSeat !== null && !view.busy}
      <LoanPanel {gs} seat={loanSeat} onaction={(a) => { const err = controller.dispatch(a); if (!err && a.type === 'takeLoan') loanSeat = null; }} onclose={() => (loanSeat = null)} />
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
        <MomentLayer moment={view.moment} {gs} speed={SPEED_FACTOR[controller.speed]} />
      {/key}
    {/if}
    {#if gs.phase === 'gameOver'}
      <div class="center">
        <div class="panel banner">
          <div class="eyebrow">Game over</div>
          <div class="big">{gameOverText(gs).title}</div>
          <div class="sub">{gameOverText(gs).subtitle}</div>
          <div class="again">
            <ActionButton label="Main menu" glyph="confirm" primary onclick={toMenu} />
            <ActionButton label="Game stats" glyph="manage" onclick={() => (statsOpen = true)} />
          </div>
        </div>
      </div>
      {#if statsOpen}
        <StatsPanel {gs} onclose={() => (statsOpen = false)} onmenu={toMenu} />
      {/if}
    {/if}
    <button class="menu" aria-label="Pause menu" onclick={() => setPaused(true)}><img src={symbolUrl('ui-menu')} alt="" /></button>
    {#if paused}
      <PauseMenu
        {gs}
        {settings}
        onsetting={setSetting}
        onresume={() => setPaused(false)}
        onforfeit={(seat) => { setPaused(false); act({ type: 'forfeit', seat }); }}
        onnewgame={() => { setPaused(false); screen = 'menu'; onnewgame(); }}
        {onfullscreen}
        onsave={() => (savingOpen = true)}
        onbenchmark={() => {}}
      />
      {#if savingOpen}
        <SavePanel {saves} onsave={onsaveslot} {onexport} onclose={() => (savingOpen = false)} />
      {/if}
    {/if}
  {/if}
  {#if perfMode !== 'off'}
    <PerfOverlay renderer={perf.renderer} mode={perfMode} info={() => `${perf.qualityLabel()} · AO ${settings.ambientOcclusion ? 'on' : 'off'}`} />
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
  .banner .sub {
    margin-top: 20px;
    margin-inline: auto;
    max-width: 640px;
    font: 500 20px/1.35 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .again {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
  .anytile {
    height: 56px;
    font: 600 18px 'Source Sans 3', sans-serif;
    border-radius: 10px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    padding: 0 10px;
    background: #fff;
  }
  .menuback {
    position: absolute;
    left: 32px;
    top: 32px;
    height: 48px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: rgba(251, 246, 234, 0.9);
    font: 700 17px 'Source Sans 3', sans-serif;
    cursor: pointer;
    pointer-events: auto;
  }
  .menu img {
    width: 34px;
    height: 34px;
  }
</style>
