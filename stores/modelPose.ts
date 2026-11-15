"use client";

import { create } from "zustand";

/**
 * Extra rotation applied to the device model on screen. The glove's globe-grab writes here; models read it every
 * frame (no re-render). Angles in radians.
 */
interface ModelPose {
  rx: number;
  ry: number;
  rz: number;
  set: (r: Partial<{ rx: number; ry: number; rz: number }>) => void;
  reset: () => void;
}

export const useModelPose = create<ModelPose>((set) => ({
  rx: 0,
  ry: 0,
  rz: 0,
  set: (r) => set(r),
  reset: () => set({ rx: 0, ry: 0, rz: 0 }),
}));
