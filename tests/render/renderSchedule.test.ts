// SPEC_render_resolution Part B: render only while active, plus a 300 ms tail.
import { describe, expect, it } from 'vitest';
import { RenderSchedule, TAIL_MS, type RenderInputs } from '../../src/render/renderSchedule';

const idle = (now: number): RenderInputs => ({ now, tickersActive: false, dirty: false, continuous: false, always: false });

describe('render schedule', () => {
  it('a fresh scene at rest draws nothing', () => {
    expect(new RenderSchedule().shouldRender(idle(1000))).toBe(false);
  });

  it('a ticker going quiet still gets a tail, so the final pose is drawn', () => {
    const s = new RenderSchedule();
    expect(s.shouldRender({ ...idle(0), tickersActive: true })).toBe(true);
    expect(s.shouldRender(idle(16))).toBe(true); // first quiet frame: draws the final pose
    expect(s.shouldRender(idle(TAIL_MS - 1))).toBe(true);
    expect(s.shouldRender(idle(TAIL_MS))).toBe(false);
  });

  it('overlapping activities stay active until the last one ends', () => {
    const s = new RenderSchedule();
    s.begin('build', 0);
    s.begin('camera', 100);
    s.end('build', 200);
    expect(s.shouldRender(idle(5000))).toBe(true);
    s.end('camera', 5000);
    expect(s.shouldRender(idle(5000 + TAIL_MS - 1))).toBe(true);
    expect(s.shouldRender(idle(5000 + TAIL_MS))).toBe(false);
  });

  it('ending an unknown activity changes nothing', () => {
    const s = new RenderSchedule();
    s.end('nope', 100);
    expect(s.shouldRender(idle(100))).toBe(false);
  });

  it('one-off requests, continuous and always-render each draw', () => {
    const s = new RenderSchedule();
    expect(s.shouldRender({ ...idle(1000), dirty: true })).toBe(true);
    expect(s.shouldRender(idle(1001))).toBe(false); // a request alone has no tail
    expect(s.shouldRender({ ...idle(1002), continuous: true })).toBe(true);
    expect(s.shouldRender({ ...idle(1003), always: true })).toBe(true);
  });

  it('counts frames rendered in the last 10 s', () => {
    const s = new RenderSchedule();
    for (let t = 0; t < 12_000; t += 100) s.recordFrame(t);
    expect(s.framesIn(10_000, 11_900)).toBe(100);
    expect(s.framesIn(1000, 11_900)).toBe(10);
    expect(s.framesIn(10_000, 30_000)).toBe(0);
  });
});
