// SPEC_render_resolution Part B check: the 3D scene draws only while something changes.
// Idle at rest, ACTIVE through a dice roll and token move, IDLE again shortly after it settles,
// input responds from full idle, and ?render=always (dev) keeps drawing.
const base = process.env.PN_URL ?? 'http://localhost:5173/';

export default {
  url: `${base}?auto=human,bot&seed=3&quality=high&speed=normal`,
  width: 1920,
  height: 1080,
  steps: [
    { until: () => !!window.__pn?.controller?.state, label: 'booted', timeout: 30000 },
    // Detailed overlay on (it must not wake the 3D loop itself): saved setting, then reload.
    {
      eval: () => {
        const k = 'property-night.settings.v1';
        localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), perfOverlay: 'detailed' }));
        setTimeout(() => location.reload(), 50);
        return true;
      },
      label: 'overlay detailed',
    },
    { wait: 1000 },
    { until: () => !!window.__pn?.controller?.state && !!document.querySelector('[data-testid=render-line]'), label: 'rebooted with overlay', timeout: 30000 },
    { wait: 2500 },
    {
      eval: async () => {
        const rr = window.__pn.scene.renderer;
        const before = rr.framesInLast(10_000);
        await new Promise((res) => setTimeout(res, 3000));
        return { state: rr.renderState, framesIn3s: rr.framesInLast(3000), fps: rr.fps, before };
      },
      label: 'at rest on the human turn (expect IDLE, 0 frames)',
    },
    { shot: 'idle-rest' },
    {
      eval: async () => {
        const rr = window.__pn.scene.renderer;
        const d = window.__pn.director;
        // Roll from full idle: Space = confirm (Roll dice is focused).
        const t0 = performance.now();
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
        let firstActiveMs = null, maxFps = 0, settledAt = null, idleAt = null, lastVisibleMove = null;
        // Camera motion on screen (approx. CSS px per frame): is the camera ticker's activity real?
        const cam = window.__pn.scene.camera.camera;
        const prevP = cam.position.clone(), prevQ = cam.quaternion.clone();
        const pxPerRad = innerHeight / ((cam.fov * Math.PI) / 180);
        while (performance.now() - t0 < 15000) {
          await new Promise((res) => requestAnimationFrame(res));
          const now = performance.now();
          const px = (prevQ.angleTo(cam.quaternion) + prevP.distanceTo(cam.position) / 0.6) * pxPerRad;
          if (px > 0.05) lastVisibleMove = now;
          prevP.copy(cam.position);
          prevQ.copy(cam.quaternion);
          if (firstActiveMs === null && rr.renderState === 'ACTIVE') firstActiveMs = Math.round(now - t0);
          maxFps = Math.max(maxFps, rr.fps);
          if (firstActiveMs !== null && settledAt === null && !d.busy && !rr.isContinuous) settledAt = now;
          if (settledAt !== null && rr.renderState === 'IDLE') { idleAt = now; break; }
          if (settledAt !== null && d.busy) settledAt = null;
        }
        // lastActiveAt: the last frame any ticker/activity was animating (camera easing included).
        const lastActive = rr.schedule.lastActiveAt;
        return {
          firstActiveMs,
          maxFps,
          queueSettledToIdleMs: idleAt && settledAt ? Math.round(idleAt - settledAt) : null,
          lastAnimationToIdleMs: idleAt ? Math.round(idleAt - lastActive) : null,
          cameraStillMovingAfterQueue: idleAt && settledAt ? Math.round(lastActive - settledAt) : null,
          lastVisibleCameraMoveToIdleMs: idleAt && lastVisibleMove ? Math.round(idleAt - lastVisibleMove) : null,
        };
      },
      label: 'roll from idle: wakes at once, full rate, IDLE ~300 ms after settling',
    },
    { wait: 1500 },
    { eval: () => window.__pn.controller.setPaused(true) ?? true, label: 'pause bots' },
    { wait: 1500 },
    { eval: () => ({ state: window.__pn.scene.renderer.renderState, framesIn1s: window.__pn.scene.renderer.framesInLast(1000) }), label: 'idle again' },
    { shot: 'idle-overlay' },
    {
      eval: async () => {
        const rr = window.__pn.scene.renderer;
        rr.setAlwaysRender(true);
        await new Promise((res) => setTimeout(res, 2000));
        const on = { state: rr.renderState, framesIn1s: rr.framesInLast(1000) };
        rr.setAlwaysRender(false);
        await new Promise((res) => setTimeout(res, 1000));
        return { on, off: { state: rr.renderState, framesIn500ms: rr.framesInLast(500) } };
      },
      label: 'always-render dev toggle on, then off',
    },
  ],
};
