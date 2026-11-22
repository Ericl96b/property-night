# Stage 2: close-up follow camera, report

Spec: [SPEC-closeup-camera.md](SPEC-closeup-camera.md). Judgment calls are in `DECISIONS.md` under "Stage 2". All screenshots below were rendered at 3840 × 2160 (headless Chrome on the dev laptop, `scripts/plans/stage2.mjs`) on the test board with a hotel on every street, then scaled to 1920 × 1080 for the repo, except the crop, which is at full 4K pixels.

## What to check on the TV

The numbers in `CLOSEUP` are still the spec's starting values (plus the fixes below). Tune them from **Main menu → Test board → Camera panel: on**:

- Pick a shot (Home / Dice / Chase / Landed). ←/→ move the selected tile; with a slider focused, ←/→ change it.
- **Play a move** hops seat 1's token 1–12 tiles through the real choreography (try one across a corner).
- **Copy values** puts a `CLOSEUP` object literal on the clipboard (or shows it to copy by hand), ready to paste over the one at the top of `src/render/cameraDirector.ts`.
- Slider changes last until the page reloads, so they also apply to a game started afterwards.

## Render checks (§5)

| Check | Result |
| --- | --- |
| Light rig | Follows the side yaw only. It turns on a side change with the 1.4 s easing; shot yaw offsets and the stick orbit don't move it (unit test). |
| Shadows at close range | **No change needed.** Hotel and token shadows are soft (PCF) on both High (4096 map) and Low (2048 map), with no visible blockiness at 4K. In Close-up the shadow camera only moves with the light rig, so camera moves can't make the shadow map swim. Cost: none. |
| Board face sharpness | **Crisp on High, slightly softer but readable on Low.** Names and prices on the landed group read cleanly at 4K in both. `boardTexture` is 8192 on High and 4096 on Low; unchanged. See [crop-4k-high-vs-low.jpg](crop-4k-high-vs-low.jpg) (High left, Low right). |
| Near plane | Kept at 0.05. The closest any shot gets is ≈ 0.16 above the board and ≥ 0.30 from its focus, so nothing comes near the near plane, and no z-fighting appeared on the board face or decals. |
| Tokens | Still face the view yaw (now including the orbit). |

Shots: [Home, pink](high-home-26.jpg) · [Home, dark blue](high-home-37.jpg) · [Home, brown](high-home-1.jpg) · [Dice](high-dice-13.jpg) · [Chase across the jail corner](high-chase-corner.jpg) · [Landed](high-landed-13.jpg) · [Peek](high-peek.jpg).

## Open question for the owner: the token hides the property name

On a Home / Landed shot the active token stands in the tile body, between the camera (outside the board edge) and the name printed near the band. So the token covers part of the landed property's name ("ROSE COURT" in [high-home-26.jpg](high-home-26.jpg)). The price, the band, the buildings and the SOLD signs are all clear, and the deed card in the context panel names the tile while the shot holds.

Pitch doesn't fix it within reason: [name-occlusion-pitch-grid.jpg](name-occlusion-pitch-grid.jpg) shows pitch 40 / 48 / 55° and yaw offset 20 / 32°. Even at 55° / 32° part of the name is hidden. Any view from outside the edge at couch height has this, because the token is ≈ 0.045 tall and the name is ≈ 0.03 behind it. Options (none built, since Stage 2 is camera-only):

1. Accept it: the deed card shows the name, and the board name is readable from the Home shot of the next turn after the token leaves.
2. Move where a lone token stands toward the price edge. On its own this isn't enough: at 40° the token's top still projects ≈ 0.05 back onto the tile, so it would cover the name less but not clear it.
3. Raise the pitch a lot (≈ 68° clears the name), which loses the low "looking along the row" feel.
4. Fade the active token to partly transparent while it is the only thing covering text in a held shot.

My suggestion is 1 for now, with 4 as a small follow-up if it bothers you on the TV.

## Performance (dev laptop, Intel Iris Xe; not the OUTPOST verdict)

Standard benchmark, 2880 × 1620 buffer, High. The pane was hidden, so frame rates were capped at 30 fps and only GPU-timer values are meaningful. Both runs were back to back with shaders warm; Table was forced from the console for comparison.

| Phase | GPU ms, Close-up | GPU ms, Table | Draw calls (max) |
| --- | --- | --- | --- |
| 1 Rest | 21.1 | 21.8 | 132 / 132 |
| 2 Turns | 20.9 | 21.5 | 132 / 132 |
| 3 Street close-ups | 22.6 | 21.6 | 132 / 132 |
| 4 Wave | 25.8 | 25.8 | 289 / 245 |
| 5 Turn sequence | 29.4 | 26.7 | 132 / 132 |
| 6 Headroom | k = 8 | k = 8 | |

The close-up phases cost ≈ 5–10% more GPU time here, against the spec's expectation of "the same or less". Draw calls don't drop because buildings are one `BatchedMesh` per finish (a few calls regardless of how many are in view). The extra cost comes from shading, not geometry:

- A held close-up (pink group, all hotels) against the rest view, interleaved 4×: ≈ 31 ms vs ≈ 25 ms median GPU.
- Of that, the board face's 16× anisotropic filtering at the low viewing angle accounted for ≈ 3.5 ms (dropping it to 1× brought the close-up to ≈ 27 ms). The rest is larger on-screen buildings and SOLD signs.
- Repeated runs on this iGPU drift by ±5 ms (the same rest view measured 21–33 ms), so these are indications only.

Not changed: anisotropy and texture size are render-quality settings outside Stage 2. **The OUTPOST runs decide.** If Close-up costs more there too, the cheapest lever is the board texture's anisotropy (16× → 8× had no clear effect on the laptop; 4× is worth trying), and it is a one-line change in `src/render/board.ts`.

The benchmark now forces Close-up, and Standard runs ≈ 65 s (phase 5 is 14 s, so the handoff plays). Phase 5 timings are therefore not directly comparable with older results; phases 1, 2 and 4 show the same whole-board view as before.

## OUTPOST checklist (owner)

1. **Before pushing Stage 2:** Settings → Performance → Run benchmark → Standard on OUTPOST at 4K against the current live site. Copy results.
2. Then I push; once the Pages deploy is green, run Standard again and compare frame times and draw calls per phase.
3. Couch checks from spec §9: name/price/signs on every landing (see the open question above), token always between the panels during moves, smooth corners with steady shadows, no clipping, dice fully visible, R2 / ZR / C peek, Table style looks like before, Reduce motion overhead, and two full games (human vs human, and with a bot) at Normal.
4. Tune `CLOSEUP` from the Camera panel and send me the copied values.
