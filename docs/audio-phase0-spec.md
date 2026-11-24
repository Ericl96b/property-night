# Property Night Audio: Phase 0 Spec (Foundation Refactor)

## Context

`docs/audio-audit.md` (the audit you wrote earlier) is the reference for this task. Today, all audio is hardcoded Web Audio synthesis in `src/audio/sound.ts`. It is called only from `director.ts` (and from the developer test board). We're about to replace sounds with recorded files, one at a time. Phase 0 builds the system that turns each replacement into dropping in a file.

## Goal

After Phase 0, the game should sound the **same** as it does today. The only audible changes are the fixes listed in Section 8.

**Out of scope:**
- New sound assets or downloads
- Rewriting the music score
- New audio settings UI beyond the one UI-volume control in Section 5

---

## 1. Sound registry (single source of truth)

Create `src/audio/registry.ts`. Every sound in the game gets a string ID with one config entry:

| Field | Type | Purpose |
|---|---|---|
| `id` | string | e.g. `dice.bounce.wood` |
| `bus` | `'ui' \| 'sfx' \| 'music'` | Mixer bus |
| `files` | string[] | Variations (may be empty) |
| `synth` | optional | Fallback to an existing synth function (the current sounds) |
| `gain` | number | Per-sound level. Replaces the literal peak values in `sound.ts` |
| `pitchJitter` | number | Random ± semitones per play (default 0) |
| `gainJitter` | number | Random ± dB per play (default 0) |
| `cooldownMs` | number | Minimum gap between plays of this ID. Replaces the current `Throttle`s |
| `maxVoices` | number | Maximum simultaneous instances of this ID |
| `botGain` | number | Multiplier when a bot triggers the sound (default 1.0; no UI for it yet) |
| `priority` | number | Used by the voice cap and batching (Section 6) |

**Resolution order when an ID plays:** loaded files → synth fallback → silent.

**Variations:** pick at random, and never play the same file twice in a row when two or more exist.

---

## 2. File loading

- **Asset folder:** `public/audio/<category>/<id_with_dots_as_underscores>_01.ogg`, `_02.ogg`, and so on.
  - Example: `dice.bounce.wood` → `public/audio/dice/dice_bounce_wood_01.ogg`
  - Accept `.ogg` (preferred) and `.wav`.
- **Loader:** `fetch` + `decodeAudioData`, with decoded `AudioBuffer`s cached. Preload every registered file at startup.
- **Unlock:** design preloading around the existing first-gesture unlock (`main.ts:105-114`). Fetching and decoding can start before the unlock; playback waits for it. Move context creation, the unlock and visibility suspend/resume into the audio module rather than leaving them in `main.ts`.
- **Missing or failed files** log **one** dev warning per ID and fall back to the synth, or to silence. Never throw, and never block the game.

---

## 3. One play API with context

Replace the `SoundFx` methods (`dice`, `tap`, `coins`, `card`, `tock`, `sting`) with:

```ts
sound.play(id: SoundId, ctx?: {
  intensity?: number;   // 0-1, scales gain; available to synth fallbacks
  amount?: number;      // passed through so the coins synth keeps its 1-6 clink behavior
  isBot?: boolean;      // applies botGain
  seat?: number;        // acting seat
  payer?: number;       // money events
  payee?: number;       // money events
})
```

- `SoundId` is a string-literal union generated from the registry, so typos fail at compile time.
- Keep a `SILENT` no-op implementation for tests.
- The existing synth code stays, but moves behind registry entries as fallbacks.

---

## 4. Event → ID mapping (split the coarse sounds)

Map every call site to a specific ID. Where the audit shows one sound covering many situations, split it into separate IDs now. Point all the split IDs at the **same** synth fallback, so nothing changes audibly.

### Dice
| ID | Notes |
|---|---|
| `dice.bounce.wood` | Die hitting the floor or a wall |
| `dice.bounce.die` | Die hitting the other die. Record the contact type in `diceSim.ts` |
| `dice.instant` | Single knock at Instant speed |
| `dice.pickup`, `dice.throw`, `dice.settle`, `dice.doubles` | New silent hooks |

