# Batch 3 spec: themed houses and hotels

**For:** Claude Code, working in `Ericl96b/property-night` (read `docs/HANDOFF.md` first and follow its standing instructions).
**Owner-approved change:** each color group gets its own house and hotel design, replacing the green and red boxes. The designs were approved in a separate 3D look test. This batch only integrates them; it doesn't redesign them.
**Delivered with this spec:** `buildings.js`, the approved asset module.

Use plan mode first. Produce an implementation plan that covers every numbered requirement below, then implement it. Every value you need is given here. If something seems to need a judgment call that this spec doesn't settle, record it in `DECISIONS.md` under this batch, and list it in the plan before implementing it.

---

## 1. What changes and what doesn't

**Changes**
- How houses and hotels look: per-group designs, built from `buildings.js`.
- How buildings are drawn: one `BatchedMesh` per surface finish instead of two `InstancedMesh`es.
- Building size: one uniform scale for all designs (§5), replacing the 22% / 70% box sizes.
- How the sell animation is implemented. It looks the same as before (lift and fade).

**Doesn't change**
- The `Buildings` public API used by `director.ts` and `main.ts`: `group`, `countOn`, `totals`, `set`, `add`, `remove`, with the same signatures, return values and semantics.
- Placement on the color band, the house slot positions (`houseSlotLX`), the hotel at the band center, and the drop-in timing and curve, the "tock" sound, speed scaling and Instant behavior.
- Engine, bots, UI, rules and settings. No new settings.

## 2. The asset module

1. Copy `buildings.js` to `src/render/buildingModels.js`.
2. Don't edit `buildingModels.js`, with one exception. It imports `three/addons/geometries/RoundedBoxGeometry.js` and `three/addons/utils/BufferGeometryUtils.js`. If the build or typecheck can't resolve those specifiers, change them to the `three/examples/jsm/...` paths the rest of the repo uses. Change nothing else; any other problem with the file goes in the plan as a question.
3. The game uses exactly one export: `buildGameAssets`, plus the `FINISH_NAMES` constant if you need the list. The module's other exports are for the standalone viewer and must not be used: `createBuilding`, `applyPalette`, `setLights`, `disposeBuilding`, `SETS`, `LIT`, `CLASSIC`.
4. `buildGameAssets` needs a DOM: it draws canvas textures. Call it only in the browser. Never import or call it from Vitest tests.

### 2.1 What `buildGameAssets({ colors })` returns

- **Input:** `colors` maps a `GroupId` (`brown`, `lightBlue`, `pink`, `orange`, `red`, `yellow`, `green`, `darkBlue`) to an sRGB color number (`0xRRGGBB`). That color becomes the design's accent: its roof, shutters, flags, awnings and so on.
- **`finishes`:** 18 shared `MeshPhysicalMaterial`s keyed by finish name (`FINISH_NAMES`). They use vertex colors; texture tiling and the sign/facade atlas are already baked into the UVs.
- **`castShadow`:** finish name → boolean. `glass`, `railing` and `print` are false; every other finish is true.
- **`designs[groupId].house` / `.hotel`:** `{ parts, size }`.
  - `parts` is one entry per finish the design uses, each `{ finish, geometry }`. Geometries are indexed and carry `position`, `normal`, `uv` and `color`. They're in model units, with the origin at the center of the footprint, the ground at y = 0, and the front facing +Z.
  - `size` is the bounding size (x = width, y = height, z = depth) in model units.
- **`dispose()`:** frees every geometry, material and texture it created.

The returned data is already final. Don't re-merge, re-color, re-UV or re-center it.

### 2.2 Type declaration

Add `src/render/buildingModels.d.ts` declaring only what the game uses:
- `FINISH_NAMES`: a readonly tuple of the 18 names, in this order: `matte, gloss, matteDouble, metal, iron, glass, railing, print, stucco, clapboard, planks, bricks, stones, shingle, scales, tile, seams, copper`.
- `FinishName`: the union of those names.
- `BuildingDesign` and `GameBuildingAssets` interfaces matching §2.1. Types come from `three` (`BufferGeometry`, `MeshPhysicalMaterial`, `Vector3`); `GroupId` comes from `src/data/classicBoard.ts`.
- `buildGameAssets(opts?: { colors?: Partial<Record<GroupId, number>> }): GameBuildingAssets`.

Don't enable `allowJs`. The declaration file is the module's type.

## 3. Designs (for logs and docs)

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

All houses in a group are identical; there's no per-house variation.

## 4. Asset lifecycle

