<script lang="ts">
  // "Press each button" remap for pads without a known mapping (SPEC §4). Stored per device id.
  import { onDestroy, onMount } from 'svelte';
  import { LOGICAL_ORDER, type InputManager, type Logical, type Mapping } from '../../input/manager';
  import ActionButton from './ActionButton.svelte';

  let { input, deviceId, onclose }: { input: InputManager; deviceId: string; onclose: () => void } = $props();

  const LABEL: Record<Logical, string> = {
    confirm: 'Confirm — bottom face button',
    back: 'Back — right face button',
    manage: 'Manage — left face button',
    trade: 'Trade — top face button',
    l1: 'Left shoulder (L1 / L)',
    r1: 'Right shoulder (R1 / R)',
    select: 'Select / Share / −',
    start: 'Start / Options / +',
    up: 'D-pad up',
    down: 'D-pad down',
    left: 'D-pad left',
    right: 'D-pad right',
  };

  let step = $state(0);
  const mapping: Mapping = {};

  onMount(() => {
    input.capture = (id, src) => {
      if (id !== deviceId) return;
      mapping[LOGICAL_ORDER[step]] = src;
      step += 1;
      if (step >= LOGICAL_ORDER.length) {
        input.endCapture();
        input.setRemap(deviceId, mapping);
        onclose();
      }
    };
  });
  onDestroy(() => input.endCapture());

  function skip() {
    step += 1;
    if (step >= LOGICAL_ORDER.length) {
      input.endCapture();
      input.setRemap(deviceId, mapping);
      onclose();
    }
  }
</script>

<div class="dim"></div>
<div class="panel remap">
  <div class="eyebrow">Set up controller</div>
  <div class="id">{deviceId}</div>
  <div class="prompt">Press: <b>{LABEL[LOGICAL_ORDER[Math.min(step, LOGICAL_ORDER.length - 1)]]}</b></div>
  <div class="progress">{step + 1} of {LOGICAL_ORDER.length}</div>
  <div class="row">
    <ActionButton label="Skip this one" onclick={skip} />
    <ActionButton label="Cancel" glyph="back" onclick={() => { input.endCapture(); onclose(); }} />
  </div>
</div>

<style>
  .dim {
    position: absolute;
    inset: 0;
    background: rgba(10, 5, 2, 0.6);
  }
  .remap {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 720px;
    padding: 30px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .eyebrow {
    font: 800 32px/1 'Fraunces', serif;
  }
  .id {
    font: 500 14px/1.3 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .prompt {
    font: 600 24px/1.3 'Source Sans 3', sans-serif;
  }
  .progress {
    font: 600 16px 'Source Sans 3', sans-serif;
    color: var(--ink-2);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
</style>
