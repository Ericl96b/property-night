# Couch Monopoly — Build Spec v2.0

**Date:** 2026-11-17 · **Supersedes:** Build Spec v1.0 (rules and systems carried over unchanged unless noted; presentation rewritten for real-time 3D).

A casual, polished, couch-play property-trading game for one Windows PC on a 4K TV. Two players use their own controllers. Every rule is a setting, every setting defaults to the official Hasbro rules, and the board is a real-time 3D tabletop scene rendered with Three.js.

---

## 0. How to use this document (implementer instructions)

- Build in the milestone order in §14. **Milestone 0 is a visual prototype that must be approved by the owner before any other work starts.**
- Do not change rule defaults, button layout, screen layouts, palette, fonts or the art direction without asking. Propose changes as a list instead.
- Where this spec is silent, follow the official Hasbro rules and record the decision in `DECISIONS.md`.
- The `assets/` and `reference/` folders shipped with this spec are the approved visual language. Match them. Where a reference file shows a texture, shadow or house sprite, ignore it: those are replaced by the 3D treatment in §10.
- Keep the rules engine free of rendering code. The 3D layer only consumes engine events.

### Handoff folder

| Path | What it is |
| --- | --- |
| `SPEC.md` | This document |
| `assets/symbols/*.svg` | Approved symbol set (board spaces, UI icons, controller prompts). Use as-is. |
| `assets/token-reference/*.svg` | 2D reference art for the 9 tokens. Shape and proportion reference for the 3D builds in §10.4, not for direct use. |
| `reference/board-face.html` | Approved print layout of the board face (names inside color bands, real per-side orientation, diagonal corners, center emblem, card spaces). The 3D board texture in §10.2 must reproduce this layout. |
| `reference/cards.html` | Approved title deed, railroad deed, utility deed, mortgaged back, Chance and Community Chest card designs. |
| `reference/bills.html` | Approved banknote designs ($1–$500) used in payment animations. |

Open the reference HTML files in Chrome; they load fonts from Google Fonts.

---

## 1. Goals and non-goals

**Goals**

- Plays like a finished console board game: the game handles money, dice, movement and bookkeeping.
- Real depth: a lit 3D table and board, brass tokens, physical houses and hotels, tumbling dice.
- Full rules control: every rule is a setting, with savable presets. Default preset = official rules.
- Two humans on one screen with their own controllers (PS4 via DS4Windows, Nintendo Switch Pro over Bluetooth).
- Classic board layout and classic color groups; property names are user-entered.
- Native 4K with a working scale-down path for a 1080p laptop.
- Save and resume any game.

**Non-goals (v1)**

- Online multiplayer, phones as controllers, hidden information.
- An animated 3D city or "living board". The board is a classic printed board on a table.
- Strong AI. Bots are one fixed "medium" level.
- Hasbro logos, artwork, card text or trademarked property names.

---

## 2. Platform and stack

| Layer | Choice |
| --- | --- |
| Language / build | TypeScript, Vite |
| 3D | Three.js (WebGL2), `three/examples` helpers allowed (RoundedBoxGeometry, RoomEnvironment, SVGLoader) |
| Physics (dice only) | cannon-es, used off-screen only (§11) |
| UI | HTML/CSS overlay above the WebGL canvas. Plain DOM or Svelte; state the choice in the README. |
| Fonts | Fraunces (display, numbers) and Source Sans 3 (UI). Both SIL OFL. **Self-host the woff2 files** so the app works offline and the board texture can be drawn with them. |
| Target | Chrome or Edge on Windows, fullscreen, 3840×2160 and 1920×1080 |
| Hosting | GitHub Pages over HTTPS, installable as a PWA. Local dev on `localhost`. |
| Data | IndexedDB in the browser. JSON export/import for saves and presets. No backend. |

---

## 3. Players, bots and winning

**Seats**

- 2–6 seats. Each seat is Human, Bot, or Bank-backed bot. At least one human.
- Each human seat is bound to a controller (§4); two humans may share one controller.
- Turn order: random by default, or set in the lobby.
- Each seat picks a token (§10.4) and a player color. No duplicates.

**Normal bot**

- Plays by exactly the same rules as a human under the active preset, and can win.
- One difficulty, "medium": buys most properties, prioritizes completing sets, builds to 3 houses when cash allows, keeps a cash reserve, accepts clearly favorable trades, bids up to a value estimate. Normal bots do not take bank loans in v1.
- Every bot action shows with a short pause and a log line. Pause length follows the speed setting.

**Bank-backed bot** (one bundled behavior)

