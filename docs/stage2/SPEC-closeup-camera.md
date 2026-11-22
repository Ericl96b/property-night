# Property Night — Stage 2 Spec: Close-Up Follow Camera

**Goal:** during play, the camera stays close to the active player's token so the tiles, property names, SOLD signs and themed houses/hotels can be seen in detail from the couch. The reference is *New Monopoly* (Ubisoft): a low, close shot from just outside the board edge, looking along the row past the token at the tiles ahead.

**Scope:** camera behavior only. No UI layout changes, no rules changes. Inventory/Trade are Stage 3.

**Files this mostly touches:** `src/render/cameraDirector.ts`, `src/director/director.ts`, `src/render/scene.ts` (ticker / light rig), `src/app/settings` (new setting), `src/input/` (peek button), `src/bench/phases.ts` + `src/bench/testBoard.ts` (tuning and benchmark), `tests/camera.test.ts`. Update `SPEC.md` §10.7 and §13 to match, and log the judgment calls in `DECISIONS.md`.

---

## 1. Settings

- New setting **Camera style: Close-up (default) / Table**.
  - **Table** = today's camera, unchanged: rest view, per-side rotation, gentle follow, push-ins. The existing *Board rotation* and *Camera follow* toggles apply only to Table and should be shown only when Table is selected (or dimmed with "Table style only").
  - **Close-up** = everything in this spec. Rotation is built in, so the Board rotation toggle doesn't apply.
- **Reduce motion** still overrides both styles: fixed overhead view, no follow, no rotation, no push-in, no nudge (exactly as today, and `tests/camera.test.ts` must still pass).
- The setting is saved with the other settings, not per game. Existing saved settings default to Close-up.

---

## 2. Shots

Restructure the camera around **shots**. A shot is a target state: a focus point on the board, yaw, pitch, distance and FOV. The camera eases between shots with critically damped smoothing on every parameter, and yaw always takes the shortest direction. The current Table behavior becomes one family of shots, so both styles go through the same code path.

All numbers below are **starting values**. Put them together in one exported `CLOSEUP` tunables object at the top of `cameraDirector.ts`, like `GUMMY` in the token file, so they can be tuned in one place (see §5).

### 2.1 Home shot (turn start, and whenever the active player is choosing what to do)
- Frames the active token's tile. If that tile is a property, frame its **whole color group**, including the buildings on the band.
- Side yaw: the side the token is on, same rule as today (`sideOfTile`). Then add **yaw offset ≈ 20°** toward the direction of travel, so the row reads slightly into the distance rather than flat.
- **Pitch ≈ 40°.** Distance: whatever fits the group, plus a margin, inside the safe area (§3).
- Jail: frame the jail corner. Corners in general: frame the corner tile plus the first tile of each adjoining side.
- Rest of the turn: the player chooses Roll / Manage / Trade from this shot. Opening a menu does **not** move the camera (existing rule: the camera never moves during menus, auctions or trades).

### 2.2 Dice shot (from the Roll action until the dice settle)
- The dice are still thrown into the board's center area. Don't change `diceSim` or where the dice land.
- The camera pulls back to a **medium shot from the active side**: today's rest view at the active side's yaw, zoomed in ≈ 10% (`zoom ≈ 0.9`). The dice and the active token must both be in frame.
- The throw starts once the camera is about 80% of the way to the dice shot, not fully settled, so the game doesn't feel slower.

### 2.3 Chase shot (while the token moves tile to tile)
- The camera sits **outside the board edge**, behind the token relative to its direction of travel. It looks along the row, past the token, at the tiles ahead, like the reference screenshot.
- **Pitch ≈ 30°.** **Yaw offset ≈ 40°** from the side's yaw toward the direction of travel. **Look-ahead:** aim at a point ≈ 1.5 tiles ahead of the token, so about 4–5 tiles ahead are visible.
- Distance: the token sits in the lower-middle part of the safe area at roughly the size it has in the reference shot. Starting value: camera ≈ 0.30 board units from the aim point. Tune it on the TV.
- Smoothing: the camera trails the token slightly, so it doesn't jerk with each hop. The token must never leave the safe area.
- **Rounding a corner:** the travel direction turns 90°. Blend the side yaw over the corner hop and the hop after it, with no snap. The side the camera uses (`camera.side`) switches when the token lands on the new side, as today.
- **Moving backwards** ("Go back 3 spaces"): the yaw offset flips toward the new travel direction.
- **Glides** (Go to Jail, and any `moved` with `steps === 0`): don't chase across the board. Pull back to the Table rest view for the glide, then settle into the Home shot on the destination.
- Long card moves ("Advance to …") use the chase shot, with corner blends as above.

