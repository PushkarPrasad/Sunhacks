"use client";

import { useEffect } from "react";
import { useInput } from "@/stores/input";

/** While the hand is driving (engaged, gated), palm openness sets the explode value continuously. */
export function useHandExplode(setExplode: (v: number) => void) {
  useEffect(
    () =>
      useInput.subscribe((s) => {
        if (s.opennessDriving && s.openness !== null) setExplode(s.openness);
      }),
    [setExplode],
  );
}

/** Thin openness meter shown next to the explode slider while the hand drives it. */
export function OpennessMeter() {
  const driving = useInput((s) => s.opennessDriving);
  const v = useInput((s) => s.openness);
  if (!driving || v === null) return null;
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted" data-testid="openness-meter" aria-label={`Hand openness ${Math.round(v * 100)} percent`}>
      Hand
      <span className="relative h-1 w-16 overflow-hidden rounded-full bg-line">
        <span className="absolute inset-y-0 left-0 rounded-full bg-ok transition-[width] duration-150 ease-out" style={{ width: `${v * 100}%` }} />
      </span>
    </span>
  );
}
