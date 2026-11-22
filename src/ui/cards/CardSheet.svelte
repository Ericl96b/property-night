<script lang="ts">
  // ?cards: every card kind, size and slot state (Stage 3 §2), for comparing against the
  // approved card-component.png. Not reachable from the game's menus.
  import { stage3Demo } from '../../bench/stage3Demo';
  import { symbolUrl } from '../../render/symbols';
  import CardSlot from './CardSlot.svelte';
  import GameCard from './GameCard.svelte';
  import PromptBar from './PromptBar.svelte';
  import { deedCard, voucherCard, type CardItem } from './model';
  import { uiGroupColor } from '../groups';

  const s = stage3Demo();
  const harbor = deedCard(s, 9);
  const rf = voucherCard(s, { kind: 'rentFree', from: 1, to: 0, group: 'railroad', total: 3, left: 2 });
  const nb = voucherCard(s, { kind: 'noBuild', from: 0, to: 1, group: 'orange', total: 2, left: 2 });
  const thumbs: [CardItem, string, string][] = [
    [deedCard(s, 18), 'Street', 'no buildings'],
    [deedCard(s, 6), 'Street', '3 houses'],
    [deedCard(s, 5), 'Railroad', ''],
    [deedCard(s, 28), 'Utility', ''],
    [deedCard(s, 37), 'Mortgaged', 'flipped to its back'],
    [{ t: 'gojf', deck: 'chance' }, 'Jail Free card', 'Chance frame'],
    [{ t: 'gojf', deck: 'chest' }, 'Jail Free card', 'Community Chest frame'],
    [{ t: 'cash', amount: 150 }, 'Cash', 'banknote stack'],
    [voucherCard(s, { kind: 'rentFree', from: 1, to: 0, group: 'pink', total: 2, left: 2 }), 'Rent-Free', 'color set'],
    [voucherCard(s, { kind: 'rentFree', from: 1, to: 0, group: 'utility', total: 1, left: 1 }), 'Rent-Free', 'utilities'],
  ];
</script>

<div class="stage sheet">
  <div class="eyebrow">Shared component · used by Inventory and Trade</div>
  <h1>One card, three sizes</h1>
  <div class="row big">
    <figure><GameCard item={harbor} size="detail" /><figcaption><b>Detail · 360 × 480</b></figcaption></figure>
    <figure><GameCard item={harbor} size="std" /><figcaption><b>Standard · 200 × 266</b></figcaption></figure>
    <figure><GameCard item={harbor} size="thumb" /><figcaption><b>Thumbnail · 92 × 122</b></figcaption></figure>
    <figure><GameCard item={rf} size="detail" /><figcaption><b>Rent-Free voucher</b></figcaption></figure>
    <figure><GameCard item={nb} size="std" /><figcaption><b>No Building voucher</b></figcaption></figure>
    <figure><GameCard item={nb} size="thumb" /><figcaption><b>Thumbnail</b></figcaption></figure>
  </div>
  <div class="eyebrow">Every kind, as a thumbnail</div>
  <div class="row">
    {#each thumbs as [item, a, b]}
      <figure><GameCard {item} size="thumb" /><figcaption><b>{a}</b>{#if b}<br />{b}{/if}</figcaption></figure>
    {/each}
  </div>
  <div class="eyebrow">Slot states (the slot takes focus, never the card)</div>
  <div class="row tray">
    <figure><CardSlot item={deedCard(s, 16)} data-autofocus /><figcaption><b>Focused</b></figcaption></figure>
    <figure><CardSlot item={deedCard(s, 16)} current /><figcaption><b>Current</b><br />outline only</figcaption></figure>
    <figure><CardSlot item={deedCard(s, 15)} inOffer /><figcaption><b>In the offer</b></figcaption></figure>
    <figure><CardSlot item={deedCard(s, 6)} blocked="Has houses" /><figcaption><b>Can't trade</b></figcaption></figure>
    <figure><CardSlot item={deedCard(s, 15)} pledged blocked="Pledged" /><figcaption><b>Pledged</b></figcaption></figure>
    <figure><CardSlot empty={{ name: 'Sunset Drive', band: uiGroupColor(s.board, 'orange'), owner: { name: 'Riley', color: '#0F9C84' } }} /><figcaption><b>Not yours</b></figcaption></figure>
    <figure><CardSlot empty={{ name: 'Scarlet Square', band: uiGroupColor(s.board, 'red'), owner: null }} /><figcaption><b>Unowned</b></figcaption></figure>
    <figure><CardSlot empty={{ name: 'West Line', band: null, icon: symbolUrl('railroad'), owner: null }} /><figcaption><b>Unowned</b></figcaption></figure>
    <figure><CardSlot locked="Promises off" /><figcaption><b>Locked</b></figcaption></figure>
  </div>
  <div class="eyebrow">Prompts</div>
  <div class="row prompts">
    <PromptBar family="playstation" prompts={[{ glyphs: ['dpad'], label: 'Move' }, { glyphs: ['confirm'], label: 'Select' }, { glyphs: ['cycleLeft', 'cycleRight'], label: 'Players' }, { glyphs: ['back'], label: 'Close' }]} />
    <PromptBar family="nintendo" prompts={[{ glyphs: ['dpadLR'], label: '±$10' }, { glyphs: ['dpadUD'], label: 'Group' }, { glyphs: ['trade'], label: 'Propose' }]} />
  </div>
</div>

<style>
  .sheet {
    position: relative;
    width: 1920px;
    min-height: 1700px;
    padding: 56px 64px;
    box-sizing: border-box;
    font-family: 'Source Sans 3', sans-serif;
    color: #fbf6ea;
    background: radial-gradient(ellipse 85% 80% at 50% 42%, #6a4330 0%, #4a2e1f 48%, #241510 100%);
  }
  h1 {
    font: 800 52px/1.05 'Fraunces', serif;
    margin: 8px 0 28px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #e2bc66;
    margin: 28px 0 16px;
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 28px;
    flex-wrap: wrap;
  }
  .tray {
    background: #efe5cd;
    border-radius: 12px;
    padding: 18px;
    color: #2b2119;
  }
  .prompts {
    background: #fbf6ea;
    border-radius: 12px;
    padding: 18px;
    gap: 60px;
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  figcaption {
    font: 500 15px/1.25 'Source Sans 3', sans-serif;
    text-align: center;
  }
</style>
