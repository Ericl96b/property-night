# SPEC §15 acceptance checks — summary for the owner (2026-11-17)

All milestones M0–M11 are built. Every check that can run on this machine passes; three need the owner's real hardware.

| # | Check | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 10,000 headless bot games under Classic rules finish with no illegal state | **Pass** | `npm run sim -- 10000` — 15,122,846 actions with invariants checked after every one, **0** illegal states or actions; 9,962 of 10,000 games (99.62%) finished within 5,000 turns (the rest are long stalemates, not errors). Report: [docs/m1/sim-report.md](../m1/sim-report.md). |
| 2 | Every rules setting has at least one test proving it changes behavior | **Pass** | `tests/engine/settings.test.ts` and `tests/engine/loans.test.ts` (one or more tests per §5/§7 setting; see M6/M7 in DECISIONS.md). |
| 3 | Loan scenarios: early payoff, interest-free, missed secured payment with refund, with shortfall, missed unsecured payment, no-build rule | **Pass** | `tests/engine/loans.test.ts`: one named test per scenario. |
| 4 | Dice fairness (§11) | **Pass** | `tests/rng.test.ts`: 1,000,000 rolls chi-square uniform per seed, 6×6 independence; `tests/diceRelabel.test.ts`: displayed faces equal the engine values on 10,000 simulated throws, Instant places flat. |
| 5 | Save mid-auction and mid-trade, reload, continue identically (incl. camera side) | **Pass** | `tests/app/saves.test.ts` ("saved mid-auction / mid-trade, reloaded, continues identically (including camera side)"). |
| 6 | DS4 (DS4Windows) and Switch Pro bid in the same auction without crossed or doubled input | **Pending — owner hardware** | Verified with simulated pads (`scripts/plans/m4.mjs`, `tests/input/manager.test.ts`). Needs a real DS4 + Switch Pro on the TV PC. |
| 7 | §10.10 performance on the TV PC (4K, High, 60 fps) and the laptop (1080p, Low, ≥ 45 fps) | **Partly measured — owner hardware** | Draw calls on a worst-case board: 71 (High) / 72 (Low), budget < 150. Idle: 0 frames rendered while static. Startup to the interactive menu on the live build (cold cache, headless Chrome on the build machine): 1.28 s at Low, 1.33 s at High (board + table textures inside that: ≈0.8–1.0 s), budget 2 s. 60 fps in headless Chrome on the build machine during a camera turn; earlier on an Iris Xe laptop: 59 fps at High 1280×720×1.5. Real 4K and 1080p-laptop numbers need the owner's machines (`scripts/plans/perf.mjs` reproduces the measurement). |
| 8 | Board text readable from the couch at 4K when its side faces the viewer; deed panel always shows the current tile name upright | **Deed panel: pass; couch readability: owner** | The right panel shows the current tile's deed (or name) upright at all times; board text follows print orientation and the camera turns each player's side toward the viewer (M0 approved). Couch-distance readability is the owner's call on the TV. |
| 9 | Houses and hotels visible on every tile while a token stands on it | **Pass** | Buildings stand on the color band and tokens in the tile body (M0 decision); see `docs/m11/perf-high.png` (every street built, tokens on the board). |

## Also delivered in M11

- Sound: synthesized dice clatter, token taps, coins, card swish, building tock, moment stings, and quiet generative music; master/music/effects volumes.
- End-of-game stats: rent paid/received, most profitable tile, money-over-time chart, direct vs auction purchases, loans (`docs/m11/m11-stats.png`).
- Speed and reduce-motion audit (camera turn timing and the fixed overhead view are unit-tested).
- Installable PWA with offline play after the first visit: verified on the live build (manifest and worker active, 14 entries cached, the menu and board load with the network switched off; `docs/m11/pwa-offline.png`).

## Open questions

The owner answered all four on 2026-11-18, and the answers are built (DECISIONS.md, "Alpha refinements"):
- houses are widened to 22%
- the board now fits between the side panels
- Ambient occlusion, Brightness and Tone mapping are settings
- the `bankBotMode` rule sets what happens to bank-backed bots after the first human hotel
