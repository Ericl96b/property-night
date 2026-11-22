# Batch 5 spec: swap the Pink and Yellow color groups

**For:** Claude Code, working in `Ericl96b/property-night`. Read `docs/HANDOFF.md` first and follow its standing instructions.
**Owner request:**
- The Pink group moves to the yellow positions and the Yellow group moves to the pink positions. Each property keeps its name, which travels with its color group.
- Prices, rents, house costs and mortgages stay tied to the board position.
- Both colors get new shades.
- Any existing save data is wiped.

Use plan mode first. Produce an implementation plan that covers every numbered requirement below, then implement it. Every value you need is given here. If something seems to need a judgment call that this spec doesn't settle, list it in the plan as a question before implementing it.

---

## 1. Board data (`src/data/classicBoard.ts`)

### 1.1 Tiles

Change only the `name` and `group` of these six tiles. Index, price, rents, house cost and mortgage stay exactly as they are now.

| Index | Name now → new | Group now → new | Price (unchanged) |
| --- | --- | --- | --- |
| 11 | Rose Court → **Goldfinch Lane** | pink → **yellow** | 140 |
| 13 | Peony Place → **Honey Street** | pink → **yellow** | 140 |
| 14 | Rosewood Lane → **Buttercup Row** | pink → **yellow** | 160 |
| 26 | Goldfinch Lane → **Rose Court** | yellow → **pink** | 260 |
| 27 | Honey Street → **Peony Place** | yellow → **pink** | 260 |
| 29 | Buttercup Row → **Rosewood Lane** | yellow → **pink** | 280 |

So the cheaper second-row set is now Yellow (Goldfinch Lane, Honey Street, Buttercup Row, at $140 / $140 / $160 with the old pink rents and $100 houses). The pricier third-row set is now Pink (Rose Court, Peony Place, Rosewood Lane, at $260 / $260 / $280 with the old yellow rents and $150 houses).

### 1.2 Group colors

In `CLASSIC_GROUPS`:
- `yellow`: color **`#D4A72C`** (mustard), `lightText: false`.
- `pink`: color **`#F569D7`** (bubblegum pink), `lightText: false`.

No other group changes.

### 1.3 Group order

Lists that present groups in board order must follow the new order: **brown, lightBlue, yellow, orange, red, pink, green, darkBlue**. Apply it to:
- the key order of `CLASSIC_GROUPS` (it sets the order of the color list in the board editor);
- `GROUP_ORDER` in `src/bench/scenes.ts`;
- `GROUP_IDS` in `src/render/buildings.ts`;
- the `GROUPS` list in `scripts/plans/batch3.mjs`.

Leave the `GroupId` union, the ids themselves (`'pink'`, `'yellow'`) and the label maps in `src/ui/present.ts` and `TestBoard.svelte` as they are.

## 2. Things that follow automatically (verify, don't change)

- **Buildings:** designs are keyed by group, so the Painted Lady and The Rosemont now stand on tiles 26/27/29, and the Mediterranean villa and Hotel Miramar on tiles 11/13/14, in the new colors. Don't change `buildings.ts` (beyond the §1.3 list order) or `buildingModels.js`.
- **Cards:** card targets are positions, so "Stroll down to {tile}" still moves to tile 11 and now reads "Goldfinch Lane". Keep every card target unchanged.
- **Everything else group-colored** follows from `board.groups`: the board texture, bands, title deeds, the group strip on the HUD and in trades, and the board editor swatches. Check each one in the verification screenshots (§6).

## 3. Wipe old data (one-time migration)

Data saved before this change describes the old layout, so it must not survive.

1. Add a one-time migration in `src/storage/migrations.ts`, run at startup right after the KV store opens and before saves, rules presets or board presets are read. Startup waits for it to finish.
2. It reads a record with id `dataVersion` from the `meta` store. If the record is missing or its value is below **2**, it:
   - deletes every record in the `saves` store, including the autosave;
   - deletes every record in the `presets` store whose `kind` is `'board'` and that isn't built-in;
   - writes `{ id: 'dataVersion', value: 2 }` to `meta`.

   Otherwise it does nothing.
3. Keep rules presets, settings (localStorage), input bindings and benchmark history.
4. Raise `SAVE_VERSION` in `src/app/saves.ts` from 1 to **2**. Exported save files from before this change are then rejected on import by the existing "Unsupported save version" message. Don't add a converter.
5. If the migration throws, log it and continue startup. Don't block the app over a failed wipe.

