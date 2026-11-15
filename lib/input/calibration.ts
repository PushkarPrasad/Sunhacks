// Calibration wizard logic (pure, unit-tested). Feed it glove orientation samples and the grab state.
//   1. Keep still: 2 s with every axis inside a 3° band. The mean becomes the baseline.
//   2. Tilt to each side: roll to ±30° and pitch to ±25° from the baseline.
//   3. Grab and twist: while grabbed (switch or camera fist), turn the wrist more than 45°.

import { angleDelta } from "./gloveProtocol";

export interface Sample {
  roll: number;
  pitch: number;
  yaw: number;
  t: number;
}

export interface CalState {
  step: 0 | 1 | 2 | 3; // 3 = finished
  still: Sample[];
  stillProgress: number;
  baseline: { roll: number; pitch: number; yaw: number } | null;
  tilt: { left: boolean; right: boolean; forward: boolean; back: boolean };
  grabStart: { roll: number; pitch: number; yaw: number } | null;
  twist: number;
}

export const STILL_MS = 2000;
export const STILL_BAND = 3;
export const ROLL_NEED = 30;
export const PITCH_NEED = 25;
export const TWIST_NEED = 45;

export const initialCal = (): CalState => ({
  step: 0,
  still: [],
  stillProgress: 0,
  baseline: null,
  tilt: { left: false, right: false, forward: false, back: false },
  grabStart: null,
  twist: 0,
});

const span = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

export function calibrate(s: CalState, o: Sample, grabbing: boolean): CalState {
  if (s.step === 0) {
    let still = [...s.still, o].filter((x) => o.t - x.t <= STILL_MS);
    // Any axis outside the band restarts the window from this sample.
    if (span(still.map((x) => x.roll)) > STILL_BAND || span(still.map((x) => x.pitch)) > STILL_BAND || span(still.map((x) => x.yaw)) > STILL_BAND) still = [o];
    const covered = still.length > 1 ? o.t - still[0].t : 0;
    if (covered >= STILL_MS * 0.95 && still.length >= 20) {
      const mean = (k: "roll" | "pitch" | "yaw") => still.reduce((a, x) => a + x[k], 0) / still.length;
      return { ...s, step: 1, still: [], stillProgress: 1, baseline: { roll: mean("roll"), pitch: mean("pitch"), yaw: mean("yaw") } };
    }
    return { ...s, still, stillProgress: Math.min(1, covered / STILL_MS) };
  }
  if (s.step === 1 && s.baseline) {
    const dr = angleDelta(s.baseline.roll, o.roll);
    const dp = angleDelta(s.baseline.pitch, o.pitch);
    const tilt = {
      left: s.tilt.left || dr <= -ROLL_NEED,
      right: s.tilt.right || dr >= ROLL_NEED,
      forward: s.tilt.forward || dp >= PITCH_NEED,
      back: s.tilt.back || dp <= -PITCH_NEED,
    };
    const done = tilt.left && tilt.right && tilt.forward && tilt.back;
    return { ...s, tilt, step: done ? 2 : 1 };
  }
  if (s.step === 2) {
    if (!grabbing) return { ...s, grabStart: null };
    const start = s.grabStart ?? { roll: o.roll, pitch: o.pitch, yaw: o.yaw };
    const turned = Math.max(Math.abs(angleDelta(start.yaw, o.yaw)), Math.abs(angleDelta(start.roll, o.roll)), Math.abs(angleDelta(start.pitch, o.pitch)));
    const twist = Math.max(s.twist, turned);
    return { ...s, grabStart: start, twist, step: twist > TWIST_NEED ? 3 : 2 };
  }
  return s;
}
