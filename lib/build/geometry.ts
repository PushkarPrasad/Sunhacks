// Card geometry for modules on the builder canvas. Shared by the canvas, wires and sticky notes.

import type { Instance, Part } from "@/lib/types";

export const HEADER_H = 40;
export const PIN_ROW = 18;
export const PAD_BOTTOM = 10;
export const PIN_COL = 18; // horizontal spacing when pins run along top/bottom

export type PinLayout = "dip" | "interleaved" | "single";

export function pinLayout(part: Part): PinLayout {
  const fp = part.footprint;
  if (/^dip\d+/.test(fp)) return "dip";
  if (/_rows2/.test(fp)) return "interleaved";
  return part.pins.length > 10 ? "dip" : "single";
}

/** Splits pins into two visual columns (left, right), top to bottom. */
export function pinColumns(part: Part): { left: string[]; right: string[] } {
  const names = part.pins.map((p) => p.name);
  const layout = pinLayout(part);
  if (layout === "single") return { left: names, right: [] };
  if (layout === "interleaved") {
    return { left: names.filter((_, i) => i % 2 === 0), right: names.filter((_, i) => i % 2 === 1) };
  }
  const half = Math.ceil(names.length / 2);
  return { left: names.slice(0, half), right: names.slice(half).reverse() };
}

export interface CardGeometry {
  w: number;
  h: number;
  pins: Record<string, { x: number; y: number; side: "left" | "right" | "top" | "bottom" }>;
}

export function cardWidth(part: Part): number {
  const layout = pinLayout(part);
  return layout === "single" ? 152 : 200;
}

/** Geometry relative to the card's top-left corner. */
export function cardGeometry(part: Part, rotation: Instance["rotation"] = 0): CardGeometry {
  const { left, right } = pinColumns(part);
  const rows = Math.max(left.length, right.length, 1);
  const pins: CardGeometry["pins"] = {};
  if (rotation === 0 || rotation === 180) {
    const w = cardWidth(part);
    const h = HEADER_H + rows * PIN_ROW + PAD_BOTTOM;
    const [l, r] = rotation === 0 ? [left, right] : [right, left];
    l.forEach((name, i) => (pins[name] = { x: 0, y: HEADER_H + i * PIN_ROW + PIN_ROW / 2, side: "left" }));
    r.forEach((name, i) => (pins[name] = { x: w, y: HEADER_H + i * PIN_ROW + PIN_ROW / 2, side: "right" }));
    return { w, h, pins };
  }
  // 90 / 270: pins along the bottom / top edges
  const w = Math.max(152, rows * PIN_COL + 24);
  const h = 104;
  const [top, bottom] = rotation === 90 ? [right, left] : [left, right];
  top.forEach((name, i) => (pins[name] = { x: 12 + i * PIN_COL + PIN_COL / 2, y: 0, side: "top" }));
  bottom.forEach((name, i) => (pins[name] = { x: 12 + i * PIN_COL + PIN_COL / 2, y: h, side: "bottom" }));
  return { w, h, pins };
}

export function pinWorldPosition(inst: Instance, part: Part, pin: string): { x: number; y: number; side: string } | null {
  const g = cardGeometry(part, inst.rotation);
  const p = g.pins[pin];
  if (!p) return null;
  return { x: inst.x + p.x, y: inst.y + p.y, side: p.side };
}

/** Top-left position near (x, y) where a new card does not overlap existing cards (spiral search on a grid). */
export function freeSpot(
  instances: Instance[],
  getPart: (id: string) => Part | undefined,
  part: Part,
  x: number,
  y: number,
  gap = 32,
): { x: number; y: number } {
  const g = cardGeometry(part, 0);
  const rects = instances.map((i) => {
    const p = getPart(i.partId);
    const cg = p ? cardGeometry(p, i.rotation) : { w: 160, h: 100 };
    return { x: i.x - gap, y: i.y - gap, w: cg.w + gap * 2, h: cg.h + gap * 2 };
  });
  const hits = (px: number, py: number) => rects.some((r) => px < r.x + r.w && px + g.w > r.x && py < r.y + r.h && py + g.h > r.y);
  const step = 40;
  for (let ring = 0; ring < 40; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const px = Math.round((x + dx * step) / 8) * 8;
        const py = Math.round((y + dy * step) / 8) * 8;
        if (!hits(px, py)) return { x: px, y: py };
      }
    }
  }
  return { x, y };
}
