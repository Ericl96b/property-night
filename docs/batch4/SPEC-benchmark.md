# Batch 4 spec: graphics benchmark, test board and performance overlay

**For:** Claude Code, working in `Ericl96b/property-night` (read `docs/HANDOFF.md` first and follow its standing instructions).
**Owner request:** a way to check how the game runs on the TV PC without playing a game until someone owns a color set. Three parts:

1. **Benchmark**: a fixed, repeatable scripted run (like the benchmark in a PC game's graphics settings) that stresses the scene and ends on a results screen with numbers and recommendations.
2. **Test board**: a sandbox reached from the main menu where houses, hotels, owners and mortgages can be placed on any property instantly, with no game rules.
3. **Performance overlay**: an optional corner readout of frame rate and frame time, usable in the test board, the benchmark and real games.

Use plan mode first. Produce an implementation plan that covers every numbered requirement below, then implement it. Record judgment calls in `DECISIONS.md` under "Batch 4" and list them in the plan before implementing. Save this file as `docs/batch4/SPEC-benchmark.md`.

---

## 1. What changes and what doesn't

**Changes**
- Main menu gets a **Test board** button (below Load game).
- Settings gets a **Performance** section: *Performance overlay* (Off / FPS / Detailed) and a **Run benchmark…** button. Settings is reachable from the main menu and the pause menu; the benchmark button is shown in both but is disabled during a real game with the note "Quit to menu to run the benchmark." (a benchmark must never touch a game in progress).
- `Renderer` gets a continuous-render mode and frame timing instrumentation (§2).
- New files (suggested): `src/perf/` for timing, stats, verdict and recommendation logic (pure TS, no DOM where possible); `src/bench/` for the benchmark script and the test-board state; Svelte components `BenchmarkPanel.svelte`, `TestBoard.svelte` (controls), `PerfOverlay.svelte`.

**Doesn't change**
- Rules engine, bots, rule defaults, save format.
- Palette, fonts, art direction, existing screen layouts and button layout (SPEC §0). New panels use the existing `.panel` style, `ActionButton`, and the same typography. If a new screen needs a layout decision, follow the existing panels and note it in `DECISIONS.md`.
- Render-on-demand behavior in normal play: when nothing animates and the overlay is off, the game still renders 0 frames while idle (SPEC §10.10). Continuous rendering is only on during the benchmark, and while the overlay is set to Detailed in the test board (§4.4).
- Draw-call budget (< 150 per frame with a full board) must still hold.
- "Monopoly" stays out of all names and text.

---

## 2. Measurement (shared by all three parts)

### 2.1 What a browser can and can't measure, design around it

- `requestAnimationFrame` is capped at the display's refresh rate as Windows has it set (the owner's TV supports 120 Hz; it may be running at 60). On a fast GPU, FPS alone will just read "60" or "120" and say nothing about headroom. That's why frame time and GPU time are the main numbers, not FPS.
- GPU time: use `EXT_disjoint_timer_query_webgl2` when the extension is available. Wrap each `composer.render()` in a `TIME_ELAPSED_EXT` query, read results asynchronously a few frames later, discard results when `GPU_DISJOINT_EXT` is set. When the extension is missing, report GPU time as "not available in this browser" and say so on the results screen; never estimate it silently.
- CPU time: `performance.now()` around the per-frame work (tickers + `composer.render()` submission).
- The browser can't read the display's *maximum* refresh rate, only the rate it is currently running at (measured from rAF intervals). It can't tell whether the TV could do 120 Hz.
- The browser can't read hardware utilization, temperatures, clock speeds, VRAM, or the CPU model. Don't show placeholders for these. What can be reported: the WebGL renderer string (`gpuName()`), `navigator.hardwareConcurrency`, max texture size, which timer extension was used, CSS size, `devicePixelRatio`, and the actual drawing-buffer size.

### 2.2 Instrumentation in `Renderer`

