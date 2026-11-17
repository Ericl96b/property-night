# Property Night

A couch-play property-trading board game for one Windows PC on a 4K TV: two players, their own controllers, a real-time 3D tabletop rendered with Three.js. The full build spec is [SPEC.md](SPEC.md); the approved visual language lives in [couch-monopoly-handoff/](couch-monopoly-handoff/).

**Live build:** https://ericl96b.github.io/property-night/

## Status

Playable: set up 2–6 seats (human, bot or bank-backed bot), then roll, move, buy, pay rent, draw cards, go to jail and end turns, with the director animating every engine event. See [docs/PROGRESS.md](docs/PROGRESS.md) for milestone status.

### Controls

| Action | Keyboard | Controller (by position) |
| --- | --- | --- |
| Confirm (main button: roll, buy, end turn) / skip animation | Space / Enter | Bottom face (Cross / B) |
| Back (decline, pass) | Escape | Right face (Circle / A) |
| Manage (build, mortgage) | B | Left face (Square / Y) |
| Trade | V | Top face (Triangle / X) |
| Nudge camera | Arrow keys | Right stick |
| L1 / R1: auction bid increment | Q / E | L1 / R1 |
| Pause menu | P | Start (Options / +) |
| Fullscreen | F | — |

Review URL parameters: `?quality=high|low`, `?seed=N`, `?speed=slow|normal|fast|instant`, `?auto=human,bot,bank` (start a game immediately).

Review screenshots: [docs/m0/](docs/m0/) (visual prototype), [docs/m2/](docs/m2/), [docs/m3/](docs/m3/).

## Stack

| Layer | Choice |
| --- | --- |
| Language / build | TypeScript, Vite |
| 3D | Three.js (WebGL2) |
| Dice physics | cannon-es, off-screen pre-simulation only |
| UI | **Svelte 5 from Milestone 2.** Milestone 0 uses a minimal plain-DOM debug HUD. |
| Fonts | Fraunces (variable, with `opsz`) and Source Sans 3, self-hosted from `public/fonts/` |
| Hosting | GitHub Pages (Actions deploy on every push to `main`) |

## Scripts

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: engine rules, RNG fairness (1M rolls), 10,000-throw dice relabel, 300 headless games
npm run sim        # acceptance run: 10,000 headless bot games with invariants checked after every action
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ on http://localhost:4173
npm run fonts      # re-copy woff2 files from node_modules into public/fonts
node scripts/cdp.mjs scripts/plans/m2-human.mjs   # headless Chrome UI check (dev server running)
```

## Layout

```
src/
  data/      classic board data
  engine/    pure rules engine: apply(state, action) → { state, events }, legalActions, invariants
  bots/      medium bot, bank-backed bot, headless runner
  render/    Three.js scene: table, board texture, board, tokens, buildings, dice, camera, lighting, quality
  director/  director (engine events → animations) and the animation queue
  app/       game controller (state, dispatch, bot pacing, auction timer)
  input/     keyboard + gamepad
  ui/        Svelte overlay (setup, player cards, context panel, deeds, cards)
tests/       Vitest suites
```

Judgement calls where the spec is silent are logged in [DECISIONS.md](DECISIONS.md). Milestone status and open questions: [docs/PROGRESS.md](docs/PROGRESS.md).
