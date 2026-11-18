<script lang="ts">
  // The big-payment moment and short banners (SPEC §10.9): banner with token portraits and the
  // amount in Fraunces; banknotes fly from the payer's panel to the payee's panel.
  import { onMount } from 'svelte';
  import type { Moment } from '../../director/director';
  import type { State } from '../../engine';
  import { getPortrait } from '../../render/portraits';
  import Banknote from './Banknote.svelte';
  import { breakdown } from '../money';
  import { money } from '../present';

  let { moment, gs, speed }: { moment: Moment; gs: State; speed: number } = $props();

  const BANK = { x: 960, y: 560 };
  let points = $state<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  function seatPoint(seat: number | 'bank'): { x: number; y: number } {
    if (seat === 'bank') return BANK;
    const el = document.querySelector(`[data-seat="${seat}"]`);
    const stage = document.querySelector('.stage');
    if (!el || !stage) return BANK;
    const r = el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const k = sr.width / 1920;
    return { x: (r.left + r.width * 0.8 - sr.left) / k, y: (r.top + r.height / 2 - sr.top) / k };
  }

  onMount(() => {
    if (moment.kind === 'payment' || moment.kind === 'transfer') points = { from: seatPoint(moment.from), to: seatPoint(moment.to) };
  });

  const k = $derived(Math.max(0.05, speed === Infinity ? 1000 : speed));
  const notes = $derived(moment.kind === 'payment' || moment.kind === 'transfer' ? breakdown(moment.amount) : { notes: [], rest: 0 });
  const nameOf = (c: number | 'bank') => (c === 'bank' ? 'The bank' : gs.seats[c].name);
  const portraitOf = (c: number | 'bank') => (c === 'bank' ? null : getPortrait(gs.seats[c].token, gs.seats[c].color));
  const what = $derived(
    moment.kind === 'payment' ? (moment.tile !== undefined ? gs.board.tiles[moment.tile].name : moment.reason.replace(/^./, (x) => x.toUpperCase())) : '',
  );
</script>

{#if moment.kind === 'payment'}
  <div class="banner panel pay" style="--d:{moment.duration / k}s">
    <div class="who">
      <div class="side">
        {#if portraitOf(moment.from)}<img src={portraitOf(moment.from)} alt="" />{:else}<div class="bank">BANK</div>{/if}
        <span>{nameOf(moment.from)}</span>
      </div>
      <div class="arrow">→</div>
      <div class="side">
        {#if portraitOf(moment.to)}<img src={portraitOf(moment.to)} alt="" />{:else}<div class="bank">BANK</div>{/if}
        <span>{nameOf(moment.to)}</span>
      </div>
    </div>
    <div class="what">{what}</div>
    <div class="amount">{money(moment.amount)}</div>
  </div>
  {#if points}
    {#each notes.notes as v, i}
      <div
        class="note"
        style="--fx:{points.from.x}px; --fy:{points.from.y}px; --tx:{points.to.x}px; --ty:{points.to.y}px; --delay:{(0.35 + i * 0.07) / k}s; --dur:{1.0 / k}s; --rot:{(i % 2 ? 1 : -1) * (6 + i * 3)}deg"
      >
        <Banknote value={v} width={140} />
      </div>
    {/each}
    {#if notes.rest > 0}
      <div class="note chip" style="--fx:{points.from.x}px; --fy:{points.from.y}px; --tx:{points.to.x}px; --ty:{points.to.y}px; --delay:{(0.35 + notes.notes.length * 0.07) / k}s; --dur:{1.0 / k}s; --rot:0deg">
        +{money(notes.rest)}
      </div>
    {/if}
  {/if}
{:else if moment.kind === 'transfer'}
  <!-- Small payment: bills only, between the player tabs (or the bank at the board center). -->
  {#if points}
    {#each notes.notes as v, i}
      <div
        class="note small"
        style="--fx:{points.from.x}px; --fy:{points.from.y}px; --tx:{points.to.x}px; --ty:{points.to.y}px; --delay:{(0.05 + i * 0.05) / k}s; --dur:{(moment.duration * 0.75) / k}s; --rot:{(i % 2 ? 1 : -1) * (4 + i * 2)}deg"
      >
        <Banknote value={v} width={110} />
      </div>
    {/each}
    {#if notes.rest > 0}
      <div class="note small chip" style="--fx:{points.from.x}px; --fy:{points.from.y}px; --tx:{points.to.x}px; --ty:{points.to.y}px; --delay:{(0.05 + notes.notes.length * 0.05) / k}s; --dur:{(moment.duration * 0.75) / k}s; --rot:0deg">
        +{money(notes.rest)}
      </div>
    {/if}
  {/if}
{:else}
  <div class="banner panel short {moment.tone}" style="--d:{moment.duration / k}s">
    {#if moment.seat !== null && getPortrait(gs.seats[moment.seat].token, gs.seats[moment.seat].color)}
      <img class="solo" src={getPortrait(gs.seats[moment.seat].token, gs.seats[moment.seat].color)} alt="" />
    {/if}
    <div class="title">{moment.title}</div>
    {#if moment.subtitle}<div class="sub">{moment.subtitle}</div>{/if}
  </div>
{/if}

<style>
  .banner {
    position: absolute;
    left: 50%;
    top: 120px;
    transform: translateX(-50%);
    padding: 22px 40px 26px;
    text-align: center;
    animation: pop var(--d) ease both;
    pointer-events: none;
    min-width: 520px;
  }
  @keyframes pop {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(-24px) scale(0.92);
    }
    12%,
    85% {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-10px) scale(0.98);
    }
  }
  .who {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font: 700 16px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .side img,
  .solo {
    width: 84px;
    height: 84px;
    object-fit: contain;
  }
  .bank {
    width: 84px;
    height: 84px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--forest);
    color: var(--paper-hi);
    font: 800 16px/1 'Fraunces', serif;
    letter-spacing: 2px;
  }
  .arrow {
    font: 800 40px/1 'Fraunces', serif;
    color: var(--brass);
  }
  .what {
    margin-top: 10px;
    font: 700 18px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .amount {
    margin-top: 8px;
    font: 800 88px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 144;
    color: var(--ink);
  }
  .short .title {
    font: 800 44px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .short .sub {
    margin-top: 8px;
    font: 600 18px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .short.oxblood .title {
    color: var(--oxblood);
  }
  .short.forest .title {
    color: var(--forest);
  }
  .short.brass .title {
    color: #8f672a;
  }
  .note {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    opacity: 0;
    animation: fly var(--dur) cubic-bezier(0.3, 0.6, 0.2, 1) var(--delay) both;
  }
  @keyframes fly {
    0% {
      opacity: 0;
      transform: translate(calc(var(--fx) - 70px), calc(var(--fy) - 35px)) rotate(0deg) scale(0.6);
    }
    15% {
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(calc(var(--tx) - 70px), calc(var(--ty) - 35px)) rotate(var(--rot)) scale(0.85);
    }
  }
  .note.small {
    animation-name: fly-small;
  }
  @keyframes fly-small {
    0% {
      opacity: 0;
      transform: translate(calc(var(--fx) - 55px), calc(var(--fy) - 27px)) rotate(0deg) scale(0.7);
    }
    15%,
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(calc(var(--tx) - 55px), calc(var(--ty) - 27px)) rotate(var(--rot)) scale(0.9);
    }
  }
  .chip {
    padding: 10px 16px;
    border-radius: 999px;
    background: var(--brass);
    color: var(--ink);
    font: 800 24px/1 'Fraunces', serif;
  }
</style>
