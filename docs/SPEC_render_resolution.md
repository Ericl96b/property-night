# Property Night — Render Resolution Setting + Idle Rendering

**Spec for Claude Code · Nov 23 2026**

## Why

Property Night runs well at 4K on CITADEL (RTX 5080), but on OUTPOST (RTX 2070, connected to the 4K TV) it pushes the GPU hard. Benchmarks are smooth on High with AO off, but the fans spin up loudly. Nearly all the GPU cost is per-pixel: lighting, shadows, AO and antialiasing. Rendering the 3D board below native resolution and upscaling it to the screen will cut that load roughly in proportion to pixel count. 1440p is about 44% of the pixels of 4K.

This spec has two parts. Ship **Part A** first and get it verified before starting **Part B**.

- **Part A — Resolution setting** (required)
- **Part B — Idle / on-demand rendering** (the biggest win for fan noise during a real game)

---

## Part A — Resolution setting

### A1. UI

- Add a **Resolution** option to the **Settings tab**, in the same section as the existing graphics options (quality preset, AO toggle).
- Show exactly these three options, with these exact labels:
  - `1920×1080 (Full HD / 1080p)`
  - `2560×1440 (QHD / 1440p)`
  - `3840×2160 (4K UHD)`
- Use the real multiplication sign `×` (U+00D7), not the letter `x`.
- **Never show percentages or scale factors anywhere in the UI.**
- Add one line of helper text under the control showing the detected display, e.g. `Your display: 3840×2160`.
- If an option is larger than the detected display, show it greyed out and unselectable, with the note `Above this display`. Example: on FORGE, the 4K option is disabled if the laptop panel is below 2160p.
- The control must be fully navigable with both controllers (PS4 via DS4Windows, Switch Pro). It uses the existing focus-visibility styling, and Back pops one menu level, the same as every other setting.

### A2. What the setting means

The setting controls the **internal render resolution of the 3D canvas only**:

- The canvas always fills the screen at its normal CSS size. The browser upscales the lower-resolution drawing buffer to fit.
- **The HTML/CSS UI is not affected.** Menus, cards, the Inventory/Trade screens and HUD text always render at native sharpness. Do not scale the UI layer.
- At native resolution (for example 4K on a 4K display), the result must be pixel-identical to the current behavior.

### A3. Implementation

1. **Detect the display's physical resolution:** `physicalHeight = round(screen.height * devicePixelRatio)`, and the same for width. This handles Windows display scaling. For example, a 4K TV at 150% reports `screen.height = 1440` and `dpr = 1.5`, which gives 2160.
2. **Effective render height:**
   ```
   canvasPhysicalHeight = round(canvas.clientHeight * devicePixelRatio)
   effectiveHeight      = min(selectedHeight, canvasPhysicalHeight)
   pixelRatio           = effectiveHeight / canvas.clientHeight
   ```
   - Clamping to the canvas's physical size means a small window (windowed testing on FORGE) never renders above its own pixel count. **Never supersample.**
   - Match by **height**. Width follows the canvas aspect ratio, so a non-16:9 window still gets correct, undistorted output.
3. Apply with `renderer.setPixelRatio(pixelRatio)` and `renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)`. Pass `false` so Three.js doesn't touch the CSS size.
4. **Resize everything that depends on drawing-buffer size.** This is the main source of bugs, so audit the codebase for:
   - the EffectComposer (`composer.setPixelRatio` / `setSize`) and every pass in it
   - the AO pass's internal render targets
   - any FXAA/SMAA resolution uniforms
   - any custom `WebGLRenderTarget`s (picking buffers, outline/highlight passes, mirrors, etc.)
   - anything that reads `renderer.getPixelRatio()` or `window.devicePixelRatio` directly and assumes the old value. Route all of these through one helper, e.g. `getRenderPixelRatio()`.
5. **Raycasting and picking** must keep using CSS-pixel pointer coordinates normalized against `canvas.clientWidth/Height`, so they stay correct at any render resolution. Verify any GPU picking buffer is resized consistently.
6. **Leave shadow-map size, MSAA and the quality preset alone.** They are independent settings. This change touches resolution only.
7. **Apply live.** Changing the setting takes effect immediately, with no reload and no game restart, including mid-game from the pause/settings menu. Recompute on window resize, on fullscreen enter/exit, and when the window moves to a different monitor (a `devicePixelRatio` change; listen with `matchMedia('(resolution: …dppx)')`).

### A4. Persistence and defaults

- The setting is **per machine**. Store it in local machine storage (localStorage or whatever local settings store the game already uses).
- It must **not** be stored in save files, rule presets or anything else that travels between machines. CITADEL and OUTPOST each remember their own value.
- **First-launch default:** the largest option that is ≤ the detected display height. If the display is below 1080p, use 1080p, clamped by the effective-height rule above.
- If the stored value is above the current display (for example a laptop on an external monitor), keep the stored value but let the clamp handle it. Don't overwrite the user's choice.

