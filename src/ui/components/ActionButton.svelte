<script lang="ts">
  import { glyphFor, type Glyph, type GlyphFamily } from '../present';
  import { symbolUrl } from '../../render/symbols';
  import { getContext } from 'svelte';

  let {
    label,
    glyph,
    primary = false,
    hint = '',
    disabled = false,
    family,
    onclick,
  }: { label: string; glyph?: Glyph; primary?: boolean; hint?: string; disabled?: boolean; family?: GlyphFamily; onclick: () => void } = $props();
  // Glyph family of the acting controller comes from context unless given explicitly.
  const ctx = getContext<{ family: GlyphFamily; swap: boolean } | undefined>('glyphs');
  const g = $derived(glyph ? glyphFor(glyph, family ?? ctx?.family ?? 'playstation', ctx?.swap ?? false) : null);
</script>

<button class="btn" class:primary {disabled} {onclick}>
  {#if g?.symbol}<img src={symbolUrl(g.symbol)} alt="" />{:else if g?.letter}<span class="letter">{g.letter}</span>{:else}<span class="spacer"></span>{/if}
  <span class="label">{label}</span>
  {#if hint}<span class="hint">{hint}</span>{/if}
</button>

<style>
  .btn {
    height: 64px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 16px 0 10px;
    border: 0;
    border-radius: 10px;
    background: var(--paper);
    color: var(--ink);
    font: 600 20px/1.1 'Source Sans 3', sans-serif;
    cursor: pointer;
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.18);
    text-align: left;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  /* Recommended/default option: accent outline and label, never a solid fill (Stage 1 §2B).
     Focus (style.css) is the only solid fill. */
  .primary {
    color: var(--forest);
    font-weight: 800;
    box-shadow: inset 0 0 0 3px var(--forest);
  }
  img,
  .spacer,
  .letter {
    width: 44px;
    height: 44px;
    flex: none;
  }
  .letter {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff3c9, #c39445 60%, #5e4115);
    color: var(--ink);
    font: 800 20px/1 'Source Sans 3', sans-serif;
    box-shadow: inset 0 0 0 3px rgba(43, 33, 25, 0.35);
  }
  .label {
    flex: 1;
  }
  .hint {
    font: 600 14px/1 'Source Sans 3', sans-serif;
    opacity: 0.75;
  }
</style>