- `intensity` comes from the impact speed (relative velocity at contact, normalized), **not** from a random level.

### Movement
| ID | Notes |
|---|---|
| `token.step` | Each tile hop **except** the landing tile |
| `token.land` | The landing tile (uses the tap synth for now) |
| `token.instant` | Instant speed, plays on landing |
| `token.glide`, `token.removed` | New silent hooks |

### Money
One `payment` event plays one ID, chosen by the payment reason:

`money.rent`, `money.salary`, `money.tax`, `money.freeParking`, `money.purchase`, `money.build`, `money.sellBuilding`, `money.mortgage`, `money.unmortgage`, `money.jailFine`, `money.loanTaken`, `money.loanInstallment`, `money.loanPayoff`, `money.seizureRefund`, `money.generic` (anything else)

Pass `isBot`, `payer` and `payee` in the context. That lets us add pay-versus-receive variants later.

### Property and buildings
`property.transfer`, `property.toBank` (silent hook), `building.house`, `building.hotel`, `building.sell`

### Cards
`card.chance.draw`, `card.chest.draw` (both use the current swish), `card.reveal` and `card.dismiss` (silent hooks)

### Banners (all keep the current good or bad sting)
`banner.setComplete`, `banner.auctionWon`, `banner.rentFree`, `banner.seizure`, `banner.bankrupt`, `banner.botsLeave`

### New silent hooks for the audit's NO SOUND rows
Wire a call at each hook location the audit names, pointing at a registry ID with no files and no synth:

