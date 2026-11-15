"use client";

import { useModelPose } from "@/stores/modelPose";

/** "Grabbed" chip and an emerald ring around the model while the glove holds it. Put inside a relative 3D view. */
export function GrabChip() {
  const grabbed = useModelPose((s) => s.grabbed);
  return (
    <div className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${grabbed ? "opacity-100" : "opacity-0"}`} aria-hidden={!grabbed}>
      <div className="absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-copper/70 shadow-[0_0_40px_-8px_rgb(15_157_107/0.6)]" />
      <span role="status" className="absolute left-1/2 top-5 -translate-x-1/2 rounded-[10px] border border-copper/60 bg-card/90 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink" data-testid="grab-chip">
        {grabbed ? "Grabbed" : ""}
      </span>
    </div>
  );
}
