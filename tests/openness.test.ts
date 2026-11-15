import { describe, expect, test } from "vitest";
import { DEFAULT_RANGE, mapRange, OneEuro, OpennessTracker, palmAngleDeg, rawOpenness } from "@/lib/input/openness";
import { syntheticHand } from "./helpers/hand";

/** Run a tracker for `ms` on a constant hand pose with noise; return the outputs. */
function run(tr: OpennessTracker, open: number, ms: number, t0 = 0, noise = 0.002, score = 0.95, tiltDeg = 0) {
  const out = [];
  for (let t = 0; t <= ms; t += 33) {
    const h = syntheticHand(open, { noise, seed: t + 7, tiltDeg });
    out.push(tr.update({ ...h, score }, t0 + t));
  }
  return out;
}

describe("palm openness", () => {
  test("raw openness orders fist < half < open and is distance independent", () => {
    const fist = rawOpenness(syntheticHand(0).world);
    const half = rawOpenness(syntheticHand(0.5).world);
    const open = rawOpenness(syntheticHand(1).world);
    expect(fist).toBeLessThan(half);
    expect(half).toBeLessThan(open);
    expect(open).toBeGreaterThan(0.95);
    // scaling the hand (closer / farther in world units would not change, but a bigger hand) keeps the angles
    const big = syntheticHand(0.5).world.map((p) => ({ x: p.x * 1.4, y: p.y * 1.4, z: p.z * 1.4 }));
    expect(Math.abs(rawOpenness(big) - half)).toBeLessThan(1e-9);
  });

  test("calibrated range maps the user's fist to 0 and open hand to 1", () => {
    const range = { fist: rawOpenness(syntheticHand(0).world), open: rawOpenness(syntheticHand(1).world) };
    expect(mapRange(range.fist, range)).toBe(0);
    expect(mapRange(range.open, range)).toBe(1);
    expect(mapRange(rawOpenness(syntheticHand(0.5).world), range)).toBeGreaterThan(0.35);
  });

  for (const [name, open, expected] of [
    ["fist", 0, 0],
    ["half open", 0.5, 0.5],
    ["full open", 1, 1],
  ] as const) {
    test(`${name} with noise settles at ${expected} ± 0.1 without flicker`, () => {
      const range = { fist: rawOpenness(syntheticHand(0).world), open: rawOpenness(syntheticHand(1).world) };
      const tr = new OpennessTracker(range);
      const out = run(tr, open, 2500, 0, 0.0025);
      const settled = out.filter((o) => o.driving).slice(-30).map((o) => o.value!);
      expect(settled.length).toBe(30);
      for (const v of settled) expect(Math.abs(v - expected)).toBeLessThan(0.1);
      // no flicker: the settled output barely moves
      expect(Math.max(...settled) - Math.min(...settled)).toBeLessThan(0.05);
    });
  }

  test("snaps to exactly 0 and 1 at the ends", () => {
    const range = { fist: rawOpenness(syntheticHand(0).world), open: rawOpenness(syntheticHand(1).world) };
    const tr = new OpennessTracker(range);
    expect(run(tr, 1, 1500).at(-1)!.value).toBe(1);
    expect(run(tr, 0, 2500, 2000).at(-1)!.value).toBe(0);
  });

  test("does not drive until the hand has been still for 300 ms", () => {
    const tr = new OpennessTracker(DEFAULT_RANGE);
    const first = tr.update({ ...syntheticHand(1), score: 0.95 }, 0);
    expect(first.driving).toBe(false);
    expect(tr.update({ ...syntheticHand(1), score: 0.95 }, 200).driving).toBe(false);
    expect(tr.update({ ...syntheticHand(1), score: 0.95 }, 340).driving).toBe(true);
    // a hand that keeps moving across the frame never engages
    const tr2 = new OpennessTracker(DEFAULT_RANGE);
    let drove = false;
    for (let t = 0; t < 1500; t += 33) drove ||= tr2.update({ ...syntheticHand(1, { cx: 0.2 + t / 3000 }), score: 0.95 }, t).driving;
    expect(drove).toBe(false);
  });

  test("gating: low confidence or a palm turned away holds the last value", () => {
    const tr = new OpennessTracker(DEFAULT_RANGE);
    const v = run(tr, 1, 1500).at(-1)!.value;
    const low = run(tr, 0, 1000, 2000, 0.002, 0.5);
    expect(low.every((o) => !o.driving && o.value === v)).toBe(true);
    expect(palmAngleDeg(syntheticHand(0.5, { tiltDeg: 70 }).world)).toBeGreaterThan(50);
    const turned = run(tr, 0, 1000, 4000, 0.002, 0.95, 70);
    expect(turned.every((o) => !o.driving && o.value === v)).toBe(true);
  });

  test("hand leaving the frame keeps the last value", () => {
    const tr = new OpennessTracker(DEFAULT_RANGE);
    const v = run(tr, 1, 1500).at(-1)!.value;
    expect(tr.update(null, 2000)).toEqual({ value: v, driving: false, raw: NaN });
    expect(tr.update(null, 4000).value).toBe(v);
  });

  test("One Euro filter smooths jitter but follows a step", () => {
    const f = new OneEuro(1.0, 0.02);
    let y = 0;
    for (let t = 0; t < 1000; t += 33) y = f.filter(0.5 + (Math.random() - 0.5) * 0.02, t);
    expect(Math.abs(y - 0.5)).toBeLessThan(0.02);
    for (let t = 1000; t < 2500; t += 33) y = f.filter(1, t);
    expect(y).toBeGreaterThan(0.95);
  });
});