- **Turns:** `turn.start`, `turn.start.local` (it becomes a human's turn), `turn.end`
- **Board events:** `go.pass`, `debt.pending`
- **Jail:** `jail.enter`, `jail.release`, `jail.release.card`, `jail.doublesFail`
- **Auctions:** `auction.start`, `auction.bid`, `auction.leaderChange`, `auction.pass`, `auction.tick`, `auction.noWinner`
- **Trades:** `trade.open`, `trade.addItem`, `trade.removeItem`, `trade.addPromise`, `trade.removePromise`, `trade.propose`, `trade.holdProgress`, `trade.accept`, `trade.decline`, `trade.counter`, `trade.incomingFromBot`
- **Promises:** `promise.ended`
- **Game flow:** `game.start`, `game.over`, `game.undo`, `save.write`, `save.load`
- **Reserved:** `camera.move`

---

## 5. UI audio

- **New `ui` bus** and a new `volumeUi` setting (default 0.7). Add it to the Pause menu next to the existing volume controls, in the same style. Include it in `mixGains` and its tests.
- **Reach from the UI layer:** make the audio service reachable from `focus.ts`, `menuStack.ts`, `App.svelte`, `Trade.svelte` and `PauseMenu.svelte` without threading it through `director`. A small exported audio module or a Svelte context is fine; pick whichever is cleaner.
- **Wire these silent UI IDs** at the hooks the audit names:

| ID | Hook / rule |
|---|---|
| `ui.focus.move` | `moveFocus`. Fire only when focus actually changes |
| `ui.focus.hover` | `hoverFocus`. Cooldown ~60 ms. Fire only on an actual change |
| `ui.confirm` | `activate`/`clickFocused` **and** real mouse clicks on buttons. Use the least invasive approach that covers every button |
| `ui.back` | `menuStack.back` |
| `ui.denied` | Back pressed where it does nothing (buy, auction and debt decisions) |
| `ui.tab` | `cycleLeft`/`cycleRight`, `screenIntent` |
| `ui.open` / `ui.close` | `stackHooks.opened` / `stackHooks.closed` |
| `ui.pause` / `ui.resume` | `setPaused` |
| `ui.error` | `controller.ts:188` rejected action; input from a read-only pad |
| `ui.step` | `stepControl` (steppers and dropdowns) |
| `ui.toggle` | Settings switches |
| `ui.volumePreview` | After a volume change, play one sample on the bus that changed |
| `ui.skip` | Skipping an animation |
| `ui.controller.lost` / `ui.controller.found` | Controller disconnect / reconnect |
| `ui.lobby.join` / `ui.lobby.start` | Seat claimed / game start |

---

## 6. Voice management and the skip pile-up fix

- **Global voice cap** (~24). When the cap is full, drop the new sound if its priority is lower than every sound already playing. Otherwise stop the oldest lowest-priority sound.
- **Per-ID `maxVoices` and `cooldownMs`,** enforced centrally.
- **Batch window:** `queue.flush()` and `queue.update`'s multi-item frames (up to 8 per frame) must run inside a batch:
  ```ts
  sound.beginBatch(); /* ... start items ... */ sound.endBatch();
  ```
  Within one batch:
  - Each ID plays at most once. For money IDs, use the largest amount in the batch.
  - Play at most ~4 sounds in total.
  - Choose them by priority: banner > money > building/property > card > everything else.

---

## 7. Music (minimal changes only)

- Do **not** rewrite the score.
- Stop scheduling notes entirely when the effective music gain is 0, and resume when it is raised.
- Add a duck API, `sound.duck(amountDb, ms)`. Music ducks while the game is paused and briefly under banner stings.
- Route music through the registry/bus structure, so a future file-based track can replace the generator without touching callers.

---

## 8. Fixes (the only intended audible changes)

1. **Benchmark:** mute effects and music for the length of a bench run, then restore the previous levels.
2. **Speed consistency:** `property.transfer` now plays at Instant speed too (batching keeps it from spamming). `token.instant` plays on landing, not before the move.
3. **Dice level:** bounce level follows impact speed instead of being random.
4. **Skip and flush:** queued sounds no longer all fire at once (Section 6).
5. **Music:** ducks during pause (Section 7).

---

## 9. Dev Sound Test screen

Add a dev-only **Sound Test** screen next to the existing bench and test-board entries:

- List every registry ID, grouped by category.
- For each ID, show its status (**FILE** with the number of variations / **SYNTH** / **SILENT**) and a Play button.
- A Play button plays the ID with its jitter, so variations can be heard.
- Include an intensity slider for testing intensity-driven sounds like dice.
- Include a "reload audio files" button, so new files dropped into `public/audio/` can be auditioned without restarting.
- The screen must be fully usable with a controller.

---

## 10. Tests

- **Registry integrity:** every ID used in code exists in the registry, and every registry entry has a valid bus, gain and cooldown.
- **Playback logic:** variation selection (no immediate repeats), cooldowns, `maxVoices`, the global cap, and fallback order (file → synth → silent).
- **Batching:** one play per ID, the largest money amount wins, the total cap holds, and priority order is respected.
- **Event mapping:** run the director with a recording fake `Sound` and assert that representative engine events produce the expected IDs. Cover rent, salary, tax, purchase, house, hotel, sell, both card decks, all six banners, jail entry and turn start.
- **Mixer:** extend the existing `mixGains` tests for the `ui` bus.
- All existing tests must still pass.

---

## 11. Deliverable: `docs/audio-registry.md`

Generate (or hand-write) a markdown table with one row per registry ID:

| ID | Category | Bus | Trigger (plain English) | Hook location (file:line) | Current status (SYNTH / SILENT) | Expected file path(s) | Gain | Cooldown | Max voices |

This becomes the checklist for Phase 1: we fill in files one ID at a time.

---

## 12. Acceptance criteria

- [ ] The game sounds identical to before, except for the Section 8 fixes.
- [ ] Every audit row now maps to a registry ID with a live call site (silent where there is no sound yet).
- [ ] Dropping `public/audio/dice/dice_bounce_wood_01.ogg` into the folder makes dice bounces use that file, with no code change.
- [ ] A missing file never breaks anything; the sound falls back and one dev warning is logged.
- [ ] UI volume control works and persists.
- [ ] Sound Test screen works with a controller.
- [ ] Skipping a busy animation (for example, a multi-property trade) produces at most ~4 sounds.
- [ ] The benchmark runs silently.
- [ ] Tests pass. `docs/audio-registry.md` exists.

When finished, commit and push as usual, and reply with a short summary plus anything you deviated from in this spec and why.
