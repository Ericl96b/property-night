<script lang="ts">
  // Left column (SPEC §10.8): one card per seat, token portrait, cash (ticks during payments).
  import { getPortrait } from '../../render/portraits';
  import { money, type PlayerSummary } from '../present';

  let {
    players,
    cashOverride = null,
    shake = null,
  }: { players: PlayerSummary[]; cashOverride?: number[] | null; shake?: number | null } = $props();
</script>

<div class="panel seats">
  {#each players as p (p.seat)}
    <div class="seat" data-seat={p.seat} class:active={p.active && !p.bankrupt} class:out={p.bankrupt} class:shake={shake === p.seat} style="--seat-color:{p.color}">
      {#if getPortrait(p.token, p.color)}
        <div class="portrait"><img src={getPortrait(p.token, p.color)} alt="" /></div>
      {:else}
        <div class="ring"></div>
      {/if}
      <div class="info">
        <div class="name">{p.name}{#if p.kind === 'bot'}<span class="tag">BOT</span>{:else if p.kind === 'bankBot'}<span class="tag">BANK</span>{/if}</div>
        <div class="sub">
          {#if p.bankrupt}Bankrupt{:else}
            {p.properties} deed{p.properties === 1 ? '' : 's'}{#if p.houses} · {p.houses} house{p.houses === 1 ? '' : 's'}{/if}{#if p.hotels} · {p.hotels} hotel{p.hotels === 1 ? '' : 's'}{/if}
            {#if p.inJail} · <b class="jail">In jail</b>{/if}{#if p.jailCards} · {p.jailCards} jail card{p.jailCards === 1 ? '' : 's'}{/if}
          {/if}
          {#each p.promises as pr}<div class="promise">◆ {pr}</div>{/each}
        </div>
      </div>
      <div class="cash">{p.kind === 'bankBot' ? '∞' : money(cashOverride ? cashOverride[p.seat] : p.cash)}</div>
    </div>
  {/each}
</div>

<style>
  .seats {
    left: 32px;
    top: 32px;
    width: 340px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .seat {
    display: grid;
    grid-template-columns: 48px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 2px solid transparent;
    background: var(--paper);
  }
  .active {
    border-color: var(--seat-color);
    background: #fff;
  }
  .out {
    opacity: 0.45;
  }
  .shake {
    animation: shake 0.45s ease;
  }
  @keyframes shake {
    20%,
    60% {
      transform: translateX(-6px);
    }
    40%,
    80% {
      transform: translateX(6px);
    }
  }
  .portrait {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 40%, #fffaf0, #efe3c8);
    box-shadow: inset 0 0 0 3px var(--seat-color);
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .portrait img {
    width: 54px;
    height: 54px;
    object-fit: contain;
    transform: translateY(2px);
  }
  .ring {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff3c9, #c39445 55%, #5e4115);
    display: grid;
    place-items: center;
  }
  .ring::after {
    content: '';
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--seat-color);
  }
  .name {
    font: 700 20px/1.1 'Fraunces', serif;
    font-variation-settings: 'opsz' 36;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tag {
    font: 700 11px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--ink);
    color: var(--paper-hi);
  }
  .sub {
    font: 600 14px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .jail {
    color: var(--oxblood);
  }
  .promise {
    color: var(--forest);
  }
  .cash {
    font: 700 22px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 36;
    font-variant-numeric: tabular-nums;
  }
</style>
