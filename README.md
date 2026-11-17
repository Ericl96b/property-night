# Property Night

A couch-play property-trading board game for one Windows PC on a 4K TV: two players, their own controllers, a real-time 3D tabletop rendered with Three.js. The full build spec is [SPEC.md](SPEC.md); the approved visual language lives in [couch-monopoly-handoff/](couch-monopoly-handoff/).

**Live build:** https://ericl96b.github.io/property-night/

## Status

Milestone 0 — visual prototype (approval gate, SPEC §14). No rules yet: table, generated board face, lighting, all nine tokens, houses and hotels, the physics-for-look / RNG-for-result dice pipeline, camera rotation per side and token hop with follow.

### Prototype controls

| Action | Keyboard | Controller |
| --- | --- | --- |
| Roll dice (random values) | Space / Enter | Cross / B (bottom face) |
| Rotate to next / previous side | E / Q | R1 / L1 |
| Hop the active token | H | Square / Y (left face) |
| Add a building | B | Triangle / X (top face) |
| Nudge camera | Arrow keys | Right stick |
| Fullscreen | F | Options / + |
| Toggle HUD | Tab | Share / − |

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
npm test           # Vitest: RNG fairness, dice relabel, board data
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ on http://localhost:4173
npm run fonts      # re-copy woff2 files from node_modules into public/fonts
```

## Layout

```
src/
  data/      classic board data
  engine/    rules engine (M0: seeded RNG only) — no rendering code
  render/    Three.js scene: table, board texture, board, tokens, buildings, dice, camera, lighting, quality
  director/  animation queue (skippable, speed-scaled)
  input/     keyboard + gamepad
  ui/        HTML overlay
tests/       Vitest suites
```

Judgement calls where the spec is silent are logged in [DECISIONS.md](DECISIONS.md).
