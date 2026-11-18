# Hand-off: resume the Property Night build

Give this file to a new Claude Code session opened in `C:\Users\Ericl_9vgzjbj\Projects\Property_Night`. It is self-contained: read it, then the files it points to, then continue with **M10**.

## Where things stand (2026-11-17)

- **Project:** "Property Night", a couch-play property-trading board game built from `SPEC.md` (the SPEC calls it "Couch Monopoly"; the trademark is kept out of every public name). TypeScript + Vite 8 + Three.js r187 + Svelte 5, deployed to **https://ericl96b.github.io/property-night/** from the public repo **Ericl96b/property-night** by `.github/workflows/deploy.yml` on every push to `main`.
- **Done:** milestones **M0–M9** of SPEC §14, each committed to `main` with a green Pages deploy. Last commit: "Milestone 9: saves, autosave, resume, undo" (see `git log`).
- **Tests:** 178 Vitest tests in 17 files, all passing (`npm test`, ~15 s). Acceptance run: `npm run sim -- 10000` (10,000 headless bot games, invariants after every action; last result 0 illegal states, 99.5% finished — `docs/m1/sim-report.md`).
- **Left:** **M10** (bots in the lobby) and **M11** (polish: sounds, end-of-game stats, speed settings, reduce motion, performance pass). See "Next steps" below.
- **Pending on real hardware (owner):** DS4 via DS4Windows + Switch Pro in one auction (verified only with simulated pads), §10.10 performance on the TV PC at 4K and a 1080p laptop (measured only on an Iris Xe laptop: 59 fps on High at 1280×720×1.5 DPR, ≤ 77 draw calls).

## Read these first

1. `SPEC.md` — the build spec. §14 is the milestone order, §15 the acceptance checks.
2. `docs/PROGRESS.md` — milestone checklist, owner instructions, definition of done, open questions. **Remove its "STATUS: WAITING FOR THE OWNER" section once the owner says to continue.**
3. `DECISIONS.md` — every judgement call made where the SPEC is silent or self-contradictory (per milestone). Keep appending to it.
4. `README.md` — scripts, controls, layout, review URL parameters.

## Owner's standing instructions

