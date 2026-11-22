<script lang="ts">
  // Footer controller prompts (Stage 3 §3, §4) for one controller: the one that opened the
  // screen, or the receiver's on review. Glyphs follow that pad's family.
  import Coin from './Coin.svelte';
  import type { GlyphFamily } from '../present';
  import type { Prompt } from './model';
  let { prompts, family = 'playstation', swap = false }: { prompts: Prompt[]; family?: GlyphFamily; swap?: boolean } = $props();
</script>

<div class="prompts" data-family={family}>
  {#each prompts as p (p.label)}
    <span class="pr">
      {#each p.glyphs as g, i}<span class="c" class:stack={i > 0}><Coin glyph={g} {family} {swap} /></span>{/each}
      <em>{p.label}</em>
    </span>
  {/each}
</div>

<style>
  .prompts {
    display: flex;
    align-items: center;
    gap: 30px;
    font: 600 19px/1 'Source Sans 3', sans-serif;
    color: #2b2119;
  }
  .pr {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .pr em {
    font-style: normal;
  }
  .c.stack {
    margin-left: -16px;
  }
</style>