1. Record per rendered frame: timestamp, frame interval (time since the previous rendered frame), CPU ms, GPU ms (when available, filled in late), draw calls, triangles.
2. Keep a ring buffer (last ~2,000 frames). Expose `beginCapture(label)` / `endCapture(): FrameSample[]` so the benchmark can collect samples per phase.
3. `setContinuous(on: boolean)`: while on, the loop renders every rAF even when nothing is dirty. Off restores render-on-demand exactly as now.
4. Estimate the display refresh rate once (median rAF interval over ~60 frames while continuous) and expose it; the verdict needs it.
5. The instrumentation must cost nothing measurable when no capture is running and the overlay is off (no timer queries issued, no array growth).

### 2.3 Statistics (pure functions, unit-tested)

For a list of samples compute: average FPS, **1% low FPS** (FPS at the 99th-percentile frame interval), average / median / p99 frame interval, average and p99 CPU ms, average and p99 GPU ms (if present), max draw calls, max triangles, and the count of frames over the refresh budget (dropped/late frames).

### 2.4 Bottleneck classification (pure function, unit-tested)

Budget = 1000 / measured refresh rate (16.7 ms at 60 Hz, 8.3 ms at 120 Hz). Snap the measured rate to the nearest common rate (30, 50, 60, 75, 100, 120, 144, 165, 240 Hz) when within 3%. Nothing in the code may assume 60.
- **GPU-bound**: p99 GPU ms > 0.85 × budget.
- **CPU-bound**: p99 CPU ms > 0.85 × budget and not GPU-bound.
- **Display-capped**: neither; the game is waiting on the display's refresh. Report headroom as budget ÷ p99 GPU ms (or ÷ CPU ms if GPU time is unavailable), e.g. "≈ 4.2× headroom".
- **Unknown**: GPU time unavailable and frame intervals exceed budget; say it can't tell which side is slow.

### 2.5 Targets: refresh rate and 60 fps

Every result is judged against two targets, shown side by side:
- **Display target**: the measured refresh rate (e.g. 120 fps on the TV at 120 Hz). The verdict uses this one.
- **60 fps reference**: always reported too (frames over 16.7 ms, 1% low vs 60), so runs at 60 Hz and 120 Hz can be compared, and so the results say whether the PC would hold 60 if the display ran at 60.

When the display target is above 60, a phase that holds 60 but not the display rate is labeled "smooth at 60, not at {rate}" rather than failing.

This raises the owner's performance target in SPEC §10.10 for the TV PC: steady 120 fps at 3840 × 2160 on High when the display runs at 120 Hz (60 fps stays the floor). Record this in `DECISIONS.md`; don't change any rendering to chase it in this batch, only measure against it.

---

## 3. Benchmark

### 3.1 Entry and setup

1. Settings → Performance → **Run benchmark…** opens a small panel: **Quick** (≈ 20 s), **Standard** (≈ 60 s), **Compare settings** (runs Standard once per configuration in §3.4), and Cancel.
2. The benchmark builds its own scene state; it doesn't start an engine game, doesn't create a save, doesn't run autosave, and doesn't change `Continue`. On exit the scene is cleaned exactly like the existing `onnewgame` cleanup in `main.ts` and the main menu returns.
3. It uses the player's current settings (quality, AO, brightness, tone mapping, speed is forced to Normal for the run and restored afterwards). Fixed seed, fixed timeline, fixed camera path: two runs on the same machine and settings must do identical work, so results are comparable.
4. The overlay UI hides during the run except a small progress strip (phase name, progress bar, "Press Back to cancel"). Back / Escape cancels and returns to the menu with no results saved. Pressing Back must work from keyboard and both controllers.
5. Turn on `setContinuous(true)` for the whole run; turn it off at the end, including on cancel or error.

### 3.2 The scene

