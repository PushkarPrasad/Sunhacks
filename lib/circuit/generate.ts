// Build -> tscircuit Circuit JSON (server only). Each on-board module becomes a Chip whose footprint is a header
// pattern matching the module; placement comes from the shared shelf packer so Board Fit and the PCB agree.

import "server-only";
import { Board, Chip, Circuit, Hole, Trace } from "@tscircuit/core";
import type { Build, Part } from "@/lib/types";
import { BOARD_MARGIN, HOLE_D, HOLE_INSET, packBoard, packItems } from "@/lib/build/pack";

export type CircuitJson = { type: string; [k: string]: unknown }[];

export interface GeneratedCircuit {
  circuitJson: CircuitJson;
  board: { w: number; h: number };
  /** Instances placed on the carrier (off-board parts like the OV2640 ribbon camera are skipped). */
  placed: string[];
  skipped: { instanceId: string; reason: string }[];
  errors: string[];
  ms: number;
}

const SCH_SCALE = 1 / 42; // canvas px -> schematic units

export async function generateCircuit(build: Build, getPart: (id: string) => Part | undefined): Promise<GeneratedCircuit> {
  const t0 = Date.now();
  const items = packItems(build, getPart);
  const pack = packBoard(items, build.board);
  const placement = new Map(pack.placements.map((p) => [p.instanceId, p]));

  const circuit = new Circuit();
  const board = new Board({ width: `${pack.boardW}mm`, height: `${pack.boardH}mm` });
  circuit.add(board);

  // Four M3 mounting holes.
  const hx = pack.boardW / 2 - HOLE_INSET;
  const hy = pack.boardH / 2 - HOLE_INSET;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    board.add(new Hole({ diameter: `${HOLE_D}mm`, pcbX: sx * hx, pcbY: sy * hy }));
  }

  const skipped: GeneratedCircuit["skipped"] = [];
  const onBoard = new Map<string, { label: string; part: Part }>();
  const minX = Math.min(0, ...build.instances.map((i) => i.x));
  const minY = Math.min(0, ...build.instances.map((i) => i.y));
  for (const inst of build.instances) {
    const part = getPart(inst.partId);
    if (!part) continue;
    const pl = placement.get(inst.id);
    if (!pl || part.footprint === "none") {
      skipped.push({ instanceId: inst.id, reason: part.offBoard ? "Connects by ribbon, not placed on the carrier" : "No footprint" });
      continue;
    }
    const pinLabels: Record<string, string> = {};
    part.pins.forEach((p, i) => (pinLabels[`pin${i + 1}`] = p.name));
    board.add(
      new Chip({
        name: inst.label,
        footprint: part.footprint,
        pinLabels,
        pcbX: pl.cx,
        pcbY: pl.cy,
        pcbRotation: inst.rotation === 90 || inst.rotation === 270 ? 90 : 0,
        schX: Math.round((inst.x - minX) * SCH_SCALE * 10) / 10,
        schY: -Math.round((inst.y - minY) * SCH_SCALE * 10) / 10,
        manufacturerPartNumber: part.name,
      }),
    );
    onBoard.set(inst.id, { label: inst.label, part });
  }

  const sel = (instanceId: string, pin: string) => {
    const e = onBoard.get(instanceId);
    if (!e) return null;
    const idx = e.part.pins.findIndex((p) => p.name === pin);
    return idx < 0 ? null : `.${e.label} > .pin${idx + 1}`;
  };
  for (const w of build.wires) {
    const from = sel(w.from.instanceId, w.from.pin);
    const to = sel(w.to.instanceId, w.to.pin);
    if (from && to) board.add(new Trace({ from, to }));
  }

  await circuit.renderUntilSettled();
  const circuitJson = circuit.getCircuitJson() as unknown as CircuitJson;
  const errors = circuitJson
    .filter((e) => e.type.endsWith("_error"))
    .map((e) => String((e as { message?: string }).message ?? e.type));
  return {
    circuitJson,
    board: { w: pack.boardW, h: pack.boardH },
    placed: [...onBoard.keys()],
    skipped,
    errors,
    ms: Date.now() - t0,
  };
}

export { BOARD_MARGIN };
