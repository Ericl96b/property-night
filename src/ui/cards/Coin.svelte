<script lang="ts">
  // One controller glyph as a brass coin (Stage 1 glyph style). Symbol art when the set has it,
  // otherwise a lettered coin drawn the same way (L1, R1, X, Y…).
  import { symbolUrl } from '../../render/symbols';
  import { glyphFor, type Glyph, type GlyphFamily } from '../present';

  let { glyph, family = 'playstation', swap = false, size = 44 }: { glyph: Glyph; family?: GlyphFamily; swap?: boolean; size?: number } = $props();
  const g = $derived(glyphFor(glyph, family, swap));
</script>

{#if g.symbol}
  <img class="coin" src={symbolUrl(g.symbol)} alt="" width={size} height={size} />
{:else}
  <svg class="coin" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <radialGradient id="coinBrass" cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stop-color="#FFF3C9" /><stop offset="0.35" stop-color="#E2BC66" /><stop offset="0.8" stop-color="#9A7030" /><stop offset="1" stop-color="#5E4115" />
      </radialGradient>
    </defs>
    <circle cx="20" cy="21.6" r="18" fill="rgba(20,10,4,.32)" />
    <circle cx="20" cy="20" r="18" fill="url(#coinBrass)" stroke="#4A3210" stroke-width="1" />
    <circle cx="20" cy="20" r="14.5" fill="#FBF3DF" stroke="rgba(74,50,16,.55)" stroke-width="1" />
    <path d="M9 14a13 13 0 0 1 8-6" fill="none" stroke="#FFF" stroke-width="1.2" opacity=".7" />
    <text x="20" y={g.letter && g.letter.length > 1 ? 24.8 : 25.6} text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="700" font-size={g.letter && g.letter.length > 1 ? 13.5 : 15.5} fill="#2B2119">{g.letter}</text>
  </svg>
{/if}

<style>
  .coin {
    flex: none;
    display: block;
  }
</style>
