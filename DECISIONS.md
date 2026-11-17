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
