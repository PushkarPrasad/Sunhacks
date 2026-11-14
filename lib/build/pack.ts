// Shelf packer used by both the Board Fit check and the PCB generator, so they agree on board size.

import type { Build, Part } from "@/lib/types";
import { footprintExtent } from "./footprint";

export const PACK_GAP = 3; // mm between module outlines
export const BOARD_MARGIN = 8; // mm from board edge (leaves room for M3 holes in the corners)
export const HOLE_D = 3.2;
export const HOLE_INSET = 4;

export interface PackItem {
  instanceId: string;
  w: number;
  h: number;
}

export interface Placement extends PackItem {
  /** Centre of the module relative to the board centre, mm. */
  cx: number;
  cy: number;
}

export interface PackResult {
  placements: Placement[];
  boardW: number;
  boardH: number;
  footprintArea: number;
  fits: boolean;
}

export function packItems(build: Build, getPart: (id: string) => Part | undefined): PackItem[] {
  const items: PackItem[] = [];
  for (const inst of build.instances) {
    const part = getPart(inst.partId);
    if (!part || part.offBoard || part.footprint === "none") continue;
    const fp = footprintExtent(part.footprint);
    // Cable-mounted parts only need room for their connector (plus a little for the housing).
    let w = part.mount === "cable" ? fp.w + 2 : Math.max(fp.w, part.dimensions_mm.w);
    let h = part.mount === "cable" ? fp.h + 4 : Math.max(fp.h, part.dimensions_mm.h);
    if (inst.rotation === 90 || inst.rotation === 270) [w, h] = [h, w];
    items.push({ instanceId: inst.id, w: round(w), h: round(h) });
  }
  return items;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Packs items into shelves no wider than maxInnerW. Returns positions relative to the top-left inner corner. */
function shelfPack(items: PackItem[], maxInnerW: number) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const out: { item: PackItem; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let shelfH = 0;
  let usedW = 0;
  for (const it of sorted) {
    if (x > 0 && x + it.w > maxInnerW) {
      y += shelfH + PACK_GAP;
      x = 0;
      shelfH = 0;
    }
    out.push({ item: it, x, y });
    x += it.w + PACK_GAP;
    usedW = Math.max(usedW, x - PACK_GAP);
    shelfH = Math.max(shelfH, it.h);
  }
  return { out, innerW: usedW, innerH: y + shelfH };
}

/**
 * Packs the build's on-board modules. With a fixed board size the packer fills that width and reports
 * whether the result fits; otherwise it searches for a near-square board.
 */
export function packBoard(items: PackItem[], fixed?: { w: number; h: number }): PackResult {
  const footprintArea = items.reduce((s, i) => s + i.w * i.h, 0);
  if (items.length === 0) {
    const w = fixed?.w ?? 40;
    const h = fixed?.h ?? 30;
    return { placements: [], boardW: w, boardH: h, footprintArea: 0, fits: true };
  }
  const widest = Math.max(...items.map((i) => i.w));
  let best: ReturnType<typeof shelfPack> | null = null;
  if (fixed) {
    best = shelfPack(items, Math.max(widest, fixed.w - 2 * BOARD_MARGIN));
  } else {
    let bestScore = Infinity;
    const target = Math.sqrt(footprintArea * 1.25);
    for (let k = 0.7; k <= 2.0; k += 0.1) {
      const r = shelfPack(items, Math.max(widest, target * k));
      const area = (r.innerW + 2 * BOARD_MARGIN) * (r.innerH + 2 * BOARD_MARGIN);
      const aspect = Math.max(r.innerW, r.innerH) / Math.max(1, Math.min(r.innerW, r.innerH));
      const score = area * (1 + Math.max(0, aspect - 1.6) * 0.5);
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
  }
  const r = best!;
  const boardW = fixed?.w ?? Math.ceil(r.innerW + 2 * BOARD_MARGIN);
  const boardH = fixed?.h ?? Math.ceil(r.innerH + 2 * BOARD_MARGIN);
  const fits = !fixed || (r.innerW <= fixed.w - 2 * BOARD_MARGIN + 0.01 && r.innerH <= fixed.h - 2 * BOARD_MARGIN + 0.01);
  // Centre the packed block on the board.
  const offX = -r.innerW / 2;
  const offY = -r.innerH / 2;
  const placements = r.out.map(({ item, x, y }) => ({
    ...item,
    cx: round(offX + x + item.w / 2),
    // PCB y is up; shelves grow downward
    cy: round(-(offY + y + item.h / 2)),
  }));
  return { placements, boardW, boardH, footprintArea: round(footprintArea), fits };
}