## 4. Tests

1. Update `tests/boardData.test.ts`:
   - tiles 11, 13, 14 are `yellow` with the new names, and tiles 26, 27, 29 are `pink` with the new names;
   - the prices at those six indices are unchanged (140, 140, 160, 260, 260, 280), as are their rents and house costs;
   - the two group colors match §1.2;
   - the per-group street counts are unchanged.
2. Add `tests/migrations.test.ts`, using the in-memory KV (`memoryKV`):
   - Seed two saves, one user board preset, one rules preset and a benchmark-history record. Run the migration and check:
     - the saves and the user board preset are gone;
     - the rules preset and the history record remain;
     - `dataVersion` is 2.
   - Run the migration again and check that nothing changes.
3. If any existing test asserts the old names, positions or colors, or `SAVE_VERSION = 1`, update it to the new values. Don't weaken any other assertion.

## 5. Documentation

1. **`SPEC.md` §8** (the classic layout line): list the group colors in the new board order with the new hex values: brown #955436, light blue #AAE0FA, yellow #D4A72C, orange #F7941D, red #ED1B24, pink #F569D7, green #1FB25A, dark blue #0072BB.
2. **`DECISIONS.md`**: add a "Batch 5: Pink/Yellow swap (owner request, 2026-11-22)" section covering:
   - the §1.1 table;
   - the colors;
   - that prices stay with position and names travel with the group;
   - that cards stay position-based;
   - the data wipe and `SAVE_VERSION` 2;
   - which building designs now sit where.

   Mark the Batch 3 note "Victorian = mid-low tier, Mediterranean = upper-mid tier" superseded if one exists. Don't delete it.
3. **`docs/PROGRESS.md`**: add a ticked "Batch 5" item under Owner feedback.
4. Don't edit the files in `couch-monopoly-handoff/reference/`. They're historical references.

## 6. Verification

1. `npm run typecheck`, `npm test` and `npm run build` pass.
2. Add `scripts/plans/batch5.mjs`, modeled on `batch3.mjs`, with these screenshots:
   - **Board:** the rest view, showing the mustard set on the left side and the pink set on the top side.
   - **Close-ups:** use `camera.frame` on tiles 11–14 and on 26–29, each with 4 houses on one tile and a hotel on another (patch the state as `batch3.mjs` does).
   - **Title deeds:** one yellow property (tile 14) and one pink property (tile 29) in the property card UI.
   - **Card text:** draw or force the Chance card that targets tile 11 and screenshot its text.
   - **Board editor:** the color list.
3. Read every screenshot. Check that:
   - the bands, deeds and HUD use #D4A72C and #F569D7;
   - band and deed text are dark and readable on both;
   - the names sit on the right tiles;
   - prices read $140/$140/$160 on the yellow set and $260/$260/$280 on the pink set;
   - the Mediterranean designs are on the yellow tiles and the Victorian designs on the pink tiles;
   - the Chance card reads "Goldfinch Lane".
4. **Migration in the browser:** in a plan step, write a dummy record to the `saves` store and set `dataVersion` to 1 through the app's KV. Reload, then check that the `saves` store is empty and `dataVersion` is 2.
5. Commit, push and confirm the Pages deploy as in `docs/HANDOFF.md`.

## 7. Do not

- Change any price, rent, house cost, mortgage, card target, rule, the GO salary or any other group's color.
- Rename the group ids or add new groups.
- Change building designs, scale or rendering.
- Convert old saves or presets instead of wiping them.

## 8. Acceptance

- [ ] Tiles 11/13/14: Goldfinch Lane / Honey Street / Buttercup Row, yellow #D4A72C, $140/$140/$160.
- [ ] Tiles 26/27/29: Rose Court / Peony Place / Rosewood Lane, pink #F569D7, $260/$260/$280.
- [ ] The Mediterranean buildings stand on the yellow set and the Victorian buildings on the pink set, in the new colors.
- [ ] The Chance card to tile 11 names Goldfinch Lane.
- [ ] After the first load of the new version, there are no saves and no user board presets; rules presets and settings survive. Old exported saves are rejected on import.
- [ ] Tests, typecheck and build pass; the batch5 plan runs clean; docs updated.
