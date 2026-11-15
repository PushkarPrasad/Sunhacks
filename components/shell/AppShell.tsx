"use client";

import { useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useBuild } from "@/stores/build";
import { useContextData } from "@/stores/context";
import { useUi } from "@/stores/ui";
import { KeyboardMap } from "@/components/input/KeyboardMap";
import { HapticsWatcher } from "@/components/input/HapticsWatcher";
import { VoiceController } from "@/components/input/VoiceController";
import { PageNav } from "./PageNav";
import { TopBar } from "./TopBar";

// Ring cursor + camera preview; MediaPipe itself is only downloaded when the camera starts.
const GestureLayer = dynamic(() => import("@/components/input/GestureLayer").then((m) => m.GestureLayer), { ssr: false });

export function AppShell({ children }: { children: ReactNode }) {
  const highContrast = useUi((s) => s.highContrast);
  const motion = useUi((s) => s.motion);

  useEffect(() => {
    useUi.persist.rehydrate();
    Promise.resolve(useBuild.persist.rehydrate()).finally(() => useBuild.setState({ hydrated: true }));
    void useContextData.getState().load();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = highContrast ? "high" : "normal";
    root.dataset.motion = motion;
  }, [highContrast, motion]);

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="relative min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
      <PageNav />
      <KeyboardMap />
      <HapticsWatcher />
      <VoiceController />
      <GestureLayer />
    </div>
  );
}
