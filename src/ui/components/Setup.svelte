<script lang="ts">
  // Lobby (SPEC §3, §4, §9): seats (Human / Bot / Bank-backed bot), token, color, controller
  // ("press any button to join" binds a pad to the next human seat), rules and board presets,
  // and turn order (random, or as listed with ▲/▼ reordering).
  import { onDestroy, onMount } from 'svelte';
  import type { SeatConfig } from '../../engine';
  import { TOKEN_IDS } from '../../render/tokens/tokens';
  import type { InputManager, PadInfo } from '../../input/manager';
  import { PLAYER_COLORS, TOKEN_NAMES } from '../theme';
  import ActionButton from './ActionButton.svelte';
  import RemapDialog from './RemapDialog.svelte';
  import { layer } from '../menuStack';
  import RulesEditor from './RulesEditor.svelte';
  import BoardEditor from './BoardEditor.svelte';
  import type { RulesPreset, RulesPresets } from '../../app/presets';
  import type { BoardPreset, BoardPresets } from '../../app/boardPresets';
  import { KIND_HINT, bankBotHint, defaultName, lobbyProblem, moveSeat, ordinal, renameForKind } from '../lobby';

  let {
    onstart,
    input,
    pads,
    presets,
    boards,
  }: {
    onstart: (seats: SeatConfig[], randomOrder: boolean, rulesId: string, boardId: string) => void;
    input: InputManager;
    pads: PadInfo[];
    presets: RulesPresets;
    boards: BoardPresets;
  } = $props();

  let boardId = $state('classic-board');
  let boardList = $state<BoardPreset[]>([]);
  let editingBoard = $state(false);
  $effect(() => {
    void editingBoard;
    void (async () => {
      boardList = await boards.list();
      if (!boardList.some((p) => p.id === boardId)) boardId = 'classic-board';
    })();
  });

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
  /** Bank-backed bot hint follows the chosen preset's "bankBotMode" rule. */
  const bankMode = $derived(rulesList.find((p) => p.id === rulesId)?.rules.bankBotMode ?? 'remove');

  let seats = $state<SeatConfig[]>([
    { kind: 'human', name: 'Player 1', token: 'teacup', color: PLAYER_COLORS[0] },
    { kind: 'human', name: 'Player 2', token: 'key', color: PLAYER_COLORS[1] },
  ]);
  let randomOrder = $state(true);
  let remapping = $state<string | null>(null);

  const problem = $derived(lobbyProblem(seats));
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
    seats.push({ kind: 'bot', name: defaultName('bot', seats.length + 1), token, color });
  }
  function removeSeat(i: number) {
    if (seats.length > 2) seats.splice(i, 1);
  }
  function setKind(i: number) {
    const seat = seats[i];
    if (seat.kind !== 'human') seat.controllerId = undefined;
    seat.name = renameForKind(seat.name, seat.kind, i + 1);
  }
  function move(i: number, dir: -1 | 1) {
    seats = moveSeat(seats, i, dir);
  }
</script>

