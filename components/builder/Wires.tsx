"use client";

import { memo, useMemo } from "react";
import type { Build, Part } from "@/lib/types";
import { pinWorldPosition } from "@/lib/build/geometry";
import { computeNets } from "@/lib/build/nets";

export type WireKind = "power" | "ground" | "signal";
export const WIRE_COLORS: Record<WireKind, string> = { power: "var(--color-bad)", ground: "var(--color-ink)", signal: "var(--color-copper)" };

export function wireKinds(build: Build, getPart: (id: string) => Part | undefined): Map<string, WireKind> {
  const map = new Map<string, WireKind>();
  for (const net of computeNets(build, getPart)) {
    const ground = net.pins.some((p) => p.def.type === "ground");
    const power = net.pins.some((p) => p.def.type === "power_out" || (p.def.type === "power_in" && p.part.role !== "passive"));
    const kind: WireKind = ground ? "ground" : power ? "power" : "signal";
    for (const w of net.wireIds) map.set(w, kind);
  }
  return map;
}

export function wirePath(a: { x: number; y: number; side: string }, b: { x: number; y: number; side: string }): string {
  const dist = Math.max(36, Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
  const dir = (s: string) => (s === "left" ? [-1, 0] : s === "right" ? [1, 0] : s === "top" ? [0, -1] : [0, 1]);
  const [ax, ay] = dir(a.side);
  const [bx, by] = dir(b.side);
  return `M ${a.x} ${a.y} C ${a.x + ax * dist} ${a.y + ay * dist}, ${b.x + bx * dist} ${b.y + by * dist}, ${b.x} ${b.y}`;
}

interface Props {
  build: Build;
  getPart: (id: string) => Part | undefined;
  selectedWire: string | null;
  onSelect: (id: string) => void;
  highlight: Set<string>;
}

function WiresImpl({ build, getPart, selectedWire, onSelect, highlight }: Props) {
  const kinds = useMemo(() => wireKinds(build, getPart), [build, getPart]);
  const byId = useMemo(() => new Map(build.instances.map((i) => [i.id, i])), [build.instances]);
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
      {build.wires.map((w) => {
        const ia = byId.get(w.from.instanceId);
        const ib = byId.get(w.to.instanceId);
        const pa = ia && getPart(ia.partId);
        const pb = ib && getPart(ib.partId);
        if (!ia || !ib || !pa || !pb) return null;
        const a = pinWorldPosition(ia, pa, w.from.pin);
        const b = pinWorldPosition(ib, pb, w.to.pin);
        if (!a || !b) return null;
        const d = wirePath(a, b);
        const kind = kinds.get(w.id) ?? "signal";
        const sel = selectedWire === w.id;
        const hl = highlight.has(w.id);
        return (
          <g key={w.id}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={12} className="pointer-events-auto cursor-pointer" onPointerDown={(e) => e.stopPropagation()} onClick={() => onSelect(w.id)} />
            {(sel || hl) && <path d={d} fill="none" stroke={hl ? "var(--color-bad)" : "var(--color-copper)"} strokeOpacity={0.18} strokeWidth={8} strokeLinecap="round" />}
            <path d={d} fill="none" stroke={WIRE_COLORS[kind]} strokeWidth={sel ? 2.6 : 1.8} strokeLinecap="round" strokeOpacity={kind === "ground" ? 0.75 : 0.95} />
          </g>
        );
      })}
    </svg>
  );
}

export const Wires = memo(WiresImpl);
