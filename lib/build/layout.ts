// Auto-layout for template builds: controller in the middle, power parts on the left, the rest on the right.

import type { Instance, Part } from "@/lib/types";
import { cardGeometry } from "./geometry";

const GAP_Y = 28;
const COL_GAP = 120;

export function autoLayout(instances: Instance[], getPart: (id: string) => Part | undefined): Instance[] {
  const parts = instances.map((i) => ({ inst: i, part: getPart(i.partId)! })).filter((x) => x.part);
  const controllers = parts.filter((x) => x.part.role === "controller");
  const power = parts.filter((x) => ["battery", "charger", "regulator", "boost"].includes(x.part.role));
  const rest = parts.filter((x) => !controllers.includes(x) && !power.includes(x));

  const placed = new Map<string, { x: number; y: number }>();
  const ctrlW = Math.max(200, ...controllers.map((c) => cardGeometry(c.part, c.inst.rotation).w));
  const centerX = 0;
  let y = 0;
  for (const c of controllers) {
    placed.set(c.inst.id, { x: centerX, y });
    y += cardGeometry(c.part, c.inst.rotation).h + GAP_Y;
  }

  // Power column (left), rotated so pins face the controller.
  let py = 0;
  for (const p of power) {
    const g = cardGeometry(p.part, 180);
    placed.set(p.inst.id, { x: centerX - COL_GAP - g.w, y: py });
    p.inst.rotation = 180;
    py += g.h + GAP_Y;
  }

  // Right side: up to two columns, balanced by height.
  const cols: { x: number; y: number }[] = [
    { x: centerX + ctrlW + COL_GAP, y: 0 },
    { x: centerX + ctrlW + COL_GAP * 2 + 152, y: 0 },
  ];
  const total = rest.reduce((s, r) => s + cardGeometry(r.part, 0).h + GAP_Y, 0);
  const useTwo = total > 620;
  for (const r of rest) {
    const g = cardGeometry(r.part, 0);
    const col = useTwo && cols[1].y < cols[0].y ? cols[1] : cols[0];
    placed.set(r.inst.id, { x: col.x, y: col.y });
    col.y += g.h + GAP_Y;
    if (!useTwo) cols[1].y = Infinity;
  }
  // If there is no controller and no power, lay everything in a grid.
  return instances.map((i) => ({ ...i, ...(placed.get(i.id) ?? { x: i.x, y: i.y }) }));
}
