<script lang="ts">
  // Benchmark (Batch 4, SPEC-benchmark §3): mode picker → progress strip → results screen.
  // Uses the existing panel style and the stats panel's type sizes (readable from the couch).
  import { onMount } from 'svelte';
  import type { PerfApi } from '../../bench/perfApi';
  import { copyText } from '../../bench/perfApi';
  import { estimatedSeconds, type BenchProgress } from '../../bench/benchmark';
  import { configLabel, findPrevious, formatCopy, mainRun, toExportJSON, worstPhase, type BenchMode, type BenchSummary, type PhaseResult } from '../../perf/summary';
  import { BOTTLENECK_LABEL } from '../../perf/verdict';
  import { downloadText } from '../../app/presets';
  import ActionButton from './ActionButton.svelte';

  let { perf, onclose, onrunning }: { perf: PerfApi; onclose: () => void; onrunning: (on: boolean) => void } = $props();

  let stage = $state<'pick' | 'running' | 'results'>('pick');
  let progress = $state<BenchProgress | null>(null);
  let result = $state.raw<BenchSummary | null>(null);
  let previous = $state.raw<BenchSummary | null>(null);
  let history = $state.raw<BenchSummary[]>([]);
  let message = $state<string | null>(null);
  let abort: AbortController | null = null;

  onMount(() => {
    void perf.history.list().then((h) => (history = h));
  });

  const MODES: { mode: BenchMode; label: string }[] = [
    { mode: 'quick', label: 'Quick' },
    { mode: 'standard', label: 'Standard' },
    { mode: 'compare', label: 'Compare settings' },
  ];
  const dur = (mode: BenchMode) => {
    const s = estimatedSeconds(mode) + (mode === 'quick' ? 8 : 0);
    return s >= 90 ? `≈ ${Math.round(s / 60)} min` : `≈ ${Math.round(s / 10) * 10} s`;
  };
  const lastFor = (mode: BenchMode) => history.find((h) => h.mode === mode) ?? null;

  async function run(mode: BenchMode) {
    message = null;
    stage = 'running';
    progress = { phase: 'Setting up', fraction: 0, run: 1, runs: 1 };
    onrunning(true);
    abort = new AbortController();
    let s: BenchSummary | null = null;
    try {
      s = await perf.run(mode, (p) => (progress = p), abort.signal);
    } catch (e) {
      message = `The benchmark stopped: ${(e as Error).message}`;
    } finally {
      abort = null;
      onrunning(false);
    }
    if (!s) {
      // Cancelled (or failed): no results saved, back where the benchmark was opened from.
      if (message) stage = 'pick';
      else onclose();
      return;
    }
    previous = findPrevious(history, s);
    history = await perf.history.add(s);
    result = s;
    stage = 'results';
  }

  /** Back / Escape: cancel a run, otherwise close. */
  export function back() {
    if (stage === 'running') abort?.abort();
    else onclose();
  }

  async function copy() {
    message = (await copyText(formatCopy(result!))) ? 'Results copied.' : "Couldn't reach the clipboard; use Export JSON instead.";
  }
  function exportJSON() {
    downloadText(`property-night-benchmark-${result!.date.slice(0, 10)}.json`, toExportJSON(result!));
  }
  async function clearHistory() {
    await perf.history.clear();
    history = [];
    previous = null;
    message = 'History cleared.';
  }

  const TONE: Record<string, string> = { aces: 'Filmic (ACES)', agx: 'AgX', neutral: 'Neutral' };
  const f0 = (n: number) => Math.round(n).toString();
  const f1 = (n: number | null) => (n === null ? 'n/a' : n.toFixed(1));
  const main = $derived(result ? mainRun(result) : null);
  const worst = $derived(main ? worstPhase(main) : null);
  const prevWorst = $derived(previous ? worstPhase(mainRun(previous)) : null);
  const tag = (p: PhaseResult, which: 'display' | 'at60') => (which === 'display' ? p.target.display : p.target.at60);
</script>

