<script lang="ts">
  // New-game setup (basic; the full lobby with presets and controllers arrives in M4/M10).
  import type { SeatConfig } from '../../engine';
  import { TOKEN_IDS } from '../../render/tokens/tokens';
  import { PLAYER_COLORS, TOKEN_NAMES } from '../theme';
  import ActionButton from './ActionButton.svelte';

  let { onstart }: { onstart: (seats: SeatConfig[], randomOrder: boolean) => void } = $props();

  let seats = $state<SeatConfig[]>([
    { kind: 'human', name: 'Player 1', token: 'teacup', color: PLAYER_COLORS[0] },
    { kind: 'human', name: 'Player 2', token: 'key', color: PLAYER_COLORS[1] },
  ]);
  let randomOrder = $state(true);

  const humans = $derived(seats.filter((s) => s.kind === 'human').length);
  const dupToken = $derived(new Set(seats.map((s) => s.token)).size !== seats.length);
  const dupColor = $derived(new Set(seats.map((s) => s.color)).size !== seats.length);
  const problem = $derived(
    humans < 1 ? 'At least one human seat is needed.' : dupToken ? 'Each seat needs its own token.' : dupColor ? 'Each seat needs its own color.' : null,
  );

  function addSeat() {
    if (seats.length >= 6) return;
    const token = TOKEN_IDS.find((t) => !seats.some((s) => s.token === t))!;
    const color = PLAYER_COLORS.find((c) => !seats.some((s) => s.color === c))!;
    seats.push({ kind: 'bot', name: `Bot ${seats.length + 1}`, token, color });
  }
  function removeSeat(i: number) {
    if (seats.length > 2) seats.splice(i, 1);
  }
</script>

<div class="panel setup">
  <div class="eyebrow">New game</div>
  <h1>Property Night</h1>
  <div class="rows">
    {#each seats as seat, i}
      <div class="row">
        <span class="swatch" style="background:{seat.color}"></span>
        <input bind:value={seat.name} maxlength="16" aria-label="Seat {i + 1} name" />
        <select bind:value={seat.kind} aria-label="Seat {i + 1} kind">
          <option value="human">Human</option>
          <option value="bot">Bot</option>
          <option value="bankBot">Bank-backed bot</option>
        </select>
        <select bind:value={seat.token} aria-label="Seat {i + 1} token">
          {#each TOKEN_IDS as t}<option value={t}>{TOKEN_NAMES[t]}</option>{/each}
        </select>
        <select bind:value={seat.color} aria-label="Seat {i + 1} color">
          {#each PLAYER_COLORS as c, k}<option value={c}>Color {k + 1}</option>{/each}
        </select>
        <button class="x" onclick={() => removeSeat(i)} disabled={seats.length <= 2} aria-label="Remove seat">×</button>
      </div>
    {/each}
  </div>
  <div class="opts">
    <button class="link" onclick={addSeat} disabled={seats.length >= 6}>+ Add seat</button>
    <label><input type="checkbox" bind:checked={randomOrder} /> Random turn order</label>
  </div>
  {#if problem}<div class="problem">{problem}</div>{/if}
  <ActionButton label="Start game" glyph="confirm" primary disabled={!!problem} onclick={() => onstart($state.snapshot(seats), randomOrder)} />
</div>

<style>
  .setup {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 860px;
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  h1 {
    margin: 0;
    font: 800 48px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 28px 1fr 190px 150px 120px 44px;
    gap: 10px;
    align-items: center;
  }
  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--paper-hi), 0 0 0 3px var(--ink);
  }
  input,
  select {
    height: 44px;
    font: 600 18px 'Source Sans 3', sans-serif;
    padding: 0 10px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
    color: var(--ink);
    min-width: 0;
  }
  .x {
    height: 44px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 22px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .opts {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font: 600 17px 'Source Sans 3', sans-serif;
  }
  .opts label {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .link {
    border: 0;
    background: none;
    font: 700 17px 'Source Sans 3', sans-serif;
    color: var(--forest);
    cursor: pointer;
  }
  .problem {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
</style>
