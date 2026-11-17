<script lang="ts">
  // New-game setup with controller assignment (SPEC §4): "press any button to join" binds a
  // pad to the next human seat; seat rows show the controller type. Presets and the full lobby
  // join in M6/M10.
  import { onDestroy, onMount } from 'svelte';
  import type { SeatConfig } from '../../engine';
  import { TOKEN_IDS } from '../../render/tokens/tokens';
  import type { InputManager, PadInfo } from '../../input/manager';
  import { PLAYER_COLORS, TOKEN_NAMES } from '../theme';
  import ActionButton from './ActionButton.svelte';
  import RemapDialog from './RemapDialog.svelte';
  import RulesEditor from './RulesEditor.svelte';
  import type { RulesPreset, RulesPresets } from '../../app/presets';

  let {
    onstart,
    input,
    pads,
    presets,
  }: {
    onstart: (seats: SeatConfig[], randomOrder: boolean, rulesId: string) => void;
    input: InputManager;
    pads: PadInfo[];
    presets: RulesPresets;
  } = $props();

  let rulesId = $state('classic');
  let rulesList = $state<RulesPreset[]>([]);
  let editingRules = $state(false);
  async function loadRules() {
    rulesList = await presets.list();
    if (!rulesList.some((p) => p.id === rulesId)) rulesId = 'classic';
  }
  $effect(() => {
    void editingRules;
    void loadRules();
  });

  let seats = $state<SeatConfig[]>([
    { kind: 'human', name: 'Player 1', token: 'teacup', color: PLAYER_COLORS[0] },
    { kind: 'human', name: 'Player 2', token: 'key', color: PLAYER_COLORS[1] },
  ]);
  let randomOrder = $state(true);
  let remapping = $state<string | null>(null);

  const humans = $derived(seats.filter((s) => s.kind === 'human').length);
  const dupToken = $derived(new Set(seats.map((s) => s.token)).size !== seats.length);
  const dupColor = $derived(new Set(seats.map((s) => s.color)).size !== seats.length);
  const problem = $derived(
    humans < 1 ? 'At least one human seat is needed.' : dupToken ? 'Each seat needs its own token.' : dupColor ? 'Each seat needs its own color.' : null,
  );
  const connected = $derived(pads.filter((p) => p.connected));

  function padLabel(id: string | undefined): string {
    if (!id) return 'Keyboard & mouse';
    const p = pads.find((x) => x.id === id);
    return p ? (p.connected ? p.label : `${p.label} (disconnected)`) : 'Controller (not connected)';
  }

  function join(deviceId: string) {
    if (remapping) return;
    if (seats.some((s) => s.controllerId === deviceId)) return;
    const pad = pads.find((p) => p.id === deviceId);
    if (pad?.needsRemap) {
      remapping = deviceId;
      return;
    }
    const seat = seats.find((s) => s.kind === 'human' && !s.controllerId);
    if (seat) seat.controllerId = deviceId;
  }

  let prevJoin: (id: string) => void;
  onMount(() => {
    prevJoin = input.onAnyButton;
    input.onAnyButton = (id) => {
      prevJoin(id);
      join(id);
    };
  });
  onDestroy(() => (input.onAnyButton = prevJoin));

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
        <select bind:value={seat.kind} aria-label="Seat {i + 1} kind" onchange={() => { if (seat.kind !== 'human') seat.controllerId = undefined; }}>
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
        {#if seat.kind === 'human'}
          <div class="pad">
            <span class:bound={!!seat.controllerId}>{padLabel(seat.controllerId)}</span>
            {#if seat.controllerId}<button class="link" onclick={() => (seat.controllerId = undefined)}>Unbind</button>{/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="opts">
    <button class="link" onclick={addSeat} disabled={seats.length >= 6}>+ Add seat</button>
    <label><input type="checkbox" bind:checked={randomOrder} /> Random turn order</label>
  </div>
  <div class="opts">
    <label>Rules
      <select bind:value={rulesId} aria-label="Rules preset">
        {#each rulesList as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <button class="link" onclick={() => (editingRules = true)}>Edit rules…</button>
  </div>

  <div class="controllers">
    <div class="ch">Controllers <span class="hint">Press any button on a controller to join the next human seat.</span></div>
    {#if !connected.length}
      <div class="none">No controllers detected yet. Press a button on a controller to wake it up.</div>
    {/if}
    {#each connected as p (p.id)}
      <div class="padrow">
        <span class="kind">{p.label}</span>
        <span class="pid">{p.id}</span>
        <span class="who">{seats.find((s) => s.controllerId === p.id)?.name ?? (p.needsRemap ? 'Needs setup' : 'Not joined')}</span>
        <button class="link" onclick={() => (remapping = p.id)}>Set up buttons</button>
      </div>
    {/each}
    <div class="help">
      Using a PS4 controller through DS4Windows? Turn on <b>Hide DS4 Controller</b> (or use HidHide) so it does not show up twice.
      If a controller does nothing, close Steam or turn off Steam Input for the browser.
    </div>
  </div>

  {#if problem}<div class="problem">{problem}</div>{/if}
  <ActionButton label="Start game" glyph="confirm" primary disabled={!!problem} onclick={() => onstart($state.snapshot(seats), randomOrder, rulesId)} />
</div>
{#if editingRules}
  <RulesEditor {presets} selectedId={rulesId} onselect={(id) => (rulesId = id)} onclose={() => (editingRules = false)} />
{/if}
{#if remapping}
  <RemapDialog {input} deviceId={remapping} onclose={() => (remapping = null)} />
{/if}

<style>
  .setup {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1000px;
    max-height: 1040px;
    overflow-y: auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 14px;
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
    gap: 6px 10px;
    align-items: center;
  }
  .pad {
    grid-column: 2 / -1;
    display: flex;
    gap: 12px;
    align-items: center;
    font: 600 15px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
    margin-top: -2px;
  }
  .pad .bound {
    color: var(--forest);
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
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--forest);
    cursor: pointer;
    padding: 4px 6px;
  }
  .controllers {
    border-top: 1px solid rgba(43, 33, 25, 0.15);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ch {
    font: 700 18px 'Source Sans 3', sans-serif;
  }
  .hint,
  .none,
  .help {
    font: 500 15px/1.4 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .padrow {
    display: grid;
    grid-template-columns: 260px 1fr 140px 140px;
    gap: 10px;
    align-items: center;
    font: 600 15px 'Source Sans 3', sans-serif;
  }
  .pid {
    color: var(--ink-2);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .problem {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
  }
</style>
