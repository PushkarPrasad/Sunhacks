"use client";

import { create } from "zustand";
import type { BatteryCurve } from "@/lib/types";

/** Data fetched once from the server that the checks can use (MATLAB discharge tables). */
interface ContextData {
  batteryCurves: BatteryCurve[];
  /** Which integrations are live on the server ("live" | "mock"). */
  integrations: Record<string, "live" | "mock">;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useContextData = create<ContextData>((set, get) => ({
  batteryCurves: [],
  integrations: {},
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : {}))
      .then((integrations) => set({ integrations }))
      .catch(() => {});
    try {
      const res = await fetch("/api/matlab");
      if (!res.ok) return;
      const data = (await res.json()) as { batteryCurves: BatteryCurve[] };
      set({ batteryCurves: data.batteryCurves ?? [] });
    } catch {
      // Offline or no curves: the checks fall back to the simple formula.
    }
  },
}));
