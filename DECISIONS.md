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
