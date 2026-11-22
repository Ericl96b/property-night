<script lang="ts">
  // Test board controls (Batch 4, SPEC-benchmark §4). Two panels in the player-card and
  // context-panel positions: the board on the left, the selected tile and camera on the right.
  import { onMount } from 'svelte';
  import type { TestBoard } from '../../bench/testBoard';
  import type { BoardPresets, BoardPreset } from '../../app/boardPresets';
  import type { PresetId } from '../../bench/scenes';
  import ActionButton from './ActionButton.svelte';
  import { TUNABLE_RANGES, type TuneShot } from '../../bench/testBoard';
  import { CLOSEUP } from '../../render/cameraDirector';

  let {
    tb,
    v,
    boards,
    detailed,
    ondetailed,
    onbenchmark,
    onexit,
  }: {
    tb: TestBoard;
    /** Bumped whenever the test board changes (the class itself isn't reactive). */
    v: number;
    boards: BoardPresets;
    detailed: boolean;
    ondetailed: (on: boolean) => void;
    onbenchmark: () => void;
    onexit: () => void;
  } = $props();

  let list = $state<BoardPreset[]>([]);
  let boardId = $state('classic-board');
  onMount(() => {
    void boards.list().then((l) => (list = l));
  });

  const GROUP_NAME: Record<string, string> = {
    brown: 'Brown',
    lightBlue: 'Light blue',
    pink: 'Pink',
    orange: 'Orange',
    red: 'Red',
    yellow: 'Yellow',
    green: 'Green',
    darkBlue: 'Dark blue',
  };
  const PRESETS: { id: PresetId; label: string }[] = [
    { id: 'empty', label: 'Empty board' },
    { id: 'allHouses', label: 'All houses' },
    { id: 'allHotels', label: 'All hotels' },
    { id: 'worstCase', label: 'Worst case' },
  ];

  const sel = $derived((void v, tb.selected));
  const name = $derived((void v, tb.tileName));
  const owner = $derived(sel.owner === null ? 'None' : tb.state.seats[sel.owner].name);
  const ownerColor = $derived(sel.owner === null ? null : tb.state.seats[sel.owner].color);
  const buildings = $derived(sel.buildings === 5 ? 'Hotel' : sel.buildings === 0 ? 'No buildings' : `${sel.buildings} house${sel.buildings > 1 ? 's' : ''}`);
  const preset = $derived((void v, tb.preset));
  const group = $derived((void v, tb.group));
  const tokens = $derived((void v, tb.tokens));
  const animating = $derived((void v, tb.animating));
  const closeUp = $derived((void v, tb.closeUp));
  // Stage 2 Camera panel.
  const tuning = $derived((void v, tb.tuning));
  const tuneShot = $derived((void v, tb.tuneShot));
  const moveLen = $derived((void v, tb.moveLen));
  const values = $derived((void v, { ...CLOSEUP }));
  const SHOTS: { id: TuneShot; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'dice', label: 'Dice' },
    { id: 'chase', label: 'Chase' },
    { id: 'landed', label: 'Landed' },
  ];
  let copied = $state<string | null>(null);
  async function copy() {
    copied = await tb.copyTunables();
  }
  const fmt = (x: number, step: number) => (step >= 1 ? String(Math.round(x)) : x.toFixed(step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3));

  async function pickBoard(id: string) {
    boardId = id;
    const p = list.find((b) => b.id === id);
    if (p) await tb.setBoard(JSON.parse(JSON.stringify(p.board)));
  }
</script>