Worst realistic case, the same idea as `scripts/plans/perf.mjs`'s "full board":
- 6 tokens on the board, spread across sides (one in jail).
- Every property owned (owner discs and SOLD signs for 6 colors).
- Every street built up: alternate groups with hotels and with 4 houses, so every group's house **and** hotel design is on screen at least once.
- Some railroads/utilities mortgaged, a few pledged (padlock) and one promise ribbon, so every decal type is drawn.
- Card decks in place.

Drive the existing render classes (`scene.tokens`, `scene.buildings`, `scene.decals`, `scene.signs`, `scene.dice`, `scene.camera`) and the director's existing animation functions where possible. Don't fake effects with simpler stand-ins: the point is to measure what the game really draws.

### 3.3 Phases (Standard; Quick runs phases 1, 3 and 4 at about a third of the length)

Each phase is captured and scored separately.

| # | Phase | What happens | Why |
| --- | --- | --- | --- |
| 1 | **Table at rest** | Rest camera, full board, light ambient motion only (continuous render). 8 s. | Baseline cost of the full scene at the player's resolution. |
| 2 | **Board turns** | Camera rotates to each of the 4 sides in turn (normal 1.4 s turn), with light rig. 8 s. | Shadow map and full-screen redraw while everything moves. |
| 3 | **Street close-ups** | Follow-zoom sweep across all 8 color groups at the close follow zoom, nudged slightly for parallax. 12 s. | Most pixels covered by buildings: fill rate, shadows, AO at 4K. |
| 4 | **Construction wave** | Every house and hotel sells (lift + fade) and drops back in, group by group, with the build bounce. 12 s. | Instance-matrix updates and the transparent sell meshes. |
| 5 | **Turn moment** | Dice roll with physics, token hop along 7 tiles with camera follow, a payment moment with its overlay. 10 s. | The heaviest everyday moment: physics, animation, UI compositing. |
| 6 | **Headroom** | Phase 3's worst frame held still, rendered *k* times per displayed frame, *k* = 1, 2, 3 … up to 8, 2 s each, stopping when the frame interval exceeds the budget. 8–16 s. | Shows spare capacity when the display cap hides it. Report "k = N renders per frame before dropping below {rate}", and convert to an equivalent frame rate (k × rate) so 60 Hz and 120 Hz runs compare. |

Phase 6 only runs in Standard and Compare. If timer queries are available it still runs (it confirms the timer-query estimate with an end-to-end number).

### 3.4 Compare settings

Runs Standard for each of: **High + AO on**, **High + AO off**, **Low + AO off**. Switch quality with `scene.setQuality()` between runs (texture regeneration happens between runs, never mid-capture) and restore the player's settings at the end. The results screen shows a side-by-side table (§3.5) and the recommendation names which configuration to use: the best-looking one that holds the display rate; if none does, the best-looking one that holds 60, stating which holds 120 if any.

### 3.5 Results screen

One panel, readable from the couch at 4K (same type sizes as the stats panel).

**Header: verdict**, one line in plain words, using the measured rate, e.g.:
- "Runs smoothly at 120 fps with headroom to spare (≈ 2× spare)."
- "Smooth at 60 fps, but drops below 120 in Street close-ups."
- "Below 60 fps in most phases: try the suggestions below."

**System box**: GPU (renderer string), resolution rendered (drawing buffer, e.g. 3840 × 2160) and how it got there (CSS 1920 × 1080 × DPR 2.0), display refresh estimate, quality / AO / tone mapping used, CPU threads, GPU timer available yes/no, date.

**Per-phase table**: avg FPS, 1% low, p99 frame ms, avg GPU ms, avg CPU ms, max draw calls, bottleneck label. Highlight the worst phase. Each FPS cell shows pass/fail against both targets (§2.5).

**Headroom line**: from phase 6 and/or the classification.

**Recommendations**: a rules-based list (pure function, unit-tested). Only show rules that fire; if none fire, say "No changes needed." Rules:

