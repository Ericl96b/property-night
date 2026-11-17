<script lang="ts">
  import { GLYPH_SYMBOL, type Glyph } from '../present';
  import { symbolUrl } from '../../render/symbols';

  let {
    label,
    glyph,
    primary = false,
    hint = '',
    disabled = false,
    onclick,
  }: { label: string; glyph?: Glyph; primary?: boolean; hint?: string; disabled?: boolean; onclick: () => void } = $props();
</script>

<button class="btn" class:primary {disabled} {onclick}>
  {#if glyph}<img src={symbolUrl(GLYPH_SYMBOL[glyph])} alt="" />{:else}<span class="spacer"></span>{/if}
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
  .btn:hover:not(:disabled) {
    background: #efe3c8;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .primary {
    background: var(--forest);
    color: var(--paper-hi);
    box-shadow: none;
  }
  .primary:hover:not(:disabled) {
    background: #28503c;
  }
  img,
  .spacer {
    width: 44px;
    height: 44px;
    flex: none;
  }
  .label {
    flex: 1;
  }
  .hint {
    font: 600 14px/1 'Source Sans 3', sans-serif;
    opacity: 0.75;
  }
</style>
