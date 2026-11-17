# Property Night

A couch-play property-trading board game for one Windows PC on a 4K TV: two players, their own controllers, a real-time 3D tabletop rendered with Three.js. The full build spec is [SPEC.md](SPEC.md); the approved visual language lives in [couch-monopoly-handoff/](couch-monopoly-handoff/).

**Live build:** https://ericl96b.github.io/property-night/

## Status

Milestone 0 — visual prototype (approval gate, SPEC §14). No rules yet: table, generated board face, lighting, all nine tokens, houses and hotels, the physics-for-look / RNG-for-result dice pipeline, camera rotation per side and token hop with follow.

### Prototype controls

| Action | Keyboard | Controller (by position) |
| --- | --- | --- |
| Roll dice (random engine values), then hop the active token; skip an animation | Space / Enter | Bottom face (Cross / B) |
| Build on the active token's tile (or the next demo street) | B | Left face (Square / Y) |
| Sell a building | V | Top face (Triangle / X) |
| Rotate to previous / next side | Q / E | L1 / R1 |
| Next player (camera rotates to their side) | N | D-pad right |
| Nudge camera | Arrow keys | Right stick |
| Toggle overlay | Tab | Select (Share / −) |
| Fullscreen | F | Start (Options / +) |

Review URL parameters: `?quality=high|low`, `?seed=N`, `?side=0-3`, `?lineup=1` (all nine tokens on the bottom row), `?focus=x,z,zoom`, `?roll=1`, `?hud=0`.

Review screenshots live in [docs/m0/](docs/m0/).

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
```

## Layout

```
src/
  data/      classic board data
  engine/    pure rules engine: apply(state, action) → { state, events }, legalActions, invariants
  bots/      medium bot, bank-backed bot, headless runner
  render/    Three.js scene: table, board texture, board, tokens, buildings, dice, camera, lighting, quality
  director/  animation queue (skippable, speed-scaled)
  input/     keyboard + gamepad
  ui/        HTML overlay
tests/       Vitest suites
```

Judgement calls where the spec is silent are logged in [DECISIONS.md](DECISIONS.md). Milestone status and open questions: [docs/PROGRESS.md](docs/PROGRESS.md).