1. **Software rendering**: renderer string matches SwiftShader / llvmpipe / "Microsoft Basic Render" → "The browser isn't using your graphics card. Turn on hardware acceleration in the browser settings and restart it." Shown first; skip the other rules, since the numbers are meaningless.
2. **Wrong GPU**: renderer string looks integrated (`isIntegratedGpu`) while discrete-class performance is expected (owner may have a dGPU) → "The browser is running on integrated graphics. In Windows Settings → Display → Graphics, set the browser to High performance."
3. **Not native resolution**: drawing buffer smaller than `screen.width × screen.height × devicePixelRatio` (allowing small rounding), or smaller than 3840 × 2160 while `screen` reports 4K → explain the mismatch (Windows scaling vs. browser zoom vs. the window not being fullscreen) and suggest fullscreen / browser zoom 100%.
4. **Low refresh**: refresh estimate ≈ 30 Hz → "The display is running at 30 Hz. Check the TV's input mode / Windows display refresh rate."
4a. **Running at 60 Hz with headroom for more**: refresh ≈ 60 Hz and headroom shows the PC could sustain ≥ 120 fps (p99 GPU and CPU ms < 7.5 ms, or headroom k ≥ 2) → "Your PC could run this at 120 fps. If your TV supports 120 Hz: set the refresh rate to 120 Hz in Windows Settings → Display → Advanced display, use an HDMI 2.1 port on the TV and an Ultra High Speed HDMI cable, and turn on the TV's Game/PC mode for that input. Restart the browser afterwards." Phrase it conditionally: the browser can't know the TV's maximum (§2.1).
4b. **At 120 Hz but only holding 60**: point to rule 5's settings and state the measured gain toward 120 for each.
5. **GPU-bound with drops**: suggest, in order of visual cost, AO off → Low quality, stating the measured gain if Compare was run ("Low gave +38% in Street close-ups").
6. **Plenty of headroom on Low or AO off**: suggest High / AO on ("Your PC has room for High with ambient occlusion").
7. **CPU-bound**: say the slowdown is on the processor side, settings will help little, and suggest closing background apps; the overlay/HUD and benchmark capture themselves must not be the cause (verify in tests by comparing capture-on vs. capture-off CPU ms in the perf plan).
8. **Draw calls over budget (≥ 150)**: flag as a game bug, not a settings issue: "This is a problem in the game, not your PC; copy the results for the developer."

Wording: plain, specific, no exclamation marks, no blame.

**Buttons**: Run again, Copy results (plain-text summary to the clipboard, ready to paste into a chat), Export JSON (full samples summary, not raw frames), Back.

### 3.6 History

Store the last 10 results summaries (not raw samples) in the IndexedDB `meta` store under `benchmarks`, newest first. The benchmark panel shows the previous result for the same configuration next to the new one ("last run: 1% low 58 → now 60"). A **Clear history** link removes them.

---

## 4. Test board (sandbox)

### 4.1 Entry and exit

1. Main menu → **Test board**. It loads the default board preset (or the board picked in the panel, §4.3) with no players taking turns, no engine actions, no bots, no autosave, no saves, no game stats, and `Continue` unaffected.
2. Exit (button, or Back from the top level) returns to the main menu with the scene cleaned the same way as `onnewgame`.
3. Implementation can reuse a `State` from `newGame` purely as data plus `director.sync()` to place everything, as long as the controller never dispatches, never starts bot timers, and `controller.onChange` (autosave) never fires for it. Add a test that entering, editing and leaving the test board leaves the stored autosave unchanged.

### 4.2 Presets (one press each, instant)

- **Empty board**
- **All houses**: 4 houses on every street, 1 owner color.
- **All hotels**: hotel on every street.
- **Worst case**: the benchmark's §3.2 scene.
- **One group**: a picker cycles the 8 color groups; puts houses on one street, a hotel on the next, so both designs of that group can be inspected up close.

### 4.3 Editing

