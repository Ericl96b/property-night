# Property Night — Stage 3 Spec: Inventory (Binder), Trade (Across the Table + Deal Strip), Group Promises

**Scope:** replace `ManagePanel.svelte` with **Inventory**, replace `TradePanel.svelte` with **Trade**, build the shared **card component** both of them use, and replace the engine's tile-based rent-free promise with **group-based promises** (Rent-Free and No Building), including the **bot lock**.

**Visual reference:** the approved mock-ups, handed off with this spec as the `property-night-stage3-mockups/` folder. Put it at `docs/stage3/` in the repo.
- `screenshots/*.png` are **the reference**. Match them.
- `mockups/*.html` are the same screens as standalone HTML. Open them in Chrome to read exact CSS values.
- `source/lib.js` holds every component's CSS and markup. It's a **value reference, not code to ship**. Rebuild the screens as Svelte components in the existing UI layer.
- `README.md` is an index of the states. Where it and this spec disagree, **this spec wins** (see §7 for the deliberate differences).

**Order:** engine first (§5, §6), then the card component (§2), then Inventory (§3), then Trade (§4), then cleanup (§7–§9). The UI work depends on the engine types.

---

## 1. Global rules carried over from Stages 1–2

- Every focusable element uses the Stage 1 focus style. **The slot wrapper takes focus, never the card itself.**
- Back goes back one level, always through the shared menu-stack close path. **Back never makes a game decision** (see §4.5: Decline is not on Back).
- The camera never moves while Inventory or Trade is open. Stage 2 peek (R2/ZR/C) still works.
- 1920×1080 logical stage. Text never below 14 px at any card size.

---

## 2. Shared card component

One component (e.g. `ui/cards/GameCard.svelte`) drawn at three sizes: **thumbnail 92×122, standard 200×266, detail 360×480** (logical px). See `card-component.png` for every kind and state.

| Kind | Drawn as |
|---|---|
| Street deed | Deed from `reference/cards.html`, with house/hotel icons for its buildings. The detail size is enlarged ×1.2 so its small print reaches 14 px. |
| Railroad / utility | Their deed cards |
| Mortgaged (any deed) | The card **back**, with the MORTGAGED stamp, like the physical game |
| Get Out of Jail Free | New card in the Chance/Community Chest frame, labeled by deck |
| Cash | Banknote stack plus an amount chip |
| Promise voucher | Dashed cut line, group stripe, kind title, stamp (`×N landings` / `N rounds`), punch holes for uses already spent, "Promised by / Held by" footer |