- Unlimited money: every payment it owes is drawn from the bank. Never goes bankrupt.
- Never buys. Any unowned property it lands on goes straight to auction among the other players; it does not bid.
- Never trades, never draws cards (card spaces do nothing), never goes to jail.
- Owns nothing and collects nothing. Cannot win and is ignored by the win check.

**Winning and forfeit**

- With 2+ humans, the game ends the moment only one human is left; that human wins, even if normal bots remain.
- With 1 human (testing), the human wins by being the last non-bank-backed seat and loses on bankruptcy.
- Forfeit: any human can forfeit at any time from the pause menu, with a confirm step. Treated as bankruptcy to the bank: cash returns to the bank, buildings sold back, loans cleared, properties auctioned one by one (or returned unowned if auctions are off).

---

## 4. Controllers

Each human seat owns one controller. The whole game is playable with controllers only; mouse and keyboard always work as a fallback.

**Supported devices**

- PS4 DualShock 4 via DS4Windows over Bluetooth (appears as a virtual Xbox 360 controller).
- Nintendo Switch Pro Controller over Bluetooth, read directly by Chrome/Edge.
- Any `standard`-mapping pad (Xbox etc.) as a bonus.

**Pitfalls to handle**

- Double input from DS4Windows: the assignment screen lists every detected pad by id; the user binds one. Help text: enable "Hide DS4 Controller" in DS4Windows (or HidHide).
- Steam Input can capture controllers. Help text: close Steam or disable Steam Input for the browser.
- Non-standard mapping: built-in table for Switch Pro ids; otherwise a "press each button" remap screen, stored per device id.
- Disconnects pause the game ("Player 2: reconnect controller") and rebind automatically when the same id returns.

**Assignment and ownership**

- Lobby: "Press any button to join" binds the pad to the next human seat; the seat card shows the controller type.
- Bindings are remembered by device id and restored on resume.
- Normal play: only the active player's controller acts; others can open read-only views.
- Auctions: every human controller is live at once. Trades: proposer edits, receiver accepts/rejects/counters. Pause: any controller.

**Button layout (by position)**

| Position | Action | PS4 | Switch Pro |
| --- | --- | --- | --- |
| Bottom face | Confirm / Roll | Cross | B |
| Right face | Back / Cancel | Circle | A |
| Left face | Manage (build, mortgage, sell) | Square | Y |
| Top face | Trade | Triangle | X |
| L1 / R1 | Cycle selection, bid increment | L1 / R1 | L / R |
| D-pad / left stick | Navigate | — | — |
| Right stick | Nudge camera (returns when released) | — | — |
| Start | Pause menu | Options | + |
| Select | Game log | Share | − |

On-screen prompts use the acting controller's glyphs (`assets/symbols/button-*.svg`). A setting swaps Confirm/Back for Nintendo pads.

---

## 5. Rules settings

Each row is a setting in the rules editor. The Default column is the built-in read-only "Classic" preset (current official rules).

| Area | Setting | Default (official) | Options |
| --- | --- | --- | --- |
| Money | Starting cash | $1,500 | Presets $1,000 / $1,500 / $2,000 / $2,500 / $5,000, or any exact amount ($0–$1,000,000) |
| Money | GO salary | $200 | Any amount |
| Money | Landing exactly on GO | Normal salary | Normal / double / custom |
| Money | Income Tax | $200 flat | Flat / % of net worth / player chooses lower |
| Money | Luxury Tax | $100 | Any amount |
| Buying | Declined property | Auction | Auction / stays unowned |
| Buying | Auction-only mode | Off | On: every unowned property landed on is auctioned |
| Buying | Auction start bid | $1 | $1 / 10% of price / 50% of price / custom |
| Buying | Auction timer | 8 s, resets on each bid | Off (pass to exit) / 3–30 s |
| Building | Even building | On | On / off |
| Building | Building supply | 32 houses, 12 hotels | Custom / unlimited |
| Building | Shortage handling | Auction scarce buildings | Auction / first come |
| Building | When you can build | Any legal time | Any time / own turn only |
| Building | Build on a set with a mortgaged lot | Not allowed | Allowed / not allowed |
| Building | Sell-back value | 50% of cost | 0–100% |
| Rent | Collect rent while in jail | On | On / off |
| Rent | Unimproved full set | 2× | 1× / 2× / custom |
| Jail | Fine | $50 | Any amount |
| Jail | Max turns in jail | 3 (then pay and move) | 1–5 |
| Jail | Doubles release you | On | On / off |
| Jail | Three doubles sends you to jail | On | On / off |
| Free Parking | Behavior | Nothing | Nothing / pot of taxes and fines / pot + seed / fixed bonus |
| Mortgage | Mortgage value | 50% of price | 0–100% |
| Mortgage | Unmortgage interest | 10% | 0–100% |
| Mortgage | Receiving a mortgaged property | Pay 10% now, unmortgage now or later | Same / free transfer |
| Dice | Speed die | Off | On / off |
| Dice | Doubles grant another roll | On | On / off |
| Trading | Trading allowed | On | On / off |
| Trading | Promises in trades | On | On / off |
| Loans | Bank loans | Off | On / off + §7 settings |
| Bankruptcy | Owed to the bank | Property auctioned | Auctioned / returned unowned |

