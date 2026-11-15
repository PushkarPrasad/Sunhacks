"use client";

import { useEffect, useState } from "react";
import type { Build } from "@/lib/types";

export interface CircuitResult {
  circuitJson: { type: string; [k: string]: unknown }[];
  schematicSvg: string;
  pcbSvg: string;
  board: { w: number; h: number };
  errors: string[];
  skipped: { instanceId: string; reason: string }[];
  placed: string[];
  ms: number;
  traces: number;
}

const cache = new Map<string, CircuitResult>();

export function circuitKey(b: Build): string {
  return JSON.stringify({
    i: b.instances.map((i) => [i.id, i.partId, i.label, i.rotation, Math.round(i.x / 40), Math.round(i.y / 40)]),
    w: b.wires.map((w) => [w.from.instanceId, w.from.pin, w.to.instanceId, w.to.pin]),
    b: b.board ?? null,
  });
}

export function useCircuit(build: Build, enabled = true) {
  const key = circuitKey(build);
  const [state, setState] = useState<{ key: string; data: CircuitResult | null; error: string | null; loading: boolean }>(() => ({
    key,
    data: cache.get(key) ?? null,
    error: null,
    loading: !cache.has(key),
  }));

  useEffect(() => {
    if (!enabled) return;
    const hit = cache.get(key);
    if (hit) {
      setState({ key, data: hit, error: null, loading: false });
      return;
    }
    setState((s) => ({ key, data: s.data, error: null, loading: true }));
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/circuit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(build), signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Generation failed");
        cache.set(key, json as CircuitResult);
        setState({ key, data: json as CircuitResult, error: null, loading: false });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState((s) => ({ key, data: s.data, error: (e as Error).message, loading: false }));
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // build is captured by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return state;
}
