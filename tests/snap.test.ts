import { describe, expect, test } from "vitest";
import { pickTarget, rectDistance, SnapPointer, type Target } from "@/lib/input/snap";

const VW = 1280;
const VH = 800;
const REACH = { x0: 0, y0: 0, x1: 1, y1: 1 }; // identity reach so pixels = normalized * viewport

/** A grid of small buttons: 44x28 px, 16 px gaps (centres 60 / 44 px apart). */
function grid(cols = 8, rows = 6): Target[] {
  const t: Target[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) t.push({ id: `b${r}-${c}`, rect: { x: 300 + c * 60, y: 200 + r * 44, w: 44, h: 28 } });
  return t;
}

describe("snap-to-target pointer", () => {
  test("rect distance and magnet radius", () => {
    const r = { x: 100, y: 100, w: 40, h: 20 };
    expect(rectDistance({ x: 110, y: 110 }, r)).toBe(0);
    expect(rectDistance({ x: 150, y: 110 }, r)).toBe(10);
    const ts = [{ id: "a", rect: r }];
    expect(pickTarget({ x: 180, y: 110 }, ts, null)).toBe("a"); // 40 px away: captured
    expect(pickTarget({ x: 200, y: 110 }, ts, null)).toBe(null); // 60 px: free
    expect(pickTarget({ x: 200, y: 110 }, ts, "a")).toBe("a"); // hysteresis keeps it to 72 px
    expect(pickTarget({ x: 220, y: 110 }, ts, "a")).toBe(null);
  });

  test("≥ 95% of pinch clicks land on the intended small button with ±30 px noise", () => {
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
    const targets = grid();
    const p = new SnapPointer(REACH);
    let t = 0;
    let hits = 0;
    let clicks = 0;
    const order = Array.from({ length: 60 }, (_, i) => targets[(i * 17) % targets.length]);
    for (const want of order) {
      const cx = want.rect.x + want.rect.w / 2;
      const cy = want.rect.y + want.rect.h / 2;
      const frame = (dx: number, dy: number, pinch: number) => {
        t += 33;
        return p.update({ x: (cx + dx + rnd() * 30) / VW, y: (cy + dy + rnd() * 30) / VH }, pinch, t, targets, VW, VH);
      };
      // approach and dwell ~0.6 s with noise, then pinch; pinching drags the knuckle down a little
      for (let i = 0; i < 18; i++) frame(0, 0, 1);
      let clicked: string | null = null;
      for (let i = 0; i < 6; i++) {
        const o = frame(0, 10 + i * 3, 0.15);
        if (o.click) clicked = o.click;
      }
      for (let i = 0; i < 4; i++) frame(0, 0, 1); // release
      clicks++;
      if (clicked === want.id) hits++;
    }
    const rate = hits / clicks;
    expect(clicks).toBe(60);
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  test("one pinch is one click (release hysteresis)", () => {
    const targets = grid(2, 1);
    const p = new SnapPointer(REACH);
    const c = { x: (300 + 22) / VW, y: (200 + 14) / VH };
    let n = 0;
    for (let i = 0; i < 10; i++) p.update(c, 1, i * 33, targets, VW, VH);
    // pinch ratio wobbles between 0.2 and 0.45 (never above the 0.5 release): still one click
    // close for two frames, then wobble between 0.2 and 0.45 (never above the 0.5 release)
    for (let i = 10; i < 40; i++) if (p.update(c, i < 12 || i % 2 ? 0.2 : 0.45, i * 33, targets, VW, VH).click) n++;
    expect(n).toBe(1);
  });

  test("a pinch needs two frames under the threshold (a single dip is ignored)", () => {
    const targets = grid(1, 1);
    const p = new SnapPointer(REACH);
    const c = { x: 322 / VW, y: 214 / VH };
    for (let i = 0; i < 10; i++) p.update(c, 1, i * 33, targets, VW, VH);
    expect(p.update(c, 0.1, 400, targets, VW, VH).click).toBe(null);
    expect(p.update(c, 0.9, 433, targets, VW, VH).click).toBe(null);
    expect(p.update(c, 0.1, 466, targets, VW, VH).click).toBe(null);
    expect(p.update(c, 0.1, 500, targets, VW, VH).click).toBe("b0-0");
  });

  test("click intent: the target locked 150 ms before the pinch wins even if the pointer slid off", () => {
    const targets = grid(2, 1); // b0-0 at x 300..344, b0-1 at 360..404
    const p = new SnapPointer(REACH);
    let t = 0;
    for (let i = 0; i < 15; i++) p.update({ x: 322 / VW, y: 214 / VH }, 1, (t += 33), targets, VW, VH);
    // in the 100 ms before the pinch, the knuckle jumps onto the neighbour
    p.update({ x: 382 / VW, y: 214 / VH }, 1, (t += 33), targets, VW, VH);
    p.update({ x: 382 / VW, y: 214 / VH }, 0.1, (t += 33), targets, VW, VH);
    const o = p.update({ x: 382 / VW, y: 214 / VH }, 0.1, (t += 33), targets, VW, VH);
    expect(o.click).toBe("b0-0");
  });
});
