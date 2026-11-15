"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { partsById } from "@/data/parts";
import { templatesById } from "@/data/templates";
import { buildFromTemplate, emptyBuild } from "@/lib/build/fromTemplate";
import * as ops from "@/lib/build/ops";
import { pinKey } from "@/lib/build/nets";
import type { Build, Fix, PinRef } from "@/lib/types";

const getPart = (id: string) => partsById[id];
const HISTORY = 60;

export type Selection = { kind: "instance"; id: string } | { kind: "wire"; id: string } | null;

interface BuildState {
  build: Build;
  past: Build[];
  future: Build[];
  selection: Selection;
  pendingPin: PinRef | null;
  hydrated: boolean;
  /** Last fix applied, for a brief confirmation. */
  lastApplied: string | null;

  commit: (next: Build) => void;
  newBuild: () => void;
  loadTemplate: (templateId: string) => void;
  loadBuild: (b: Build) => void;
  addPart: (partId: string, x?: number, y?: number) => string | null;
  beginMove: () => void;
  moveLive: (id: string, x: number, y: number) => void;
  rotate: (id: string) => void;
  remove: (id: string) => void;
  removeWire: (id: string) => void;
  select: (s: Selection) => void;
  clickPin: (ref: PinRef) => void;
  cancelWire: () => void;
  applyFix: (findingId: string, fix: Fix) => void;
  dismiss: (findingId: string) => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
}

export const useBuild = create<BuildState>()(
  persist(
    (set, get) => ({
      build: emptyBuild(),
      past: [],
      future: [],
      selection: null,
      pendingPin: null,
      hydrated: false,
      lastApplied: null,

      commit: (next) => {
        const { build, past } = get();
        if (next === build) return;
        set({ build: next, past: [...past, build].slice(-HISTORY), future: [] });
      },
      newBuild: () => set({ build: emptyBuild(), past: [], future: [], selection: null, pendingPin: null }),
      loadTemplate: (templateId) => {
        const t = templatesById[templateId];
        if (!t) return;
        set({ build: buildFromTemplate(t, getPart), past: [], future: [], selection: null, pendingPin: null });
      },
      loadBuild: (b) => set({ build: { ...b, dismissed: b.dismissed ?? [] }, past: [], future: [], selection: null, pendingPin: null }),
      addPart: (partId, x, y) => {
        const part = getPart(partId);
        if (!part) return null;
        const { build } = get();
        const px = x ?? Math.max(0, ...build.instances.map((i) => i.x + 240), 0) + (build.instances.length ? 0 : 40);
        const py = y ?? (build.instances.length ? 40 : 40);
        const { build: next, id } = ops.addInstance(build, part, px, py);
        get().commit(next);
        set({ selection: { kind: "instance", id } });
        return id;
      },
      beginMove: () => {
        const { build, past } = get();
        set({ past: [...past, build].slice(-HISTORY), future: [] });
      },
      moveLive: (id, x, y) => set({ build: ops.moveInstance(get().build, id, x, y) }),
      rotate: (id) => get().commit(ops.rotateInstance(get().build, id)),
      remove: (id) => {
        get().commit(ops.removeInstance(get().build, id));
        set({ selection: null });
      },
      removeWire: (id) => {
        get().commit(ops.removeWire(get().build, id));
        set({ selection: null });
      },
      select: (s) => set({ selection: s }),
      clickPin: (ref) => {
        const { pendingPin, build } = get();
        if (!pendingPin) {
          set({ pendingPin: ref, selection: null });
          return;
        }
        if (pinKey(pendingPin) === pinKey(ref)) {
          set({ pendingPin: null });
          return;
        }
        const { build: next, id } = ops.addWire(build, pendingPin, ref);
        if (id) get().commit(next);
        set({ pendingPin: null, selection: id ? { kind: "wire", id } : null });
      },
      cancelWire: () => set({ pendingPin: null }),
      applyFix: (findingId, fix) => {
        get().commit(ops.applyFix(get().build, fix, getPart));
        set({ lastApplied: findingId });
      },
      dismiss: (findingId) => {
        const b = get().build;
        get().commit({ ...b, dismissed: [...b.dismissed, findingId], updatedAt: Date.now() });
      },
      rename: (name) => get().commit({ ...get().build, name, updatedAt: Date.now() }),
      undo: () => {
        const { past, build, future } = get();
        if (!past.length) return;
        set({ build: past[past.length - 1], past: past.slice(0, -1), future: [build, ...future].slice(0, HISTORY), selection: null });
      },
      redo: () => {
        const { past, build, future } = get();
        if (!future.length) return;
        set({ build: future[0], future: future.slice(1), past: [...past, build].slice(-HISTORY), selection: null });
      },
    }),
    {
      name: "copperline-build",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ build }) => ({ build }),
      onRehydrateStorage: () => () => useBuild.setState({ hydrated: true }),
    },
  ),
);