Fixed rules: rent is collected automatically; Get Out of Jail Free cards can be traded or sold; bankruptcy to a player transfers everything to that player.

---

## 6. Auctions and trading

**Auctions (open bidding, no hidden bids)**

- Full-screen auction panel over a dimmed scene: property card, current high bid and bidder, each seat's cash, countdown ring.
- Every human controller is live: L1/R1 picks an increment (+$1, +$10, +$50, +$100), Confirm raises, Back passes.
- Bids are capped at the bidder's current cash.
- Ends when the timer runs out after the last bid, or when everyone but the high bidder has passed. No bids = stays unowned.
- Bots bid with a short delay so humans can react.

**Trades**

- Proposed on your own turn with the Trade button; the other side responds with their controller.
- Two columns: properties, cash, Get Out of Jail Free cards and promises on each side.
- Properties with buildings cannot be traded (greyed out with the reason). Mortgaged properties can; the receiver gets the 10% prompt.
- Receiver: Accept / Reject / Counter (counter opens the same screen with sides swapped).
- Cash is allowed in trades. Player-to-player loans are not.

**Promises (enforced by the game)**

- Rent-free: "A pays no rent to B on [tile] for the next N of A's turns", N = 1–99. Badge on the tile and in both player panels with turns remaining.
- Void if the tile changes owner. Must be attached to a trade.
- Generic model `Promise { kind, from, to, tileId?, turnsLeft }` for future kinds.

---

## 7. Bank loans

Borrow from the bank on your own turn, secured by pledged properties or unsecured. Repayment is automatic at GO; early payoff any time on your turn.

| Setting (shown only when loans are On) | Default | Options |
| --- | --- | --- |
| Loan limit mode | Collateral-based | Collateral-based / fixed cap / % of net worth |
| Collateral loan value | 75% of pledged purchase price | 10–100% of price, or 100% of mortgage value |
| Fixed cap | $1,000 | Any amount |
| % of net worth cap | 50% | 10–100% |
| Allow unsecured loans | On | On / off (unsecured uses the fixed or net-worth cap) |
| Max active loans per player | 1 | 1–5 |
| Interest per GO pass | 10% of remaining principal | 0% (interest-free) to 50% |
| Loan term | Player chooses 3–10 GO passes | Min and max settable |
| No building while a loan is unpaid | Off | On / off |
| Collateral seizure value | Purchase price + building sell-back value | Purchase price / mortgage value (+ buildings) |
| Seized property goes to | Auction | Auction / unowned |

