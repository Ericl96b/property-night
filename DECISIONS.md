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

- **House width:** SPEC §10.5 asks for houses ≈30% of the tile width *and* four across the band with gaps. Four at 30% would need 120% of the width, so houses were ≈19% of the tile width (4 fit with ≈5% gaps). Hotels span 70% as specified. *Widened to 22% on 2026-11-18 (see Alpha refinements).*
- **Building placement covers band names:** houses stand on the color band (SPEC §10.5/§16), so a fully built street partly hides its printed name, as on a real board. The deed panel (M2) always shows the name. *Since batch 2 (2026-11-18) names print under the band, so houses no longer hide them.*
- **Board-face optical sizing:** Canvas 2D cannot set `font-variation-settings`. Text is drawn at its reference CSS size under a scaling transform, so Fraunces' automatic optical sizing tracks the print size (≈ `opsz` 9–12 on tiles), matching the reference.
- **Symbol text:** `<text>` elements inside symbol SVGs (the Chance "?" and the Income Tax "$") are stripped before rasterizing and re-drawn with Canvas text in the self-hosted Fraunces.
- **Board slab:** the flat top cap is exactly the 1.0 × 1.0 print; the 1.6 mm bevel sits outside it, so decal UVs match the print exactly.
- **Ownership decals:** the owner disc sits at the tile's outer edge just below the price; the mortgaged state is a tile-sized overlay sampling the same board texture through a desaturating shader, plus an oxblood "M" stamp; the promise ribbon sits at the outer corner of the tile body.
- **Extra player colors:** the two additional player hues are raspberry `#C8326E` and blue `#2E7DD7` (SPEC §10.1 leaves them open).
- **Lamp pool:** baked into table vertex colors (rotation-invariant, zero cost) rather than a spot light.
- **Ambient occlusion:** not used in M0 (*now an independent setting, see Alpha refinements*). Soft PCF shadows already give contact shading under tokens and houses, and AO would cost the integrated-GPU budget. Can be added on High if the owner wants it.
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
- **Bank-backed bot money pump:** because it pays rent from the bank's unlimited money, games that include one can run indefinitely. Kept exactly as specified; listed as an open question. *Resolved 2026-11-18 by the `bankBotMode` rule (see Alpha refinements).*
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

## Milestone 5 — trades with promises (2026-11-17)