- Select a tile with the D-pad/arrows (moves around the board in order) or the mouse. The selected tile gets a subtle highlight using an existing style (e.g. the owner-disc ring brightened); no new colors.
- On the selected street: **Add building** / **Remove building** (0 → 4 houses → hotel and back) with the normal drop-in and sell animations and sound, so they can be judged. **Owner** cycles none + 6 colors. **Mortgage** and **Pledge** toggle. No rules checks (even building, set ownership, bank supply all ignored).
- **Board**: pick a board preset (re-generates the face via `scene.setBoard`, as on game start).
- **Tokens**: Off / 2 / 6 tokens.
- **Animate**: a toggle that loops phase 4 (construction wave) and phase 2 (turns) from the benchmark, for watching the motion on the TV.
- Camera: right-stick nudge as in play; **LB / RB** (Q / E on keyboard) rotate to the previous/next side; **close-up** toggle on the selected tile uses the follow zoom.
- Controls must work with a PS4 controller (via DS4Windows), a Switch Pro controller, keyboard, and mouse. Button prompts use the existing glyph system.
- **Run benchmark from here** opens the §3.1 panel; the benchmark uses its own fixed scene, not the test-board layout (keeps results comparable), and returns to the test board afterwards.

### 4.4 Overlay in the test board

The performance overlay (§5) is forced to at least FPS while in the test board, and the test-board panel has a shortcut to switch it to Detailed. In Detailed mode the test board renders continuously so the numbers are live; leaving Detailed returns to render-on-demand.

---

## 5. Performance overlay

1. Setting: **Performance overlay**: Off (default) / FPS / Detailed. Stored with the other settings in `settings.ts`; default Off so nothing changes for normal play.
2. Position: top-right corner of the 1920 × 1080 stage, outside the side panels' content; small, semi-transparent paper chip, existing font. Must not cover the player cards or context panel; if there's no room, place it under the pause-menu button and note the choice.
3. **FPS**: FPS and 1% low over the last second.
4. **Detailed**: adds frame interval ms, CPU ms, GPU ms (or "n/a"), draw calls, triangles, drawing-buffer resolution, quality/AO.
5. When the renderer is idle (render-on-demand, nothing rendered for > 0.5 s), show **"idle"** instead of a number. Don't show 0 fps, and don't force rendering just to update the overlay outside the test board.
6. Updates at most 4 times per second, so the overlay itself doesn't cost frames.

---

## 6. Tests and checks

1. Vitest (pure logic only, no DOM, never import `buildingModels.js`): statistics (§2.3) on synthetic samples, refresh-rate snapping and both targets (§2.5) at 60 Hz and 120 Hz, bottleneck classification (§2.4) at each threshold for 60 Hz and 120 Hz budgets, every recommendation rule (§3.5) firing and not firing, verdict text selection, results summary formatting for Copy results, and history trimming to 10.
2. Test-board isolation test (§4.1.3): autosave and `Continue` unchanged.
3. New CDP plan `scripts/plans/bench.mjs`: opens Settings → Run benchmark → Quick, waits for the results screen, screenshots it, and asserts: every phase has samples, draw calls < 150, continuous mode is off afterwards and the renderer goes idle within 2 s (0 frames in the next 2 s).
4. New CDP plan `scripts/plans/testboard.mjs`: enters the test board, applies each preset, adds and removes a building with keyboard input, screenshots *Worst case* and a *One group* close-up, exits, and checks autosave untouched.
5. Re-run `scripts/plans/perf.mjs`: idle frames and draw calls unchanged from before this batch.
6. Standard finish: `npm run typecheck`, `npm test`, `npm run build` pass → commit → push → green Pages deploy → note the batch in `docs/PROGRESS.md`.

## 7. Left for the owner (real hardware)

Run **Compare settings** on the TV PC at 4K with Windows set to 120 Hz (and once at 60 Hz for comparison), and on the laptop; check that the results screen is readable from the couch; check that the test-board controls feel right on both controllers. Report anything off as feedback for the next batch.
