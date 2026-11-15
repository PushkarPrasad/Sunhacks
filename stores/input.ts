"use client";

// One shared input store for the webcam and the glove. Both sources report here; this file owns the fusion
// rules so no page duplicates them:
//   Grab      = camera fist held  OR  glove switch held (BTN:DOWN)
//   Rotate    = while grabbed, glove roll/pitch/yaw deltas from the grab-start baseline, smoothed
//   Select    = camera pinch  OR  G:SELECT
//   Explode   = camera spread;  Collapse = camera fist tap
//   Next/prev = camera swipe  OR  G:SWIPE_R / G:SWIPE_L
//   Recenter  = G:SHAKE
// A second event of the same action within 300 ms is dropped (lib/input/fuse.ts).

import { create } from "zustand";
import type { InputAction } from "@/lib/input/bus";
import { emitFused, type InputSource } from "@/lib/input/fuse";
import { angleDelta } from "@/lib/input/gloveProtocol";
import { useModelPose } from "./modelPose";

export type CameraStatus = "off" | "starting" | "on" | "denied" | "error";
export interface Orientation {
  roll: number;
  pitch: number;
  yaw: number;
}
export interface InputEventLog {
  id: number;
  label: string;
  source: InputSource;
  at: number;
}

interface InputState {
  camera: CameraStatus;
  cameraNotice: string | null;
  pipOpen: boolean;
  handSeen: boolean;
  cameraPose: string;
  cameraFist: boolean;
  switchDown: boolean;
  grabbing: boolean;
  orientation: Orientation | null;
  events: InputEventLog[];
}

export const useInput = create<InputState>(() => ({
  camera: "off",
  cameraNotice: null,
  pipOpen: true,
  handSeen: false,
  cameraPose: "none",
  cameraFist: false,
  switchDown: false,
  grabbing: false,
  orientation: null,
  events: [],
}));

const DEG = Math.PI / 180;
/** Exponential smoothing per glove sample (25 Hz): 0.35 settles in ~150 ms without visible lag. */
export const ROTATE_SMOOTHING = 0.35;

let seq = 0;
let baseline: { o: Orientation; rx: number; ry: number; rz: number } | null = null;

export function logInputEvent(label: string, source: InputSource) {
  const e = { id: ++seq, label, source, at: Date.now() };
  useInput.setState((s) => ({ events: [e, ...s.events].slice(0, 8) }));
}

/** Fire a fused action and log it if it was not a duplicate. */
export function fireAction(action: InputAction, source: InputSource, label: string, now = performance.now()): boolean {
  const fired = emitFused(action, source, undefined, now);
  if (fired) logInputEvent(label, source);
  return fired;
}

function updateGrab() {
  const s = useInput.getState();
  const grabbing = s.cameraFist || s.switchDown;
  if (grabbing === s.grabbing) return;
  useInput.setState({ grabbing });
  if (grabbing) takeBaseline(s.orientation);
  else baseline = null;
}

function takeBaseline(o: Orientation | null) {
  const p = useModelPose.getState();
  baseline = o ? { o, rx: p.rx, ry: p.ry, rz: p.rz } : null;
}

/** Grab from either source. Rotation starts from the orientation at the moment of the grab. */
export function setGrab(source: InputSource, down: boolean) {
  const s = useInput.getState();
  const key = source === "camera" ? "cameraFist" : "switchDown";
  if (s[key] === down) return;
  useInput.setState({ [key]: down } as Partial<InputState>);
  logInputEvent(down ? (source === "camera" ? "Fist grab" : "Switch down") : source === "camera" ? "Fist release" : "Switch up", source);
  updateGrab();
}

/** Glove orientation sample. While grabbed, turns the model like a globe from the grab-start baseline. */
export function pushOrientation(o: Orientation) {
  useInput.setState({ orientation: o });
  if (!useInput.getState().grabbing) return;
  if (!baseline) {
    takeBaseline(o);
    return;
  }
  const dPitch = angleDelta(baseline.o.pitch, o.pitch);
  const dYaw = angleDelta(baseline.o.yaw, o.yaw);
  const dRoll = angleDelta(baseline.o.roll, o.roll);
  const target = { rx: baseline.rx + dPitch * DEG, ry: baseline.ry + dYaw * DEG, rz: baseline.rz - dRoll * DEG };
  const p = useModelPose.getState();
  const k = ROTATE_SMOOTHING;
  p.set({ rx: p.rx + (target.rx - p.rx) * k, ry: p.ry + (target.ry - p.ry) * k, rz: p.rz + (target.rz - p.rz) * k });
}

/** G:SHAKE or the Recenter button: model back to its rest pose, new baseline if still grabbing. */
export function recenter(source: InputSource = "glove") {
  useModelPose.getState().reset();
  if (useInput.getState().grabbing) takeBaseline(useInput.getState().orientation);
  logInputEvent("Recenter", source);
}

export function resetInputForTests() {
  baseline = null;
  useInput.setState({ cameraFist: false, switchDown: false, grabbing: false, orientation: null, events: [] });
}
