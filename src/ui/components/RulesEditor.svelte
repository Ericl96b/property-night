<script lang="ts">
  // Rules editor (SPEC §5, §8): every setting, grouped by area; Classic is read-only (duplicate
  // to edit); save, rename, duplicate, delete, export/import JSON. Edits autosave.
  import { onMount } from 'svelte';
  import { downloadText, type RulesPreset, type RulesPresets } from '../../app/presets';
  import { RULE_AREAS, RULE_FIELDS, coerce, type RuleField } from '../../app/rulesSchema';
  import ActionButton from './ActionButton.svelte';

  let {
    presets,
    selectedId,
    onselect,
    onclose,
    seatKinds = [],
  }: { presets: RulesPresets; selectedId: string; onselect: (id: string) => void; onclose: () => void; seatKinds?: readonly string[] } = $props();
  const lockOf = (f: RuleField) => f.locked?.({ seatKinds }) ?? null;

  let list = $state<RulesPreset[]>([]);
  let current = $state<RulesPreset | null>(null);
  let message = $state<string | null>(null);
  let renaming = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let fileInput: HTMLInputElement;

  async function refresh(selectId?: string) {
    list = await presets.list();
    const id = selectId ?? current?.id ?? selectedId;
    current = $state.snapshot(list.find((p) => p.id === id) ?? list[0]) as RulesPreset;
  }
  onMount(() => void refresh(selectedId));

  function pick(p: RulesPreset) {
    current = $state.snapshot(p) as RulesPreset;
    renaming = false;
    message = null;
  }

  function setField(f: RuleField, raw: unknown) {
    if (!current || current.builtIn) return;
    (current.rules as unknown as Record<string, unknown>)[f.key] = coerce(f, raw);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!current) return;
      await presets.save($state.snapshot(current) as RulesPreset);
      message = 'Saved';
      list = await presets.list();
    }, 250);
  }

  async function duplicate() {
    if (!current) return;
    const p = await presets.duplicate($state.snapshot(current) as RulesPreset);
    await refresh(p.id);
    message = `Created “${p.name}”`;
  }
  async function remove() {
    if (!current || current.builtIn) return;
    await presets.remove(current);
    if (selectedId === current.id) onselect('classic');
    current = null;
    await refresh('classic');
  }
  async function rename(name: string) {
    if (!current || current.builtIn) return;
    await presets.rename($state.snapshot(current) as RulesPreset, name);
    renaming = false;
    await refresh(current.id);
  }
  async function importFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const p = await presets.importJSON(await file.text());
      await refresh(p.id);
      message = `Imported “${p.name}”`;
    } catch (err) {
      message = (err as Error).message;
    }
    (e.currentTarget as HTMLInputElement).value = '';
  }

  const fieldsByArea = $derived(
    RULE_AREAS.map((area) => ({ area, fields: RULE_FIELDS.filter((f) => f.area === area && (!f.showIf || (current && f.showIf(current.rules)))) })),
  );
  const val = (f: RuleField) => (current ? (current.rules as unknown as Record<string, unknown>)[f.key] : undefined);
</script>