<div class="panel setup">
  <div class="eyebrow">New game</div>
  <h1>Property Night</h1>
  <div class="rows">
    {#each seats as seat, i}
      <div class="row" class:ordered={!randomOrder}>
        {#if !randomOrder}
          <div class="order">
            <span class="ord">{ordinal(i + 1)}</span>
            <button class="mv" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move {seat.name} earlier">▲</button>
            <button class="mv" onclick={() => move(i, 1)} disabled={i === seats.length - 1} aria-label="Move {seat.name} later">▼</button>
          </div>
        {/if}
        <span class="swatch" style="background:{seat.color}"></span>
        <input bind:value={seat.name} maxlength="16" aria-label="Seat {i + 1} name" />
        <select bind:value={seat.kind} aria-label="Seat {i + 1} kind" onchange={() => setKind(i)}>
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
        {#if seat.kind !== 'human'}
          <div class="sub hint-line"><span class="badge {seat.kind}">{seat.kind === 'bot' ? 'BOT' : 'BANK'}</span>{seat.kind === 'bankBot' ? bankBotHint(bankMode) : KIND_HINT[seat.kind]}</div>
        {:else}
          <div class="sub pad">
            <span class:bound={!!seat.controllerId}>{padLabel(seat.controllerId)}</span>
            {#if seat.controllerId}<button class="link" onclick={() => (seat.controllerId = undefined)}>Unbind</button>{/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  <div class="opts">
    <button class="link" onclick={addSeat} disabled={seats.length >= 6}>+ Add seat</button>
    <div class="turnorder" role="group" aria-label="Turn order">
      <span>Turn order</span>
      <button class="seg" class:on={randomOrder} aria-pressed={randomOrder} onclick={() => (randomOrder = true)}>Random</button>
      <button class="seg" class:on={!randomOrder} aria-pressed={!randomOrder} onclick={() => (randomOrder = false)}>As listed</button>
    </div>
  </div>
  <div class="opts">
    <label>Rules
      <select bind:value={rulesId} aria-label="Rules preset">
        {#each rulesList as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <button class="link" onclick={() => (editingRules = true)}>Edit rules…</button>
    <label>Board
      <select bind:value={boardId} aria-label="Board preset">
        {#each boardList as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <button class="link" onclick={() => (editingBoard = true)}>Edit board & cards…</button>
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
  <ActionButton label="Start game" glyph="confirm" primary disabled={!!problem} onclick={() => onstart($state.snapshot(seats), randomOrder, rulesId, boardId)} />
</div>
{#if editingBoard}
  <div class="layer" use:layer={{ kind: 'menu', close: () => (editingBoard = false) }}>
    <BoardEditor presets={boards} selectedId={boardId} onselect={(id) => (boardId = id)} onclose={() => (editingBoard = false)} />
  </div>
{/if}
{#if editingRules}
  <div class="layer" use:layer={{ kind: 'menu', close: () => (editingRules = false) }}>
    <RulesEditor {presets} selectedId={rulesId} onselect={(id) => (rulesId = id)} onclose={() => (editingRules = false)} />
  </div>
{/if}
{#if remapping}
  <!-- RemapDialog ends input capture in onDestroy, so closing the layer is enough. -->
  <div class="layer" use:layer={{ kind: 'dialog', close: () => (remapping = null) }}>
    <RemapDialog {input} deviceId={remapping} onclose={() => (remapping = null)} />
  </div>
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
    grid-template-columns: [sw] 28px [name] 1fr 190px 150px 120px 44px;
    gap: 6px 10px;
    align-items: center;
  }
  .row.ordered {
    grid-template-columns: [order] 112px [sw] 28px [name] 1fr 190px 150px 120px 44px;
  }
  .order {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ord {
    width: 40px;
    font: 700 17px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .mv {
    width: 32px;
    height: 36px;
    border: 0;
    border-radius: 6px;
    background: var(--paper);
    font: 700 13px 'Source Sans 3', sans-serif;
    cursor: pointer;
  }
  .mv:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .sub {
    grid-column: name / -1;
  }
  .hint-line {
    display: flex;
    gap: 10px;
    align-items: center;
    font: 500 15px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
    margin-top: -2px;
  }
  .badge {
    font: 700 12px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    padding: 4px 7px;
    border-radius: 5px;
    color: var(--paper-hi);
    background: var(--ink-2);
    flex: none;
  }
  .badge.bankBot {
    background: var(--brass);
  }
  .turnorder {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .turnorder > span {
    margin-right: 6px;
  }
  .seg {
    height: 38px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--ink);
    cursor: pointer;
  }
  .seg.on {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--ink); /* selected: outline, never a fill (focus is the fill) */
    color: var(--ink);
    font-weight: 800;
    border-color: var(--ink);
  }
  .pad {
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