1. The `Buildings` constructor takes the `BoardData`. In `GameScene`, construct it inside `GameScene.create`, after lighting is created, with the board passed to `create`. The `buildings` field stops being a field initializer. `scene.add(s.buildings.group)` stays where it is.
2. Accent colors come from the board: for each `GroupId`, parse `board.groups[id].color` (`#RRGGBB`) into a number and pass all eight to `buildGameAssets`. Custom board presets therefore recolor the buildings.
3. Add `setBoard(board)` to `Buildings` and call it from `GameScene.setBoard`. It disposes the old assets and batches, builds new ones, and re-places every currently placed building without animation, keeping tiles, slots and counts.
4. A building's design comes from the group of the tile it stands on: `board.tiles[tile].group`. Buildings only ever stand on street tiles.
5. Time the `buildGameAssets` call and store it as a new `buildingsMs` field in `SceneStats`.

## 5. Size and placement

- **Scale:** `0.016` board units per model unit, uniform on all three axes, for houses and hotels alike. Keep it as a named constant in `buildings.ts`.
  - The widest house (Modern Villa, 1.24 model units) comes out at 0.0198, inside the 0.0204 slot pitch.
  - The deepest design (Ski Lodge, 1.35) comes out at 0.0216, inside the 0.038 band.
  - Hotels come out at roughly 29–36% of the tile width, not 70%. That's intended: it matches the approved look-test proportions between houses and hotels.
- **Position:**
  - Houses stand at `tileLocalToWorld(tileFrame(tile), houseSlotLX(slot), BAND_CENTER_LY)`; hotels at local x = 0 on the same band line.
  - y = `BOARD_TOP`; the model's ground is at y = 0, so add no extra offset.
- **Orientation:** yaw = `tileYaw(tileFrame(tile))`, as today. The model's +Z then faces the tile's outer edge, so a building's front faces the player whose side the camera is on.
- Use the same matrix composition as today (position, yaw quaternion, uniform scale), with the scale above.

## 6. Rendering structure

1. After building the assets, create one `BatchedMesh` per finish that at least one design uses (all 18 in practice).
   - Material: the finish material from `finishes`.
   - `maxInstanceCount`: 5 × the number of street tiles on the board (4 house slots + 1 hotel per street; 110 on the classic layout). Not 32 / 12: the "unlimited" building supply and the perf worst-case board both exceed the bank's default supply.
   - `maxVertexCount` and `maxIndexCount`: the sums over every design part with that finish.
2. Add each design part's geometry to its finish's batch once, at build time. Keep a lookup from (group, kind, finish) to the geometry id.
3. Placing a building adds one instance to every batch its design has a part in, all with the same matrix. Keep the instance ids with the placed record. Removing a building deletes those instances.
4. Batch settings:
   - `castShadow` from `castShadow[finish]`; `receiveShadow` true for every batch.
   - Turn off per-instance sorting (`sortObjects` false); nothing is transparent.
   - Keep per-object frustum culling on.
   - `frustumCulled` false on the batches themselves, as today.
5. Name each batch `buildings-<finish>` and keep them all under `Buildings.group`.

## 7. Behavior

- **`set(tile, houses, hotel)`:** unchanged semantics. It replaces whatever stands on the tile with no animation.
- **`add(tile, durationScale)`:** unchanged semantics, including the 4-houses-become-a-hotel case. The houses disappear at once, then the hotel drops in.
  - Animate the drop by updating the new building's instance matrices every tick with the existing curve: 0.18 s × `durationScale`, falling from 0.03 above with the gravity ease, then the 0.0025 bounce over the last 30%. No temporary meshes.
  - With a duration ≤ 0, place it directly and return `undefined`.
- **`remove(tile, durationScale)`:** unchanged choice of which building goes (the highest slot, or the hotel).
  - Delete its instances at once, then show the lift-and-fade with temporary `Mesh`es: one per design part, reusing the part geometry (not cloned), with a transparent clone of that part's finish material.
  - Same timing as today: 0.35 s × `durationScale`, lift 0.03 × k², opacity 1 − k.
  - At the end, remove the meshes and dispose the cloned materials only.
- Return values for the animation queue are unchanged: an update function that returns true while running, or `undefined`.
- **No idle animation.** The flags, bell, marquee lights and beacon from the look test are frozen in the asset data. Rendering stays on-demand (SPEC §10.10).

## 8. Remove

From `src/render/buildings.ts`: the `HOUSE` / `HOTEL` size constants, `MAX_HOUSES` / `MAX_HOTELS`, `buildingGeometry`, `lighten`, the two `InstancedMesh`es and the shared lacquer material. Delete any import left unused.

## 9. Do not

