<script lang="ts">
  // Overlay root: fixed 1920 × 1080 logical stage, scaled uniformly (SPEC §10.8).
  import { onMount } from 'svelte';
  import type { Action, SeatConfig } from '../engine';
  import type { GameController, GameView } from '../app/controller';
  import type { Intent } from '../input/keys';
  import PlayerCards from './components/PlayerCards.svelte';
  import ContextPanel from './components/ContextPanel.svelte';
  import DrawnCard from './components/DrawnCard.svelte';
  import Setup from './components/Setup.svelte';
  import { players, primaryButtons } from './present';

  let {
    controller,
    onstart,
  }: {
    controller: GameController;
    onstart: (seats: SeatConfig[], randomOrder: boolean) => void;
  } = $props();

  let view = $state<GameView | null>(null);
  let started = $state(false);
  let scale = $state(1);
  let offset = $state({ x: 0, y: 0 });

  onMount(() => {
    const unsub = controller.subscribe((v) => {
      view = v;
      started = !!v.state;
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

  const actor = $derived(view?.humanActors[0] ?? null);
  const actions = $derived(view && actor !== null ? controller.actionsFor(actor) : []);
  const actingName = $derived(view && actor !== null && actor !== view.state.turn.seat ? view.state.seats[actor].name : null);

  function act(a: Action) {
    controller.dispatch(a);
  }

  /** Keyboard / controller intents for the overlay. Returns true when handled. */
  export function intent(i: Intent): boolean {
    if (!view || !started) return false;
    if (view.busy || view.card) {
      if (i === 'confirm' || i === 'back') {
        controller.skip();
        return true;
      }
      return false;
    }
    const buttons = primaryButtons(view.state, actions);
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
  {#if !started || !view}
    <Setup {onstart} />
  {:else}
    <PlayerCards players={players(view.state)} />
    <ContextPanel state={view.state} {actions} busy={view.busy} {actingName} error={view.error} onaction={act} />
    {#if view.card}
      <div class="center"><DrawnCard card={view.card} playerName={view.state.seats[view.card.seat].name} /></div>
    {/if}
    {#if view.state.phase === 'gameOver'}
      <div class="center">
        <div class="panel banner">
          <div class="eyebrow">Game over</div>
          <div class="big">{view.state.winner === null ? 'No winner' : `${view.state.seats[view.state.winner].name} wins!`}</div>
        </div>
      </div>
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
</style>