<div class="testb">
  <div class="panel left">
    <div class="eyebrow">Sandbox · no rules</div>
    <div class="title">Test board</div>
    {#each PRESETS as p (p.id)}
      <ActionButton label={p.label} primary={preset === p.id} onclick={() => tb.applyPreset(p.id)} />
    {/each}
    <ActionButton label={`One group: ${GROUP_NAME[group]}`} primary={preset === 'oneGroup'} hint={preset === 'oneGroup' ? 'next' : ''} onclick={() => (preset === 'oneGroup' ? tb.cycleGroup(1) : tb.applyPreset('oneGroup'))} />
    <label class="row">Board
      <select value={boardId} onchange={(e) => pickBoard((e.currentTarget as HTMLSelectElement).value)}>
        {#each list as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
      </select>
    </label>
    <ActionButton label={`Tokens: ${tokens === 0 ? 'Off' : tokens}`} onclick={() => tb.cycleTokens()} />
    <ActionButton label={animating ? 'Animate: on' : 'Animate: off'} onclick={() => tb.setAnimate(!animating)} />
    <ActionButton label={tuning ? 'Camera panel: on' : 'Camera panel: off'} primary={tuning} onclick={() => tb.setTuning(!tuning)} />
    <ActionButton label={detailed ? 'Overlay: Detailed' : 'Overlay: FPS'} onclick={() => ondetailed(!detailed)} />
    <ActionButton label="Run benchmark from here…" onclick={onbenchmark} />
    <ActionButton label="Exit to menu" glyph="back" onclick={onexit} />
  </div>

  {#if tuning}
  <div class="panel right cam">
    <div class="eyebrow">Camera · {name}</div>
    <label class="row">Shot
      <select value={tuneShot} onchange={(e) => tb.setTuneShot((e.currentTarget as HTMLSelectElement).value as TuneShot)}>
        {#each SHOTS as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
      </select>
    </label>
    <label class="row">Move length
      <input type="range" min="1" max="12" step="1" value={moveLen} oninput={(e) => tb.setMoveLen(Number((e.currentTarget as HTMLInputElement).value))} />
      <span class="val">{moveLen}</span>
    </label>
    <ActionButton label={`Play a move (${moveLen})`} glyph="confirm" onclick={() => tb.playMove()} />
    <ActionButton label="Copy values" onclick={copy} />
    {#if copied}<textarea class="copied" readonly rows="6">{copied}</textarea>{/if}
    {#each TUNABLE_RANGES as r (r.key)}
      <label class="slider">
        <span class="lbl">{r.label}</span>
        <span class="val">{fmt(values[r.key], r.step)}</span>
        <input type="range" min={r.min} max={r.max} step={r.step} value={values[r.key]} oninput={(e) => tb.setTunable(r.key, Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
    {/each}
  </div>
  {:else}
  <div class="panel right">
    <div class="eyebrow">Selected · ←/→ to move</div>
    <div class="tile">{name}</div>
    <div class="info">
      {#if ownerColor}<span class="dot" style="background:{ownerColor}"></span>{/if}{owner}
      {#if sel.street} · {buildings}{/if}
      {#if sel.mortgaged} · mortgaged{/if}
      {#if sel.pledged} · pledged{/if}
    </div>
    <ActionButton label="Add building" glyph="manage" disabled={!sel.street || sel.buildings >= 5} onclick={() => tb.addBuilding()} />
    <ActionButton label="Remove building" glyph="trade" disabled={!sel.street || sel.buildings <= 0} onclick={() => tb.removeBuilding()} />
    <ActionButton label={`Owner: ${owner}`} onclick={() => tb.cycleOwner()} />
    <ActionButton label={sel.mortgaged ? 'Mortgage: on' : 'Mortgage: off'} onclick={() => tb.toggleMortgage()} />
    <ActionButton label={sel.pledged ? 'Pledge: on' : 'Pledge: off'} onclick={() => tb.togglePledge()} />
    <ActionButton label={closeUp ? 'Close-up: on' : 'Close-up: off'} onclick={() => tb.setCloseUp(!closeUp)} />
    <ActionButton label="Previous side" glyph="cycleLeft" onclick={() => tb.rotate(-1)} />
    <ActionButton label="Next side" glyph="cycleRight" onclick={() => tb.rotate(1)} />
  </div>
  {/if}
</div>

<style>
  .panel {
    top: 32px;
    width: 340px;
    max-height: 1016px;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .left {
    left: 32px;
  }
  .right {
    right: 32px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .title,
  .tile {
    font: 800 32px/1.05 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
    margin-bottom: 4px;
  }
  .info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font: 600 18px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
    margin-bottom: 6px;
  }
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font: 600 17px/1.2 'Source Sans 3', sans-serif;
    min-height: 56px;
  }
  .cam {
    gap: 6px;
  }
  .slider {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    font: 600 15px/1.2 'Source Sans 3', sans-serif;
  }
  .slider input {
    grid-column: 1 / -1;
    width: 100%;
    height: 28px;
  }
  .val {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .copied {
    width: 100%;
    font: 12px/1.3 monospace;
  }
  select {
    height: 44px;
    width: 190px;
    font: 600 17px 'Source Sans 3', sans-serif;
    padding: 0 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
  }
</style>
