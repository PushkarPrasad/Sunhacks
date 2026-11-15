"use client";

import { useMemo } from "react";
import { parts } from "@/data/parts";
import { runChecks } from "@/lib/checks";
import { useBuild } from "@/stores/build";
import { useContextData } from "@/stores/context";

/** Runs the checks on the current build. Pure and fast (< 5 ms for template-sized builds), so no worker. */
export function useChecks() {
  const build = useBuild((s) => s.build);
  const curves = useContextData((s) => s.batteryCurves);
  return useMemo(() => runChecks(build, parts, { batteryCurves: curves }), [build, curves]);
}
