"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n/notes";

export type BuilderTab = "build" | "schematic" | "pcb" | "3d";

interface UiState {
  lang: Lang;
  highContrast: boolean;
  motion: "system" | "reduced" | "full";
  gestures: boolean;
  builderTab: BuilderTab;
  boardView: "pcb" | "3d";
  set: (patch: Partial<Omit<UiState, "set">>) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      lang: "en",
      highContrast: false,
      motion: "system",
      gestures: false,
      builderTab: "build",
      boardView: "pcb",
      set: (patch) => set(patch),
    }),
    {
      name: "copperline-ui",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Never come back with the webcam already on.
      partialize: ({ lang, highContrast, motion, builderTab, boardView }) => ({ lang, highContrast, motion, builderTab, boardView }),
    },
  ),
);
