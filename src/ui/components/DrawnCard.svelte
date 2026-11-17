<script lang="ts">
  // Chance / Community Chest card (reference/cards.html), flipping in from its deck.
  import { symbolUrl } from '../../render/symbols';
  import type { CardView } from '../../director/director';

  let { card, playerName }: { card: CardView; playerName: string } = $props();
  const color = $derived(card.deck === 'chance' ? 'var(--oxblood)' : 'var(--forest)');
  const title = $derived(card.deck === 'chance' ? 'Chance' : 'Community Chest');
</script>

<div class="wrap" style="--c:{color}">
  <div class="who">{playerName} draws</div>
  <div class="card {card.deck}">
    <div class="b1"><div class="b2">
      <span class="d tl"></span><span class="d tr"></span><span class="d bl"></span><span class="d br"></span>
      <div class="body">
        {#if card.deck === 'chance'}
          <svg width="96" height="96" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" fill="none" stroke="#8E2F23" stroke-width="1.6" stroke-dasharray="1.5 3.2" />
            <text x="32" y="47" text-anchor="middle" font-family="Fraunces, serif" font-weight="900" font-size="46" fill="#8E2F23">?</text>
          </svg>
        {:else}
          <img src={symbolUrl('community-chest')} alt="" width="78" height="78" class="chest" />
        {/if}
        <div class="text">
          <div class="title">{title}</div>
          <div class="main">{card.text}</div>
        </div>
      </div>
    </div></div>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    animation: flip 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes flip {
    from {
      transform: perspective(1200px) translateY(40px) rotateY(-90deg) scale(0.6);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  .who {
    font: 700 18px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--paper-hi);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }
  .card {
    position: relative;
    width: 560px;
    height: 318px;
    background: var(--paper-hi);
    border-radius: 12px;
    box-shadow: 0 1px 0 #e2d2b0, 0 2px 0 #d2bd95, 0 3px 0 #c2aa7e, 0 4px 0 #a98f63, 0 22px 40px rgba(10, 5, 2, 0.55), 0 6px 12px rgba(10, 5, 2, 0.35);
  }
  .b1 {
    position: absolute;
    inset: 10px;
    border: 2.5px solid var(--c);
    border-radius: 5px;
  }
  .b2 {
    position: absolute;
    inset: 17px;
    border: 1px solid var(--c);
    border-radius: 3px;
  }
  .d {
    position: absolute;
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    background: var(--c);
  }
  .tl { top: 16px; left: 16px; }
  .tr { top: 16px; right: 16px; }
  .bl { bottom: 16px; left: 16px; }
  .br { bottom: 16px; right: 16px; }
  .body {
    position: absolute;
    inset: 30px 38px;
    display: flex;
    align-items: center;
    gap: 28px;
  }
  .chest {
    filter: hue-rotate(0deg);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .title {
    font: 800 30px/1 'Fraunces', serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--c);
  }
  .main {
    font: 500 24px/1.3 'Fraunces', serif;
    color: var(--ink);
  }
</style>