<div class="dim"></div>
<div class="panel rules">
  <div class="side">
    <div class="eyebrow">Rules presets</div>
    {#each list as p (p.id)}
      <button class="preset" class:sel={current?.id === p.id} onclick={() => pick(p)}>
        {p.name}{#if p.builtIn}<span class="ro">built-in</span>{/if}{#if p.id === selectedId}<span class="use">in use</span>{/if}
      </button>
    {/each}
    <div class="sideacts">
      <button class="link" onclick={duplicate}>Duplicate</button>
      <button class="link" onclick={() => fileInput.click()}>Import…</button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importFile} />
    </div>
  </div>
  {#if current}
    <div class="main">
      <div class="head">
        {#if renaming && !current.builtIn}
          <input class="name" value={current.name} onchange={(e) => rename((e.currentTarget as HTMLInputElement).value)} />
        {:else}
          <h2>{current.name}</h2>
        {/if}
        <div class="acts">
          {#if !current.builtIn}
            <button class="link" onclick={() => (renaming = !renaming)}>Rename</button>
            <button class="link" onclick={remove}>Delete</button>
          {/if}
          <button class="link" onclick={() => downloadText(`${current!.name.replace(/[^\w-]+/g, '-')}.rules.json`, presets.exportJSON(current!))}>Export</button>
        </div>
      </div>
      {#if current.builtIn}<div class="note">The official rules. Read-only — duplicate it to make your own.</div>{/if}
      {#if message}<div class="note ok">{message}</div>{/if}
      <div class="fields">
        {#each fieldsByArea as g (g.area)}
          {#if g.fields.length}
            <div class="area">{g.area}</div>
            {#each g.fields as f (f.key)}
              <label class="field">
                <span class="lbl">{f.label}{#if f.help}<span class="help">{f.help}</span>{/if}{#if lockOf(f)}<span class="help locked">{lockOf(f)}</span>{/if}</span>
                {#if f.kind === 'toggle' && lockOf(f)}
                  <input type="checkbox" checked={false} disabled aria-label="{f.label}: {lockOf(f)}" />
                {:else if f.kind === 'toggle'}
                  <input type="checkbox" checked={!!val(f)} disabled={current.builtIn} onchange={(e) => setField(f, (e.currentTarget as HTMLInputElement).checked)} />
                {:else if f.kind === 'select'}
                  <select value={String(val(f))} disabled={current.builtIn} onchange={(e) => setField(f, (e.currentTarget as HTMLSelectElement).value)}>
                    {#each f.options ?? [] as o}<option value={String(o.value)}>{o.label}</option>{/each}
                  </select>
                {:else}
                  <span class="num">
                    {#if f.kind === 'money'}<span class="unit">$</span>{/if}
                    <input type="number" min={f.min} max={f.max} step={f.step ?? 1} value={val(f) === 'unlimited' ? '' : String(val(f))} disabled={current.builtIn}
                      placeholder={f.key === 'houseSupply' || f.key === 'hotelSupply' ? 'unlimited' : ''}
                      onchange={(e) => setField(f, (e.currentTarget as HTMLInputElement).value)} />
                    {#if f.kind === 'percent'}<span class="unit">%</span>{/if}
                  </span>
                {/if}
              </label>
            {/each}
          {/if}
        {/each}
      </div>
      <div class="foot">
        <ActionButton label="Use these rules" glyph="confirm" primary onclick={() => { onselect(current!.id); onclose(); }} />
        <ActionButton label="Close" glyph="back" onclick={onclose} />
      </div>
    </div>
  {/if}
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.6);
  }
  .rules {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 1500px;
    height: 1000px;
    padding: 26px;
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 26px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    border-right: 1px solid rgba(43, 33, 25, 0.15);
    padding-right: 18px;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
    margin-bottom: 8px;
  }
  .preset {
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: var(--paper);
    font: 700 18px 'Fraunces', serif;
    text-align: left;
    cursor: pointer;
  }
  .preset.sel {
    background: #fff;
    box-shadow: inset 0 0 0 3px var(--forest);
  }
  .ro,
  .use {
    font: 700 11px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--ink-2);
    color: var(--paper-hi);
  }
  .use {
    background: var(--forest);
    margin-left: auto;
  }
  .sideacts {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font: 800 34px/1.1 'Fraunces', serif;
  }
  .name {
    height: 48px;
    font: 800 26px 'Fraunces', serif;
    padding: 0 10px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
  }
  .acts {
    display: flex;
    gap: 6px;
  }
  .link {
    border: 0;
    background: none;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--forest);
    cursor: pointer;
    padding: 6px 8px;
  }
  .note {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .note.ok {
    color: var(--forest);
  }
  .fields {
    flex: 1;
    overflow-y: auto;
    padding-right: 10px;
  }
  .area {
    font: 700 15px/1 'Source Sans 3', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--ink-2);
    margin: 18px 0 6px;
  }
  .field {
    display: grid;
    grid-template-columns: 1fr 300px;
    align-items: center;
    gap: 16px;
    min-height: 50px;
    padding: 4px 10px;
    border-radius: 8px;
  }
  .field:nth-child(even) {
    background: rgba(243, 234, 214, 0.6);
  }
  .lbl {
    font: 600 18px/1.25 'Source Sans 3', sans-serif;
  }
  .help {
    display: block;
    font: 500 14px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  select,
  input[type='number'] {
    height: 42px;
    font: 600 17px 'Source Sans 3', sans-serif;
    padding: 0 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(43, 33, 25, 0.3);
    background: #fff;
    width: 100%;
  }
  .num {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .unit {
    font: 700 17px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  input[type='checkbox'] {
    width: 26px;
    height: 26px;
    accent-color: var(--forest);
    justify-self: start;
  }
  .foot {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
  }
  .help.locked {
    color: var(--oxblood);
    font-weight: 600;
  }
</style>
