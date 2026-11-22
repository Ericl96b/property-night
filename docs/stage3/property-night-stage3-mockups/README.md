# Property Night · Stage 3 mock-ups (approved): Inventory + Trade

These are the approved visual targets for replacing `ManagePanel.svelte` (with **Inventory**, using the "Binder" layout) and `TradePanel.svelte` (with **Trade**, using Option C: across the table plus a contract footer). Match the screenshots. The numbers in them are mock data: a three-player game with Lawrence on a Switch Pro, Riley on a PS4 and Sam.

Suggested location in the repo: `docs/stage3/`.

## Contents

| Path | What it is |
| --- | --- |
| `screenshots/*.png` | 1920×1080 renders of every state, plus the card sheet at 1920×1700. **These are the reference.** |
| `mockups/*.html` | The same screens as standalone HTML, using the repo's own fonts and tokens under `mockups/assets/`. Open them in Chrome to inspect exact CSS values. |
| `source/*.js` | The Node generator that produced the HTML. `lib.js` holds every component (cards, voucher, banknote, slot, button, stepper, glyph coins) and the full CSS. Use it as a value reference, not as code to ship. |

| Screen | File |
| --- | --- |
| Inventory: mid-game collection, focus on a railroad | `inventory-1-collection` |
| Inventory: buildable property, focus on an action | `inventory-2-buildable` |
| Inventory: mortgaged card (shows the card back) | `inventory-3-mortgaged` |
| Inventory: active promises (Promises row + row tags) | `inventory-4-promises` |
| Shared card component: three sizes, every kind, slot states, voucher steps | `card-component` |
| Trade: building an offer (cash amount being edited) | `trade-1-building-offer` |
| Trade: promise voucher sheet (adding or editing) | `trade-2-promise-voucher` |
| Trade: review, as the receiver sees it | `trade-3-review` |
| Trade: promises locked because a normal bot is in the game | `trade-4-promises-locked` |

## Decisions shown in the mock-ups

**Shared card component**
- There are three sizes: thumbnail 92×122, standard 200×266 and detail 360×480 (logical px). The slot wrapper takes focus, never the card itself. Focus uses the existing Stage 1 style (`style.css`).
- Card kinds:
  - Street deeds show their buildings.
  - Railroad and utility deeds.
  - A mortgaged card is drawn as its back.
  - Get Out of Jail Free is a new card drawn in the Chance-card frame.
  - Cash is a banknote stack.
  - Promise vouchers use a dashed cut line, a group stripe, a stamp and punch holes for the uses already spent.
- Text never goes below 14 px at any size. The detail deed is enlarged ×1.2 from `reference/cards.html` so its small print reaches 14 px.

**Inventory**
- Groups run in **current board order**: brown, light blue, mustard, orange, red, pink, green, dark blue, then railroads, utilities, jail cards and promises.
- Owned cards fill their slots. A slot you don't own is a dashed outline that shows who owns it, or "Unowned".
- The detail pane shows the focused card, its live rent row, buildings, mortgage state and actions. Disabled actions show their reason in red.
- Controls: the d-pad moves. Confirm moves focus into the action list and Back returns to the binder. L/R opens other players' binders, view-only.

**Trade (Option C)**
- Layout: the proposer's mini binder is on the left and the partner's on the right, with the tray ("X gives ⇄ Y gives") in the center. The plain-sentence **deal strip** runs along the bottom.
- Proposer's controls:

  | Input | Action |
  | --- | --- |
  | D-pad | Move |
  | Confirm | Add or remove the focused card (it slides in or out of the tray). On Cash, opens the amount. On "+ Promise", opens the voucher sheet. On a voucher in the tray, edits it. |
  | L/R | Jump between columns |
  | Top face (X / △) | Propose |
  | Back | Cancel, one level at a time |

- Cash: the d-pad changes it by ±$10 and L/R by ±$100, capped at the player's cash.
- Voucher sheet: pick the kind, then the group, then N. Its preview updates live, and editing an existing voucher opens the same sheet with its terms filled in.
- Review:
  - The banner is in the receiver's color, and the prompts switch to the receiver's controller glyphs.
  - The proposer's controller is paused.
  - The cards are standard size, and the deal strip is written from the receiver's side ("You get… You give…").
  - **Accept is press-and-hold.** Focus starts on Accept, so the hold guards against a stray press.
  - Counter reopens the same screen with the sides swapped.
- **No advisory notes**: nothing like "completes a set" or "Heads-Up". The review side rails show only cash before → after.
- Properties with buildings can't be traded and show the reason "Has houses". A mortgaged property can be traded, and the receiver gets the existing 10% prompt.

**Promise rules (as the vouchers show them)**
- Each voucher records **Promised by** (who carries the obligation) and **Held by** (who benefits). In a trade, a voucher sits on the side of the player who promised it.
- **Rent-Free:** the holder pays the promiser no rent on an entire group (one color set, all railroads or both utilities). This covers properties in that group the promiser acquires later. N counts the holder's landings, from 1 to 99. *My assumption:* only landings where rent would otherwise be owed use up a landing.
- **No Building (Restricted Development):** the promiser can't build houses or hotels on one color set for N full rounds, from 1 to 20. Selling is still allowed. Railroads and utilities aren't options.
- **Locked state:** if any normal bot is seated, trade promises are disabled. Bank-backed bots don't count. The "+ Promise" slots show a padlock with the line "Promises are off: Sam is a normal bot."
- This changes the engine's current `Promise { kind:'rentFree', tileId, turnsLeft }` to group-based promises with a kind and a remaining count. Claude Code decides the exact type.

## Flags

1. **Orange in the overlay.** `CLASSIC_GROUPS` uses `#DC5A00` on purpose, to compensate for ACES tone mapping on the 3D board. The HTML overlay isn't tone-mapped, though, and the mock-ups use `#FF8200`. The overlay (deeds, chips, vouchers) needs its own UI hex separate from the board hex. Mustard is `#E3BC2A` in both.
2. **Broken asset:** `couch-monopoly-handoff/assets/token-reference/teacup.svg`, line 52, has a duplicate `opacity` attribute, so strict SVG parsers reject it. A fixed copy is in `mockups/assets/tokens/teacup.svg`.
3. **New controller glyph:** there was no d-pad prompt in the assets, so the mock-ups draw one in the same brass-coin style.
