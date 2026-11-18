// Minimal Chrome DevTools Protocol driver for unattended UI checks (real-time rendering,
// unlike --virtual-time-budget screenshots). Usage:
//   node scripts/cdp.mjs <plan.json> [outDir]
// plan.json: { "url": "...", "width": 1920, "height": 1080, "steps": [
//   { "wait": 1500 }, { "eval": "js expression (awaited)" }, { "shot": "name" },
//   { "key": "Space" }, { "until": "js boolean expression", "timeout": 20000 } ] }
// Each eval result is printed as JSON.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

// Plans can be JSON, or .mjs modules whose default export is the plan (eval steps may then be
// functions, which are stringified and called in the page).
const planPath = resolve(process.argv[2]);
const plan = planPath.endsWith('.mjs') ? (await import(pathToFileURL(planPath).href)).default : JSON.parse(readFileSync(planPath, 'utf8'));
for (const st of plan.steps) {
  if (typeof st.eval === 'function') st.eval = `(${st.eval.toString()})()`;
  if (typeof st.until === 'function') st.until = `(${st.until.toString()})()`;
}
const outDir = resolve(process.argv[3] ?? '.snapshots');
mkdirSync(outDir, { recursive: true });
const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'pn-cdp-'));
const proc = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${plan.width ?? 1920},${plan.height ?? 1080}`,
  '--use-angle=d3d11',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 100 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    await sleep(100);
  }
}
if (!target) {
  console.error('could not reach chrome');
  proc.kill();
  process.exit(2);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const consoleLines = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleLines.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => (${expr}))()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description ?? 'error' };
  return r.result?.result?.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: plan.width ?? 1920, height: plan.height ?? 1080, deviceScaleFactor: plan.dpr ?? 1, mobile: false });
await send('Page.navigate', { url: plan.url });
await sleep(plan.loadWait ?? 3000);

let failed = false;
for (const step of plan.steps) {
  if (step.wait) await sleep(step.wait);
  if (step.cdp) {
    // Raw protocol command, e.g. { cdp: 'Network.emulateNetworkConditions', params: {...} }.
    const r = await send(step.cdp, step.params ?? {});
    console.log(`cdp ${step.cdp}: ${r.error ? `error ${r.error.message}` : 'ok'}`);
    if (r.error) failed = true;
  }
  if (step.eval) {
    const v = await evaluate(step.eval);
    console.log(`eval ${step.label ?? ''}: ${JSON.stringify(v)}`);
    if (v && v.error) failed = true;
  }
  if (step.until) {
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < (step.timeout ?? 20000)) {
      if (await evaluate(step.until)) {
        ok = true;
        break;
      }
      await sleep(100);
    }
    console.log(`until ${step.label ?? step.until}: ${ok ? 'ok' : 'TIMEOUT'} (${Date.now() - t0} ms)`);
    if (!ok) failed = true;
  }
  if (step.key) {
    const codes = { Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], KeyP: ['p', 80], KeyB: ['b', 66], KeyV: ['v', 86], KeyN: ['n', 78], Tab: ['Tab', 9] };
    const [key, kc] = codes[step.key] ?? [step.key, 0];
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: step.key, windowsVirtualKeyCode: kc });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: step.key, windowsVirtualKeyCode: kc });
  }
  if (step.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `${step.shot}.png`), Buffer.from(r.result.data, 'base64'));
    console.log(`shot ${step.shot}`);
  }
}
if (consoleLines.length) console.log(`console:\n  ${consoleLines.slice(-30).join('\n  ')}`);
ws.close();
proc.kill();
process.exit(failed ? 1 : 0);
