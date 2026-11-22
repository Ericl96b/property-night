# Property Night — Stage 1 Spec: Controller Navigation, Back Button, Auction Clarity, Tile Colors, Gummy Bear Token

**Scope:** Five changes, built in the order below. Out of scope for this stage: the close-up follow camera (Stage 2) and the Inventory/Trade rework, including the new trade promises (Stage 3). Do not start on those.

**Build order:**
1. Back-button fix (smallest, and it's a root-cause fix in the menu stack the focus work will touch anyway)
2. Controller focus system (global)
3. Auction clarity
4. Tile color changes
5. Gummy Bear token: apply the provided patch and verify (see §5)

**Files handed off with this spec:** `gummy-bear-token.patch` (the complete Gummy Bear token, including its new source file). Nothing else.

**General constraints (unchanged from previous specs):** no bloom; must stay sharp at native 4K on the TV and scale down cleanly on the laptop; supports a PS4 controller (DS4Windows) and a Switch Pro controller at the same time, plus mouse.

---

## 1. Back button: one level at a time

### Bug
In the Save Game menu, pressing the controller button mapped to Back/Close (Circle on PS4) closes everything and returns to the game. Selecting the on-screen **Close** button with the controller and confirming, or clicking it with the mouse, correctly returns to the main Settings menu. So the Back-button handler is taking a different code path from the on-screen Close button, most likely a "close all menus" call instead of "pop one level".

### Requirements
- **One shared close path.** The Back button, every on-screen Close/Back/Cancel button, and mouse clicks on them must all call the same "pop one level" function on the menu stack. No menu may have its own Back handler that bypasses it.
- **Behavior:**

| Where you are | Back does |
|---|---|
| A submenu (e.g. Settings → Save Game) | Return to the parent menu |
| The root of a menu opened from the game (e.g. Settings) | Close the menu and return to the game |
| A confirmation dialog | Cancel the dialog (same as choosing "No/Cancel") |
| In the game with no menu open | Whatever it does today (no change) |
| A decision prompt that is part of game flow (buy/auction prompt, auction bid menu, jail options, paying rent, etc.) | **Nothing.** Back must never trigger a game action like passing, declining or forfeiting. Those require choosing the option and confirming. |

- **Focus returns to where you came from.** When Back returns to a parent menu, focus lands on the item that opened the submenu (e.g. back on "Save Game"), not on the top item.
- **Audit every nested menu**, not just Save Game. Assume the same bug exists anywhere a submenu has its own close handling (Load Game, rule presets, custom rules editor, bot settings, loans, property management, trade, etc.).

### Acceptance
- From every submenu in the game, pressing Back with either controller returns exactly one level, and focus lands on the item that opened it.
- On-screen Close, Back button, and mouse click produce identical results everywhere.
- No game-flow decision can be made with the Back button.

---

## 2. Controller focus system (all menus)

### Problem
The currently selected item is hard to see. The strong green fill sits on the top/default option and stays there while you move. The actual selection gets only a thin outline. The "default/primary" style is visually stronger than the "focused" style, so the eye reads the wrong item as selected. This makes every controller-driven menu error-prone, especially auction bidding.

### Requirements

**A. One clear "focused" style, the strongest thing on the screen**
- The focused item gets the **solid accent fill** (use the current green or a theme-appropriate accent), high-contrast text on it, and a slight scale-up (~1.05×).
- Non-focused items: neutral fill. The difference between focused and not focused must be obvious from couch distance on the 4K TV.
- Moving focus animates quickly (~80–120 ms). It must never lag behind input.
- No bloom. A soft drop shadow or border on the focused item is fine.

**B. "Default/primary" must not look focused**
- The recommended/default option may still be marked, but only in a way clearly weaker than focus: e.g. an accent-colored outline or text color, a small icon, or bolder label. **Never a solid fill.**
- When a menu opens, focus starts on the sensible default item, so normally the focused and default items match at first. The moment you move, the fill goes with you.

**C. One focus, shared by mouse and controller**
- Hovering with the mouse moves the same focus. There should never be two highlighted items at once (one for the mouse, one for the controller).
- If more than one controller can drive menus at the same time, there is still only one focus per menu.

**D. Other control types**
- Steppers, sliders, toggles, and number fields use the same focused style on the whole row. When focused, their left/right arrows also highlight to show they respond to left/right.
- Disabled items: clearly dimmed, and focus skips them. If a disabled item explains why it's disabled (e.g. "Need $40 more"), keep that text readable.
- Lists that scroll: the focused item always scrolls into view.

**E. Implement as a shared component/style**
Do this once in the shared UI layer (menu item, button, stepper, list row components) so every screen gets it. Do not patch each screen separately.

### Audit list (every screen must use the new style)
Main menu, new game setup (players, tokens, bots, rule presets, custom rules), Settings and all submenus, Save/Load, pause menu, the turn action menu, buy/auction prompt, auction bidding, jail options, property management, building/selling houses, mortgage, loans, trade (current version; it gets reworked in Stage 3 but must be usable until then), bankruptcy/forfeit, end-game screens, and every confirmation dialog.

### Acceptance
- On any screen, with either controller, someone glancing at the TV can say which item is selected within a second.
- The default option never looks selected once focus has moved off it.
- Mouse and controller never show two different highlighted items.

---

## 3. Auction clarity

Bidding stays **menu-based** (no face-button shortcuts). The focus fix in §2 does most of the work for bidding. This section adds a clear display of who is winning and makes each bid option unambiguous.

### A. Leader panel (large, top of the auction UI)
- Shows the **current leader**: their token icon, their name in their player color, a **LEADING** label, and the **current high bid** as the biggest number in the auction UI.
- Before any bids: "No bids yet" plus the opening/minimum bid.
- **When the lead changes:** a short pulse or slide animation on the leader panel (~300 ms) so a change is noticed even if you weren't looking.

### B. Bidder list
Every player in the auction gets a row with their token icon and name in their player color, plus a status:
- **Leading** (highlighted, matching the leader panel)
- **Outbid** (shows their last bid)
- **Passed** (dimmed, struck through or greyed)

### C. Whose bid it is
The bid menu must clearly say which player it's taking input for: a header like **"[Name]'s bid"** in that player's color. The menu should be visually attached to that player's row or carry their color, so no one bids on behalf of the wrong player.

### D. Bid options state the result, not just the step
- Label each raise with the **total that will be bid**, e.g. **"Bid $130"**, with the increment as secondary text "(+10)". Don't label it only "+10".
- **Pass** sits apart from the bid options (separated by space or a divider, at the end of the list) and uses a different style, so it can't be hit by accidentally moving one step too far.
- When the bid menu opens, focus starts on the **smallest raise**, never on Pass.
- If the player is currently leading, bid options are disabled (they can't outbid themselves). Show "You're leading" in place of the menu if that fits the existing auction flow.
- If a raise is more than the player can afford, disable it and show why (per §2D).

### Acceptance
- At any moment during an auction, someone looking at the TV can tell who is winning and for how much.
- It's impossible to place a bid without seeing the resulting total on the button.
- Pass can't be selected by overshooting the bid options.

---

## 4. Tile color changes

### Orange set → Tennessee Vols orange
- Base color: **#FF8200**.
- The target is what you **see on screen**, not just the hex value in code. Check it under the game's actual lighting, paper texture, and tone mapping. If the rendered result reads as dull or brown-orange, adjust the material's base color until the result looks like Vols orange. Report the final value used.

### Mustard yellow set → more yellow
- Current: #D4A72C. That's too close in hue to the new orange.
- Starting point: **#E3BC2A**. Push it further toward yellow if needed.
- Requirement: the mustard and orange sets must be **instantly distinguishable at couch distance on the TV**, and on the laptop. Mustard should still read as mustard (warm, a bit muted), not lemon yellow.

### Where the colors apply
Every place a set's color appears: board color bands, property cards and deeds in the UI, any color chips/legends, and the themed house/hotel models if they use the set color. Change the color once at its single source and have everything read from there. If any place has the color hardcoded, fix that too.

### Acceptance
- Show the orange and mustard sides of the board on the TV: no one should hesitate over which is which.
- Report the final hex values used for both sets.

---

## 5. Gummy Bear token

The asset is finished and approved. It comes as **`gummy-bear-token.patch`** (handed off with this spec). Apply it from the repo root:

```
git apply gummy-bear-token.patch
```

If the patch doesn't apply cleanly because `tokens.ts` or `theme.ts` changed since it was made, use `git apply --3way`, or make the small edits listed below by hand. The new file inside the patch is self-contained.

### What the patch does
- **New file:** `src/render/tokens/gummyBear.ts`. It exports `gummy()`, the token builder, with the same shape as the other builders. It also exports `GUMMY` (the look settings), `bearSDF`, `meshSDF`, `gummyBearGeometry` and `gummyMaterial`.
- **`src/render/tokens/tokens.ts`:** imports `gummy` and adds `'gummy'` to `TokenId`, `TOKEN_IDS` and `BUILDERS`. It also makes `brassMerged` optional. This token has no brass above the base, and `mergeGeometries([])` would throw, so the figure mesh falls back to `baseGeometry()` alone.
- **`src/ui/theme.ts`:** `TOKEN_NAMES.gummy = 'Gummy Bear'`.

### How the asset works (for reference, don't rebuild it)
- **Geometry:** the bear is a signed-distance shape, a smooth union of ellipsoids and capsules with eye dimples and flat soles. It is meshed **once** with surface nets: vertices are projected onto the surface and normals come from the SDF gradient. This happens on the first `buildToken('gummy', …)` call (about 100 ms), then it's cached in `figureCache` like every other token. Nothing runs per frame. If the 100 ms lands mid-game and causes a visible hitch, warm the cache at lobby/load time.
- **Scale and origin:** they match the rest of the set. The origin is at the bottom center of the base, Y is up, the token faces +Z, and the total height is about 0.045. It stands on the shared brass base with the player-color enamel ring.
- **Cost:** about 5.6k triangles for the bear and 8.2k for the whole token (the teacup is 8.1k). It uses 3 draw calls (base, ring, bear) and casts shadows like the other tokens.
- **Material:** one shared `MeshPhysicalMaterial`. It is opaque and uses clearcoat (the same feature the brass already uses), a small emissive lift, and a view-angle rim tint injected via `onBeforeCompile` (`customProgramCacheKey` = `gummy-rim-v1`). No transmission, no transparency, no extra passes, and it doesn't depend on bloom.
- **Color:** **neon pink (#FF2E9F) is fixed to this token** in `GUMMY.color`. It is **not** added to the player-color palette. `setColor()` still recolors only the ring, so player colors work for the Gummy Bear player exactly like any other token.
- **Tuning:** all look values are in the `GUMMY` object at the top of `gummyBear.ts`. `resolution` sets mesh density: 36 gives about 5.6k triangles, keep it between 32 and 40. Don't change the look values unless asked; they were approved.

### Checks after applying
1. `npm run typecheck && npm test`. If any other `Record<TokenId, …>` in the codebase now fails typecheck, add a `gummy` entry following the pattern of the other tokens.
2. Lobby: "Gummy Bear" appears in the token picker, and the player-card portrait renders. `portraits.ts` uses `buildToken`, so it should need no change. The picker uses the new focus style from §2.
3. Anywhere else a token icon appears (HUD, auction bidder list from §3, trade screen, end screen), the Gummy Bear shows correctly.
4. On the board: the bear faces the camera yaw like the other tokens, hops and settles normally, and casts a shadow. Put it on a pink property: it stands on the cream tile body with the pink band behind it, so check it's clearly visible at couch distance. If it isn't, report that; don't change the color.
5. Existing saves still load.
6. Benchmark/test board on OUTPOST: frame time with the Gummy Bear should match the teacup's.

---

## Test checklist (whole stage)

- [ ] PS4 controller (DS4Windows) and Switch Pro controller both connected, each one used through every menu in the §2 audit list
- [ ] Mouse used through the same menus; no two highlighted items at once
- [ ] Back from every submenu returns one level with focus on the item that opened it; Back never makes a game decision
- [ ] A full auction with 3+ participants including a bot: leader, outbid and passed states all correct; lead changes noticeable; Pass can't be hit by overshooting
- [ ] Orange vs mustard checked on the 4K TV and the laptop
- [ ] Gummy Bear patch applied; typecheck and tests pass; selectable; shows correctly in-game and in every icon location; visible on pink tiles; frame time on OUTPOST matches the teacup
- [ ] Existing saves still load
