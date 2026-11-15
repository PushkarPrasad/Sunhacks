// Glove grab-and-rotate (P0-2). The glove alone owns grab.
//
// Clutch: if a switch has been seen this session (any BTN: line), BTN:DOWN grabs and BTN:UP releases.
// Without a switch, a knock (G:SELECT) toggles grab while a 3D view is on screen; elsewhere it is a click.
//
// Math: O:roll,pitch,yaw (degrees) -> mapped to screen axes (AXIS_MAP + per-axis flips from calibration) ->
// Euler XYZ -> quaternion qGlove. At grab start store qGlove0 and qModel0. Each sample:
//   qDelta = qGlove * inverse(qGlove0)          (rotation of the hand since the grab, in screen space)
//   target = qDelta * qModel0                    (apply that rotation on top of where the model was)
// A 2° dead zone on qDelta keeps a resting hand from drifting the model. Views slerp toward `target` at 0.25.
// Release keeps the model where it is. G:SHAKE animates back to the default view.

import { Euler, Quaternion } from "three";
import { IDENTITY, useModelPose, type Quat } from "@/stores/modelPose";

export type SensorAxis = "roll" | "pitch" | "yaw";
export interface AxisMapEntry {
  /** Screen axis the sensor axis turns the model around (x = right, y = up, z = toward the viewer). */
  axis: "x" | "y" | "z";
  sign: 1 | -1;
}

/**
 * Sensor -> screen axes, with the glove worn on the back of the hand, fingers pointing at the screen:
 *  - twisting the wrist like a doorknob (roll) spins the model in the screen plane, clockwise with the hand;
 *  - tilting the fingers down (pitch) tips the top of the model toward you;
 *  - turning the hand left (yaw) turns the model's front to the left.
 * If a direction is wrong on real hardware, flip it on the Calibration tab (stored per axis).
 */
export const AXIS_MAP: Record<SensorAxis, AxisMapEntry> = {
  roll: { axis: "z", sign: -1 },
  pitch: { axis: "x", sign: 1 },
  yaw: { axis: "y", sign: 1 },
};

export const DEAD_ZONE_DEG = 2;
const DEG = Math.PI / 180;

export type Flips = Record<SensorAxis, boolean>;
let flips: Flips = { roll: false, pitch: false, yaw: false };
export const setAxisFlips = (f: Flips) => (flips = { ...f });
export const getAxisFlips = () => ({ ...flips });

export interface Orient {
  roll: number;
  pitch: number;
  yaw: number;
}

/** Glove orientation -> quaternion in screen space. */
export function gloveQuat(o: Orient, f: Flips = flips): Quaternion {
  const v = { x: 0, y: 0, z: 0 };
  for (const k of ["roll", "pitch", "yaw"] as SensorAxis[]) {
    const m = AXIS_MAP[k];
    v[m.axis] += o[k] * m.sign * (f[k] ? -1 : 1) * DEG;
  }
  return new Quaternion().setFromEuler(new Euler(v.x, v.y, v.z, "XYZ"));
}

/** Angle of a rotation quaternion in degrees (0..180). */
export function quatAngleDeg(q: Quaternion): number {
  return (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
}

const toQ = (q: Quat) => new Quaternion(q[0], q[1], q[2], q[3]);
const fromQ = (q: Quaternion): Quat => [q.x, q.y, q.z, q.w];

/** Pure step: the model target for a glove sample, given the grab-start quaternions. */
export function grabTarget(qGlove: Quaternion, qGlove0: Quaternion, qModel0: Quaternion): Quaternion {
  const qDelta = qGlove.clone().multiply(qGlove0.clone().invert());
  if (quatAngleDeg(qDelta) < DEAD_ZONE_DEG) return qModel0.clone();
  return qDelta.multiply(qModel0).normalize();
}

// ---- session state ----
let hasSwitch = false;
let last: Orient | null = null;
let start: { g: Quaternion; m: Quaternion } | null = null;

function begin() {
  const pose = useModelPose.getState();
  start = last ? { g: gloveQuat(last), m: toQ(pose.q) } : null;
  useModelPose.setState({ grabbed: true });
}

function end() {
  start = null;
  useModelPose.setState({ grabbed: false });
}

/** BTN:DOWN / BTN:UP. Any switch event means this glove has a switch, so knocks become plain clicks. */
export function onSwitch(down: boolean) {
  hasSwitch = true;
  if (down) begin();
  else end();
}

/** G:SELECT. Returns true when the knock was used to toggle grab (no switch, a 3D view on screen). */
export function onKnock(): boolean {
  if (hasSwitch || useModelPose.getState().views === 0) return false;
  if (useModelPose.getState().grabbed) end();
  else begin();
  return true;
}

/** O:roll,pitch,yaw sample. */
export function onOrientation(o: Orient) {
  last = o;
  if (!useModelPose.getState().grabbed) return;
  if (!start) {
    // Grab began before the first orientation sample: anchor here.
    start = { g: gloveQuat(o), m: toQ(useModelPose.getState().q) };
    return;
  }
  useModelPose.getState().setQ(fromQ(grabTarget(gloveQuat(o), start.g, start.m)));
}

/** G:SHAKE: animate back to the default view (the views slerp there). Re-anchor if still grabbing. */
export function onShake() {
  useModelPose.getState().setQ(IDENTITY);
  if (useModelPose.getState().grabbed && last) start = { g: gloveQuat(last), m: new Quaternion() };
}

export const switchSeen = () => hasSwitch;

/** Link dropped: let go of the model without marking a switch as seen (knock mode must survive a drop). */
export function releaseGrab() {
  if (useModelPose.getState().grabbed) end();
}

export function resetGrabForTests() {
  hasSwitch = false;
  last = null;
  start = null;
  flips = { roll: false, pitch: false, yaw: false };
  useModelPose.setState({ q: IDENTITY, grabbed: false, views: 0 });
}