### 2.4 Landed shot (after the token settles, through buy/auction/rent/cards)
- Same framing as the Home shot (2.1) for the landed tile, so the player sees what they landed on: the group, its owner signs and its buildings.
- It holds through the buy prompt, an auction, a rent payment, a card draw and any banners. The camera doesn't move while those overlays are up.
- **Payment push-in (§10.9):** in Close-up style the camera is already close, so `pushIn` does nothing to the camera. The payment banner, banknotes and counters still play normally.

### 2.5 Turn handoff
- When the turn ends, the camera eases from the Landed shot to the **next** player's Home shot: rotation to their side plus the move to their tile, in one combined move. Duration ≈ 1.4 s at Normal, scaled by the speed setting, like the current side turn.
- **Doubles:** go from the Landed shot straight to the Dice shot on the next roll.
- **Bot turns** use the same shots, at the same speed scaling.

### 2.6 Speed, skip, Instant
- Every camera move scales with the speed setting, as it does today.
- **Instant** speed: each shot snaps.
- **Skip** (Confirm during an animation): the camera snaps to the shot that animation ends on.
- The camera moves the director queues (Home, Dice, glide pull-back, handoff) are queue animations, like today's `turnTo`, so things happen in the right order. The chase is driven by the token's hops, like today's `follow` callback.

---

## 3. Safe area and collisions

- **Safe area:** the free screen region between the left player-card column and the right context panel. Today this is `viewport.maxX` from `setViewport`. Also keep the top banner zone and a bottom margin clear. Every shot keeps its focus (token or tile group) inside this region. The framing math has to account for the panels: the subject is centered in the free region, **not** in the middle of the screen.
- **No clipping:** the camera never goes below a minimum height above the board (≈ 0.04 units, roughly the height of a hotel). It never goes inside a building's bounding box, a token, the card decks or the dice. Lower the near plane (currently 0.05) only as far as close-up shots need it, and check that this causes no z-fighting on the board face or decals.
- **Occlusion:** the camera sits outside the board edge and the buildings are on the inner band, so buildings shouldn't block the token. If any tile and side combination still lets a hotel hide the active token by more than half, raise the pitch for that shot.

---

## 4. Controls in Close-up style

- **Right stick:** orbit around the current shot's focus (yaw ±25°, pitch −5° to +15°). Releasing the stick returns to the shot, as today's nudge does. Keyboard: Shift + arrows, unchanged.
- **Hold to peek at the board:** while **R2** is held (Nintendo: ZR; keyboard: **C**), the camera eases to the Table rest view on the current side. Releasing returns to the current shot. This replaces the overview you lose by being in close-up, e.g. checking who owns what across the board. Peek works whenever the game screen has focus, including during menus: the "no camera moves during menus" rule covers the game moving the camera, not the player asking it to. Add the R2 prompt to the controls list in the pause menu/README and use the existing lettered-disc prompt style.
- Peek and nudge do nothing under Reduce motion.

---

## 5. Lighting and render quality checks