- Work unattended through the remaining milestones in §14 order when told to continue; stop only for a critical error or a decision that genuinely needs the owner. Record judgement calls in `DECISIONS.md`; list open questions in `docs/PROGRESS.md`.
- Do not change rule defaults, button layout, screen layouts, palette, fonts or art direction without asking (SPEC §0) — propose changes as a list instead.
- Each milestone: `npm run typecheck`, `npm test`, `npm run build` pass → commit to `main` (message ends with the Co-Authored-By line from the session's system reminder) → push → confirm the "Deploy to GitHub Pages" run succeeds (`gh run watch <id> --repo Ericl96b/property-night --exit-status`) → tick the milestone in `docs/PROGRESS.md`.
- Keep "Monopoly" out of public names, URLs and card text.

## Code map

| Path | What it is |
| --- | --- |
| `src/engine/` | Pure rules engine. `apply(state, action) → { state, events }` (`apply.ts`), `legalActions` / `seatsToAct` (`legal.ts`), `newGame` / `cloneState` (`state.ts`), queries + building/mortgage blockers (`queries.ts`), trades (`trade.ts`), bank loans (`loans.ts`), cards with `{tile}` templating (`cards.ts`), all §5/§7 settings (`rules.ts`, `CLASSIC_RULES`), seeded serializable RNG (`rng.ts`), invariants (`invariants.ts`). No DOM or rendering imports. |
| `src/bots/` | `chooseAction(state, seat)`: medium bot (`medium.ts`: reserve, value estimate, set-completing trades, building/speed-die/auction choices) and bank-backed bot (`index.ts`). `headless.ts` runs bot-only games. |
| `src/app/` | `controller.ts` (state owner: dispatch, action log, seed, undo, bot pacing, auction timer, pause, autosave hook), `ownership.ts` (which controller may act), `settings.ts` (§13 settings, localStorage), `presets.ts` + `rulesSchema.ts` (rules presets/editor fields), `boardPresets.ts` (board/card presets, `printView`), `saves.ts` (§12 save format, slots, autosave, import/export). |
| `src/storage/db.ts` | IndexedDB key-value store (`presets`, `saves`, `meta`) with an in-memory fallback. |
| `src/director/` | `director.ts` turns engine events into skippable, speed-scaled animations (dice, hops, camera turns, deeds, buildings, cards, payment/bankruptcy/auction/set/seizure moments) and re-syncs the scene to the state; `queue.ts` is the animation queue. |
| `src/render/` | Three.js scene: `scene.ts` (assembly, quality switching, `setBoard` texture regeneration), `boardTexture.ts` (Canvas 2D board face from board data), `table.ts`, `board.ts`, `lighting.ts`, `renderer.ts` (render-on-demand, MSAA/FXAA), `cameraDirector.ts`, `tokens/` (nine code-built brass tokens), `tokenLayer.ts`, `buildings.ts` (instanced), `decals.ts` (owner discs, mortgage stamp, promise ribbon, loan padlock), `dice.ts` + `diceSim.ts` (§11 physics pre-sim + relabel), `portraits.ts`, `layout.ts`, `quality.ts`, `symbols.ts`. |
| `src/input/` | `manager.ts` (gamepads: device ids, mappings, remaps, seat binding, reconnects), `keys.ts` (keyboard). |
| `src/ui/` | Svelte 5 overlay on a 1920×1080 stage: `App.svelte` (root, intents, panels), `components/` (MainMenu, Setup, PlayerCards, ContextPanel, Deed, DrawnCard, AuctionPanel, ManagePanel, TradePanel, LoanPanel, PauseMenu, SavePanel, LogPanel, RulesEditor, BoardEditor, RemapDialog, MomentLayer, Banknote, ActionButton); typed helpers in `present.ts`, `trade.ts`, `money.ts`, `focus.ts`, `theme.ts`. |
| `src/main.ts` | Boot: scene, director, controller, input, presets, saves, autosave, App mount, review helpers on `window.__pn`. |
| `tests/` | Vitest: `engine/` (rules, settings, loans, endgame/headless), `app/` (controller, ownership, presets, board presets, saves/undo, trade UI, moments), `input/`, plus RNG/dice/board-data suites. |
| `scripts/` | `sim.ts` (10,000-game run), `cdp.mjs` (headless Chrome driver), `plans/` (UI checks m2…m9), `copy-fonts.mjs`. |
| `docs/` | `PROGRESS.md`, this file, screenshots per milestone (`docs/m0`–`docs/m9`), `m1/sim-report.md`. |

## How to verify UI work unattended

The in-app browser pane pauses `requestAnimationFrame` when hidden, so UI checks use headless Chrome over the DevTools Protocol:

1. Start the dev server (`npm run dev`, port 5173; or the `dev` entry in `.claude/launch.json`).
2. Run a plan: `node scripts/cdp.mjs scripts/plans/m9.mjs .snapshots`. Plans are `.mjs` modules with steps `{ eval }`, `{ until }`, `{ key }`, `{ wait }`, `{ shot }`; screenshots land in `.snapshots/` (git-ignored). Read the PNGs to review them.
3. Page helpers: `window.__pn` exposes `controller`, `scene`, `director`, `input`, `saves`, `forceDice(...values)` (steer the seeded RNG), `patchState(fn)` (edit and reload state). `scripts/plans/helpers.mjs` adds click/button/idle helpers.
4. URL parameters: `?auto=human,bot,bank` (start immediately, fixed order), `?seed=N`, `?speed=slow|normal|fast|instant`, `?quality=high|low`.
5. Lessons: wait for the actual button text (the overlay lags the engine until animations finish); fake gamepads work by redefining `navigator.getGamepads` in the page (see `plans/m4.mjs`); after `vite.config.ts` changes the dev server restarts.

Gotchas already hit: Svelte 5 treats `$state` as a store if a variable named `state` exists (game state props are named `gs`); reactive proxies cannot go into `structuredClone` or IndexedDB (use `$state.snapshot` / JSON copies); the animation queue only calls `finish()` on skip, so animations must clean up at the end of their own tick; long inline Python heredocs can trip the shell safety check — write edit scripts to the scratchpad and run them.

## Next steps

### M10 — Bots (medium + bank-backed) in the lobby

Much is already in place: the setup screen offers Human / Bot / Bank-backed bot per seat, bots play by the same rules with paced decisions (`src/app/controller.ts` `BOT_PAUSE`), and the bank-backed bot rules are in the engine and tested. Remaining:

- Lobby polish per SPEC §3/§9: turn order "random by default, or set in the lobby" (currently a checkbox; add explicit ordering), clear labels/badges for bot kinds, no duplicate tokens/colors (already validated), at least one human (validated).
- Bot action log lines and pauses that follow the speed setting (pauses done; check every bot action produces a readable log line).
- Win rules with bots in the UI (2+ humans: ends when one human is left; 1 human testing mode) — engine done; check the game-over screen wording.
- Tests: a controller-level game with humans + bots + a bank-backed bot.

### M11 — Polish

- **Sound** (SPEC §9): dice clatter (dice contact steps are recorded in `diceSim.ts` `contacts`; `Dice.play` has an `onContact` hook), token tap per tile (`TokenLayer.travel` `onStep`), coins, card flip, building "tock", light background music; separate volume sliders (settings already have master/music/effects fields). Generate sounds with WebAudio rather than shipping files.
- **End-of-game stats** (SPEC §9): rent paid/received (player `stats` already tracked), most profitable tile, money-over-time line chart (record cash per turn), auction vs direct purchases (tracked), loans.
- **Speed settings / reduce motion:** both work; audit every animation for speed scaling and that reduce motion gives the fixed overhead view.
- **Performance pass** (§10.10): draw calls < 150, render-on-demand when idle, startup < 2 s, Auto quality picks Low on integrated GPUs. Real-hardware numbers need the owner's TV PC and laptop.
- **PWA** (SPEC §2 hosting row): installable manifest + service worker (not done yet).
- Then run all §15 acceptance checks and summarize them for the owner.

## Open questions for the owner (also in `docs/PROGRESS.md`)

1. House width ≈19% of a tile (the SPEC's 30% cannot fit four).
2. Board at 88% screen height nearly touches the right panel at 1080p; drop to ≈84%?
3. Ambient occlusion on High (left out so far)?
4. The bank-backed bot pays rent from the bank's unlimited money, so games with one can run indefinitely; keep as specified or cap it?

## Housekeeping

- The scheduled auto-resume task (`property-night-resume`) was deleted by the owner on 2026-11-17; nothing resumes the build automatically. `.snapshots/heartbeat` is only a leftover from that setup and can be ignored.
- Local preview of the production build: `vite preview` 404s on module scripts in this Vite version (a dev-server quirk tied to `Sec-Fetch-Dest`); verify production on the live Pages URL instead.
