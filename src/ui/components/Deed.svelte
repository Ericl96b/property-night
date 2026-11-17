<script lang="ts">
  // Title deed / railroad deed / utility deed / mortgaged back (reference/cards.html).
  import type { DeedInfo } from '../present';
  import { symbolUrl } from '../../render/symbols';

  let { deed, scale = 1 }: { deed: DeedInfo; scale?: number } = $props();
  const icon = $derived(
    deed.kind === 'railroad' ? symbolUrl('railroad') : deed.kind === 'utility' ? symbolUrl(/water/i.test(deed.name) ? 'utility-water' : 'utility-power') : null,
  );
</script>

<div class="deed" style="--k:{scale}">
  {#if deed.mortgaged}
    <div class="frame center">
      {#if deed.band}<div class="strip" style="background:{deed.band}"></div>{/if}
      <div class="mname">{deed.name}</div>
      <div class="stamp">MORTGAGED</div>
      <div class="mfor">Mortgaged for {deed.mortgagedFor}</div>
      <div class="ufor">Unmortgage for {deed.unmortgageFor}</div>
    </div>
  {:else if deed.kind === 'street'}
    <div class="frame">
      <div class="band" style="background:{deed.band}; color:{deed.lightText ? '#FFF8EC' : 'var(--ink)'}">
        <div class="kicker">TITLE DEED</div>
        <div class="title">{deed.name}</div>
      </div>
      <div class="headline">{deed.headline}</div>
      <div class="rows">
        {#each deed.rows as r}
          <div class="row"><span>{r.label}</span><span class="dots"></span><b>{r.value}</b></div>
        {/each}
      </div>
      <div class="rule"></div>
      <div class="notes">
        {#each deed.notes as n}<div>{n}</div>{/each}
      </div>
      <div class="foot">{deed.footnote}</div>
    </div>
  {:else if deed.kind === 'railroad' || deed.kind === 'utility'}
    <div class="frame center">
      {#if icon}<img class="icon" src={icon} alt="" />{/if}
      <div class="kicker muted">{deed.kind === 'railroad' ? 'RAILROAD' : 'UTILITY'}</div>
      <div class="title2">{deed.name}</div>
      {#if deed.kind === 'railroad'}
        <div class="rows wide">
          <div class="row"><span>Rent</span><span class="dots"></span><b>{deed.headline.replace('Fare ', '')}</b></div>
          {#each deed.rows as r}
            <div class="row"><span>{r.label}</span><span class="dots"></span><b>{r.value}</b></div>
          {/each}
        </div>
        <div class="rule"></div>
        <div class="notes">{deed.notes[0]}</div>
      {:else}
        <div class="util">{deed.notes[0]}</div>
        <div class="util">{deed.notes[1]}</div>
        <div class="rule"></div>
        <div class="notes">{deed.notes[2]}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .deed {
    width: calc(300px * var(--k));
    height: calc(400px * var(--k));
    position: relative;
    flex: none;
  }
  .frame {
    position: absolute;
    left: 0;
    top: 0;
    width: 300px;
    height: 400px;
    transform: scale(var(--k));
    transform-origin: 0 0;
    background: var(--paper-hi);
    border-radius: 9px;
    box-shadow: 0 1px 0 #e2d2b0, 0 2px 0 #d2bd95, 0 3px 0 #c2aa7e, 0 4px 0 #a98f63, 0 14px 28px rgba(10, 5, 2, 0.35);
    display: flex;
    flex-direction: column;
    padding: 17px;
    color: var(--ink);
  }
  .frame::before {
    content: '';
    position: absolute;
    inset: 10px;
    box-shadow: inset 0 0 0 1.5px var(--ink);
    pointer-events: none;
  }
  .center {
    align-items: center;
    text-align: center;
    padding: 32px 28px;
  }
  .band {
    box-shadow: inset 0 0 0 1.5px var(--ink);
    padding: 12px 10px 14px;
    text-align: center;
  }
  .kicker {
    font: 700 10px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3.5px;
  }
  .muted {
    color: var(--ink-2);
    margin-top: 10px;
  }
  .title {
    font-family: 'Fraunces', serif;
    font-variation-settings: 'opsz' 36;
    font-weight: 800;
    font-size: 25px;
    line-height: 1.05;
    text-transform: uppercase;
    margin-top: 8px;
    letter-spacing: 0.5px;
  }
  .title2 {
    font: 800 26px/1.05 'Fraunces', serif;
    text-transform: uppercase;
    margin: 6px 0 14px;
  }
  .headline {
    text-align: center;
    font: 700 18px/1 'Fraunces', serif;
    margin: 14px 0 8px;
  }
  .rows {
    padding: 0 10px;
  }
  .rows.wide {
    width: 100%;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font: 500 14.5px/1.55 'Fraunces', serif;
    font-variation-settings: 'opsz' 12;
    text-align: left;
  }
  .dots {
    flex: 1;
    border-bottom: 1.2px dotted rgba(43, 33, 25, 0.45);
    transform: translateY(-4px);
  }
  .rule {
    height: 1px;
    background: var(--ink);
    margin: 10px 10px 8px;
    align-self: stretch;
  }
  .notes {
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font: 500 13px/1.3 'Source Sans 3', sans-serif;
    text-align: center;
  }
  .foot {
    margin-top: auto;
    font: italic 400 11px/1.3 'Fraunces', serif;
    color: var(--ink-2);
    text-align: center;
    padding: 0 12px 4px;
  }
  .icon {
    width: 64px;
    height: 64px;
  }
  .util {
    font: 500 15px/1.45 'Fraunces', serif;
    margin-top: 10px;
  }
  .strip {
    width: 100%;
    height: 16px;
    box-shadow: inset 0 0 0 1.2px var(--ink);
  }
  .mname {
    font: 800 24px/1.1 'Fraunces', serif;
    text-transform: uppercase;
    margin-top: 18px;
  }
  .stamp {
    margin: 54px 0;
    transform: rotate(-12deg);
    border: 3px solid var(--oxblood);
    outline: 1px solid var(--oxblood);
    outline-offset: 3px;
    padding: 10px 18px;
    color: var(--oxblood);
    font: 900 30px/1 'Fraunces', serif;
    letter-spacing: 3px;
    opacity: 0.92;
  }
  .mfor {
    font: 600 16px/1.4 'Source Sans 3', sans-serif;
  }
  .ufor {
    font: 500 14px/1.4 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
</style>
