# Build progress

This file is the hand-off log for unattended work. A resumed session reads it first, continues the first unchecked milestone, and updates it as it goes.

## Owner instructions (2026-11-17)

- Resumed at M10 on the owner's request (2026-11-17): build M10 and M11 unattended until all milestones are complete.

- Milestone 0 was approved on 2026-11-17.
- After M1 passes all checks, build **M2 → M11 unattended** in SPEC §14 order, as long as every check passes.
- Stop and wait for the owner only for a critical error or a decision that genuinely needs them. Otherwise record the decision in `DECISIONS.md` and list open questions below.
- Commit each milestone to `main` with the Co-Authored-By line, push, and confirm the GitHub Pages deploy succeeds.

## Definition of done for every milestone

1. `npm run typecheck`, `npm test` and `npm run build` pass.
2. New behavior is covered by tests (engine rules) or verified in the browser (UI/3D). Use the headless Chrome capture and `POST /__snap` dev endpoint described in `README.md`/`vite.config.ts`.
3. `DECISIONS.md` records judgement calls; README updated if controls or scripts change.
4. Committed and pushed to `main`; the "Deploy to GitHub Pages" workflow is green.

## Milestones

- [x] **M0** Visual prototype — approved 2026-11-17.
- [x] **M1** Engine with Classic rules + unit tests; headless bot-vs-bot games run to completion. Done 2026-11-17: 95 tests; 10,000-game run in `docs/m1/sim-report.md` (0 illegal states, 99.5% finished).
- [x] **M2** Engine → director → scene: roll, move, buy, rent, cards, jail, end turn, basic overlay panels (mouse/keyboard). Done 2026-11-17.
- [x] **M3** Auctions, building, mortgages, raise-money flow, bankruptcy, forfeit, big-payment moment. Done 2026-11-17.
- [x] **M4** Controller layer: assignment screen, DS4Windows/Switch Pro mapping, per-seat ownership, simultaneous auction input. Done 2026-11-17 (verified with simulated pads; physical DS4/Switch check pending on the TV PC).
- [x] **M5** Trades with promises (UI; engine support already exists). Done 2026-11-17.
- [x] **M6** Rules editor + rules presets; every §5 setting wired and tested. Done 2026-11-17.
- [x] **M7** Bank loans. Done 2026-11-17.
- [x] **M8** Board and card editors + board presets (texture regeneration). Done 2026-11-17.
- [x] **M9** Save slots, autosave, resume, export/import, undo, game log. Done 2026-11-17.
- [x] **M10** Bots (medium + bank-backed) in the lobby. Done 2026-11-17: turn order Random / As listed with reordering, bot badges and descriptions, a log line for every action, game-over wording for the §3 win rules; mixed human/bot/bank-bot controller test.
- [x] **M11** Polish: sounds, stats screen, speed settings, reduce motion, performance pass. Done 2026-11-17: WebAudio sound and music with volumes, end-of-game stats screen, speed/reduce-motion audit, performance pass (71 draw calls worst case, render on demand), installable offline PWA; §15 summary in `docs/m11/acceptance.md`. Real-hardware checks (controllers, 4K/laptop fps) remain for the owner.

## Notes for the next session

- Engine: `src/engine/` (pure reducer `apply`, `legalActions`, invariants). Bots: `src/bots/`. Headless runner: `src/bots/headless.ts`; acceptance run: `npm run sim -- 10000`.
- Trades and rent-free promises are implemented in the engine (pulled forward from M5 because bot games cannot finish without trading).
- The scheduled auto-resume task and its heartbeat check were retired on 2026-11-17 (task deleted by the owner).

## Open questions for the owner

1. House width: four houses at the SPEC's 30% of a tile cannot fit; using ≈19%.
2. Board fills 88% of screen height; at 1080p the GO corner nearly touches the right panel. Drop to ≈84%?
3. Ambient occlusion left out (soft shadows already give contact shading). Add on High?
4. A bank-backed bot pays rent from the bank's unlimited money, which can keep games with one running indefinitely. Keep as specified, or cap/limit it?
