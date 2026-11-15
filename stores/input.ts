"use client";

// One shared input store for the webcam and the glove. Both sources report here; this file owns the fusion
// rules so no page duplicates them:
//   Grab      = the glove only: held switch (BTN:DOWN) or, with no switch, a knock that toggles (lib/input/grab.ts)
//   Rotate    = quaternion delta from the grab start (lib/input/grab.ts)
//   Select    = camera pinch  OR  G:SELECT (when the knock is not a grab toggle)
//   Explode   = continuous palm openness from the camera (lib/input/openness.ts)
//   Next/prev = camera swipe  OR  G:SWIPE_R / G:SWIPE_L
//   Recenter  = G:SHAKE
// A second event of the same action within 300 ms is dropped (lib/input/fuse.ts).

import { create } from "zustand";
import type { InputAction } from "@/lib/input/bus";
import { emitFused, type InputSource } from "@/lib/input/fuse";
import { onShake } from "@/lib/input/grab";
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
  /** Palm openness 0..1 (held value) and whether the hand is actively driving the explode. */
  openness: number | null;
  opennessDriving: boolean;
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
  openness: null,
  opennessDriving: false,
}));

let seq = 0;

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

/** Glove switch state for the UI (the grab itself lives in lib/input/grab.ts). */
export function setSwitch(down: boolean) {
  if (useInput.getState().switchDown === down) return;
  useInput.setState({ switchDown: down });
  logInputEvent(down ? "Switch down" : "Switch up", "glove");
}

/** Latest glove orientation for the dials (rotation is applied by lib/input/grab.ts). */
export function pushOrientation(o: Orientation) {
  useInput.setState({ orientation: o });
}

/** G:SHAKE or the Recenter button: animate the model back to its default view. */
export function recenter(source: InputSource = "glove") {
  onShake();
  logInputEvent("Recenter", source);
}

export function resetInputForTests() {
  useInput.setState({ cameraFist: false, switchDown: false, grabbing: false, orientation: null, events: [] });
}

// Mirror the grab clutch into this store so existing UI that reads `grabbing` keeps working.
useModelPose.subscribe((p) => {
  if (useInput.getState().grabbing !== p.grabbed) {
    useInput.setState({ grabbing: p.grabbed });
    logInputEvent(p.grabbed ? "Grab" : "Release", "glove");
  }
});
