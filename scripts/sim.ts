// Headless acceptance run (SPEC §15): N bot-vs-bot games under Classic rules, invariants
// checked after every action. Usage: npm run sim -- [games=10000] [maxTurns=5000]
import { writeFileSync, mkdirSync } from 'node:fs';
import { botSeats, runHeadless } from '../src/bots/headless';

const games = Number(process.argv[2] ?? 10_000);
const maxTurns = Number(process.argv[3] ?? 5000);
const t0 = performance.now();
let finished = 0;
let errored = 0;
let turns = 0;
let actions = 0;
const turnHist: number[] = [];
const bySeats = new Map<number, { n: number; fin: number }>();
const firstErrors: string[] = [];

for (let g = 1; g <= games; g++) {
  const n = 2 + (g % 5);
  const r = runHeadless({ seats: botSeats(n), seed: g * 2654435761 >>> 0 }, { maxTurns, checkEveryAction: true });
  const b = bySeats.get(n) ?? { n: 0, fin: 0 };
  b.n++;
  if (r.finished) {
    finished++;
    b.fin++;
    turnHist.push(r.turns);
  }
  bySeats.set(n, b);
  if (r.errors.length) {
    errored++;
    if (firstErrors.length < 10) firstErrors.push(`game ${g} (${n} seats): ${r.errors.join(' | ')}`);
  }
  turns += r.turns;
  actions += r.actions;
  if (g % 1000 === 0) console.log(`${g}/${games} games · ${finished} finished · ${errored} with errors · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

turnHist.sort((a, b) => a - b);
const pct = (p: number) => turnHist[Math.min(turnHist.length - 1, Math.floor((p / 100) * turnHist.length))] ?? 0;
const secs = (performance.now() - t0) / 1000;
const report = [
  `# Headless acceptance run`,
  ``,
  `- Games: **${games}** (2–6 medium bots, Classic rules), invariants checked after **every** action (${actions.toLocaleString('en-US')} actions)`,
  `- Games with an illegal state or illegal action: **${errored}**`,
  `- Finished (one player left) within ${maxTurns} turns: **${finished}** (${((finished / games) * 100).toFixed(2)}%)`,
  `- Turns to finish: median ${pct(50)}, 90th percentile ${pct(90)}, 99th percentile ${pct(99)}, max ${turnHist.at(-1) ?? 0}`,
  `- By seat count: ${[...bySeats.entries()].sort((a, b) => a[0] - b[0]).map(([n, b]) => `${n} seats ${b.fin}/${b.n}`).join(', ')}`,
  `- Wall time: ${secs.toFixed(1)} s (${((secs * 1000) / games).toFixed(1)} ms per game, avg ${Math.round(turns / games)} turns)`,
  ...(firstErrors.length ? ['', '## First errors', ...firstErrors.map((e) => `- ${e}`)] : []),
  '',
].join('\n');
console.log(report);
mkdirSync('docs/m1', { recursive: true });
writeFileSync('docs/m1/sim-report.md', report);
process.exit(errored ? 1 : 0);
