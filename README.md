# Property Night

A couch-play property-trading board game for one Windows PC on a 4K TV: two players, their own controllers, a real-time 3D tabletop rendered with Three.js. The full build spec is [SPEC.md](SPEC.md); the approved visual language lives in [couch-monopoly-handoff/](couch-monopoly-handoff/).

**Live build:** https://ericl96b.github.io/property-night/

## Status

Complete (milestones M0–M11): 2–6 seats (human, medium bot or bank-backed bot) with random or listed turn order; the full Classic rules plus every §5/§7 setting, auctions, trades with promises, bank loans, rules/board/card editors and presets; saves, autosave, undo and the game log; generated sound and music; an end-of-game stats screen; and an installable offline web app (PWA). See [docs/PROGRESS.md](docs/PROGRESS.md) for milestone status and [docs/m11/acceptance.md](docs/m11/acceptance.md) for the acceptance checks.

### Controls

Each human seat owns one controller (join from the setup screen by pressing any button). Keyboard and mouse always work as a fallback.

| Action | Keyboard | Controller (by position) |
| --- | --- | --- |
| Confirm (main action, or the focused control) / skip animation | Space / Enter | Bottom face (Cross / B) |
| Back (decline, pass, close) | Escape | Right face (Circle / A) |
| Manage (build, mortgage) | B | Left face (Square / Y) |
| Trade | V | Top face (Triangle / X) |
| Auction bid increment | Q / E | L1 / R1 |
| Navigate menus | Arrow keys | D-pad / left stick |
| Nudge camera | Shift + arrows | Right stick |
| Pause menu | P | Start (Options / +) |
| Game log | L | Select (Share / −) |
| Fullscreen | F | from the pause menu |

Review URL parameters: `?quality=high|low`, `?seed=N`, `?speed=slow|normal|fast|instant`, `?auto=human,bot,bank` (start a game immediately), `?ao=1|0` (ambient occlusion on/off).

Graphics settings (pause menu, independent of Quality): Ambient occlusion (off by default), Brightness 70–130%, Tone mapping Filmic (ACES) / AgX / Neutral.

Review screenshots: [docs/m0/](docs/m0/) (visual prototype), [docs/m2/](docs/m2/), [docs/m3/](docs/m3/), [docs/m4/](docs/m4/), [docs/m5/](docs/m5/), [docs/m6/](docs/m6/), [docs/m7/](docs/m7/), [docs/m8/](docs/m8/), [docs/m9/](docs/m9/), [docs/m10/](docs/m10/), [docs/m11/](docs/m11/).

**Install:** in Chrome or Edge, open the live build and use "Install Property Night" in the address bar (or the browser menu). After the first visit it also works offline. Sound starts after the first key press, click or controller button (browser autoplay rules); volumes are in the pause menu.

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
node scripts/cdp.mjs scripts/plans/perf.mjs       # draw calls, idle rendering, fps (PN_URL / PN_QUALITY env)
node scripts/cdp.mjs scripts/plans/boot.mjs       # startup breakdown (pn-scene / pn-ready marks)
node scripts/cdp.mjs scripts/plans/pwa.mjs        # manifest, service worker and offline reload on the live build
node scripts/make-icons.mjs                       # render public/icon.svg to the PNG app icons
```

## Layout

```
src/
  data/      classic board data
  engine/    pure rules engine: apply(state, action) → { state, events }, legalActions, invariants
  bots/      medium bot, bank-backed bot, headless runner
  render/    Three.js scene: table, board texture, board, tokens, buildings, dice, camera, lighting, quality
  director/  director (engine events → animations + sounds) and the animation queue
  audio/     WebAudio sound effects and generative music (nothing shipped as files)
  app/       game controller, settings, presets, saves
  storage/   IndexedDB key-value store
  input/     keyboard + gamepad
  ui/        Svelte overlay (lobby, player cards, context panel, deeds, cards, editors, stats)
public/      fonts, app icons, web app manifest, service worker (sw.js)
tests/       Vitest suites
```

Judgement calls where the spec is silent are logged in [DECISIONS.md](DECISIONS.md). Milestone status and open questions: [docs/PROGRESS.md](docs/PROGRESS.md). Resuming in a new session: [docs/HANDOFF.md](docs/HANDOFF.md).
