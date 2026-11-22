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

## Owner feedback

- [x] **Alpha refinements** (owner answers, 2026-11-18):
  - houses 22% wide
  - board fits between the side panels at every rotation and aspect
  - Ambient occlusion / Brightness / Tone mapping settings
  - `bankBotMode` rule (Classic: bank-backed bots leave after the first human hotel)

  See DECISIONS.md, "Alpha refinements".

- [x] **Batch 2** (owner requests, 2026-11-18):
  - camera turns to the active token's side
  - bills fly for every payment
  - SOLD signs
  - names under the color band
  - card decks on the table
  - slower speed presets (Relaxed / Normal / Fast / Instant)

  See DECISIONS.md, "Batch 2". Check: `node scripts/cdp.mjs scripts/plans/batch2.mjs .snapshots`.
- [x] **Batch 3** (owner request, 2026-11-21): themed houses and hotels, one design pair per color group, in the group's board color. See DECISIONS.md, "Batch 3". Check: `node scripts/cdp.mjs scripts/plans/batch3.mjs .snapshots`.

- [x] **Batch 4** (owner request, 2026-11-21):
  - graphics benchmark (Quick / Standard / Compare settings) with a results screen, recommendations and history
  - test board sandbox from the main menu
  - performance overlay (Off / FPS / Detailed)

  See DECISIONS.md, "Batch 4". Checks: `node scripts/cdp.mjs scripts/plans/bench.mjs .snapshots`, `node scripts/cdp.mjs scripts/plans/testboard.mjs .snapshots`, `node scripts/cdp.mjs scripts/plans/perf.mjs .snapshots`. Left for the owner: Compare settings on the TV PC at 4K (Windows at 120 Hz, then 60 Hz) and on the laptop; couch readability of the results; test-board controls on both controllers.

- [x] **Batch 5** (owner request, 2026-11-22): Pink and Yellow swap places. Yellow (Goldfinch Lane, Honey Street, Buttercup Row, mustard #D4A72C) is on tiles 11/13/14 and Pink (Rose Court, Peony Place, Rosewood Lane, #F569D7) on tiles 26/27/29. Prices stay with position. Old saves and user board presets are wiped once; `SAVE_VERSION` is 2. See DECISIONS.md, "Batch 5". Check: `node scripts/cdp.mjs scripts/plans/batch5.mjs .snapshots`.
- [x] **Stage 2** (owner request, 2026-11-22): close-up follow camera (new default Camera style; Table unchanged), hold R2 / ZR / C to peek, test board Camera panel, benchmark on the close-up shots. See DECISIONS.md, "Stage 2", and `docs/stage2/report.md`. Check: `node scripts/cdp.mjs scripts/plans/stage2.mjs .snapshots` (`PN_QUALITY=low` for Low). Pushed and deployed 2026-11-22 after the owner saved the OUTPOST baseline; the "after" benchmark and couch checks are next.
- [x] **Stage 3** (owner request, 2026-11-22): Inventory binder (replaces Manage, keeps loans and the debt phase), Trade "Across the Table + Deal Strip" with hold-to-accept, the shared card component, group promises (Rent-Free and No Building) and the normal-bot lock; `SAVE_VERSION` 3 with v2 saves migrated. See DECISIONS.md, "Stage 3", and `docs/stage3/report.md`. Check: `node scripts/cdp.mjs scripts/plans/stage3.mjs .snapshots`. Committed locally; not pushed or deployed yet. Left for the owner: the TV checklist in the report (both pads, hold-to-accept).

## Open questions for the owner

- Stage 2: the active token hides part of the landed property's name in Home / Landed shots (options in `docs/stage2/report.md`).

Otherwise none. The four alpha questions were answered on 2026-11-18. The owner has more fixes and additions planned; they will arrive as a separate batch.