- Add bloom or any other post-processing effect. SPEC §10.3 rules bloom out, and the owner confirmed it.
- Call `setLights`, or add a day/night or lit-windows mode.
- Use `createBuilding`, or build the showcase-detail models in the game.
- Add a "classic green/red buildings" option, per-house variation, dust puffs, squash-and-stretch or any other animation beyond §7.
- Change the asset module's look, colors, materials or geometry.
- Change camera, lighting, quality profiles, signs, decals or tokens.

## 10. Performance (SPEC §10.10)

Measure with `scripts/plans/perf.mjs` at High and at Low, AO off. Then measure once at High with AO on (Settings → Graphics).

| Check | Requirement |
| --- | --- |
| Draw calls, worst-case board (the perf plan's full board) | < 150 with AO off, and < 150 with AO on. Expected: about 120 off, about 140 on, up from 93 / 109, since each finish adds one main and one shadow call. |
| Idle frames | Still 0 rendered in 2 s when nothing animates. |
| `buildingsMs` | Report it. If startup to the interactive menu grows by more than 600 ms over the 1.3 s baseline, say so in the plan's results and propose deferring the build. Don't defer without asking. |

If draw calls exceed 150, stop and report the numbers rather than cutting finishes or shadows.

## 11. Documentation

1. **`SPEC.md` §10.5:** replace the first two bullets with:
   - "Real meshes from `src/render/buildingModels.js`: each color group has its own house and hotel design (table in DECISIONS.md, Batch 3). The group's board color is the accent. Lacquered-wood and painted finishes, 18 shared materials."
   - "Size: one uniform scale (0.016 board units per model unit) for houses and hotels; four houses fit across the band; hotels keep the approved house-to-hotel proportions (≈ 29–36% of the tile width)."

   Keep the placement and animation bullets. In §10.10, leave the budget as it is.
2. **`DECISIONS.md`:** add a "Batch 3: themed buildings (owner request, 2026-11-21)" section:
   - the §3 design table;
   - the scale and its fit numbers (§5);
   - the BatchedMesh-per-finish structure and the measured draw calls;
   - `buildingsMs`;
   - that hotels are now narrower than the old 70%, by owner-approved proportion;
   - that idle building animations are frozen to keep render-on-demand;
   - that this supersedes the "Houses are 22% of the tile width" entry. Mark that entry superseded; don't delete it.
3. **`docs/PROGRESS.md`:** add a ticked "Batch 3" item under Owner feedback with the check command from §12.
4. **`docs/HANDOFF.md`:** in the code map, change the `buildings.ts` description to "themed buildings, one BatchedMesh per finish" and add `buildingModels.js` ("approved building asset module; edit only via the owner's look-test workflow").

## 12. Verification

1. `npm run typecheck`, `npm test` and `npm run build` pass.
2. Add `scripts/plans/batch3.mjs`, modeled on `batch2.mjs`: same base URL and env vars, `?auto=human,human&seed=5&speed=normal&quality=high`. Steps:
   - **Full board:** patch the state like `perf.mjs` (every street owned; streets alternate 4 houses and a hotel by `i % 3`; bank set to 1000 / 1000). Screenshot the rest view from each of the four camera sides (`b3-side0` … `b3-side3`).
   - **Close-ups:** use `camera.frame(x, z, zoom)` at zoom ≈ 0.3 on one tile per group with 4 houses, and one per group with a hotel (16 shots, `b3-<group>-house` / `b3-<group>-hotel`).
   - **Animations:** on an empty street, call `add` four times, then a fifth time (hotel), then `remove` once. Screenshot mid-drop and after settling (`b3-drop`, `b3-hotel-upgrade`, `b3-sell`).
   - **Fit check:** in an `eval` step, return `size.x × 0.016` for each house design and check it's < 0.0204. Return the largest `size.z × 0.016` and check it's < 0.038.
   - **Draw calls:** in an `eval` step, return `renderer.lastRenderInfo` on the full board.
3. Read every screenshot. Check that:
   - each group shows its own design;
   - fronts face the outer edge on all four sides;
   - no building overlaps its neighbor or the band edges;
   - shadows look right;
   - no building has black or missing faces, and no surface flickers between frames.
4. Run `scripts/plans/perf.mjs` at High and Low and record the §10 numbers in `DECISIONS.md`.
5. Commit, push and confirm the Pages deploy as in `docs/HANDOFF.md`.

## 13. Acceptance

- [ ] All 16 designs appear in game on their groups, in each group's board color, on the classic board and on a preset with edited group colors.
- [ ] `add` / `remove` / `set` behave exactly as before, including the hotel upgrade, speed scaling and Instant.
- [ ] Worst-case board: < 150 draw calls with AO off and with AO on; 0 idle frames.
- [ ] No bloom; no idle animation.
- [ ] Docs updated per §11; the batch3 plan runs clean.
