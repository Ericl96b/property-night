<script lang="ts">
  // Focusable wrapper around a card (Stage 3 §2). The slot takes focus, never the card: the
  // Stage 1 focus style (style.css) fills the slot's 5 px margin in forest and scales it.
  import type { Snippet } from 'svelte';
  import GameCard from './GameCard.svelte';
  import type { CardItem, CardSize, EmptyInfo } from './model';


  let {
    item = null,
    size = 'thumb',
    empty = null,
    current = false,
    inOffer = false,
    blocked = null,
    pledged = false,
    locked = null,
    tag = null,
    tagColor = '#2B2119',
    label = '',
    disabled = false,
    onclick,
    onfocus,
    children,
    ...rest
  }: {
    item?: CardItem | null;
    size?: CardSize;
    empty?: EmptyInfo | null;
    /** Selected / current: outline only, never a fill (Stage 1 §2B). */
    current?: boolean;
    inOffer?: boolean;
    /** Reason chip ("Has houses", "Pledged"); the card stays readable but dimmed. */
    blocked?: string | null;
    /** Collateral for a loan: lock badge. */
    pledged?: boolean;
    /** Locked slot (padlock), with its caption. */
    locked?: string | null;
    tag?: string | null;
    tagColor?: string;
    label?: string;
    disabled?: boolean;
    onclick?: () => void;
    onfocus?: () => void;
    children?: Snippet;
    [k: string]: unknown;
  } = $props();
</script>

<button
  class="slot"
  class:current
  class:inoffer={inOffer}
  class:blocked={!!blocked}
  class:isempty={!!empty && !item}
  class:locked={!!locked}
  aria-label={label || undefined}
  aria-disabled={blocked || disabled ? 'true' : undefined}
  {onclick}
  {onfocus}
  {...rest}
>
  {#if item}
    <GameCard {item} {size} />
  {:else if locked}
    <div class="lslot">
      <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="11" rx="2" fill="#5E4C3B" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#5E4C3B" stroke-width="2.4" /><circle cx="12" cy="15.6" r="1.6" fill="#FBF6EA" /></svg>
      <em>{locked}</em>
    </div>
  {:else if empty}
    <div class="eslot">
      {#if empty.band}<div class="eband" style="background:{empty.band}"></div>{:else if empty.icon}<img class="eicon" src={empty.icon} alt="" width="34" height="34" />{/if}
      <div class="ename">{empty.name}</div>
      {#if empty.owner}<div class="eown"><i style="background:{empty.owner.color}"></i>{empty.owner.name}</div>{:else}<div class="eown un">{empty.note ?? 'Unowned'}</div>{/if}
    </div>
  {:else if children}
    {@render children()}
  {/if}
  {#if inOffer}
    <em class="otag"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 7.5 13l7-8" fill="none" stroke="#FBF6EA" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>In offer</em>
  {/if}
  {#if blocked}<em class="btag">{blocked}</em>{/if}
  {#if pledged}
    <em class="lockb" title="Pledged to a loan"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="11" rx="2" fill="#FBF6EA" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#FBF6EA" stroke-width="2.4" /></svg></em>
  {/if}
  {#if tag}<em class="ctag" style="background:{tagColor}">{tag}</em>{/if}
</button>

<style>
  .slot {
    position: relative;
    padding: 5px;
    border: 0;
    border-radius: 12px;
    display: block;
    flex: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: transform 0.12s ease;
  }
  /* Focus fill comes from style.css; the slot also lifts a little (mock-up .slot.f). */
  .slot:focus {
    translate: 0 -3px;
    box-shadow: 0 0 0 2px #16301f, 0 10px 20px rgba(10, 5, 2, 0.5) !important;
  }
  .current {
    box-shadow: inset 0 0 0 3px var(--forest, #2f5d46);
    background: rgba(47, 93, 70, 0.08);
  }
  .inoffer > :global(.card),
  .inoffer > :global(.cashc) {
    opacity: 0.38;
  }
  .blocked > :global(.card) {
    opacity: 0.4;
  }
  em {
    font-style: normal;
  }
  .otag,
  .btag {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    font: 700 14px/1 'Source Sans 3', sans-serif;
    padding: 5px 8px;
    border-radius: 6px;
    z-index: 2;
  }
  .otag {
    background: #2f5d46;
    color: #fbf6ea;
  }
  .btag {
    background: #fbf6ea;
    color: #8e2f23;
    box-shadow: 0 0 0 1.5px #8e2f23;
  }
  .ctag {
    position: absolute;
    top: -6px;
    right: -6px;
    font: 800 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    color: #fbf6ea;
    padding: 4px 7px;
    border-radius: 5px;
    z-index: 4;
    box-shadow: 0 2px 5px rgba(10, 5, 2, 0.35);
  }
  .lockb {
    position: absolute;
    top: -4px;
    left: -4px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #8e2f23;
    box-shadow: 0 2px 5px rgba(10, 5, 2, 0.35);
    z-index: 4;
  }
  .eslot,
  .lslot {
    width: 92px;
    height: 122px;
    border-radius: 7px;
    border: 2px dashed rgba(43, 33, 25, 0.28);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 7px 6px 6px;
    box-sizing: border-box;
  }
  .lslot {
    justify-content: center;
    gap: 8px;
    font: 700 14px/1.1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
    text-align: center;
  }
  .eband {
    width: 100%;
    height: 20px;
    border-radius: 2px;
    opacity: 0.38;
    flex: none;
  }
  .eicon {
    opacity: 0.3;
    flex: none;
  }
  .ename {
    font: 600 14px/1.12 'Fraunces', serif;
    color: #5e4c3b;
    text-align: center;
    margin-top: 6px;
    flex: 1;
  }
  .eown {
    display: flex;
    align-items: center;
    gap: 5px;
    font: 700 14px/1 'Source Sans 3', sans-serif;
    color: #5e4c3b;
  }
  .eown i {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    display: inline-block;
  }
  .eown.un {
    font-weight: 600;
    opacity: 0.8;
  }
</style>
