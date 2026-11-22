# Stage 3: Inventory, Trade, group promises, report

Spec: [property-night-stage3-spec.md](property-night-stage3-spec.md). Judgment calls are in `DECISIONS.md` under "Stage 3". The screenshots below come from headless Chrome on the dev laptop at 1920 × 1080 (`scripts/plans/stage3.mjs`), on the mock-up table (`?demo=stage3`: Lawrence, Riley and Sam with the mock-ups' deeds, buildings and mortgages). Compare them with [the approved mock-ups](property-night-stage3-mockups/screenshots/).

## Screens

| Mock-up | Built |
| --- | --- |
| card-component | [card-sheet.jpg](card-sheet.jpg) (`?cards`) |
| inventory-1-collection | [inventory-1-collection.jpg](inventory-1-collection.jpg) |
| inventory-2-buildable | [inventory-2-buildable.jpg](inventory-2-buildable.jpg) |
| inventory-3-mortgaged | [inventory-3-mortgaged.jpg](inventory-3-mortgaged.jpg) |
| inventory-4-promises | [inventory-4-promises.jpg](inventory-4-promises.jpg) |
| (not in the mock-ups) view-only binder | [inventory-viewonly-riley.jpg](inventory-viewonly-riley.jpg) |
| (not in the mock-ups) debt phase with a loan | [inventory-debt.jpg](inventory-debt.jpg) |
| trade-1-building-offer | [trade-1-building-offer.jpg](trade-1-building-offer.jpg) |
| trade-2-promise-voucher | [trade-2-promise-voucher.jpg](trade-2-promise-voucher.jpg), then [trade-2b-offer-with-promises.jpg](trade-2b-offer-with-promises.jpg) |
| trade-3-review | [trade-3-review.jpg](trade-3-review.jpg), [trade-3b-holding.jpg](trade-3b-holding.jpg) (Space held, ring half full) |
| trade-4-promises-locked | [trade-4-promises-locked.jpg](trade-4-promises-locked.jpg) (`?demo=stage3bot`) |
| (not in the mock-ups) rent-free landing | [rent-free-banner.jpg](rent-free-banner.jpg) |

The plan also checks, in text: the deal strip from both sides ("You get … You give …", names only), Back doing nothing on the review and in the debt phase, a full hold accepting the trade (East Line to Riley, Sunset Drive to Lawrence, both promises in place), and a rent-free landing on South Line (no rent, 2 of 3 left).

Differences from the mock-ups that are on purpose (spec §7): Decline has no Back glyph; the voucher sheet and deal strip use names instead of "her / his"; Inventory has the loan button, strip and lock badges; the review header names the pad only when one is bound (keyboard play shows "your controller").

## Engine (spec §5, §6)

New tests in `tests/engine/promises.test.ts` cover every §9 engine bullet: Rent-Free on every promiser tile including one acquired later; mortgaged and $0 landings not counting; the double-rent railroad card counting once; ending at 0; surviving the promiser losing the tiles; voiding on bankruptcy; the ownership check at creation; No Building blocking houses, hotels and shortage auctions while allowing selling and mortgaging; the countdown at the anchor's turn starts; doubles not counting; the anchor moving; merging; duplicates rejected; the bot lock (normal bot on, bank-backed bot alone off, lock kept after the bot goes bankrupt). `tests/app/saves.test.ts` loads a v2 save with tile promises. All 316 tests pass, and the 10,000-game simulator still reports 0 illegal states.

## What to check on the TV (both controllers)

- [ ] Inventory looks like `inventory-1…4` at couch distance. Every old Manage action is reachable: build, sell, mortgage, unmortgage, Bank loan (take and pay off), and raising money in the debt phase.
- [ ] L / R on Inventory shows the other binders as clearly view-only.
- [ ] Trade: the cash editor (d-pad ±$10, L/R ±$100, Back undoes), the voucher sheet for both kinds, editing and removing a voucher from the tray, L/R jumping columns, the top face proposing.
- [ ] Review: the receiver's glyphs, "controller is paused" for the proposer, **hold-to-accept on both pads** (it reads the bound pad's Confirm, including the Nintendo swap setting), Decline only by focus + Confirm, Back does nothing. Back on the proposer's pad offers Withdraw.
- [ ] The deal strip reads right from both sides.
- [ ] A game with a normal bot shows the padlocks and "Promises are off: … is a normal bot."; a bank-bot-only game doesn't.
- [ ] Board badges: the ribbon on the promiser's tiles of the group, the No Building decal on the set; player cards count down; the rent-free banner on use.
- [ ] Overlay orange is #FF8200 everywhere (deeds, chips, vouchers, badges); the 3D board is unchanged.
- [ ] An old save loads (slot, autosave and imported file).

## Not covered here

- No pads were attached on the dev laptop, so the hold feel and both pads' glyphs are untested on hardware.
- The No Building decal's size and place on the tile were only checked in code, not on the TV.