- **Light rig:** today it rotates with the camera yaw. In Close-up style it should follow the **side yaw only**, not the shot's yaw offset or the right-stick orbit. Otherwise the shadows would swing across the board every time the token rounds a corner. It turns when the side changes, with the same easing as the side turn.
- **Shadows at close range:** the close-up shows the shadow map far closer than the current design was checked at. If shadows on the houses and tokens look blocky or swim at couch distance, fit the shadow camera's frustum to the visible area in Close-up shots, snapped to the shadow-map texel grid to avoid shimmer. Report what you did and the cost.
- **Board face sharpness:** check that property names and prices on the landed tile are crisp at 4K in the Home/Landed shots, on both High and Low quality. If they're soft, **report it with screenshots and the current `boardTexture` size**; don't raise the texture size without asking. OUTPOST has 8 GB of VRAM, so there's room, but I want to see the tradeoff first.
- **Tokens:** they keep facing the camera's view yaw (`faceYaw`), as now. No change.

---

## 6. Tuning tools (test board)

The values in §2 are guesses until they're seen on the TV. Add a **Camera** panel to the test board (Main menu → Test board):

- A shot picker: Home, Dice, Chase, Landed.
- Sliders for every `CLOSEUP` tunable: pitch, yaw offset, distance, look-ahead, FOV, smoothing rates, minimum height.
- **Play a move:** animate the selected token N tiles (1–12, including around a corner) with the real chase camera.
- **Copy values:** copies the current tunables as a TS object literal, so they can be pasted back into `cameraDirector.ts`.
- Controller and keyboard navigation follow the Stage 1 focus system.

---

## 7. Benchmark

- **Phase 3 (Street close-ups)** switches to the new Landed-shot framing for each group, replacing the old 0.88 follow zoom. That's the view players will actually see, and it's much closer.
- **Phase 5 (Turn sequence)** runs the new choreography: Home → Dice → Chase → Landed → handoff.
- **Phase 6** (k× render of the costliest close-up) uses the new costliest shot.
- Run Standard on OUTPOST at 4K before and after, then report frame times and draw calls per phase. The close-up should cost the same or less (fewer objects in view). If it costs more, find out why before finishing.
- The benchmark still forces its camera settings during the run and restores them after. That now includes forcing Camera style = Close-up.

---

## 8. Tests

- Keep the existing `tests/camera.test.ts` cases passing (Table-style rotation timing, Reduce motion overhead).
- New tests:
  - **Safe area:** for every tile 0–39 and every shot type, the projected focus point (token or group bounds) falls inside the safe area at 16:9 with the standard panel widths.
  - **Minimum height:** across a full chase lap of the board (40 hops, every corner), the camera never goes below the minimum height and never enters a building box on a worst-case board (all hotels).
  - **Corner continuity:** no frame-to-frame yaw jump larger than ≈ 3° at 60 fps during a corner blend at Normal speed.
  - **Instant/skip:** at Instant speed, and after a skip, the camera sits exactly on the shot's end state.
  - **Settings:** Table style behaves exactly as before. Reduce motion overrides Close-up.
  - **Peek:** hold → Table rest view; release → back to the shot.

---

## 9. Acceptance (on the TV, from the couch)

- [ ] On every landing, you can read the landed property's name and price, and see its group's owner signs and buildings clearly.
- [ ] During a move, the token is always visible in the free area between the panels, and the tiles ahead are readable.
- [ ] Rounding corners is smooth with no snap. Shadows don't swing as the camera turns.
- [ ] The camera never clips into a building, token, deck or the dice. The active token is never hidden by a hotel.
- [ ] Dice are fully visible in the Dice shot.
- [ ] Holding R2/ZR/C gives the full-board view, and releasing it goes back.
- [ ] Table style looks exactly like today's game. Reduce motion is still the fixed overhead view.
- [ ] OUTPOST benchmark at 4K: no regression compared with before Stage 2.
- [ ] Two full games (one human vs. human, one with a bot) at Normal speed. No moment where you lose track of whose turn it is or where the active token is.

## 10. Deliberately not in this stage

- Moving the dice throw next to the token. The dice stay in the center, and the Dice shot pulls back to show them. If the pull-back feels like too much back-and-forth once tuned, it gets revisited separately; it would mean changing the dice simulation.
- Camera moves for Manage actions (building/selling elsewhere on the board while a menu is open). The camera doesn't move during menus, and peek covers looking around.
- Any UI layout changes for the close-up. If the panels crowd the close-up shots badly, report it with screenshots; layout belongs to Stage 3.
