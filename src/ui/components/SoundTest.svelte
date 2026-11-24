<script lang="ts">
  // Sound Test (dev only, audio Phase 0 §9): every registry ID by category, what it plays now
  // (FILE ×n / SYNTH / SILENT) and a Play button. Play uses the entry's jitter, so variations can
  // be heard. Reload re-reads public/audio/ so dropped-in files play without a restart.
  // Controller: the standard menu routing (D-pad moves, Confirm plays, Back leaves; left/right on
  // the intensity slider change it).
  import { audio, REGISTRY, SOUND_IDS, categoryOf, fileStem, type SoundId } from '../../audio';
  import ActionButton from './ActionButton.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let intensity = $state(70);
  let version = $state(0);
  let reloading = $state(false);
  let lastPlayed = $state<SoundId | null>(null);

  const groups = (() => {
    const m = new Map<string, SoundId[]>();
    for (const id of SOUND_IDS) {
      const c = categoryOf(id);
      m.set(c, [...(m.get(c) ?? []), id]);
    }
    return [...m.entries()];
  })();

  const status = (id: SoundId, _v: number) => {
    const s = audio.status(id);
    return s.kind === 'file' ? { cls: 'file', text: `FILE ×${s.count}` } : s.kind === 'synth' ? { cls: 'synth', text: 'SYNTH' } : { cls: 'silent', text: 'SILENT' };
  };

  function play(id: SoundId) {
    audio.unlock();
    const k = intensity / 100;
    audio.play(id, { intensity: k, amount: Math.round(k * 1000) });
    lastPlayed = id;
  }

  async function reload() {
    reloading = true;
    await audio.reloadFiles();
    reloading = false;
    version++;
  }
</script>

<div class="panel soundtest">
  <div class="head">
    <h2>Sound test</h2>
    <label class="slider">Intensity {intensity}%
      <input type="range" min="0" max="100" step="10" bind:value={intensity} data-autofocus />
    </label>
    <ActionButton label={reloading ? 'Reloading…' : 'Reload audio files'} disabled={reloading} onclick={reload} />
    <ActionButton label="Back" glyph="back" onclick={onclose} />
  </div>
  <div class="note">{lastPlayed ? `Played ${lastPlayed} · ` : ''}Files go in public/audio/&lt;category&gt;/&lt;id_with_underscores&gt;_01.ogg</div>
  <div class="list">
    {#each groups as [cat, ids] (cat)}
      <h3>{cat}</h3>
      {#each ids as id (id)}
        {@const st = status(id, version)}
        <div class="row">
          <button class="play" data-focus-key={`play-${id}`} onclick={() => play(id)} aria-label={`Play ${id}`}>▶</button>
          <span class="id">{id}</span>
          <span class="badge {st.cls}">{st.text}</span>
          <span class="meta">{REGISTRY[id].bus} · gain {REGISTRY[id].gain} · {fileStem(id)}_01.ogg</span>
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .soundtest {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1100px;
    height: 900px;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: grid;
    grid-template-columns: 1fr auto 260px 160px;
    align-items: center;
    gap: 16px;
  }
  h2 {
    margin: 0 auto 0 0;
    font: 800 36px/1 'Fraunces', serif;
  }
  .slider {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 700 16px 'Source Sans 3', sans-serif;
  }
  .note {
    font: 600 14px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
  }
  h3 {
    margin: 14px 0 6px;
    font: 700 18px 'Fraunces', serif;
    text-transform: capitalize;
  }
  .row {
    display: grid;
    grid-template-columns: 44px 230px 90px 1fr;
    align-items: center;
    gap: 12px;
    padding: 3px 0;
    font: 600 15px 'Source Sans 3', sans-serif;
  }
  .play {
    width: 40px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    box-shadow: inset 0 0 0 1.5px rgba(43, 33, 25, 0.25);
    cursor: pointer;
    font-size: 14px;
  }
  .id {
    font-family: ui-monospace, monospace;
  }
  .badge {
    justify-self: start;
    padding: 2px 8px;
    border-radius: 6px;
    font: 800 12px 'Source Sans 3', sans-serif;
    letter-spacing: 0.04em;
  }
  .badge.file {
    background: #0f9c84;
    color: white;
  }
  .badge.synth {
    background: #c8a24a;
    color: #2b2119;
  }
  .badge.silent {
    background: rgba(43, 33, 25, 0.12);
    color: var(--ink-2);
  }
  .meta {
    color: var(--ink-2);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
