<script lang="ts">
  // Performance overlay (Batch 4, SPEC-benchmark §5): a small paper chip under the pause-menu
  // button. Updates 4× a second from samples the renderer already records; it never requests a
  // frame, and shows "idle" when render-on-demand has nothing to draw.
  import { onMount } from 'svelte';
  import type { Renderer } from '../../render/renderer';
  import { computeStats } from '../../perf/stats';
  import { displayPhysical } from '../../render/resolution';

  let { renderer, mode, info }: { renderer: Renderer; mode: 'fps' | 'detailed'; info: () => string } = $props();

  let idle = $state(true);
  let fps = $state(0);
  let low = $state(0);
  let interval = $state(0);
  let cpu = $state(0);
  let gpu = $state<number | null>(null);
  let calls = $state(0);
  let tris = $state(0);
  let buffer = $state('');
  let gpuAvailable = $state(false);
  let infoText = $state('');
  // Idle rendering debug (Part B): ACTIVE / IDLE, render fps, frames in the last 10 s.
  let renderLine = $state('');

  function update() {
    const now = performance.now();
    idle = !renderer.lastFrameAt || now - renderer.lastFrameAt > 500;
    const b = renderer.drawingBufferSize;
    const d = displayPhysical(screen, window.devicePixelRatio || 1);
    // Debug check for the render resolution: the actual drawing buffer vs the display's pixels.
    buffer = `Buffer ${b.width} × ${b.height} · Display ${d.w} × ${d.h}`;
    infoText = info();
    renderLine = `Render: ${renderer.renderState} · ${renderer.fps} fps · ${renderer.framesInLast(10_000)} frames / 10 s${renderer.alwaysRender ? ' · always' : ''}`;
    if (idle) return;
    const samples = renderer.recent(1000);
    if (!samples.length) return;
    const s = computeStats(samples, 60);
    fps = Math.round(s.avgFps);
    low = s.low1Fps;
    interval = s.avgInterval;
    cpu = s.avgCpu;
    gpu = s.avgGpu;
    calls = s.maxCalls;
    tris = s.maxTriangles;
  }

  onMount(() => {
    gpuAvailable = renderer.gpuTimerAvailable;
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  });

  const n0 = (x: number) => Math.round(x).toString();
  const n1 = (x: number) => x.toFixed(1);
</script>

<div class="perf" class:detailed={mode === 'detailed'} aria-label="Performance">
  {#if idle}
    <div class="row"><b>idle</b></div>
  {:else}
    <div class="row"><b>{fps}</b> fps <span class="dim">· 1% low {n0(low)}</span></div>
  {/if}
  {#if mode === 'detailed'}
    {#if !idle}
      <div class="row">frame {n1(interval)} ms · CPU {n1(cpu)} ms · GPU {gpu === null ? (gpuAvailable ? '…' : 'n/a') : `${n1(gpu)} ms`}</div>
      <div class="row">{calls} draw calls · {(tris / 1000).toFixed(0)}k triangles</div>
    {/if}
    <div class="row" data-testid="render-line">{renderLine}</div>
    <div class="row dim">{buffer} · {infoText}</div>
  {/if}
</div>

<style>
  .perf {
    position: absolute;
    left: 50%;
    top: 74px;
    transform: translateX(-50%);
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(251, 246, 234, 0.78);
    box-shadow: var(--panel-shadow);
    color: var(--ink);
    font: 600 15px/1.35 'Source Sans 3', sans-serif;
    font-variant-numeric: tabular-nums;
    text-align: center;
    white-space: nowrap;
    pointer-events: none;
  }
  .row b {
    font-weight: 800;
    font-size: 17px;
  }
  .dim {
    color: var(--ink-2);
  }
</style>
