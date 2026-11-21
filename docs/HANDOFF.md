# Hand-off: resume the Property Night build

Give this file to a new Claude Code session opened in the project folder (currently `C:\Users\dmvchiroel\projects\property-night`; on a fresh machine clone `Ericl96b/property-night` and run `npm ci`). It is self-contained: read it, then the files it points to. **All milestones are complete**; further work starts from the owner's feedback.

## Where things stand (2026-11-17)

- **Project:** "Property Night", a couch-play property-trading board game built from `SPEC.md` (the SPEC calls it "Couch Monopoly"; the trademark is kept out of every public name). TypeScript + Vite 8 + Three.js r187 + Svelte 5, deployed to **https://ericl96b.github.io/property-night/** from the public repo **Ericl96b/property-night** by `.github/workflows/deploy.yml` on every push to `main`. Installable as a PWA (offline after the first visit).
- **Done:** all milestones **M0–M11** of SPEC §14, each committed to `main` with a green Pages deploy (see `git log`). The §15 acceptance summary is `docs/m11/acceptance.md`.
- **Tests:** `npm test` (Vitest, ~15 s). Acceptance run: `npm run sim -- 10000` (results in `docs/m1/sim-report.md`).
- **Left for the owner (real hardware only):** DS4 via DS4Windows + Switch Pro in one auction (verified only with simulated pads); §10.10 frame rates on the TV PC at 4K (High) and a 1080p laptop (Low); couch readability of the board text at 4K. Everything else in §15 is automated and passing.
- **Alpha refinements (2026-11-18):** the owner's answers to the four alpha questions are built: house width, the board fitting between the panels, the AO / brightness / tone-mapping settings, and the `bankBotMode` rule. To check them, run `node scripts/cdp.mjs scripts/plans/refine.mjs .snapshots` (set `PN_W`/`PN_H` for other window sizes).
- **Possible next work:** the owner's next batch of fixes and additions, then any feedback from real-hardware play.

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
| `src/audio/` | `sound.ts`: WebAudio-synthesized effects (dice, tap, coins, card, tock, moment stings) and generative music; volumes from settings. |
| `src/director/` | `director.ts` turns engine events into skippable, speed-scaled animations (and sounds) (dice, hops, camera turns, deeds, buildings, cards, payment/bankruptcy/auction/set/seizure moments) and re-syncs the scene to the state; `queue.ts` is the animation queue. |
| `src/render/` | Three.js scene: `scene.ts` (assembly, quality switching, `setBoard` texture regeneration), `boardTexture.ts` (Canvas 2D board face from board data), `table.ts`, `board.ts`, `lighting.ts`, `renderer.ts` (render-on-demand, MSAA/FXAA), `cameraDirector.ts`, `tokens/` (nine code-built brass tokens), `tokenLayer.ts`, `buildings.ts` (themed buildings, one BatchedMesh per finish), `buildingModels.js` (approved building asset module; edit only via the owner's look-test workflow), `decals.ts` (owner discs, mortgage stamp, promise ribbon, loan padlock), `dice.ts` + `diceSim.ts` (§11 physics pre-sim + relabel), `portraits.ts`, `layout.ts`, `quality.ts`, `symbols.ts`. |
| `src/input/` | `manager.ts` (gamepads: device ids, mappings, remaps, seat binding, reconnects), `keys.ts` (keyboard). |
| `src/ui/` | Svelte 5 overlay on a 1920×1080 stage: `App.svelte` (root, intents, panels), `components/` (MainMenu, Setup, PlayerCards, ContextPanel, Deed, DrawnCard, AuctionPanel, ManagePanel, TradePanel, LoanPanel, PauseMenu, SavePanel, LogPanel, StatsPanel, RulesEditor, BoardEditor, RemapDialog, MomentLayer, Banknote, ActionButton); typed helpers in `present.ts`, `trade.ts`, `money.ts`, `focus.ts`, `theme.ts`, `lobby.ts`, `stats.ts`. |
| `src/main.ts` | Boot: scene, director, controller, input, presets, saves, autosave, App mount, review helpers on `window.__pn`. |
| `tests/` | Vitest: `engine/` (rules, settings, loans, endgame/headless), `app/` (controller, ownership, presets, board presets, saves/undo, trade UI, moments), `input/`, plus RNG/dice/board-data suites. |
| `scripts/` | `sim.ts` (10,000-game run), `cdp.mjs` (headless Chrome driver), `plans/` (UI checks m2…m9), `copy-fonts.mjs`. |
| `public/` | Fonts, app icons (`icon.svg` → PNGs via `scripts/make-icons.mjs`), `manifest.webmanifest`, `sw.js` (service worker). |
| `docs/` | `PROGRESS.md`, this file, screenshots per milestone (`docs/m0`–`docs/m11`), `m1/sim-report.md`, `m11/acceptance.md`. |

## How to verify UI work unattended

The in-app browser pane pauses `requestAnimationFrame` when hidden, so UI checks use headless Chrome over the DevTools Protocol:

1. Start the dev server (`npm run dev`, port 5173; or the `dev` entry in `.claude/launch.json`).
2. Run a plan: `node scripts/cdp.mjs scripts/plans/m9.mjs .snapshots`. Plans are `.mjs` modules with steps `{ eval }`, `{ until }`, `{ key }`, `{ wait }`, `{ shot }`; screenshots land in `.snapshots/` (git-ignored). Read the PNGs to review them.
3. Page helpers: `window.__pn` exposes `controller`, `scene`, `director`, `input`, `saves`, `forceDice(...values)` (steer the seeded RNG), `patchState(fn)` (edit and reload state). `scripts/plans/helpers.mjs` adds click/button/idle helpers.
4. URL parameters: `?auto=human,bot,bank` (start immediately, fixed order), `?seed=N`, `?speed=slow|normal|fast|instant`, `?quality=high|low`.
5. Lessons: wait for the actual button text (the overlay lags the engine until animations finish); fake gamepads work by redefining `navigator.getGamepads` in the page (see `plans/m4.mjs`); after `vite.config.ts` changes the dev server restarts.

Gotchas already hit: Svelte 5 treats `$state` as a store if a variable named `state` exists (game state props are named `gs`); reactive proxies cannot go into `structuredClone` or IndexedDB (use `$state.snapshot` / JSON copies); the animation queue only calls `finish()` on skip, so animations must clean up at the end of their own tick; long inline Python heredocs can trip the shell safety check — write edit scripts to the scratchpad and run them.

## Next steps

No milestones remain. If the owner asks for more work, start from their feedback; keep the standing instructions above (DECISIONS.md for judgement calls, open questions in `docs/PROGRESS.md`, commit → push → green deploy). Useful checks: `scripts/plans/m10.mjs` (lobby/bots/game over), `m11.mjs` (sound unlock, volumes, stats), `perf.mjs` (draw calls, idle, fps), `boot.mjs` (startup marks), `pwa.mjs` (offline on the live build).

## Open questions for the owner

None open. The four alpha questions were answered and built on 2026-11-18 (DECISIONS.md, "Alpha refinements").

## Housekeeping

- The scheduled auto-resume task (`property-night-resume`) was deleted by the owner on 2026-11-17; nothing resumes the build automatically. `.snapshots/heartbeat` is only a leftover from that setup and can be ignored.
- Local preview of the production build: `vite preview` 404s on module scripts in this Vite version (a dev-server quirk tied to `Sec-Fetch-Dest`); verify production on the live Pages URL instead.