**Slot states** (also on the card sheet): owned, focused, in offer (✓ In offer), blocked with a reason chip ("Has houses", "Pledged"), empty/not owned (dashed outline showing the owner's dot and name, or "Unowned"), and locked (padlock).

**Group colors in the overlay:** the overlay is **not** tone-mapped, so it needs its own color per group, separate from the board texture's. Add a `UI_GROUP_COLORS` map (or a `ui` field per group). Orange is **#FF8200 in the UI** and stays **#DC5A00 on the 3D board** (that value compensates for ACES tone mapping and is correct). Mustard is #E3BC2A in both. Every overlay element that shows a group color (deeds, chips, vouchers, player-panel badges) reads from the UI map.

**Mustard/orange/pink check:** the sets now run in **board order**: brown, light blue, mustard, orange, red, pink, green, dark blue, then railroads, utilities. The binder rows and every group list follow this order.

---

## 3. Inventory (replaces ManagePanel)

**Reference:** `inventory-1-collection` … `inventory-4-promises`.

### Layout
- Header: token and "[Name]'s binder", plus stat cells: Deeds, Full sets, Houses, Cash.
- Two binder columns. One row per group in board order, then Railroads, Utilities, Jail cards and **Promises**. Each row's label shows "k of n", plus tags when they apply: FULL SET, "No building · N rounds", "[Name] rent-free · N", "You ride free · N".
- Detail pane on the right: the focused card at detail size, its live rent row, buildings, mortgage state, and the **action list**. A disabled action shows its reason in red.
- Footer: controller prompts for the active pad (Stage 1 glyph style, using the controller that opened the screen).

### Controls
| Input | Action |
|---|---|
| D-pad / left stick | Move between slots |
| Confirm | Move focus into the action list. Confirm on an action runs it. |
| Back | Action list → binder. Binder → close Inventory. |
| L / R | View other players' binders (**view-only**, with a clear "Viewing Riley's binder" header and no actions) |

### Actions: nothing from ManagePanel may be lost
Audit `ManagePanel.svelte` and carry over **every** action it offers today, with the same engine calls:
- Build / Sell (even-build rule, house/hotel supply and the shortage-rule building auctions as they work today)
- Mortgage / Unmortgage
- **Bank loans.** The mock-ups don't show loans, so add them without a new design, using Stage 1 components and the binder's visual language:
  - a "Bank loan" button in the header next to Cash (shown only when the loans rule is on);
  - it opens the existing take-loan flow (secured/unsecured, collateral picker, amount, term, schedule preview), restyled;
  - active loans show under the header as a compact strip: principal left, passes left, next installment, and Pay off;
  - pledged cards get a **lock badge** and the "Pledged" reason chip on the actions they block.
- New blocked reason: **No Building** promises. "Build on Light Blue: blocked by your promise to Riley for 2 more rounds" (see `inventory-4`).

### Debt phase
Inventory is also where a player raises money in the `debt` phase. In that phase, show a top banner: "Raise $X to pay [creditor]". Show a live "Still needed" amount that updates as they sell or mortgage. Close is disabled until the debt is covered (or the player chooses bankruptcy through the existing flow). Keep today's debt behavior exactly; only the screen changes.

---

## 4. Trade (replaces TradePanel): Option C, Across the Table + Deal Strip

**Reference:** `trade-1-building-offer` … `trade-4-promises-locked`.

### 4.1 Layout
- Header: "Trade · New offer" (or "Counter-offer"), "[Proposer] ⇄ [Partner]", partner tabs ("With: Riley | Sam (BOT)"; bank-backed bots don't appear at all), and the active controller pill.
- Left column: the proposer's mini binder (only the groups they own cards in), Jail cards, Cash and "+ Promise". Right column: the same for the partner.
- Center tray: "[Proposer] gives ⇄ [Partner] gives". Each side has a "List value $X · cash $Y · N cards" line at the bottom. Nothing else is advisory: **no** "completes a set" or similar hints.
- Bottom: **the deal strip**, which states the whole trade in plain sentences and updates live.

### 4.2 Building an offer (proposer's controller only)
| Input | Action |
|---|---|
| D-pad | Move |
| Confirm | On a card: add/remove it (it slides into or out of the tray). On Cash: open the amount editor. On "+ Promise": open the voucher sheet. On a voucher in the tray: edit it. |
| L / R | Jump between columns (left binder ↔ tray ↔ right binder) |
| Top face | Propose |
| Back | Close the open editor → leave the tray → cancel the trade (one level at a time) |

- **Cash editor:** d-pad ±$10, L/R ±$100, capped at that player's cash. Confirm = Done, Back = undo the changes and close.
- **Blocked cards** stay visible, dimmed, with a reason chip and no add: "Has houses" (any building in the set, as the engine rules today), "Pledged" (collateral for a loan).
- Mortgaged deeds can be traded. They show as the card back, and the receiver gets the existing 10% prompt.
- Propose is disabled, with the engine's reason shown inline, whenever `validateOffer` fails.

### 4.3 Voucher sheet (`trade-2`)
A modal on top of the trade screen. The title is "[Promiser] promises [Holder]…" (the promiser is the side whose "+ Promise" was used).
1. **Kind:** Rent-Free or No Building.
2. **Group:** a stepper plus a row of color chips.
   - Rent-Free: any color set, Railroads or Utilities.
   - No Building: color sets only (Railroads and Utilities are skipped, with the note shown in the mock-up).
3. **Length:** Rent-Free 1–99 landings. No Building 1–20 rounds, with the note "One round = every player takes one turn."
- A **live preview** voucher on the right.
- "Add to offer" / Cancel. Confirming a voucher already in the tray reopens this sheet with its terms filled in, plus a **Remove** action.

### 4.4 Deal strip wording
- The proposer's view: "Lawrence gives East Line, $150 and a Get Out of Jail Free card. Riley gives Sunset Drive." Then promise sentences, e.g. "Lawrence promises not to build on Orange for 2 rounds." "Riley promises Lawrence no rent on Railroads for 3 of **Lawrence's** landings."
- **Use names, never pronouns.** The mock-ups say "her/his landings". The game doesn't know anyone's gender, so write the player's name.
- The receiver's view (review): "You get … You give …", with "you" in place of the receiver's name.
- Locked state: end with "Promises are off in this game."

### 4.5 Review (`trade-3`)
- The banner is in the receiver's color: "[Receiver], it's your call", with "Answer with your [PS4/Switch Pro] controller". Prompts switch to the **receiver's** controller glyphs.
- The proposer's controller is **paused**, with a chip saying so. The proposer can still withdraw from a "Waiting for [Receiver]" state reached with Back, as today.
- Cards at standard size. Side rails show only **cash before → after** for each player.
- Buttons: **Accept (press and hold ~0.8 s, with a fill ring)**, Counter, Decline. Focus starts on Accept; the hold guards against a stray press.
- **Decline is chosen with focus + Confirm only.** The mock-up maps Decline to Circle/Back. **Don't do that**: it breaks the Stage 1 rule that Back never makes a game decision. On the review screen, Back does nothing, and the footer shows no Back prompt for Decline.
- Counter: the top face, or focus + Confirm. It reopens the compose screen with the sides swapped (existing behavior).
- When the receiver is a bot: as today (the proposer waits; bots never counter).

### 4.6 Promises locked (`trade-4`)
When promises are off for this game (§6), both "+ Promise" slots show a padlock and "Promises off". A banner in the tray gives the reason: "Promises are off: Sam is a normal bot." If they're off because the rules preset turned them off, the reason is "Promises are off in this game's rules." Properties, cash and jail cards still trade normally.

---

## 5. Engine: group promises

Replace `PromiseTerm { kind:'rentFree', from, to, tileId, turnsLeft }` with a group-based model. You choose the exact type; it must carry:

```
kind: 'rentFree' | 'noBuild'
from: seat      // promiser: carries the obligation
to: seat        // holder: benefits
group: GroupId  // a color set, 'railroad' or 'utility' (noBuild: color sets only)
total: number   // N as agreed (for the punch holes)
left: number    // remaining landings (rentFree) or rounds (noBuild)
```

### 5.1 Rent-Free
- **Effect:** the holder pays the promiser **no rent** on any tile in `group` that the promiser owns when the holder lands there. That includes tiles the promiser acquires after the trade.
- **Counting:** `left` goes down by 1 **only on a landing where rent would otherwise be owed** (not on mortgaged tiles, and not when the computed rent is $0). Card-driven landings that charge rent ("advance to the nearest railroad and pay double") count as one landing and are fully waived.
- **Creation check:** after the trade, the promiser must own at least one tile in `group`.
- **Ends** when `left` hits 0, or when either party goes bankrupt or leaves. It is **not** voided when the promiser sells or loses tiles in the group. It simply has no effect while they own none, and applies again if they get one back.
- **Feedback:** when a landing uses the promise, the normal rent moment is replaced with a short banner: "Rent-free (Lawrence's voucher) · 2 left". Add a log line.

### 5.2 No Building (Restricted Development)
- **Effect:** the promiser **can't build** houses or hotels on any tile in the color set `group`. That covers building a house, upgrading to a hotel, and winning or entering a shortage-rule building auction for a tile in that set. **Selling is still allowed.** Mortgaging and unmortgaging are unaffected.
- The promiser doesn't need to own anything in the set when the promise is made.
- **Counting rounds:** a round is one turn for every player still in the game. The promise takes effect the moment the trade is accepted. Record the seat whose turn it was at acceptance (the "anchor"). Each time the anchor seat **starts** a new turn, `left` goes down by 1, and the promise ends when it reaches 0. Extra rolls from doubles are part of the same turn. If the anchor seat goes bankrupt, move the anchor to the next seat in turn order.
- `legalActions` and the build/auction validation return the reason string "blocked by your promise to [Holder] (N rounds left)".

### 5.3 General
- Promises are only created through a trade, and only between the two traders. Either side can promise either kind.
- **Merging:** if a new promise matches an existing one in kind, from, to and group, add its count to the existing one (one voucher, bigger N). Within a single offer, reject duplicates.
- Validation limits: Rent-Free 1–99, No Building 1–20. `validateOffer` is updated for both kinds and for the lock (§6).
- **Badges:**
  - Rent-free keeps today's ribbon decal, now on **every tile of the group the promiser owns**.
  - No Building gets its own small "no build" decal on every tile of the set.
  - Both appear in the player cards with the count remaining.
- **Saves:** bump the save version.
  - Migrate old tile-based rent-free promises to the tile's group, with `left = total = turnsLeft`.
  - If a migrated promise duplicates another, merge them.
  - Old saves must load without error.

---

## 6. The bot lock

- **Rule:** if any seat is a **normal bot** (`kind: 'bot'`), trade promises are **off for that game**. **Bank-backed bots (`bankBot`) do NOT trigger the lock.**
- **Scope:** the lock covers both promise kinds, and also any **loan-related term in trades**. Today `TradeOffer` has no loan terms (player-to-player loans are banned and pledged tiles can't be traded), so nothing else changes now. But the lock is written as "no promises or loan terms in trades" so a future loan term inherits it.
- **Where it applies:**
  - Game setup: when a normal-bot seat exists, the rules' promises setting shows as **locked off**, with the reason "Locked: a normal bot is seated", and can't be toggled. Removing the bot unlocks it (the preset's own value comes back).
  - At game start, the game's copy of the rules is saved with promises off. The lock is decided once at the start and **stays for the whole game**, even if the bot goes bankrupt.
  - Engine: `validateOffer` rejects promises when they're off (it already checks `promisesAllowed`). Add a test with a normal bot seated and one with only a bank-backed bot.
- No bot AI changes. Normal bots never meet promises, and bank-backed bots never trade (`validateOffer` already enforces that).

---

## 7. Differences from the mock-up README (deliberate)

1. **Decline is not on Back** (§4.5). Stage 1 rule.
2. **Names instead of pronouns** in the deal strip and the voucher sheet (§4.4).
3. **Loans are added to Inventory** (§3). The mock-ups left them out, but ManagePanel's loan features must survive.
4. **No Building's round counting** is defined precisely in §5.2. The README's "after everyone has taken N more turns" is the player-facing wording; keep that wording in the UI.

---

## 8. Assets and fixes from the mock-up handoff

- **D-pad glyph:** there's no d-pad prompt in `assets/symbols/`. Add one in the existing brass-coin style, matching the one drawn in the mock-ups (`source/lib.js` has its markup). Use it in every footer that prompts for the d-pad.
- **Teacup SVG:** `couch-monopoly-handoff/assets/token-reference/teacup.svg` line 52 has a duplicate `opacity` attribute, which strict SVG parsers reject. Replace it with the fixed copy at `docs/stage3/mockups/assets/tokens/teacup.svg`, or delete the duplicate attribute.
- Fonts in the mock-ups are the repo's own (Fraunces, Source Sans 3). No new font files.

---

## 9. Tests and acceptance

**Engine tests (new/updated):**
- Rent-Free: waives rent on every promiser-owned tile in the group, including one acquired after the trade. Only landings that owe rent use it up. Mortgaged and $0 landings don't. Double-rent railroad cards count as one landing. It ends at 0. It's voided by bankruptcy, not by the promiser selling tiles. Creating one requires the promiser to own at least one tile in the group after the trade.
- No Building: blocks house, hotel and shortage-auction building on the set. Allows selling. Counts down at the anchor seat's turn starts. The anchor moves if that seat goes bankrupt. Doubles don't count as extra turns.
- Merging identical promises. Duplicates within one offer are rejected.
- Bot lock: a normal bot locks promises (offer rejected). A bank-backed bot alone doesn't. The lock persists after the bot goes bankrupt.
- Save migration from tile-based promises.

**UI checks (on the TV, both controllers):**
- [ ] Inventory matches `inventory-1…4`. Every ManagePanel action is still reachable, including loans, in the debt phase too.
- [ ] Opening another player's binder with L/R is clearly view-only.
- [ ] Trade matches `trade-1…4`. Cash editor, voucher sheet (both kinds), editing and removing a voucher from the tray.
- [ ] Review: receiver glyphs, proposer paused, hold-to-accept works with both pads, Decline only via focus + Confirm, Back does nothing.
- [ ] The deal strip reads correctly from both sides, with names only.
- [ ] A locked game (normal bot) shows the padlocks and the reason. A bank-bot-only game doesn't.
- [ ] Badges on tiles and player cards for both promise kinds update as counts drop. The rent-free banner fires on use.
- [ ] Overlay orange is #FF8200 everywhere. The board is unchanged.
- [ ] Old saves load.
