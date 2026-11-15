"use client";

import { create } from "zustand";

/**
 * Target orientation of the device model on screen, as a quaternion [x, y, z, w]. The glove grab writes it; every
 * 3D view slerps its model root toward it at 0.25 per frame (see `slerpToPose`). `grabbed` drives the visible
 * "Grabbed" chip and emerald ring.
 */
export type Quat = [number, number, number, number];
export const IDENTITY: Quat = [0, 0, 0, 1];

interface ModelPose {
  q: Quat;
  grabbed: boolean;
  /** Number of mounted 3D views (a knock toggles grab only when one is on screen). */
  views: number;
  setQ: (q: Quat) => void;
  reset: () => void;
}

export const useModelPose = create<ModelPose>((set) => ({
  q: IDENTITY,
  grabbed: false,
  views: 0,
  setQ: (q) => set({ q }),
  reset: () => set({ q: IDENTITY }),
}));

/** Per-frame smoothing toward the target (the spec's 0.25 slerp). */
export const POSE_SLERP = 0.25;

// ---- helpers for 3D views ----
import { useEffect } from "react";
import { Quaternion, type Object3D } from "three";

const tmp = new Quaternion();
/** Per frame: slerp a model root toward the pose target (the spec's 0.25). Returns the angle left, in degrees. */
export function slerpToPose(obj: Object3D, amount = POSE_SLERP): number {
  const [x, y, z, w] = useModelPose.getState().q;
  tmp.set(x, y, z, w);
  obj.quaternion.slerp(tmp, amount);
  const left = (2 * Math.acos(Math.min(1, Math.abs(obj.quaternion.dot(tmp)))) * 180) / Math.PI;
  if (typeof window !== "undefined") (window as unknown as { __magicSmokePoseApplied?: number[] }).__magicSmokePoseApplied = obj.quaternion.toArray();
  return left;
}

/** Register a mounted 3D view so a knock can toggle grab while it is on screen. */
export function usePoseView() {
  useEffect(() => {
    useModelPose.setState((s) => ({ views: s.views + 1 }));
    return () => useModelPose.setState((s) => ({ views: Math.max(0, s.views - 1) }));
  }, []);
}
