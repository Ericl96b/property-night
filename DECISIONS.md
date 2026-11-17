# Decisions

Where SPEC.md is silent, the decision taken is recorded here (SPEC §0).

## Carried over from SPEC §16

- Bank-backed bots never bid in auctions; they trigger them.
- Auctions run on an 8 s timer that resets on each bid; bids are capped at cash.
- Trades are proposed only on the proposer's own turn.
- Loan defaults: 75% of pledged price, 10% per GO pass, 3–10 passes, one loan, unsecured allowed, pledged properties locked; a missed secured payment seizes collateral immediately.
- Normal bots do not take loans in v1.
- Board text keeps real print orientation; readability across the board comes from camera rotation per active player and the upright deed panel.
- No procedural paper grain anywhere; realism comes from lighting.
- Houses stand on the color band; tokens stand in the tile body.
- Tokens are code-built: four turned/assembled pieces, five die-cut medallions.
- Dice: physics is cosmetic, the engine RNG decides, playback is pre-recorded.

## Project setup (2026-11-17)

- **Name:** the repo and Pages URL use "Property Night" (`property-night`). "Monopoly" is a Hasbro trademark and SPEC §1 rules out trademarked names, so it stays out of anything public.
- **Repo:** public GitHub repo `Ericl96b/property-night`, deployed to GitHub Pages by a GitHub Actions workflow on every push to `main`.
- **UI framework:** Svelte 5 from Milestone 2 (the lobby, editors, trade and auction screens are stateful enough to benefit). Milestone 0 uses a plain-DOM debug HUD.
- **Fonts:** self-hosted from npm packages (`@fontsource-variable/fraunces` full-axis file for the `opsz` axis; `@fontsource/source-sans-3` static 400–700), copied to `public/fonts/` by `npm run fonts`.
- **Handoff folder:** kept in the repo unchanged at `couch-monopoly-handoff/`; the app imports its SVG symbols directly from there so there is one copy.

## Milestone 0 — visual prototype (2026-11-17)

- **House width:** SPEC §10.5 asks for houses ≈30% of the tile width *and* four across the band with gaps. Four at 30% would need 120% of the width, so houses are ≈19% of the tile width (4 fit with ≈5% gaps). Hotels span 70% as specified.
- **Building placement covers band names:** houses stand on the color band (SPEC §10.5/§16), so a fully built street partly hides its printed name, as on a real board. The deed panel (M2) always shows the name.
- **Board-face optical sizing:** Canvas 2D cannot set `font-variation-settings`. Text is drawn at its reference CSS size under a scaling transform, so Fraunces' automatic optical sizing tracks the print size (≈ `opsz` 9–12 on tiles), matching the reference.
- **Symbol text:** `<text>` elements inside symbol SVGs (the Chance "?" and the Income Tax "$") are stripped before rasterizing and re-drawn with Canvas text in the self-hosted Fraunces.
- **Board slab:** the flat top cap is exactly the 1.0 × 1.0 print; the 1.6 mm bevel sits outside it, so decal UVs match the print exactly.
- **Ownership decals:** the owner disc sits at the tile's outer edge just below the price; the mortgaged state is a tile-sized overlay sampling the same board texture through a desaturating shader, plus an oxblood "M" stamp; the promise ribbon sits at the outer corner of the tile body.
- **Extra player colors:** the two additional player hues are raspberry `#C8326E` and blue `#2E7DD7` (SPEC §10.1 leaves them open).
- **Lamp pool:** baked into table vertex colors (rotation-invariant, zero cost) rather than a spot light.
- **Ambient occlusion:** not used in M0. Soft PCF shadows already give contact shading under tokens and houses, and AO would cost the integrated-GPU budget. Can be added on High if the owner wants it.
- **Dice physics scale:** 1 board unit ≈ 45 cm, so gravity is scaled to −21.8 units/s². Dice are cannon-es boxes (rounded corners are visual only); the arena walls sit at ±0.30 so dice never reach the tiles (±0.368). In 10,000 test throws, 33 needed an invisible re-throw and none had to be placed flat.
- **Pip layout:** +X 3, −X 4, +Y 1, −Y 6, +Z 2, −Z 5 (opposites sum to 7).
- **Medallion engraving:** detail lines (key bow ring, cat ears and whiskers, sail seams, gramophone cabinet) are thin darkened-brass inlays standing ≈0.1 mm proud of each face.
- **Umbrella:** eight raised ribs were added to the turned canopy so it reads as an umbrella from the 58° camera.
- **Overlay layout:** the seat column is 330 px and the context panel 340 px (logical) so the board at 88% height clears both panels at 16:9.
- **Sound:** not part of M0; tap/clatter/tock hooks exist (token step, dice contacts) for M11.
- **Dev snapshot endpoint:** the dev server accepts `POST /__snap` to save canvas captures into `.snapshots/` (git-ignored, dev only) for visual reviews.

