<script lang="ts">
  // Overlay root: fixed 1920 × 1080 logical stage, scaled uniformly (SPEC §10.8).
  import { onMount, setContext } from 'svelte';
  import type { Action, SeatConfig } from '../engine';
  import type { GameController, GameView } from '../app/controller';
  import type { Settings } from '../app/settings';
  import { keyboardConfirmHeld, type Intent } from '../input/keys';
  import { decide } from '../app/ownership';
  import { glyphFamily, type InputManager, type PadInfo } from '../input/manager';
  import { activate, cycleFocus, defaultFocus, focusEl, hoverFocus, isStepper, moveFocus, stepControl, type Dir } from './focus';
  import { back as stackBack, hooks as stackHooks, layer, topLayer } from './menuStack';
  import { stageFit } from './stage';
  import { SPEED_FACTOR } from '../director/queue';
  import LogPanel from './components/LogPanel.svelte';
  import StatsPanel from './components/StatsPanel.svelte';
  import Trade from './components/Trade.svelte';
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
  import Inventory from './components/Inventory.svelte';
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
      ensureFocus();
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
    // Mouse hover moves the same single focus as the controller.
    const over = (e: PointerEvent) => hoverFocus(e.target, topPanel());
    document.addEventListener('pointerover', over);
    return () => {
      unsub();
      window.removeEventListener('resize', fit);
      document.removeEventListener('pointerover', over);
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
  const manageable = $derived(
    actor !== null &&
      !!gs &&
      gs.phase !== 'debt' &&
      (actions.some((a) => ['build', 'sell', 'mortgage', 'unmortgage'].includes(a.type)) || (actor === gs.turn.seat && ['preRoll', 'buy', 'postRoll'].includes(gs.phase))),
  );
  /** A full-screen screen (Inventory, Trade) can take intents the shared router leaves alone (L/R). */
  let screenIntent: ((i: Intent, deviceSeat: number | null) => boolean) | null = null;
  const registerIntent = (h: ((i: Intent, deviceSeat: number | null) => boolean) | null) => (screenIntent = h);
  /** Hold-to-accept (Stage 3 §4.5): Confirm still held on the keyboard or on that seat's pad. */
  const confirmHeld = (seat: number) => keyboardConfirmHeld() || input.confirmHeld(seat);
  /** Glyphs and pad name of the controller that owns a screen (Stage 3 §3 footer). */
  function padOf(seat: number | null): { family: 'playstation' | 'nintendo'; label: string | null } {
    void pads;
    const dev = seat !== null ? input.deviceForSeat(seat) : null;
    return { family: dev ? glyphFamily(dev.kind) : glyphCtx.family, label: dev ? dev.label : null };
  }
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
    if (!p) savingOpen = false; // closing the pause menu closes its submenus too
    controller.setPaused(p);
  }

  /** Navigation scope: the top layer of the menu stack (menuStack.ts). */
  function topPanel(): Element | null {
    return topLayer()?.el ?? null;
  }

  // One focus (Stage 1 §2): every layer starts on its default item, and whenever the top layer
  // has no focused item (opened, closed, or its buttons re-rendered) focus goes to its default.
  let ensureTimer: ReturnType<typeof setTimeout> | undefined;
  function ensureFocus() {
    clearTimeout(ensureTimer);
    ensureTimer = setTimeout(() => {
      const p = topPanel();
      if (!p) return;
      const a = document.activeElement;
      if (a && a !== document.body && a.isConnected && p.contains(a)) return;
      const d = defaultFocus(p);
      if (d) focusEl(d);
    }, 0);
  }
  stackHooks.opened = ensureFocus;
  stackHooks.closed = ensureFocus;

  /** D-pad / arrows move focus; Confirm then clicks the focused control. */
  function navigate(i: Intent): boolean {
    const panel = topPanel();
    const a = document.activeElement as HTMLElement | null;
    const onStepper = !!panel && !!a && panel.contains(a) && isStepper(a);
    // L1/R1 (Q/E) step the focused stepper; otherwise they are left to the screen.
    if (i === 'cycleLeft' || i === 'cycleRight') return onStepper && stepControl(a!, i === 'cycleRight' ? 1 : -1);
    const dir = ({ navUp: 'up', navDown: 'down', navLeft: 'left', navRight: 'right' } as Record<string, Dir>)[i];
    if (!dir) return false;
    if (!panel) return true;
    // Left/right change a focused stepper's value; at the end of its range they move on.
    if (onStepper && (dir === 'left' || dir === 'right') && stepControl(a!, dir === 'right' ? 1 : -1)) return true;
    moveFocus(panel, dir);
    return true;
  }

  function clickFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    const panel = topPanel();
    if (!el || !panel || !panel.contains(el)) return false;
    return activate(el);
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
        stackBack();
        return true;
      case 'navLeft':
      case 'navRight': {
        // Stage 2 Camera panel: left/right change a focused slider or select; otherwise they
        // move the selection.
        const el = document.activeElement;
        if (el && el.closest('.stage .testb') && isStepper(el) && stepControl(el, i === 'navRight' ? 1 : -1)) return true;
        t.step(i === 'navRight' ? 1 : -1);
        return true;
      }
      case 'navUp':
      case 'navDown': {
        const panel = document.querySelector('.stage .testb');
        if (panel) cycleFocus(panel, i === 'navDown' ? 1 : -1);
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
        stackBack();
        return true;
      }
      if (benchRunning) return true;
      if (navigate(i)) return true;
      if (i === 'confirm') return clickFocused();
      return true;
    }
    if (screen === 'testboard' && tb && !started) return testBoardIntent(i, tb);
    if (!started || !view || !gs) {
      // Menus and setup: navigation, Confirm on the focused control, Back pops one level.
      if (i === 'back') return stackBack();
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
      if (i === 'back') stackBack(); // Save → pause menu → game, a confirm dialog cancels
      return true;
    }
    if (i === 'log') {
      logOpen = !logOpen;
      return true;
    }
    if (logOpen) {
      if (i === 'back') stackBack();
      return true;
    }
    if (statsOpen) {
      if (navigate(i)) return true;
      if (i === 'confirm' && !clickFocused()) toMenu();
      if (i === 'back') stackBack();
      else if (i === 'manage') statsOpen = false;
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
    // Full-screen screens (Inventory, Trade) see intents first: L/R, the trade's top face, and
    // Back inside the trade tray or on the proposer's paused pad.
    if (screenIntent?.(i, deviceSeat)) return true;
    // Back closes the top menu one level; on a game decision (buy, auction, trade reply, debt)
    // it does nothing — those need the option chosen and confirmed (Stage 1 §1).
    if (i === 'back') {
      stackBack();
      return true;
    }
    // A bid menu belongs to one seat ([data-bid-seat]): a bound controller's first D-pad press jumps
    // into its own menu, and it can never confirm another player's bid (§3C).
    const owned = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-bid-seat]');
    if (deviceSeat !== null && gs.phase === 'auction') {
      const mine = document.querySelector<HTMLElement>(`.stage [data-bid-seat="${seat}"]`);
      if (mine && !mine.contains(document.activeElement) && i.startsWith('nav')) {
        const d = defaultFocus(mine);
        if (d) focusEl(d);
        return true;
      }
      if (i === 'confirm' && owned && Number(owned.dataset.bidSeat) !== seat) return true;
    }
    if (navigate(i)) return true;
    if (i === 'confirm' && clickFocused()) return true;
    // Bidding is menu-based (§3): focus an option and confirm it. Nothing else bids or passes.
    if (gs.phase === 'auction') return true;
    if (manageSeat !== null) {
      if (i === 'manage') manageSeat = null;
      return true;
    }
    if (compose || loanSeat !== null) return true;
    if (gs.phase === 'trade') {
      const t = gs.trade!;
      // Accept is press-and-hold on the review screen; Confirm never accepts outright here.
      if (seat === t.to && gs.seats[seat].kind === 'human' && i === 'trade') openTrade(seat);
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
      if (gs.phase !== 'debt' && (seatActions.some((a) => ['build', 'sell', 'mortgage', 'unmortgage'].includes(a.type)) || (seat === gs.turn.seat && ['preRoll', 'buy', 'postRoll'].includes(gs.phase)))) manageSeat = seat;
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
    return false;
  }
