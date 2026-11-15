"use client";

import { create } from "zustand";
import type { Build, Part } from "@/lib/types";
import { cardGeometry } from "@/lib/build/geometry";

export interface View {
  x: number;
  y: number;
  k: number;
}

interface ViewState {
  view: View;
  size: { w: number; h: number };
  set: (v: Partial<View>) => void;
  setSize: (w: number, h: number) => void;
  zoomAt: (factor: number, sx?: number, sy?: number) => void;
  fit: (build: Build, getPart: (id: string) => Part | undefined) => void;
  center: () => { x: number; y: number };
}

export const MIN_K = 0.3;
export const MAX_K = 2.2;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export const useView = create<ViewState>((set, get) => ({
  view: { x: 80, y: 60, k: 1 },
  size: { w: 800, h: 600 },
  set: (v) => set({ view: { ...get().view, ...v } }),
  setSize: (w, h) => set({ size: { w, h } }),
  zoomAt: (factor, sx, sy) => {
    const { view, size } = get();
    const cx = sx ?? size.w / 2;
    const cy = sy ?? size.h / 2;
    const k = clampK(view.k * factor);
    const wx = (cx - view.x) / view.k;
    const wy = (cy - view.y) / view.k;
    set({ view: { k, x: cx - wx * k, y: cy - wy * k } });
  },
  fit: (build, getPart) => {
    const { size } = get();
    if (!build.instances.length) {
      set({ view: { x: 80, y: 60, k: 1 } });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const i of build.instances) {
      const p = getPart(i.partId);
      if (!p) continue;
      const g = cardGeometry(p, i.rotation);
      minX = Math.min(minX, i.x);
      minY = Math.min(minY, i.y);
      maxX = Math.max(maxX, i.x + g.w);
      maxY = Math.max(maxY, i.y + g.h);
    }
    const pad = 56;
    const k = clampK(Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2 - 40) / (maxY - minY), 1.1));
    set({ view: { k, x: (size.w - (maxX - minX) * k) / 2 - minX * k, y: (size.h - 40 - (maxY - minY) * k) / 2 - minY * k } });
  },
  center: () => {
    const { view, size } = get();
    return { x: (size.w / 2 - view.x) / view.k, y: (size.h / 2 - view.y) / view.k };
  },
}));
