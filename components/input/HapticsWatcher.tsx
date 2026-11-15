"use client";

import { useEffect, useRef } from "react";
import { useChecks } from "@/lib/hooks/useChecks";
import { buzzRing } from "@/lib/input/serial";

/** Buzzes the gesture ring (if connected over USB) whenever a check turns red. */
export function HapticsWatcher() {
  const report = useChecks();
  const prev = useRef<Set<string>>(new Set());
  useEffect(() => {
    const red = new Set(report.results.filter((r) => r.status === "fail").map((r) => r.id));
    const turnedRed = [...red].some((id) => !prev.current.has(id));
    prev.current = red;
    if (turnedRed) void buzzRing();
  }, [report]);
  return null;
}