{#if stage === 'running'}
  <div class="panel strip benchp">
    <div class="sline">
      <b>{progress?.phase}</b>
      {#if progress && progress.runs > 1}<span>Run {progress.run} of {progress.runs}</span>{/if}
      <span class="cancel">Press Back to cancel</span>
    </div>
    <div class="bar"><i style="width:{Math.round((progress?.fraction ?? 0) * 100)}%"></i></div>
  </div>
{:else}
  <div class="dim"></div>
  <div class="panel benchp" class:wide={stage === 'results'}>
    <div class="eyebrow">Performance</div>
    {#if stage === 'pick'}
      <div class="title">Benchmark</div>
      <div class="lead">A fixed, repeatable run on a fully built board. It uses your current graphics settings and doesn't touch saved games.</div>
      <div class="col">
        {#each MODES as m (m.mode)}
          <ActionButton label={m.label} hint={dur(m.mode)} primary={m.mode === 'standard'} glyph={m.mode === 'standard' ? 'confirm' : undefined} onclick={() => run(m.mode)} />
          {#if lastFor(m.mode)}<div class="last">Last run: {lastFor(m.mode)!.verdict}</div>{/if}
        {/each}
        <ActionButton label="Cancel" glyph="back" onclick={onclose} />
      </div>
      {#if history.length}<button class="link" onclick={clearHistory}>Clear history</button>{/if}
    {:else if result && main}
      <div class="verdict">{result.verdict}</div>
      {#if previous && prevWorst && worst}
        <div class="prev">Last run: 1% low {f0(prevWorst.stats.low1Fps)} → now {f0(worst.stats.low1Fps)} (worst phase)</div>
      {/if}

      <div class="system">
        <div><span>Graphics card</span>{result.system.gpu}</div>
        <div><span>Rendered</span>{result.system.bufferW} × {result.system.bufferH} (CSS {result.system.cssW} × {result.system.cssH} × DPR {result.system.dpr.toFixed(1)})</div>
        <div><span>Display</span>{result.system.hz} Hz (measured {result.system.hzRaw.toFixed(1)})</div>
        <div><span>Settings</span>{result.player.quality === 'high' ? 'High' : 'Low'} · AO {result.player.ao ? 'on' : 'off'} · tone mapping {TONE[result.player.toneMapping] ?? result.player.toneMapping}</div>
        <div><span>CPU threads</span>{result.system.threads}</div>
        <div><span>GPU timer</span>{result.system.gpuTimer ? 'yes' : 'not available in this browser (GPU time not shown)'}</div>
        <div><span>Date</span>{new Date(result.date).toLocaleString()}</div>
      </div>

      {#if result.runs.length > 1}
        <table>
          <thead>
            <tr><th class="who">1% low fps</th>{#each result.runs as r}<th>{configLabel(r.config)}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each result.runs[0].phases as p, i (p.id)}
              <tr>
                <td class="who">{p.name}</td>
                {#each result.runs as r}
                  {@const q = r.phases[i]}
                  <td>{f0(q.stats.low1Fps)} <span class="tag" class:ok={q.target.display}>{result.system.hz}</span>{#if result.system.hz !== 60}<span class="tag" class:ok={q.target.at60 !== false}>60</span>{/if}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if result.pick}<div class="pick">Use {result.pick}</div>{/if}
      {/if}

      {#if result.runs.length > 1}<div class="sub">{configLabel(main.config)}</div>{/if}
      <table>
        <thead>
          <tr>
            <th class="who">Phase</th><th>Avg fps</th><th>1% low</th><th>p99 ms</th><th>GPU ms</th><th>CPU ms</th><th>Draw calls</th><th>Limit</th>
          </tr>
        </thead>
        <tbody>
          {#each main.phases as p (p.id)}
            <tr class:worst={worst?.id === p.id}>
              <td class="who">{p.name}</td>
              <td>{f0(p.stats.avgFps)}</td>
              <td>{f0(p.stats.low1Fps)} <span class="tag" class:ok={tag(p, 'display')}>{result.system.hz}</span>{#if result.system.hz !== 60}<span class="tag" class:ok={tag(p, 'at60') !== false}>60</span>{/if}</td>
              <td>{f1(p.stats.p99Interval)}</td>
              <td>{f1(p.stats.avgGpu)}</td>
              <td>{f1(p.stats.avgCpu)}</td>
              <td>{p.stats.maxCalls}</td>
              <td>{p.target.label === 'smooth60' ? `Smooth at 60, not at ${result.system.hz}` : BOTTLENECK_LABEL[p.cls.kind]}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if result.headroomLine}<div class="best">{result.headroomLine}</div>{/if}

      <div class="sub">Suggestions</div>
      <ul>
        {#each result.recommendations as r (r.id)}<li>{r.text}</li>{/each}
      </ul>

      <div class="btns">
        <ActionButton label="Run again" glyph="confirm" primary onclick={() => run(result!.mode)} />
        <ActionButton label="Copy results" onclick={copy} />
        <ActionButton label="Export JSON" onclick={exportJSON} />
        <ActionButton label="Back" glyph="back" onclick={onclose} />
      </div>
      <button class="link" onclick={clearHistory}>Clear history</button>
    {/if}
    {#if message}<div class="msg">{message}</div>{/if}
  </div>
{/if}

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.55);
  }
  .benchp:not(.strip) {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 640px;
    max-height: 1040px;
    overflow-y: auto;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .benchp.wide {
    width: 1240px;
  }
  .strip {
    left: 50%;
    bottom: 32px;
    transform: translateX(-50%);
    width: 760px;
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(251, 246, 234, 0.88);
  }
  .sline {
    display: flex;
    gap: 16px;
    align-items: baseline;
    font: 600 18px 'Source Sans 3', sans-serif;
  }
  .sline b {
    font: 800 22px 'Fraunces', serif;
  }
  .cancel {
    margin-left: auto;
    color: var(--ink-2);
  }
  .bar {
    height: 10px;
    border-radius: 5px;
    background: rgba(43, 33, 25, 0.15);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--forest);
    transition: width 0.25s linear;
  }
  .eyebrow {
    font: 700 14px/1 'Source Sans 3', sans-serif;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--oxblood);
  }
  .title {
    font: 800 40px/1 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .verdict {
    font: 800 34px/1.15 'Fraunces', serif;
    font-variation-settings: 'opsz' 96;
  }
  .lead,
  .best,
  .prev,
  .pick,
  li {
    font: 500 18px/1.4 'Source Sans 3', sans-serif;
  }
  .prev {
    color: var(--ink-2);
  }
  .pick {
    font-weight: 700;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .last {
    font: 500 16px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
    padding: 0 10px 4px;
  }
  .system {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.55);
    font: 600 16px/1.35 'Source Sans 3', sans-serif;
  }
  .system span {
    display: inline-block;
    min-width: 128px;
    font: 700 13px 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .sub {
    font: 700 18px 'Source Sans 3', sans-serif;
    margin-top: 4px;
  }
  table {
    border-collapse: collapse;
    font: 600 18px 'Source Sans 3', sans-serif;
    font-variant-numeric: tabular-nums;
  }
  th {
    font: 700 13px 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--ink-2);
    text-align: right;
    padding: 6px 10px;
    border-bottom: 1.5px solid rgba(43, 33, 25, 0.2);
  }
  td {
    text-align: right;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(43, 33, 25, 0.1);
    white-space: nowrap;
  }
  .who {
    text-align: left;
  }
  tr.worst td {
    background: rgba(195, 148, 69, 0.18);
  }
  .tag {
    display: inline-block;
    margin-left: 4px;
    font: 700 11px/1 'Source Sans 3', sans-serif;
    letter-spacing: 1px;
    padding: 3px 5px;
    border-radius: 4px;
    background: var(--oxblood);
    color: var(--paper-hi);
    vertical-align: 2px;
  }
  .tag.ok {
    background: var(--forest);
  }
  ul {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .btns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 6px;
  }
  .link {
    align-self: flex-start;
    border: 0;
    background: none;
    padding: 0;
    font: 700 16px 'Source Sans 3', sans-serif;
    color: var(--oxblood);
    cursor: pointer;
  }
  .msg {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
</style>