### A5. Benchmark / test board integration

- The benchmark results screen must list the render resolution used, e.g. `Render: 2560×1440` alongside the quality preset and AO state.
- If the benchmark has its own graphics overrides, add resolution as one of them, with the same three labeled options.

### A6. Debug check

Add a dev-only overlay line, using whatever debug toggle already exists, that shows the actual drawing buffer: `renderer.domElement.width × height` plus the display's physical size. This is how Part A gets verified.

### A7. Acceptance criteria

- [ ] The Settings tab shows the three options with the exact labels above. No percentages appear anywhere.
- [ ] On a 4K display, selecting `2560×1440` makes the debug overlay report a drawing buffer of 2560×1440, while the canvas still fills the screen.
- [ ] The HTML UI stays native-sharp at every setting.
- [ ] Selecting `3840×2160` on a 4K display looks identical to the current build.
- [ ] Options above the display's resolution are disabled and labeled `Above this display`.
- [ ] AO, any post-processing, highlights/outlines and hover/selection picking all work correctly at all three settings: no stretched, offset or blurry-at-half-res effects and no misaligned clicks.
- [ ] The setting changes live, mid-game, with no reload.
- [ ] Both controllers can navigate and change the setting. Back behaves like every other setting.
- [ ] The value survives a restart on the same machine and does not appear in save files.
- [ ] Benchmark results show the render resolution.

---

## Part B — Idle / on-demand rendering

Monopoly is static most of the time: players think, trade, read cards and navigate menus. Redrawing an unchanged 3D board 60 times a second keeps OUTPOST near benchmark load all night. Draw frames only when something in the 3D scene actually changes.

### B1. Behavior

- The 3D scene renders only while it is **active**: something is moving or changing visually. Otherwise it holds the last frame.
- Active triggers include, at minimum:
  - dice physics simulating
  - token movement
  - camera moves, including active-player follow and board rotation
  - house/hotel build or sell animations
  - any tween or animation mixer running
  - 3D hover/selection highlight changes
  - resize, fullscreen or render-resolution changes
  - graphics setting changes
- After activity ends, keep rendering for a short tail (~300 ms) so final frames and easing settle cleanly.

### B2. Implementation

- Add a central API, e.g. `requestRender()` for one-off frames and `beginActivity(id)` / `endActivity(id)` for ongoing animations. Every animation system registers through it. Render while any activity is open plus the tail; otherwise stop calling `renderer.render`.
- **Inventory every continuous animation in the scene** (idle token bob, ambient effects, animated materials, the Gummy Bear's gloss, etc.):
  - If something must animate forever, it either becomes an activity with an idle frame cap of **20 fps**, or it pauses when idle. Pick per effect and list the decisions in the PR description.
  - No visible effect may freeze in an obviously broken mid-pose.
- **Input must not depend on rendering.** Gamepad polling (`navigator.getGamepads()`) is often done inside the rAF render loop. Keep a lightweight rAF (or equivalent) loop that **always** polls input and runs game logic, and skip only the `render()` call when idle. Both controllers must respond instantly from a fully idle state.
- **Dice fairness and physics are untouched.** Physics keeps its fixed timestep and full simulation regardless of render state. Idle mode only skips drawing; it never throttles or alters simulation.
- The HTML UI is unaffected. CSS transitions in menus run normally and do not need to wake the 3D render.
- Add a dev setting to disable idle rendering (always render) for debugging and A/B comparison. Not shown in the normal Settings UI.

### B3. Debug check

Extend the debug overlay with: `Render: ACTIVE / IDLE`, the current render fps, and a counter of frames rendered in the last 10 s.

### B4. Acceptance criteria

- [ ] With the board at rest and no menus animating the scene, the overlay shows IDLE and close to 0 rendered fps. If a continuous effect was kept, it shows ≤ 20 fps.
- [ ] Dice rolls, token moves, camera follow/rotation, building animations and highlights all look exactly as smooth as before.
- [ ] No visible hitch on the first frame when waking from idle.
- [ ] From full idle, both controllers respond on the first press with no lag.
- [ ] Dice results and physics behavior are unchanged (same simulation path, fixed timestep).
- [ ] Turning on the always-render dev toggle restores the old behavior exactly.

---

## Out of scope

- Upscaling filters (FSR-style sharpening, etc.). The browser's default upscale is fine for now.
- Changes to shadow quality, AO quality or presets.
- A frame-rate cap setting for active rendering.
- Changing what the quality presets contain.

## Test plan (manual, on real hardware)

1. **CITADEL:** set 4K, confirm it is identical to the current build, and run the benchmark.
2. **OUTPOST (4K TV):** run the benchmark at all three resolutions with High and AO off, and record the fps for each. Then play ~10 minutes of a normal game at 1440p with Part B active and compare fan noise and GPU load (Task Manager → GPU) against the current build.
3. **FORGE:** confirm options above the panel's resolution are disabled, and that windowed mode clamps correctly.
