import { describe, expect, test } from "vitest";
import { classify, GestureRecognizer, type Pt } from "@/lib/input/gestures";

type Shape = "open" | "spread" | "fist" | "pinch";

/** Synthetic 21-point hand centred at (cx, cy) in camera space. */
function hand(shape: Shape, cx = 0.5, cy = 0.5): { landmarks: Pt[] } {
  const lm: Pt[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  lm[0] = { x: cx, y: cy + 0.15 };
  lm[9] = { x: cx, y: cy };
  const offsets = shape === "spread" ? [-0.12, -0.04, 0.04, 0.12] : [-0.06, -0.02, 0.02, 0.06];
  [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(([tip, pip], i) => {
    const o = offsets[i];
    const curled = shape === "fist" || (shape === "pinch" && i > 0);
    lm[pip] = { x: cx + o, y: cy - 0.05 };
    lm[tip] = curled ? { x: cx + o, y: cy + 0.02 } : { x: cx + o, y: cy - 0.15 };
  });
  lm[4] = shape === "pinch" ? { ...lm[8] } : { x: cx - 0.12, y: cy + 0.02 };
  return { landmarks: lm };
}

describe("pose classification", () => {
  test("open, spread, fist and pinch", () => {
    expect(classify(hand("open").landmarks)).toBe("open");
    expect(classify(hand("spread").landmarks)).toBe("spread");
    expect(classify(hand("fist").landmarks)).toBe("fist");
    expect(classify(hand("pinch").landmarks)).toBe("pinch");
    expect(classify([])).toBe("none");
  });
});

describe("recogniser", () => {
  const rec = () => new GestureRecognizer({ width: 1000, height: 800, smoothing: 1, deadzone: 0 });

  test("cursor follows the index fingertip, mirrored", () => {
    const r = rec();
    const ev = r.update([hand("open", 0.3, 0.5)], 0).find((e) => e.type === "cursor")!;
    // index tip x = 0.24 -> mirrored 0.76 -> mapped through the 70% active region
    expect(ev.type === "cursor" && ev.x).toBeCloseTo(((0.76 - 0.15) / 0.7) * 1000, 0);
  });

  test("pinch starts once, ends once, and freezes the cursor while held", () => {
    const r = rec();
    r.update([hand("open")], 0);
    const start = r.update([hand("pinch")], 33);
    expect(start.filter((e) => e.type === "pinchStart")).toHaveLength(1);
    const held = r.update([hand("pinch", 0.6)], 66);
    expect(held.some((e) => e.type === "pinchStart")).toBe(false);
    const c1 = start.find((e) => e.type === "cursor")!;
    const c2 = held.find((e) => e.type === "cursor")!;
    expect(c2).toMatchObject({ x: (c1 as { x: number }).x });
    expect(r.update([hand("open")], 100).some((e) => e.type === "pinchEnd")).toBe(true);
  });

  test("open-palm swipe right and left", () => {
    const r = rec();
    const events: string[] = [];
    // Hand moves from camera x 0.7 to 0.35, i.e. to the user's right in the mirrored view.
    for (let i = 0; i <= 10; i++) for (const e of r.update([hand("open", 0.7 - i * 0.035)], i * 30)) if (e.type === "swipe") events.push(e.dir);
    expect(events).toEqual(["right"]);
    const r2 = rec();
    const ev2: string[] = [];
    for (let i = 0; i <= 10; i++) for (const e of r2.update([hand("open", 0.35 + i * 0.035)], i * 30)) if (e.type === "swipe") ev2.push(e.dir);
    expect(ev2).toEqual(["left"]);
  });

  test("spread held still explodes once; fist held grabs; a short fist tap collapses", () => {
    const r = rec();
    const types: string[] = [];
    for (let t = 0; t <= 600; t += 30) for (const e of r.update([hand("spread")], t)) types.push(e.type);
    expect(types.filter((x) => x === "explode")).toHaveLength(1);
    const r2 = rec();
    const t2: string[] = [];
    for (let t = 0; t <= 900; t += 30) for (const e of r2.update([hand("fist")], t)) t2.push(e.type);
    for (let t = 930; t <= 1200; t += 30) for (const e of r2.update([hand("open")], t)) t2.push(e.type);
    expect(t2.filter((x) => x === "grabStart")).toHaveLength(1);
    expect(t2.filter((x) => x === "grabEnd")).toHaveLength(1);
    expect(t2).not.toContain("collapse");
    const r3 = rec();
    const t3: string[] = [];
    for (let t = 0; t <= 210; t += 30) for (const e of r3.update([hand("fist")], t)) t3.push(e.type);
    for (let t = 240; t <= 600; t += 30) for (const e of r3.update([hand("open")], t)) t3.push(e.type);
    expect(t3.filter((x) => x === "collapse")).toHaveLength(1);
    expect(t3).not.toContain("grabStart");
  });

  test("two-hand pinch zooms with distance", () => {
    const r = rec();
    r.update([hand("pinch", 0.4), hand("pinch", 0.6)], 0);
    const ev = r.update([hand("pinch", 0.3), hand("pinch", 0.7)], 33).find((e) => e.type === "zoom")!;
    // hands moved apart: factor < 1 means "move the camera closer"
    expect(ev.type === "zoom" && ev.factor).toBeCloseTo(0.5, 2);
  });

  test("losing the hand ends a pinch", () => {
    const r = rec();
    r.update([hand("pinch")], 0);
    expect(r.update([], 33).map((e) => e.type)).toEqual(["lost", "pinchEnd"]);
  });
});
