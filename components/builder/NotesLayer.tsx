"use client";

import { useMemo } from "react";
import type { Build, Finding, Part } from "@/lib/types";
import { cardGeometry } from "@/lib/build/geometry";
import { StickyNote } from "@/components/notes/StickyNote";
import type { View } from "./viewStore";

const NOTE_W = 232;
const NOTE_H = 150;

interface Props {
  findings: Finding[];
  build: Build;
  getPart: (id: string) => Part | undefined;
  view: View;
  size: { w: number; h: number };
  onApply: (f: Finding) => void;
  onDismiss: (f: Finding) => void;
  onHover: (f: Finding | null) => void;
}

/** Sticky notes in screen space, pinned next to the part they are about. */
export function NotesLayer({ findings, build, getPart, view, size, onApply, onDismiss, onHover }: Props) {
  const placed = useMemo(() => {
    const rects: { x: number; y: number }[] = [];
    const byId = new Map(build.instances.map((i) => [i.id, i]));
    return findings.map((f) => {
      const inst = f.instanceIds.map((id) => byId.get(id)).find(Boolean);
      let x = size.w - NOTE_W - 24;
      let y = 56;
      if (inst) {
        const part = getPart(inst.partId);
        const g = part ? cardGeometry(part, inst.rotation) : { w: 160, h: 100 };
        x = (inst.x + g.w) * view.k + view.x + 18;
        y = inst.y * view.k + view.y + 4;
        if (x + NOTE_W > size.w - 12) x = inst.x * view.k + view.x - NOTE_W - 18;
      }
      x = Math.max(12, Math.min(size.w - NOTE_W - 12, x));
      y = Math.max(52, Math.min(size.h - NOTE_H - 60, y));
      // Nudge down until it no longer overlaps an earlier note.
      for (let guard = 0; guard < 12; guard++) {
        const hit = rects.find((r) => Math.abs(r.x - x) < NOTE_W - 10 && Math.abs(r.y - y) < NOTE_H - 10);
        if (!hit) break;
        y = hit.y + NOTE_H - 4;
        if (y > size.h - NOTE_H - 60) {
          y = 56;
          x = x - NOTE_W - 12 < 12 ? x + NOTE_W + 12 : x - NOTE_W - 12;
        }
      }
      rects.push({ x, y });
      return { f, x, y };
    });
  }, [findings, build.instances, getPart, view, size]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {placed.map(({ f, x, y }) => (
        <div key={f.id} className="pointer-events-auto absolute" style={{ left: x, top: y }} onMouseEnter={() => onHover(f)} onMouseLeave={() => onHover(null)}>
          <StickyNote finding={f} onApply={() => onApply(f)} onDismiss={() => onDismiss(f)} />
        </div>
      ))}
    </div>
  );
}