## Milestone 1 — rules engine (2026-11-17)

- **Engine shape:** `apply(state, action) → { state, events }` clones the state structurally (rules, board and decks are shared and treated as immutable), so it is pure and fast (~20 ms per full 4-player bot game). The game log keeps the last 200 lines; the full history is the action list.
- **Timeless engine:** the auction timer lives in the UI, which sends `auctionTimeout` when the 8 s countdown expires. Headless runs send it when no bidder acts.
- **Debts sit outside cash:** a payment that the payer cannot cover becomes a pending debt and the game enters the raise-money phase; cash itself never goes negative. Debts settle automatically the moment the debtor has the cash. "Declare bankruptcy" is legal only when selling everything and mortgaging everything would still fall short.
- **Several debts at once** (e.g. "collect $10 from each player") are queued and settled in order; a non-active player can be the one raising money.
- **Double rent on an unimproved set** still applies to the unmortgaged lots when another lot in the set is mortgaged (official FAQ). Railroad rent counts every railroad the owner holds, mortgaged or not.
- **Jail:** leaving on doubles moves you but gives no extra roll; after the last failed attempt you pay the fine and move by that roll. Bank-backed bots never go to jail, even on three doubles.
- **Income Tax "player chooses lower":** the engine picks the lower amount automatically (no player would choose more).
- **House shortage:** breaking a hotel needs 4 houses from the bank. If the bank has fewer, selling that hotel clears the whole color set back to the bank at the sell-back value, so building always stays even. The Classic "auction scarce buildings" shortage auction is not in the engine yet (building is first-come for now); it lands with the building UI (M3) and is tested in M6.
- **Not yet implemented:** speed die (M6), bank loans (M7), "own turn only" building timing is honored but untested until M6.
- **Building any legal time:** any seat can build, sell or mortgage during pre-roll, the buy decision and post-roll, not during auctions, trades or someone else's raise-money.
- **Trades and promises pulled forward from M5:** headless bot games cannot finish without trading (sets rarely form), so the engine already supports propose / accept / reject / counter / cancel, cash, jail cards, the 10% mortgaged-transfer choice, and rent-free promises (count down at the end of the beneficiary's turns, void when the tile changes owner or a party leaves). Properties in a color set that has buildings cannot be traded. M5 adds the trade screen.
- **Bankruptcy to a player:** buildings are sold back to the bank first; the cash, every deed and jail cards go to the creditor, who then decides per mortgaged deed (pay 10% now or lift the mortgage). **To the bank:** deeds return unmortgaged and are auctioned one by one (Classic). A forfeiting high bidder's bid is voided.
- **One human, testing mode:** if the human goes bankrupt the game ends with no winner.
- **Medium bot:** keeps a reserve of $150 + 30% of the worst rent it could face (max $500); values a lot at its price, ×1.7 if it completes the bot's set, ×1.4 if it blocks an opponent's set, ×1.2 if the bot already owns part of the set; bids up to that value (keeping half the reserve). It proposes one set-completing trade per turn, raising its cash offer from 1.8× to 4× the price over the game, or a set-for-set swap; it accepts only trades worth ≥ 115% of what it gives (handing someone a set counts heavily). It builds to 3 houses as specified, but goes on to hotels when it is very cash-rich (> reserve + $1,500) or the bank is out of houses; otherwise 5–6 player games stall with every house on the board.
- **Bank-backed bot money pump:** because it pays rent from the bank's unlimited money, games that include one can run indefinitely. Kept exactly as specified; listed as an open question.
- **Card text and board names:** two Chance cards name tiles ("Rose Court", "Midnight Park", "North Line", "Scarlet Square"). The card editor (M8) will template these from the board preset so renamed boards stay consistent.

## Milestone 2 — engine → director → scene (2026-11-17)

- **UI framework:** Svelte 5 components for the overlay. `svelte-check` does not support TypeScript 7 yet, so components stay thin and all logic lives in type-checked `.ts` modules (`src/app/controller.ts`, `src/ui/present.ts`).
- **Shown state lags the engine:** the overlay shows the state as of the last finished animation batch (cash, deeds, prompts update when the director goes idle), so numbers never change before the animation that explains them.
- **Confirm skips:** pressing Confirm (or Back) while animations play jumps every queued animation to its end state.
- **Bot pacing:** Slow 1.1 s, Normal 0.65 s, Fast 0.3 s, Instant none, between bot decisions; auctions use 90% of that.
- **Auction timer** lives in the controller (8 s Classic, reset on each bid) and sends `auctionTimeout`; pausing holds bots and the timer.
- **Hidden tab:** rendering and animations pause while the tab is hidden (browser behavior); the game simply waits.
- **Shadows:** three.js r187 removed `PCFSoftShadowMap`; using `PCFShadowMap` with a shadow radius.
- **Jail placement:** tokens *in* jail stand inside the jail square; visitors stand on the Just Visiting strip.
- **Setup screen is interim:** seats (Human / Bot / Bank-backed bot), name, token, color, random order. Controllers and presets join it in M4/M6/M10.
- **Review tooling:** `scripts/cdp.mjs` drives headless Chrome over the DevTools Protocol in real time (clicks, keys, evaluation, screenshots) using plans in `scripts/plans/`, so UI checks run unattended. `?auto=human,bot,…` starts a game directly; `?speed=` sets the speed.

## Milestone 3 — auctions, building, raise money, payments (2026-11-17)

- **Auction screen:** every human in the auction gets a row with the four increments (+$1/+$10/+$50/+$100, default +$10), a Bid button showing the exact amount, and Pass. The first increment applies to the opening bid. Keyboard drives the first human still able to act; per-controller input arrives in M4.
- **Manage screen:** properties grouped by color set (railroads and utilities too); every action is always listed, disabled with the engine's reason on hover when it cannot run (evenness, supply, mortgaged lot, cash). Raise-money reuses it as a blocking panel that cannot be dismissed and closes itself once the debt settles.
- **Payment moment:** payments of $200+ or 25%+ of the payer's cash (settings) show the banner with both token portraits, the place or reason, the amount in Fraunces, banknotes flying payer → payee (largest first, max 12, then a "+$X" chip), counters ticking, a 0.4 s camera push-in on the tile, and a shake if the payer ends below $100. The bank's position is the board center. Bank-backed bots' payments and bankruptcy hand-overs do not trigger it.
- **Other moments (1.5 s banner):** bankruptcy, auction win, completing a color set.
- **Token portraits** are rendered from the 3D brass tokens at game start with a small separate renderer (the reference SVGs are proportion references only).
- **Pause menu** (Start/Options, keyboard P, or the menu icon top center): resume, fullscreen, forfeit per human seat (with a confirm step), new game (confirm), and settings: speed, quality, board rotation, camera follow, reduce motion, big-payment thresholds. Settings persist in localStorage until saves move to IndexedDB in M9. Pausing holds bots and the auction timer.
- **Svelte naming:** components avoid a variable named `state` (Svelte 5 treats `$state` as a store subscription when one exists); game state props are named `gs`.

## Milestone 4 — controller layer (2026-11-17)

- **Input manager** (`src/input/manager.ts`) polls every frame and tags each intent with its device id and bound seat, so two pads can never cross or double their input. Device kinds: Xbox-style (DS4Windows' virtual Xbox 360 pad or a real Xbox pad), raw DualShock 4, Switch Pro, generic.
- **Mappings:** standard-mapping pads map by position. A Switch Pro without the standard mapping uses a built-in table (B/A/Y/X = 0/1/2/3, D-pad on the hat axis); that table is not verified on hardware, so every pad can be set up with "Set up buttons" (press each button), stored per device id. Unknown non-standard pads ask for this before they can join.
- **Joining:** on the setup screen, any button on an unjoined pad binds it to the next human seat without a controller; seats show the controller type and can be unbound. Bindings are remembered by device id (localStorage now; saved games carry them from M9). Seats are shuffled into turn order at start and bindings follow the seat.
- **Ownership** (`src/app/ownership.ts`): in normal play only the active player's controller acts; others are read-only. Every human's controller is live in auctions; raise-money belongs to the debtor; trades: receiver answers, proposer may cancel. Pause (Start) and the game log (Select) work from any bound controller. Unbound pads do nothing during a game. Keyboard and mouse always act as a fallback for whoever must act.
- **Glyphs:** prompts use the acting controller's glyphs. Nintendo pads by position show B (Confirm) and A (Back) with the approved symbols; with "Swap Confirm/Back on Nintendo pads" on, A confirms and B goes back. X and Y have no approved symbol, so they are drawn as lettered brass discs.
- **Disconnects:** a bound pad of a human in a running game disconnecting pauses the game with "Name: reconnect controller"; the same device returning rebinds automatically and resumes. Keyboard/mouse can choose to continue without it.
- **Navigation:** D-pad / left stick (and arrow keys) move focus spatially within the topmost panel; Confirm presses the focused control; otherwise Confirm runs the main action. Shift + arrows nudge the camera from the keyboard; the right stick nudges from a pad.
- **Opening bid** is the chosen increment (at least the minimum): +$50 opens at $50.
- **Two identical pads** (same id string) are told apart by connection order (`#1`, `#2`).