- **Taking a loan:** Manage menu, choose secured or unsecured, pick collateral, amount, term. Preview shows the schedule and total interest. Pledged properties show a lock badge, still collect rent, can be built on (unless the no-build rule is on), cannot be traded, sold or mortgaged. Mortgaged properties cannot be pledged.
- **Repayment:** passing or landing on GO pays salary first, then takes the installment = principal ÷ remaining passes + interest on remaining principal. Early payoff of any amount on your own turn; zero balance closes the loan and unlocks collateral.
- **Missed payment (secured):** the bank seizes all collateral for that loan immediately. If seizure value exceeds the remaining balance (principal + this installment's interest), the bank pays the difference. A shortfall is owed to the bank like unpaid rent.
- **Missed payment (unsecured):** the installment is owed to the bank like unpaid rent.
- Bankruptcy or forfeit cancels loans; pledged properties follow the normal bankruptcy path. Bank-backed bots never borrow.

---

## 8. Board, cards and presets

**Board data**

- Classic 40-tile layout and positions; 22 streets in 8 classic color groups (brown #955436, light blue #AAE0FA, yellow #E3BC2A, orange #DC5A00, red #ED1B24, pink #F569D7, green #1FB25A, dark blue #0072BB), 4 railroads, 2 utilities, 2 taxes, 3 + 3 card spaces, 4 corners.
- Prices, rent tables, house costs, mortgage values, railroad rents (25/50/100/200) and utility multipliers (4×/10×) default to standard US values.
- Default names are placeholders; the user's own board preset is the expected normal use. The reference files use stand-in names (Hazel Lane … Midnight Park).

**Board editor:** per tile name, price, rent table, house cost, mortgage value; per group scaling (+ overrides); railroad and utility values; tax amounts; group colors default classic with a color picker. Validation warns on non-increasing rents.

**Card editor:** Chance and Community Chest default to 16 cards each with original wording (never Hasbro's text). Each card = text + one effect: collect $X, pay $X, collect from each player, pay each player, move to tile, nearest railroad (pay 2×), nearest utility (pay 10× dice), back N spaces, go to jail, get out of jail free, pay per house/hotel.

**Presets:** rules presets and board presets (board + cards) saved separately, picked in the lobby. Built-in "Classic" presets are read-only (duplicate to edit). Save, rename, duplicate, delete, export/import JSON. A game in progress keeps its own copy, so editing a preset never changes a saved game. **Changing a board preset regenerates the board texture (§10.2).**

---

## 9. Turn flow, screens and ease of use

Every roll and every turn end is a deliberate button press (no auto-roll). Everything else is automatic.

**Turn flow**

1. Turn start: camera rotates to the active player's side (§10.7). In jail: Pay fine / Use card / Roll for doubles.
2. Before rolling: Manage, Trade, Loan available.
3. Roll (Confirm): dice tumble (§11), token hops tile by tile.
4. Resolve the landing: buy prompt or auction, rent paid (with the payment moment §10.9 for large amounts), card drawn and shown, tax paid.
5. Doubles: roll again (three doubles = jail, per setting).
6. After resolving: Manage, Trade, Loan, then End Turn.

**Raise money flow:** when a player owes more than their cash, a blocking panel shows the amount and everything they can do (sell buildings, mortgage, trade, loan if allowed). "Declare bankruptcy" appears only when nothing can cover the debt, or as forfeit with confirm.

**Screens:** main menu (Continue, New game, Load, Presets, Controllers, Settings); lobby (seats, token, color, controller, presets, turn order); game; property card view; Manage; pause (resume, save, rules reference, settings, forfeit, quit); end of game + stats.

**Ease of use**

- Speed: Slow / Normal / Fast / Instant (animations, camera moves, bot pauses).
- Undo: last decision (buy, build, mortgage, trade sent) until the next roll or card, if no other player has acted. Setting, default on.
- Game log (newest first). End-of-game stats: rent paid/received, most profitable tile, money-over-time line chart, auction vs direct purchases, loans.
- Sound: dice clatter, token tap, coins, card flip, building place, light background music. Separate volume sliders.
- Reduce motion setting: disables camera follow and rotation (fixed overhead view), keeps everything else.

**Save and resume:** autosave after every action to IndexedDB; up to 10 named slots; Continue restores everything including camera side, promises, loans and controller bindings; export/import JSON.

---

## 10. Visual design (3D)

**Direction: "Warm tabletop."** A printed board lying on a walnut table under a warm lamp, brass tokens, lacquered wooden houses, ivory dice. Interface panels feel like printed card stock but stay as crisp 2D overlays.

### 10.1 Palette and type

| Token | Value | Use |
| --- | --- | --- |
| `ink` | #2B2119 | Board print, text on paper |
| `ink-2` | #5E4C3B | Secondary text |
| `paper` | #F3EAD6 | Board face base |
| `paper-hi` | #FBF6EA | Cards, panels |
| `oxblood` | #8E2F23 | GO, Chance, warnings |
| `forest` | #2F5D46 | Community Chest, primary buttons |
| `brass` | #C39445 (range #FFF3C9 → #5E4115) | Tokens, controller coins |
| `walnut` | #6A4330 | Table |
| Player colors | #7B3FE4, #0F9C84, #C0582B, #5B6472, + 2 more distinct hues | Enamel rings, owner pips, panel accents |

Fraunces for names, headings and money amounts (use the optical-size axis: `opsz` 9–12 on the board, 36–144 for headings). Source Sans 3 for UI text. Board band text is ink on all groups except brown and dark blue (light text).

### 10.2 Table and board

- **Table:** large plane with a procedural walnut material: horizontal grain, plank seams, slight tone variation per plank. Generate the albedo once at startup into a canvas (fractal noise stretched along the grain, mapped to a walnut ramp, plank seams drawn on top) and use it as the color map, with a matching low-contrast roughness map. Satin finish (roughness ≈ 0.45). This look was approved; keep it.
- **Board object:** a thin box, 1.0 × 1.0 units, 0.012 thick, slightly beveled edges. Side faces show layered card-stock edge (cream with a darker lamination line). Cast and receive shadows.
- **Board face texture:** generated at runtime from the active board preset into a canvas, then used as the top face's color map. It must reproduce `reference/board-face.html` exactly in layout:
  - property names inside the color band, all text oriented to its own edge (bottom row upright, left column rotated 90°, top row 180°, right column −90°), corners diagonal;
  - prices at the outer edge, symbols from `assets/symbols/`, card spaces and emblem in the center.
  - Size: 8192 × 8192 on High quality, 4096 × 4096 on Low. Mipmaps on, anisotropic filtering at the GPU maximum, `SRGBColorSpace`.
  - Draw with the Canvas 2D API after `document.fonts.ready` using the self-hosted fonts. SVG symbols are drawn as images; the `chance.svg` question mark uses Fraunces text, so convert it to a path (or draw it with Canvas text) because SVG images cannot use web fonts.
  - Regenerate when the board preset changes. Never at runtime during play.
- **No fake paper grain.** The approved fix for the "artificial" texture complaint: the board face is clean print. Realism comes from lighting (§10.3), a very low-contrast large-scale roughness variation (one map across the whole board, not per tile), and slight satin sheen (roughness ≈ 0.6). Cards and panels in the HTML overlay also have no grain.
- Ownership and state on the board: owner = small enamel disc in the player's color set into the tile's outer edge; mortgaged = the tile's print desaturated plus a small oxblood "M" stamp decal; promise = small ribbon decal. These are 3D decals or thin meshes on the board, not texture redraws.

### 10.3 Lighting and rendering

- Warm key light: `DirectionalLight` (≈ 3200 K tint, #FFD9A8) from above-front-left, soft shadows (`PCFSoftShadowMap`, 4096 map on High, 2048 on Low), shadow camera fitted tightly to the board.
- Fill: `HemisphereLight` warm-top / dark-wood-bottom at low intensity.
- Reflections for brass: `PMREMGenerator` + `RoomEnvironment` (procedural, no HDR files), environment intensity ≈ 0.6.
- Subtle lamp pool: a large soft radial falloff on the table (spot light or a baked gradient in the table albedo) so edges of the table fall into shadow. Screen-space vignette in CSS.
- Tone mapping ACES Filmic or AgX, output sRGB. Antialiasing: MSAA 4× on the render target on High, FXAA or none on Low.
- Optional on High: ambient occlusion (N8AO or SSAO) at low strength for contact shadows under tokens and houses. No bloom, no depth of field.
- Light rig and camera rig rotate together (§10.7), so the board looks identical from every player's side.

### 10.4 Tokens (code-built)

Nine tokens: teacup, key, bicycle, cat, rocket, crown, sailboat, umbrella, gramophone. Use `assets/token-reference/*.svg` for silhouette and proportion. All are built in code, no external model files.

- **Common base:** every token stands on a turned brass base (`LatheGeometry`: short cylinder with a rounded top lip, ≈ 0.030 diameter, 0.006 tall) with an inset enamel ring in the player's color (separate thin torus or ring mesh, glossy, roughness 0.2).
- **Turned / assembled tokens:**
  - Teacup: lathe cup + lathe saucer + torus-segment handle.
  - Rocket: lathe body + three extruded fins + inset dark glass porthole.
  - Umbrella: lathe canopy with a scalloped rim (modulate the lathe profile), thin cylinder shaft, torus-segment handle hook.
  - Crown: lathe band + five extruded points (alternating heights) with small spheres on the tips, three enamel "jewels" (red, green, blue) on the band.
- **Medallion tokens** (die-cut brass silhouettes, standing upright on the base): key, bicycle, cat, sailboat, gramophone. Each is a filled 2D outline (derive one clean outer path from the reference art; inner cut-outs as holes, e.g. wheel spokes, key bow, gramophone horn mouth) extruded with `ExtrudeGeometry` (depth ≈ 0.004, bevel size ≈ 0.0008, 3 bevel segments). A shallow engraved inner line (second, slightly inset extrusion or normal map) gives face detail.
- **Material:** `MeshPhysicalMaterial`, brass color #C9A055, metalness 1.0, roughness 0.28, clearcoat 0.3. Slight per-token roughness variation is fine.
- **Size:** token height ≈ 0.045 board units (about 60% of a tile's depth). Tokens always face the camera's yaw (rotate around their vertical axis toward the active view) so medallions read clearly.
- **Placement:** in the tile body (not on the color band). Multiple tokens on one tile fan out in a small arc. Jail: inside the jail square or along the Just Visiting edge.
- **Movement:** hop tile to tile (arc ≈ 0.02 high, 140 ms per tile at Normal speed), small settle bounce on landing, faint tap sound per tile.

### 10.5 Houses and hotels

Fixes the approved complaint that houses were hard to see and hidden by tokens.

- Real meshes from `src/render/buildingModels.js`: each color group has its own house and hotel design (table in DECISIONS.md, Batch 3). The group's board color is the accent. Lacquered-wood and painted finishes, 18 shared materials.
- Size: one uniform scale (0.016 board units per model unit) for houses and hotels; four houses fit across the band; hotels keep the approved house-to-hotel proportions (≈ 29–36% of the tile width).
- **Placement: standing on the color band** (the band is the building row, like the real board). Tokens never stand on the band, so buildings are never hidden.
- Cast shadows. Build animation: drops in from 0.03 above with a short bounce (180 ms) and a wooden "tock". Sell: lifts and fades.

### 10.6 Dice (visual)

- `RoundedBoxGeometry` (radius ≈ 18% of size), ivory `MeshPhysicalMaterial` (#F6EEDD, roughness 0.35, clearcoat 0.6 for a polished resin look).
- Pips: recessed. Use a normal map plus dark pip color in the albedo (texture atlas per face), not separate meshes.
- Size ≈ 0.055 board units. Rolled into the board's center area. Physics and fairness in §11.

### 10.7 Camera

Two styles (Settings → Camera style, saved with the settings, default **Close-up**; Stage 2, spec `docs/stage2/SPEC-closeup-camera.md`). Both write the camera through the same shot path. **Reduce motion overrides both:** fixed overhead view, no follow, rotation, push-in, nudge, orbit or peek.

**Close-up (default).** The camera eases between *shots* (focus point on the board, yaw, pitch, distance, FOV) with critically damped smoothing on every parameter, yaw by the shortest direction. Starting values live in the `CLOSEUP` tunables at the top of `src/render/cameraDirector.ts` and are tuned from Test board → Camera panel.

- **Home** (turn start; the player chooses Roll / Manage / Trade here): frames the active token's tile, and for a street its whole color group with the buildings on the band, from the side the token is on, turned ≈ 20° toward the direction of travel, pitch ≈ 40°. Corners (and jail) frame the corner plus the first tile of each neighbouring side; other tiles frame themselves and both neighbours.
- **Dice** (Roll until the dice settle): the Table rest view at the active side's yaw, zoomed in ≈ 10% (zoomed back out if the token would leave the screen). The dice are still thrown into the board's center; the throw starts when the camera has covered ≈ 80% of the move.
- **Chase** (while the token hops): outside the board edge, behind the token, pitch ≈ 30°, yaw ≈ 40° toward travel, aiming ≈ 1.5 tiles ahead, ≈ 0.30 board units back. The side yaw blends across corners over the corner hop and the hop after it; backwards moves flip the offset. The camera trails slightly, and a leash keeps the whole token inside the free screen area. Glides (Go to Jail, any direct move) pull back to the Table rest view, then settle on the destination.
- **Landed:** the Home framing of the landed tile, held through the buy prompt, auctions, rent, cards and banners. The big-payment push-in does nothing to the camera here (banner, banknotes and counters still play).
- **Turn handoff:** one combined move from the Landed shot to the next player's Home shot (side turn and move, ≈ 1.4 s at speed factor 1, scaled like the Table side turn). Doubles go straight from Landed to Dice. Bots use the same shots.
- **Safe area:** every shot keeps its subject between the left player cards and the right context panel, below the banner zone and above a bottom margin, centered in that region (not the screen). The camera stays ≥ 0.04 above the board and out of building, token, deck and dice boxes, raising its pitch if needed.
- **Light rig** follows the side yaw only (not the shot's yaw offset or the stick), turning with the same 1.4 s easing when the side changes, so shadows don't swing at corners.
- **Right stick / Shift + arrows** orbit around the shot's focus (yaw ± 25°, pitch − 5° / + 15°); releasing returns to the shot. **Hold R2 / ZR / C** to peek: the camera eases to the Table rest view on the current side and returns on release. Peek works whenever a game is on screen, menus included (the player asks for it; the game itself never moves the camera during menus).
- Speed: every camera move scales with the speed setting; Instant snaps each shot; skipping snaps to the shot the animation ends on.

**Table** (the pre-Stage-2 camera, unchanged):

- Perspective camera, vertical FOV ≈ 30° (low distortion), default pitch ≈ 58° from the table plane, distance so the whole board fills ≈ 88% of the screen height at rest with room for the side panels.
- **Board rotation per active player:** each seat is assigned a board side by turn order (2 players: bottom and top; 3: bottom, left, top; 4: one side each; 5–6 share sides). At the start of each turn the camera rig (with the light rig) orbits around the board center so the active player's side is nearest the viewer. 1.4 s ease-in-out at Normal speed, shortest direction. Setting: Rotation on (default) / off (fixed on seat 1's side).
- **Gentle follow:** while a token moves, the camera eases toward it (target offset up to 15% of board width, zoom in up to 12%) and keeps the destination tile fully in frame. After the landing resolves it returns to rest over 0.8 s. Large payments add a short push-in on the tile (§10.9).
- Right stick nudges the view (pan/tilt within limits); releasing it returns to rest.
- Never move the camera during menus, auctions or trades (scene dims behind the overlay).
- Reduce motion: no follow, no rotation, fixed overhead view.

### 10.8 Overlay UI

- HTML/CSS layer above the canvas. Fixed 1920 × 1080 logical stage, scaled uniformly to fit the window; letterboxed on non-16:9 screens. With `devicePixelRatio` 2 on the 4K TV, text renders natively sharp.
- Layout at rest: player cards in a left column, context panel on the right (current tile card, action buttons with controller prompts, recent log). Panels are card-stock colored (`paper-hi`), soft drop shadow, no grain.
- Title deeds, Chance/Community Chest cards and banknotes are HTML/SVG overlays matching `reference/cards.html` and `reference/bills.html`. Draw cards flip in from the deck space's screen position.
- Icons and controller prompts: `assets/symbols/`.
- Buttons ≥ 64 px tall at the logical size; text never below 14 px logical.

### 10.9 The big-payment moment

Triggers when a payment is ≥ $200 or ≥ 25% of the payer's cash (both thresholds in settings).

1. Camera pushes in slightly on the tile (0.4 s).
2. Overlay banner: payer token portrait → payee token portrait, property name, amount set large in Fraunces.
3. Banknotes (from `reference/bills.html`) fly from the payer's panel to the payee's panel in the denominations that make up the amount (largest first, max ~12 notes, then a "+$X" chip).
4. Both cash counters tick to their new values; the payer's card shakes slightly if they fall below $100.
5. Total 2.2 s at Normal speed. Confirm skips to the end state.

Bankruptcy, auction wins and buying a full color set get their own short moments in the same style (banner + sound), ≤ 1.5 s.

### 10.10 Performance budget

| Target | Requirement |
| --- | --- |
| TV PC at 3840 × 2160, High | Steady 60 fps on a GTX 1660 / RTX 3050-class GPU |
| Laptop at 1920 × 1080, Low | ≥ 45 fps on integrated graphics |
| Draw calls | < 150 per frame (instance houses, share materials) |
| Startup | Board and table textures generated in < 2 s on the TV PC |
| Idle | Render on demand when nothing is animating (no continuous 60 fps while a menu is open or the scene is static) |

Quality setting: Auto (default; picks by GPU and resolution), High, Low. Low = 4096 board texture, 2048 shadows, no AO, FXAA.

---

## 11. Dice: physics for the look, RNG for the result

The visible tumble is real physics; the result always comes from the engine.

1. The engine produces the roll from its seeded RNG (stored in game state, saved, replayable). Physics never changes it.
2. The renderer creates a throw from a separate cosmetic RNG: start position on the active player's side, random linear and angular impulse.
3. cannon-es simulates the two dice **off-screen** at a fixed 1/120 s step until both sleep (cap 4 s), recording each die's transform every step. Colliders: the board plane plus invisible walls around the center area so dice never cover tiles. Two bodies only: this takes a few milliseconds.
4. If a die rests cocked (top face more than 10° off vertical), discard and re-simulate with a new cosmetic throw (max 5 tries, then place flat). Invisible to the player.
5. Read which face of each die ended up on top. Apply a fixed re-labeling rotation to the die's **visual** mesh (rotate the pip layout so the top-facing face shows the engine's value; keep opposite faces summing to 7) before playback.
6. Play the recording back in real time (with speed-setting scaling), plus clatter sounds on recorded contacts.

Result: realistic tumbles, exact engine results, zero per-frame physics cost. Instant speed skips the throw and places the dice flat.

Fairness tests: 1,000,000 engine rolls pass a chi-square test for uniform 1–6 and independent dice; a test confirms the displayed faces always equal the engine's values across 10,000 simulated throws.

---

## 12. Architecture

**Modules**

- `engine/` — `apply(state, action) → { state, events }`. Pure, deterministic, seeded RNG in state. `legalActions(state, seat)`. No rendering or DOM.
- `bots/` — medium bot and bank-backed bot: `chooseAction(state, seat) → action` using `legalActions`.
- `input/` — gamepad manager: polling, device ids, mapping tables, remaps, seat binding, reconnects. Emits intents (Confirm, Back, Navigate, Trade…).
- `render/` — Three.js scene: `table`, `boardTexture` (canvas generation from board data), `board`, `tokens` (builders per token), `buildings` (instanced), `dice` (physics pre-sim + playback), `cameraDirector` (rotation, follow, push-ins), `lighting`, `quality`.
- `director/` — consumes engine events in order and turns them into a queue of animations (move token, roll dice, place house, payment moment…). Each animation is skippable and speed-scaled. The engine state is always the source of truth; the director only shows it.
- `ui/` — HTML overlay: panels, modals, cards, prompts. Reads state, sends actions.
- `storage/` — IndexedDB: presets, saves, bindings, settings; JSON export/import.

**Save format:** `{ version, createdAt, rulesPreset (copy), boardPreset (copy), seats, seed, actions: Action[], snapshot: State, view: { cameraSide } }`.

**Core types (sketch)**

```ts
Rules        // every setting in §5 and §7, Classic defaults
Board        // 40 tiles: name, type, group, price, rents[], houseCost, mortgage
Card         // text + Effect
Seat         // kind: 'human' | 'bot' | 'bankBot', token, color, controllerId?, boardSide
PlayerState  // cash, position, jail, properties, gojfCards, loans[], bankrupt
Loan         // principal, rate, passesLeft, collateral: TileId[]
Promise      // kind: 'rentFree', from, to, tileId, turnsLeft
Auction      // tileId, highBid, highBidder, passed[], deadline
State        // rules, board, decks, seats, players, turn, phase, bank, freeParkingPot, auction?, trade?, log, rng
```

---

## 13. Settings menu (outside rules presets)

Controllers, Speed, Reduce motion, Camera style (Close-up / Table; §10.7), Board rotation (on/off) and Camera follow (on/off) — both shown for Table style only, Quality (Auto/High/Low), Big-payment thresholds, Undo (on/off), Swap Confirm/Back on Nintendo pads, Volume (master, music, effects), Fullscreen.

---

## 14. Build order

Each milestone must be playable or testable before the next starts.

0. **Visual prototype (approval gate).** No rules. Table, board with generated face texture (Classic board preset), lighting and shadows, all 9 tokens on the base with player rings, houses and a hotel on several bands, dice throw with the §11 pipeline (press a button to roll random values), camera rotation between four sides and token hop with follow. Quality toggle. Deliver as a page the owner can open on the 4K TV. **Stop and wait for approval and screenshot feedback.**
1. Engine with Classic rules + unit tests; headless bot-vs-bot games run to completion.
2. Connect engine → director → scene: roll, move, buy, rent, cards, jail, end turn, with basic overlay panels (mouse/keyboard).
3. Auctions, building, mortgages, raise-money flow, bankruptcy, forfeit, big-payment moment.
4. Controller layer: assignment screen, DS4Windows and Switch Pro mapping, per-seat ownership, simultaneous auction input.
5. Trades with promises.
6. Rules editor + rules presets; every §5 setting wired.
7. Bank loans.
8. Board and card editors + board presets (with texture regeneration).
9. Save slots, autosave, resume, export/import, undo, game log.
10. Bots (medium + bank-backed) in the lobby.
11. Polish: sounds, stats screen, speed settings, reduce motion, performance pass on TV PC and laptop.

---

## 15. Acceptance checks

- 10,000 headless bot games under Classic rules finish with no illegal state (cash never negative outside raise-money, buildings within supply, even building respected).
- Every rules setting has at least one test proving it changes behavior.
- Loan scenarios tested: early payoff, interest-free, missed secured payment with refund, missed secured payment with shortfall, missed unsecured payment, no-build rule.
- Dice fairness tests in §11 pass.
- Save mid-auction and mid-trade, reload, and the game continues identically (including camera side).
- A DS4 (via DS4Windows) and a Switch Pro controller bid in the same auction without crossed or doubled input.
- §10.10 performance targets met on the TV PC and the laptop.
- Board text on every side is readable from the couch at 4K when that side faces the viewer; the deed panel always shows the current tile name upright.
- Houses and hotels are visible on every tile while a token stands on it.

---

## 16. Decisions log (carried over from v1 and this revision)

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
