import { expect, test } from "vitest";
import { calibrate, initialCal, type CalState } from "@/lib/input/calibration";

const run = (s: CalState, samples: [number, number, number][], t0: number, grabbing = false, dt = 40) =>
  samples.reduce((acc, [roll, pitch, yaw], i) => calibrate(acc, { roll, pitch, yaw, t: t0 + i * dt }, grabbing), s);

test("keep still: 2 s inside a 3° band sets the baseline; movement restarts the window", () => {
  let s = run(initialCal(), Array.from({ length: 30 }, () => [10, 0, 0] as [number, number, number]), 0);
  expect(s.step).toBe(0);
  s = run(s, [[25, 0, 0]], 1200); // moved: window restarts
  expect(s.stillProgress).toBe(0);
  s = run(s, Array.from({ length: 55 }, (_, i) => [25 + (i % 2), 0, 0] as [number, number, number]), 1240);
  expect(s.step).toBe(1);
  expect(s.baseline!.roll).toBeCloseTo(25.5, 0);
});

test("tilt needs both roll sides and both pitch sides from the baseline", () => {
  let s: CalState = { ...initialCal(), step: 1, baseline: { roll: 5, pitch: 0, yaw: 0 } };
  s = run(s, [[-26, 0, 0], [36, 0, 0], [5, 26, 0]], 0);
  expect(s.step).toBe(1);
  expect(s.tilt).toEqual({ left: true, right: true, forward: true, back: false });
  s = run(s, [[5, -26, 0]], 200);
  expect(s.step).toBe(2);
});

test("grab and twist passes past 45° only while grabbed, across the ±180 wrap", () => {
  let s: CalState = { ...initialCal(), step: 2, baseline: { roll: 0, pitch: 0, yaw: 0 } };
  s = run(s, [[0, 0, 170], [0, 0, -120]], 0, false);
  expect(s.step).toBe(2);
  s = run(s, [[0, 0, 170], [0, 0, -170], [0, 0, -140]], 100, true);
  expect(s.step).toBe(3);
  expect(s.twist).toBeCloseTo(50, 0);
});