- **Trade screen:** proposed on your own turn (Trade button / top face) with any other player in the game (not bank-backed bots). Two columns, one per side: deeds (deeds in a set with buildings are greyed out with the reason), cash in ±$10/±$50 steps (capped at that player's cash), and jail cards when held. Validation errors from the engine show inline and disable Propose.
- **Promises:** rent-free only (the generic `Promise` model is in the engine). Either side can promise; the property list is what that player will own after the trade. Turns 1–99. Badges show on the tile (ribbon decal) and in both player cards with the turns remaining.
- **Responding:** a human receiver sees "You get / You give" with Accept (Confirm), Counter (Trade button) and Reject (Back); a counter opens the same screen with the sides swapped and becomes the live offer the original proposer must answer. When the receiver is a bot, the proposer sees "Waiting for …" and can withdraw. Bots never counter; they accept only clearly favorable offers.
- **Bots proposing to humans:** a bot's set-completing offer appears as a normal offer to the human receiver.
- **Overlay state is not deep-reactive:** the game view uses `$state.raw` (the engine replaces state wholesale), which also avoids proxy cloning issues.

## Milestone 6 — rules editor and presets (2026-11-17)

- **Presets** live in IndexedDB (`src/storage/db.ts`, memory fallback when unavailable). "Classic" is built in and read-only (duplicate to edit). User presets: save (autosave on every change), rename, duplicate, delete, export/import JSON (`property-night/rules` format). Imports are normalized: missing settings come from Classic and every value is clamped to its range. A game copies its rules at the start, so editing a preset never changes a game in progress.
- **Editor** (from the setup screen, "Edit rules…"): every §5/§7 setting grouped by area; dependent fields appear only when relevant (custom amounts, pot seed, loan settings when loans are on). Supplies accept blank for unlimited.
- **Shortage auction (Classic default):** when a build would take one of the last houses (or hotels) and more players could build one than the bank has left, that building is auctioned among everyone who could build it. The requester bids for the tile they chose; others for their best eligible tile (largest rent jump). The winner pays the bid instead of the house cost and builds immediately; no bids means it stays in the bank. Bots value a scarce building at 1.4× its cost.
- **Speed die (off by default):** joins after a player's first lap. Faces 1–3 add to the move; triples (both white dice equal the speed face) move you to any space and end the turn; the bus lets you move by either white die or their sum; "Mr. Monopoly" moves you on after your landing resolves, to the next unowned property, else the next property where rent is due. Doubles still come from the two white dice. The speed die's face shows in the prompt and log; it is not a third 3D die yet.
- Every rules setting now has a test proving it changes behavior (`tests/engine/settings.test.ts` lists where each is covered). Loans settings are wired in M7.

## Milestone 7 — bank loans (2026-11-17)

- **Taking a loan:** on your own turn (pre-roll, buy decision, post-roll) from "Bank loans", or while raising money. Unsecured (if allowed) or secured by pledging properties (not mortgaged, not already pledged). Limits: collateral mode lends the collateral percentage of the pledged purchase prices; fixed-cap and net-worth modes lend up to the cap minus what the player already owes. Unsecured loans use the fixed cap (or the net-worth cap in that mode). The interest rate is fixed when the loan is taken.
- **Collateral option "100% of mortgage value":** expressed as 50% collateral value (the Classic mortgage value is half the price); a separate option was not added.
- **Repayment:** passing or landing on GO pays the salary first, then each loan's installment = ⌈principal ÷ passes left⌉ + ⌈remaining principal × rate⌉. Early payoff of any amount on your own turn; a zero balance closes the loan and unlocks its collateral.
- **Missed payment, secured:** all collateral is seized at once (buildings return to the bank), valued by the seizure setting; a surplus over the balance (principal + this installment's interest) is refunded, a shortfall is owed to the bank like rent. Seized deeds go to auction or back unowned per the setting.
- **Missed payment, unsecured:** that installment is owed to the bank like rent (raise money or go bankrupt); the loan's schedule moves on.
- **Pledged properties** show a padlock on the board and a LOAN tag in Manage; they still collect rent, can be built on (unless "No building while a loan is unpaid" is on, which blocks all building for a borrower), and cannot be traded or mortgaged.
- **Bankruptcy check counts borrowing:** "Declare bankruptcy" appears only when selling, mortgaging and the extra cash a loan could add would still not cover the debt.
- Bankruptcy and forfeit cancel loans; bank-backed and normal bots never borrow.

## Milestone 8 — board and card editors, board presets (2026-11-17)

- **Board presets** (IndexedDB) hold the board and both decks. "Classic board" is built in and read-only; user presets support duplicate, rename, delete, export/import JSON (`property-night/board`). The classic 40-tile layout and tile types are fixed (SPEC §8); everything printed or priced is editable: names, prices, rent tables, house costs, mortgage values, group colors (+ light/dark band text), railroad rents, utility multipliers, board title and subtitle.
- **Group scaling** is an action ("Scale 150% → Apply") that rewrites the group's prices, rents, house costs and mortgages, so per-tile overrides stay editable afterwards.
- **Validation** warns (does not block) on non-increasing rents, mortgage above price and duplicate names. Imports are normalized and clamped like rules presets.
- **Tax amounts** belong to the rules (§5), so the board editor only renames tax tiles. The printed board follows the game's rules: GO salary and tax lines ("Pay $200", "Pay 10%", or "$200 or 10%").
- **Cards:** text + one effect from the SPEC list; at most one Get Out of Jail Free card per deck (extra ones are dropped); an empty deck falls back to Classic. "Move to" card text can contain `{tile}`, which prints the target's current name, so renamed boards stay consistent (the default cards use it).
- **Texture regeneration:** the board face is redrawn at game start only when the printed board differs from the current texture (board preset or rules changed). It never redraws during play.

## Milestone 9 — saves, autosave, resume, undo, log (2026-11-17)

- **Save format** follows SPEC §12: `{ version, createdAt, rulesPreset (copy), boardPreset (copy), seats, seed, actions, snapshot, view: { cameraSide } }` plus a name and a one-line summary. The snapshot is the source of truth on load; the action list replays from the seed to the same snapshot (tested), so saves can be audited.
- **Autosave** after every action (debounced 250 ms so a burst of bot actions writes once) to the `autosave` record in IndexedDB. **Continue** on the main menu resumes it, unless that game is over. **Up to 10 named slots** from the pause menu ("Save game…"), loaded from the main menu; slots can be overwritten or deleted. **Export** downloads the save as JSON; **Import** validates the version and the game state's invariants before resuming.
- **Resume restores everything:** state (promises, loans, auctions and trades mid-flight), the action log, the seed, the camera side, controller bindings (by device id on the seats) and the board texture.
- **Undo** (setting, default on): reverts the last decision — buy, build, sell, mortgage, unmortgage, or a trade sent — until the next roll or card, or until another player acts (bots included), or the turn ends. Only the latest decision is undoable.
- **Main menu:** Continue, New game, Load game, Import save, Settings. Presets and controllers are on the new-game screen. "Quit to menu" in the pause menu replaces "New game" (the game is autosaved). Quitting clears tokens, decals and buildings from the board.
- **Game log:** the full log (newest first) is the read-only Select/L view from M4; the save keeps the last 200 lines plus the complete action list.

## Milestone 10 — bots in the lobby (2026-11-17)

- **Turn order** in the lobby is a two-way choice, **Random** (default, shuffled with the game seed) or **As listed**; "As listed" shows 1st/2nd/… and ▲/▼ buttons on each seat row to reorder.
- **Bot labels:** each Bot / Bank-backed seat shows a BOT / BANK badge and a one-line description of what it does. A still-default seat name follows its kind ("Player 2" → "Bot 2" → "Bank 2"); custom names are kept.
- **Lobby validation** adds one rule to the SPEC's (at least one human, no duplicate token/color): **at least two seats must be human or normal bots**. A human with only bank-backed bots would end instantly, since bank-backed bots are ignored by the win check. Empty names are also refused.
- **Every action gets a log line** (SPEC §3 "every bot action shows with … a log line"), for humans too so the log reads consistently: bids ("X bid $N"), passes, ending the turn, withdrawing a trade offer, and the received-mortgage choice were the gaps. The right panel shows the latest five lines while bots act.
- **Game-over wording:** 2+ humans — "{name} wins!" / "Last human standing" (noting that bots still in play do not count); 1 human — "{name} wins!" / "Every bot is out", or "The bots win" / "{name} went bankrupt"; all bots (review URL only) — "{name} wins!" / "Last player standing". The engine log names the human who lost in testing mode.

## Milestone 11 — polish (2026-11-17)

- **Sound is synthesized with WebAudio** (no audio files): dice clatter on each recorded physics contact (one knock at Instant speed), a soft tap per tile hopped (one tap on arrival at Instant), coin clinks on every payment (1–6 by amount), a papery swish when a card is drawn, a wood-block "tock" when a building is placed (lower when sold), and a short sting on each moment banner (rising for auction wins and full sets, falling for bankruptcy and seizures, SPEC §10.9). Background music is a quiet generative loop (F major, four chords, soft pad and sparse pentatonic plucks).
- **Volumes:** Volume (master), Music and Sound effects in the pause/settings menu as 0–100% selects in 10% steps (controller-friendly, like the other settings). The sliders use a squared curve; music sits at 35% of the effects level at equal settings. Audio stops while the page is hidden.
- **Autoplay:** browsers only start audio after a user gesture, so sound begins on the first key press, click or touch. A controller button also tries to start it, but Chrome may not count that as a gesture; one keypress or click (for example the Fullscreen button) is enough.
- **Stats history** is recorded in the game state (`history`): cash per seat at each turn start, thinned 2:1 whenever it passes 240 samples (so saves stay small), plus the final position; rent collected per tile. Player stats gained loans taken, amount borrowed and interest paid. Rent paid by a bank-backed bot now counts as rent received. Saves from before M11 are filled in with empty history on the next action.
- **Stats screen:** "Game stats" on the game-over banner (or Manage). Per player: rent received and paid, properties bought directly and at auction, loans (column shown only when anyone borrowed). Most profitable tile by rent collected. Money-over-time line chart in player colors (bank-backed bots left out: their money is unlimited).
- **Speed and reduce motion audit:** every queued animation (dice, hops, glides, buildings, cards, moments, camera turns and follow) scales with the speed setting and is skipped at Instant; bot pauses scale too. Reduce motion fixes the camera overhead (no rotation, follow, push-in or nudge) and keeps everything else, per SPEC §9. On first run, Reduce motion starts from the system "reduce motion" preference. The card flip (0.45 s) and the low-cash card shake are short CSS effects and are not scaled.
- **Performance:** render on demand was already in place (0 frames while idle). A worst-case board (every property owned, 4 houses or a hotel on every street, mortgages) draws 71–72 calls at High and Low (budget < 150). Startup to the interactive menu measured 1.28 s (Low) / 1.33 s (High) on the live production build with a cold cache (headless Chrome on the build machine). Auto quality now treats Intel Arc as discrete; its GPU-name rules are unit-tested.
- **PWA:** web app manifest (fullscreen, landscape, walnut theme color), a code-drawn icon (brass house and crescent moon on the forest green, rendered to PNG by `scripts/make-icons.mjs`), and a service worker: pages network-first with the cached shell as offline fallback, hashed assets/fonts/icons cache-first, and the page hands the worker every URL it loaded so the first visit is cached in full. Registered in production builds only.
- **Game-over panel** no longer shows the current tile under "X wins!".

## Alpha refinements: owner answers to the open questions (2026-11-18)

- *Superseded by Batch 3 (themed buildings, 2026-11-21).* **Houses** are 22% of the tile width: the widest four can be with small gaps (≈2.4 px of the 20.4 px slot pitch at print scale), with the outer houses still inside the tile edge. Hotels stay at 70%.
- **Board fit:** the rest camera now sizes the board so its widest projected edge stays 24 logical px clear of both side panels, and at most 88% of the screen height. At the 58° pitch the near edge is wider than the board is tall.
  - It's solved for the real window aspect and re-solved on resize (`CameraDirector.setViewport`; panel geometry in `src/ui/stage.ts`). One solve holds for all four rotations because the board is square.
  - Result: the board fills 77% of the height at 16:9 and 70% at 16:10, with 24 px clearance at every rotation.
  - Follow and push-in zooms stay relative to the new rest.
- **Graphics settings, independent of Quality:**
  - Ambient occlusion on/off: GTAO from three/examples, off by default. It adds a normal/depth pass, giving 109 draw calls on a worst-case board (budget 150). It's subtle on this scene: the board is flat and the soft shadows already darken contacts.
  - Brightness 70–130% (tone-mapping exposure).
  - Tone mapping: Filmic (ACES, the unchanged default) / AgX / Neutral.
  - There's no Bloom: SPEC §10.3 rules it out and it was never built. A washed-out look comes from tone mapping and exposure, which the two new settings address.
  - Token portraits stay on ACES (made once, UI images).
- **Bank-backed bots:** the `bankBotMode` rule (in the "Bank-backed bots" area of the rules editor) sets what happens after the first hotel a **human** builds. Direct builds and shortage-auction wins count; normal bots' hotels never do; only the first hotel counts.
  - `remove` (**Classic default**, an owner-approved change to SPEC §3): every bank-backed bot leaves the table (marked out, with `leftTable` set) with a banner and a log line. Play moves on even if it was the bot's turn. Its card reads "Left the table".
  - `cutoff`: the bank stops backing it. It gets the starting cash and keeps every other bank-bot limit: it never buys, bids, trades, borrows, draws cards, goes to jail or collects GO. Rent and tax come from its own cash. When it can't pay, it declares bankruptcy and the creditor gets what it has left. Its card shows its real cash instead of ∞.
  - `always`: the old behavior (unlimited money forever).
  - Games saved before the rule existed carry rules without it and play as `always`, so a resumed game never changes behavior.
  - The lobby's bank-bot hint follows the selected preset's mode.
- **Confirmed by the owner, unchanged:**
  - The medium bot keeps building hotels when very cash-rich or when the bank is out of houses.
  - The lobby still requires two seats that are humans or normal bots.
  - The speed die stays as text in the prompt and log (no 3D die).
- **Headless runs with humans:** `runHeadless(…, { humansAsBots: true })` lets human seats play the medium strategy, so the human-hotel trigger can be tested unattended. `tests/engine/bankBot.test.ts` runs 30 games per mode, with 0 illegal states.

## Batch 2: owner refinements (2026-11-18)

These change approved SPEC behavior at the owner's request.

- **Camera follows the token (SPEC §10.7 changed):** each turn the camera turns to the side the active player's token stands on (`sideOfTile`: 0–9 bottom, 10–19 left including jail, 20–29 top, 30–39 right). If the move ends on another side, it turns again once the token lands; it doesn't turn mid-move.
  - The seat's fixed `boardSide` no longer drives the camera; it stays in the state for save compatibility.
  - Dice are thrown from the side the camera faces.
  - Rotation off and reduce motion are unchanged.
- **Bills for every payment (SPEC §10.9 extended):** the engine now emits a payment event for every cash change. That adds purchases, auction wins, building, selling, mortgaging, unmortgaging, GO salary and bankruptcy liquidation. `tests/engine/payments.test.ts` checks conservation across full games.
  - Big payments keep the full moment.
  - Every other payment flies banknotes between the player tabs (the bank is the board center) and ticks the counters, with no banner or camera move: 0.7 s at factor 1, or 0.45 s for Manage actions so building several houses doesn't drag.
  - The counters hold the new balance until the shown state catches up.
  - Bank-backed bots' payments and bankruptcy hand-overs now show bills too, but never the banner.
  - Setting "Show bills for every payment" (default on).
- **SOLD signs:** a small yard sign stands 18 px past each owned tile's inner edge, in the board's center area, so it never covers the color band.
  - The panel is the owner's color, with a cream "SOLD" sticker on both faces.
  - Signs turn to face the camera like the tokens.
  - A sign pops up on purchase, dips and re-colors on a new owner, and sinks when the bank takes the property back.
  - Three instanced draw calls for all of them.
  - Far-row houses stay visible above the signs.
  - The owner disc is kept as a second cue (owner's choice).
- **Names under the color band:** like the real board, the band is a plain color block and the name prints centered just beneath it (SPEC §10.2 / `reference/board-face.html` changed). The band-text light/dark option still drives the deed cards. Tokens stay where they were (owner's choice), so a token can hide part of a name; the deed panel always shows it.
- **Card decks on the table:** Chance and Community Chest stacks lie on the printed outlines. Each is a layered card-stock body with the top card's back in the cards.html style; they're purely visual.
  - The dice physics treats the stacks as obstacles, so dice can bounce off or rest on a stack. The relabel and fairness tests still pass.
- **Slower speeds:** Relaxed (new, 0.45×), Normal (the old Slow, 0.6×), Fast (the old Normal, 1×), Instant. The old 2× Fast was dropped.
  - Bot pauses are 1.4 s / 1.1 s / 0.65 s.
  - The stored keys are unchanged (`slow` = Relaxed).
- **Fixed along the way (found by the new full-game tests):**
  - A bank-backed bot froze the game on a speed-die bus or triples choice. It now takes the first bus option, or stays put on triples.
  - With bank loans on, a normal bot in debt could never declare bankruptcy, because a loan it would never take counted as a way out, so the game froze. Normal bots never borrow (SPEC §3), so their borrowing capacity is now 0.
- **Performance:** worst-case board 93 draw calls (budget 150). Signs and decks cost about 2 fps on this machine's headless browser.

## Batch 4: benchmark, test board, performance overlay (owner request, 2026-11-21)

A way to check how the game runs on the TV PC without playing: a scripted benchmark with a results screen, a no-rules test board, and an optional frame-rate overlay. Spec: `docs/batch4/SPEC-benchmark.md`. Rules, bots, rule defaults and the save format are unchanged; normal play still renders 0 frames when idle.

- **Performance target (SPEC §10.10 changed):** on the TV PC the target is now a steady 120 fps at 3840 × 2160 on High when the display runs at 120 Hz; 60 fps stays the floor. This batch only measures against it; no rendering was changed to chase it.
- **Measurement:**
  - A frame is *late* when its interval is over 1.5 refresh periods (it missed a vsync). A phase *holds* a rate when at most 1% of its frames are late (p99 interval ≤ 1.5 periods). The same rule gives the 60 fps reference: frames over 25 ms.
  - "Unknown" bottleneck (GPU time unavailable): p99 interval over 1.5 periods.
  - Frame interval is the rAF delta of the render loop, so the first frame after an idle period isn't counted as a long frame.
  - The ring buffer holds 4,096 frames instead of ≈2,000, so a 12 s phase at 240 Hz fits.
  - The refresh rate is measured from 60 rAF intervals *before* the benchmark loads the GPU. Measured under load, a GPU-bound run would report a falsely low rate.
  - Instrumentation only runs while a capture is open or the overlay is on (one boolean check otherwise). `perf.mjs` measures the loop's CPU time with capture off / on / off: 3.57 / 3.23 / 3.51 ms, no measurable difference.
- **Benchmark scene and phases:**
  - The worst-case board alternates hotel / 4 houses **street by street within each group**, not group by group. Group by group would show each group's house *or* hotel design, never both.
  - Phase 1's "light ambient motion" is a slow seeded camera sway (the scene has no idle animation since Batch 3).
  - Phase 2 turns every 2 s. A turn at Normal speed takes 2.3 s (1.4 s ÷ the 0.6 speed factor), so the next turn starts just before the last one settles.
  - Phase 3 uses the game's follow zoom (`setFollow` on each group's middle street) with a small nudge sway.
  - Phase 4 sells street by street within each group's slot, then drops back in with the build bounce. A hotel comes back the way it's built in play: four houses, then the hotel drops in.
  - Phase 5 feeds the director hand-made `turnStarted` / `diceRolled` / `moved` / `payment` events against the benchmark state, so the real dice physics, hop, camera follow, push-in and payment moment run. The director got `reseed()` so every run throws identical dice. Moments show over the benchmark's own state (App renders the MomentLayer with it).
  - Phase 6 holds phase 3's costliest close-up still and renders it k times per displayed frame (`Renderer.setRenderMultiplier`). Draw calls are reported per single render.
  - Before the first capture, one sell fade per group runs uncaptured (warm-up). The first sell in a session compiles the transparent sell shader (≈330 ms here); without the warm-up only the first run would pay for it.
  - During the run, camera rotation and follow are forced on and reduce motion forced off, then restored. Otherwise the camera path would depend on settings.
  - The benchmark always uses the Classic board; the board face is regenerated if another preset was last shown.
- **Sell fades exceed the draw-call budget (existing, from Batch 3; not fixed here):** a full board is 122–128 draw calls at rest. One house sell adds ≈19 temporary draw calls and one hotel sell ≈39, so selling a hotel on a full board reaches ≈167. Each sell also costs a 30–80 ms frame (cloned materials) on the test machine's Iris Xe. The Construction wave shows this, peaking at ≈230–340 calls, so recommendation rule 8 ("a problem in the game") fires on every run. `bench.mjs` fails on ≥ 150 only in the steady phases and reports the wave peak. Fixing it (e.g. one merged fade mesh per finish, or keeping the fade materials alive) is a rendering change for a later batch.
- **Recommendations:**
  - Rule 2 (integrated GPU) fires when the renderer string looks integrated *and* a phase misses the display rate. The browser can't know whether a discrete GPU exists, so the wording is conditional.
  - Rule 5 is folded into 4b when both would fire (same advice).
  - Rule 6 needs every phase to hold the display rate with ≥ 2× spare (or headroom k ≥ 3).
  - Measured gains compare p99 GPU ms (or CPU/interval without a timer) in the worst phase.
- **History:** one `meta` record `benchmarks` with the 10 newest summaries. "Same configuration" for "last run" means the same mode, quality, AO, tone mapping and drawing-buffer size.
- **Layout:**
  - The overlay chip sits under the pause-menu button at top centre in every mode: in a game the context panel fills the top-right corner.
  - The Settings column scrolls (max 760 px) with the new Performance section at the bottom.
  - The benchmark panel follows the stats panel (1240 px wide for results, same type sizes). Pass/fail tags sit in the 1% low cell, one per target; at 60 Hz only one tag shows.
  - The test board uses two panels in the player-card and context-panel positions.
- **Test board controls:**
  - D-pad left/right selects the previous/next *property* (corners, cards and taxes are skipped: nothing on them can be edited). Up/down steps through both panels' controls in order.
  - Square/Y (B) adds and Triangle/X (V) removes a building; LB/RB (Q/E) rotate. Mouse clicks on the board select a property.
  - L1/R1 prompts use the lettered-disc style ("L1"/"R1", "L"/"R" on Nintendo). There is no approved symbol for them.
  - Any connected pad's right stick nudges the camera in the test board (`InputManager.nudgeAnyPad`); in games only bound pads nudge, as before.
  - The selected tile gets a thin cream ring (the decal print cream `#FBF6EA`) at the owner-disc spot, so unowned tiles show it too.
  - The test board starts on Empty with 2 tokens. Camera rotation/follow are forced on while it's open.
  - It never touches the game controller: `tests/bench/testBoard.test.ts` checks autosave, Continue and `onChange` are untouched.
- **Overlay:** "FPS" is 1000 ÷ the average frame interval over the last second. Outside the test board it never requests a frame and shows "idle" after 0.5 s without one.

## Batch 3: themed buildings (owner request, 2026-11-21)

Each color group gets its own house and hotel design, replacing the green and red boxes. The designs were approved in a separate 3D look test; this batch only integrates them. Spec: `docs/batch3/SPEC-buildings.md`.

| Group | House | Hotel |
| --- | --- | --- |
| brown | Cottage | Roadside Inn |
| lightBlue | Beach Bungalow | Seaside Hotel |
| pink | Painted Lady | The Rosemont |
| orange | Brownstone | Downtown Hotel |
| red | Alpine Chalet | Ski Lodge |
| yellow | Villa Mediterranea | Hotel Miramar |
| green | Georgian Manor | The Pacific |
| darkBlue | Modern Villa | Art Deco Tower |

- **Asset module:** `src/render/buildingModels.js` is the owner's `buildings.js`, copied byte for byte; the `three/addons/...` imports resolve, so no edit was needed. The game uses only `buildGameAssets`; types live in `buildingModels.d.ts`. Accents come from the board's group colors, so custom presets recolor the buildings (`Buildings.setBoard` rebuilds and re-places everything without animation).
- **Scale:** 0.016 board units per model unit, uniform, houses and hotels alike. Widest house (Modern Villa) 0.0198 against the 0.0204 slot pitch; deepest design (Ski Lodge) 0.0215 against the 0.038 band. Hotels come out at about 29–36% of the tile width instead of the old 70%: that is the owner-approved house-to-hotel proportion from the look test.
- **Rendering:** one `BatchedMesh` per finish (18), each sized for 5 × street tiles. A building is one instance in every batch its design uses. `glass`, `railing` and `print` cast no shadow. Drops animate the instance matrices; the sell fade uses temporary meshes sharing the part geometry with transparent clones of the finish materials.
- **Idle animations frozen:** the flags, bell, marquee lights and beacon from the look test stay in their rest pose, so rendering stays on demand (0 idle frames).
- **Judgment calls:**
  - The spec moved, unchanged, to `docs/batch3/SPEC-buildings.md`.
  - `Buildings.designSizes()` (read-only) was added for the batch3 fit check.
  - The sell-fade meshes cast shadows by their finish's rule.
  - `perf.mjs` takes `PN_AO=1/0`; `batch3.mjs` gives every group one hotel on the full board (pink and green have no `i % 3 === 0` street).
- **Performance (worst-case board, headless Chrome on this machine):**
  - AO off: 122 draw calls at High and 123 at Low (budget 150); 0 idle frames in 2 s.
  - AO on (High): **247 draw calls, over budget.** Hiding all buildings still gives 181: the GTAO normal pass redraws the whole scene, and the board was already over 150 with AO on after Batch 2 (signs, decks), which only measured AO off. The buildings add 33 calls with AO off and about 66 with AO on. The owner accepted this on 2026-11-21. AO is off by default.
  - `buildingsMs` (the `buildGameAssets` call): 360–680 ms across runs, on a noisy headless machine. The build is not deferred; the owner can ask for that if startup feels slow.

## Batch 5: Pink/Yellow swap (owner request, 2026-11-22)

The Pink and Yellow color groups trade places on the board. Spec: `docs/batch5/SPEC-color-swap.md`.

| Index | Name now → new | Group now → new | Price (unchanged) |
| --- | --- | --- | --- |
| 11 | Rose Court → Goldfinch Lane | pink → yellow | 140 |
| 13 | Peony Place → Honey Street | pink → yellow | 140 |
| 14 | Rosewood Lane → Buttercup Row | pink → yellow | 160 |
| 26 | Goldfinch Lane → Rose Court | yellow → pink | 260 |
| 27 | Honey Street → Peony Place | yellow → pink | 260 |
| 29 | Buttercup Row → Rosewood Lane | yellow → pink | 280 |

- **Colors:** yellow is now mustard `#D4A72C` and pink is bubblegum `#F569D7`, both with dark text. No other group changes. *(Superseded by Stage 1 §4 below: yellow `#E3BC2A`, orange `#DC5A00`.)* Board-order group lists (`CLASSIC_GROUPS` keys, `GROUP_ORDER`, `GROUP_IDS`, the batch3 plan's `GROUPS`) now run brown, light blue, yellow, orange, red, pink, green, dark blue. The group ids and labels are unchanged.
- **Prices stay with position, names travel with the group:** the cheaper second-row set (Yellow) keeps the old pink prices, rents and $100 houses. The third-row set (Pink) keeps the old yellow prices, rents and $150 houses.
- **Cards stay position-based:** "Stroll down to {tile}" still moves to tile 11 and now reads "Goldfinch Lane". No card target changed.
- **Buildings follow the group:** Villa Mediterranea / Hotel Miramar now stand on tiles 11/13/14, and the Painted Lady / The Rosemont on tiles 26/27/29, in the new colors. Designs, scale and rendering are unchanged.
- **Data wipe:** `src/storage/migrations.ts` runs at startup right after the KV store opens. If `meta/dataVersion` is missing or below 2, it deletes every save (autosave included) and every user board preset, then writes `dataVersion` 2. Rules presets, settings, input bindings and benchmark history stay. A failed wipe is logged and startup continues. `SAVE_VERSION` is now 2, so exported save files from before this change are rejected on import ("Unsupported save version 1."). There is no converter.
- **Judgment calls:**
  - `kv` was added to the `window.__pn` debug object so `batch5.mjs` can check the migration through the app's KV.
  - Board-preset export files (`property-night/board` version 1) still import: they are self-contained boards, and the spec wipes only stored presets.
  - The comment in `batch3.mjs` now says yellow and green have no `i % 3 === 0` street (pink has tile 27). The Batch 3 note above stays as written.
  - No "Victorian = mid-low tier" note existed in this file, so nothing was marked superseded.
  - The spec moved, unchanged, to `docs/batch5/SPEC-color-swap.md`.

## Stage 1 §4: tile colors (owner request, 2026-11-22)

Orange becomes Tennessee Vols orange and the mustard set moves toward yellow so the two left-side sets can't be confused. Spec: `docs/property-night-stage1-spec.md` §4.

- **Final values (single source, `CLASSIC_GROUPS` in `src/data/classicBoard.ts`):** orange **`#DC5A00`**, yellow (mustard) **`#E3BC2A`**, both with dark text. Bands, deeds, chips and the themed buildings all read from there; the `SETS` fallback accents in `buildingModels.js` match.
- **Why orange isn't `#FF8200` in code:** the spec judges the color as rendered. Under the default ACES tone mapping and current lighting, a `#FF8200` band shows on screen as about `#FFC260` (light amber, right next to the mustard). `#DC5A00` shows as about `#FD9A49`, which reads as Vols orange. Measured from the canvas on the left side at default settings:

  | Source hex | ACES (default) | AgX | Neutral |
  | --- | --- | --- | --- |
  | old orange `#F7941D` | `#FACC6D` | `#E5B382` | `#FA9C5D` |
  | old mustard `#D4A72C` | `#EED476` | `#D6B880` | `#F6B846` |
  | orange `#FF8200` (spec start) | `#FFC260` | `#EAAC7E` | `#FA9161` |
  | **orange `#DC5A00`** | **`#FD9A49`** | `#E2936D` | `#F77246` |
  | **mustard `#E3BC2A`** | **`#F1DD81`** | `#DBC288` | `#F8C451` |

- **Trade-off:** the flat UI (deed headers, chips) shows the source hex unlit, so there the orange is a deeper, slightly burnt orange. Dark text stays legible on it. The mustard stays at the spec's starting point: once orange moved, no further push toward yellow was needed.
- **Data wipe:** `DATA_VERSION` is 3. Saves and user board presets carry the old hexes, so they are wiped once more, the same way as Batch 5. `SAVE_VERSION` stays 2, so an exported save file from before this change still imports, with its old colors.

## Stage 2: close-up follow camera (owner request, 2026-11-22)

A new default camera style, Close-up, built from shots (Home, Dice, Chase, Landed, handoff) with critically damped smoothing; Table keeps the old camera exactly. Spec: `docs/stage2/SPEC-closeup-camera.md`. Render checks, screenshots, laptop benchmark numbers and the OUTPOST checklist: `docs/stage2/report.md`.

- **Table is verbatim:** the old camera math runs unchanged for Table style and Reduce motion. `tests/cameraTableGolden.test.ts` replays a scripted call sequence against poses recorded from the pre-Stage-2 code (`tests/fixtures/camera-table-golden.json`, 1e-9).
- **Smoothing:** every parameter uses SmoothDamp-style critically damped springs with smooth times in seconds at speed factor 1, divided by the speed factor, the same basis as the Table side turn (1.4 s at factor 1, so ≈ 2.3 s at Normal). `handoffSmooth` 0.42 arrives (99%) in ≈ 1.4 s at factor 1. Instant snaps; skip snaps the queue's camera items and also any close-up move still easing (`settle()`).
- **Side yaw vs shot yaw:** the old eased side turn now drives the light rig in both styles; in Close-up it never includes the shot's yaw offset or the orbit. `camera.side` switches when the token lands, as before.
- **Framing:** a general solver (`src/render/framing.ts`) fits board points (each framed tile's corners plus its band raised to the tallest building, 0.0425 measured from the designs at startup) into the safe area and centers them there. Streets frame their color group; corners and jail frame the corner plus the first tile of each neighbouring side; **other tiles** (railroads, utilities, taxes, Chance, Chest), which the spec doesn't cover, frame themselves and both neighbours.
- **Safe area:** between the panels (`boardMaxNdcX`), below a 230 px banner zone (moment banners start at 120 px and are ≈ 110 px tall) and above a 48 px bottom margin, in the 1920 × 1080 stage.
- **Chase framing:** with the spec's starting numbers (40° yaw offset, 1.5-tile look-ahead, 0.30 distance) the token sat on the right panel's edge. The aim point keeps its look-ahead depth but slides sideways until the token is centered between the panels, then backs off only if the whole token still doesn't fit. While moving, the camera trails the token, so a **leash** slides the current focus just enough to keep the whole token inside the safe area (tested every frame over a 40-hop lap, both directions, all hotels).
- **Chase start:** the swing from the Dice shot into the chase runs at the shot pace and tightens to the chase trail over about one hop, so the first move into the 40° offset stays under 3°/frame like the corners. `chaseSmooth` is 0.2 (0.16 broke the 3°/frame corner limit).
- **Corner blend** depends only on the token's ring position (s from 10k − 1 to 10k + 1), so it plays the same forwards and backwards.
- **Dice shot:** if the 0.9 zoom would put the active token off screen (corners), the zoom backs off in 0.01 steps until it fits. Its test checks the dice area and token against the screen between the panels, not the banner zone (it is a whole-board view).
- **Glides** pull back to the Table rest view on the current side (blocking until 90% there), glide without a chase, then ease to the Landed framing of the destination.
- **Clipping guard:** below 0.04 or inside a building / token / deck / die box, the pitch rises 1° at a time. In practice no shot triggers it; the tests keep it honest on an all-hotels board.
- **Near plane:** stays 0.05 (the closest shot is ≈ 0.16 above the board and ≥ 0.30 from its focus).
- **Shadows:** unchanged. They look soft at 4K on both qualities, and in Close-up the shadow camera moves only with the light rig, so nothing swims.
- **Board texture:** unchanged (8192 High / 4096 Low); text is crisp at 4K on High and readable on Low.
- **Peek** works while a game or the test board is on screen, menus included; it is ignored under Reduce motion. Changing Camera style or Reduce motion mid-game snaps the camera to the active seat's view. R2 / ZR is a new held `Logical` (`r2`, standard b7, raw Switch Pro b7, analog past halfway), added to the remap order. Saved custom remaps from before have no R2 until redone.
- **Controls list (owner decision):** a small Controls block in the in-game pause menu (Nudge camera, Hold to peek) with lettered discs (`RS`, `R2`/`ZR`), plus README rows.
- **Settings UI:** Board rotation and Camera follow are hidden unless Table is selected (the spec allowed hidden or dimmed; hidden keeps focus simple).
- **Benchmark:** forces Close-up and restores the player's settings. Phase 3 uses the Landed framing; phase 5 adds the handoff and runs 14 s (Standard ≈ 65 s), so its numbers aren't directly comparable with older runs. The whole-board phases (1, 2, 4) show the Table rest view as a shot, so they stay comparable.
- **Test board** stays in Table style (its Close-up toggle is the old follow zoom) unless the Camera panel is on.
- **Open:** the active token hides part of the landed property's name in Home / Landed shots from any outside-the-edge angle at couch height. Left as is pending the owner's call (options in the report).