</script>

<div class="stage" style="transform: translate({offset.x}px, {offset.y}px) scale({scale})">
  {#if !started || !view || !gs}
    {#if screen === 'testboard' && tb}
      {#if !benchOpen}
        <div class="layer" use:layer={{ kind: 'menu', close: exitTestBoard }}>
          <TestBoardControls {tb} v={tbV} {boards} detailed={tbDetailed} ondetailed={(on) => (tbDetailed = on)} onbenchmark={() => openBench('testboard')} onexit={exitTestBoard} />
        </div>
      {/if}
    {:else if screen === 'menu'}
      {#if !benchOpen}
        <div class="layer" use:layer={{ kind: 'root' }}>
          <MainMenu {saves} {oncontinue} onnew={() => (screen = 'setup')} onload={onloadsave} {onimport} onsettings={() => (menuSettings = true)} ontestboard={openTestBoard} />
        </div>
      {/if}
      {#if menuSettings}
        <div class="layer" use:layer={{ kind: 'menu', close: () => (menuSettings = false) }}>
          <PauseMenu gs={null} {settings} onsetting={setSetting} onresume={() => (menuSettings = false)} onforfeit={() => {}} onnewgame={() => {}} {onfullscreen} onbenchmark={() => openBench('menu')} />
        </div>
      {/if}
    {:else}
      <div class="layer" use:layer={{ kind: 'menu', close: () => (screen = 'menu') }}>
        <Setup {onstart} {input} {pads} {presets} {boards} />
        <button class="menuback" data-focus-key="menuback" onclick={() => (screen = 'menu')}>‹ Main menu</button>
      </div>
    {/if}
    {#if benchOpen}
      <div class="layer" use:layer={{ kind: 'menu', close: () => benchPanel?.back() }}>
        <BenchmarkPanel bind:this={benchPanel} {perf} onclose={closeBench} onrunning={(on) => (benchRunning = on)} />
      </div>
    {/if}
    {#if benchState && view?.moment}
      {#key view.moment}
        <MomentLayer moment={view.moment} gs={benchState} speed={SPEED_FACTOR[controller.speed]} />
      {/key}
    {/if}
  {:else}
    <PlayerCards players={players(gs)} {cashOverride} {shake} />
    <div class="layer" use:layer={{ kind: 'decision' }}>
    <ContextPanel {gs} {actions} busy={view.busy} {actingName} error={view.error} onaction={act}>
      {#snippet extra()}
        {#if manageable && gs.phase !== 'debt'}
          <ActionButton label="Inventory" glyph="manage" disabled={view!.busy} onclick={openManage} />
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
    </div>
    {#if gs.phase === 'auction' && !view.busy}
      <div class="layer" use:layer={{ kind: 'decision' }}>
      <AuctionPanel
        {gs}
        deadline={view.auctionDeadline}
        humans={auctionHumans}
        busy={view.busy}
        onbid={(seat, amount) => act({ type: 'bid', seat, amount })}
        onpass={(seat) => act({ type: 'pass', seat })}
      />
      </div>
    {/if}
    {#if compose && !view.busy}
      <div class="layer" use:layer={{ kind: 'menu', close: () => (compose = null) }}>
        <Trade {gs} mode="compose" seat={compose.seat} initial={compose.initial} counter={compose.counter} swap={settings.swapNintendo} {padOf} {registerIntent} onsubmit={submitTrade} oncancel={() => (compose = null)} />
      </div>
    {:else if gs.phase === 'trade' && !view.busy}
      <!-- The receiver answers on their own controller; Back never decides (Stage 3 §4.5). -->
      <div class="layer" use:layer={{ kind: 'decision' }}>
        <Trade {gs} mode={gs.seats[gs.trade!.to].kind === 'human' ? 'review' : 'waiting'} seat={gs.seats[gs.trade!.to].kind === 'human' ? gs.trade!.to : gs.trade!.from}
          swap={settings.swapNintendo} {padOf} isConfirmHeld={confirmHeld} {registerIntent}
          onaccept={() => act({ type: 'acceptTrade', seat: gs.trade!.to })}
          onreject={() => act({ type: 'rejectTrade', seat: gs.trade!.to })}
          oncounter={() => openTrade(gs.trade!.to)}
          oncancel={() => act({ type: 'cancelTrade', seat: gs.trade!.from })} />
      </div>
    {/if}
    {#if panelSeat !== null}
      <!-- Raising money for a debt is a game decision; Inventory on your turn is a menu. It stays
           open while a build or sale animates (actions wait), so focus and the open card stay put. -->
      {@const pad = padOf(panelSeat)}
      <div class="layer" use:layer={debtSeat !== null ? { kind: 'decision' } : { kind: 'menu', close: () => (manageSeat = null) }}>
        <Inventory {gs} seat={panelSeat} busy={view.busy} family={pad.family} swap={settings.swapNintendo} padLabel={pad.label} {registerIntent} onaction={act} onclose={() => (manageSeat = null)} onloan={() => (loanSeat = panelSeat)} />
      </div>
    {/if}
    {#if loanSeat !== null && !view.busy}
      <div class="layer" use:layer={{ kind: 'menu', close: () => (loanSeat = null) }}>
        <LoanPanel {gs} seat={loanSeat} onaction={(a) => { const err = controller.dispatch(a); if (!err && a.type === 'takeLoan') loanSeat = null; }} onclose={() => (loanSeat = null)} />
      </div>
    {/if}
    {#if logOpen}
      <div class="layer" use:layer={{ kind: 'menu', close: () => (logOpen = false) }}>
        <LogPanel {gs} onclose={() => (logOpen = false)} />
      </div>
    {/if}
    {#if waitingSeat !== null}
      <div class="layer" use:layer={{ kind: 'decision' }}>
      <div class="dimall"></div>
      <div class="panel padlost">
        <div class="pl-title">{gs.seats[waitingSeat].name}: reconnect controller</div>
        <div class="pl-sub">The game is paused until the same controller is back.</div>
        <ActionButton label="Continue with keyboard and mouse" onclick={() => { waitingSeat = null; controller.setPaused(paused); }} />
      </div>
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
      <div class="center" use:layer={{ kind: 'decision' }}>
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
        <div class="layer" use:layer={{ kind: 'menu', close: () => (statsOpen = false) }}>
          <StatsPanel {gs} onclose={() => (statsOpen = false)} onmenu={toMenu} />
        </div>
      {/if}
    {/if}
    <button class="menu" aria-label="Pause menu" onclick={() => setPaused(true)}><img src={symbolUrl('ui-menu')} alt="" /></button>
    {#if paused}
      <div class="layer" use:layer={{ kind: 'menu', close: () => setPaused(false) }}>
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
        <div class="layer" use:layer={{ kind: 'menu', close: () => (savingOpen = false) }}>
          <SavePanel {saves} onsave={onsaveslot} {onexport} onclose={() => (savingOpen = false)} />
        </div>
      {/if}
      </div>
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
