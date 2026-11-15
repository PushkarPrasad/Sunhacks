import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { writeFileSync } from "node:fs";
import { partsById } from "@/data/parts";
import { templates } from "@/data/templates";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { generateCircuit } from "@/lib/circuit/generate";
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg";

test.skipIf(!process.env.DEBUG_CIRCUIT)("generate", async () => {
  for (const id of (process.env.DEBUG_CIRCUIT ?? "").split(",")) {
    const t = templates.find((x) => x.id === id)!;
    const b = buildFromTemplate(t, (pid) => partsById[pid]);
    const r = await generateCircuit(b, (pid) => partsById[pid]);
    const count: Record<string, number> = {};
    for (const e of r.circuitJson) count[e.type] = (count[e.type] ?? 0) + 1;
    console.log(id, r.ms, "ms", r.board, "traces", count.pcb_trace, "wires", b.wires.length, "errors", r.errors.slice(0, 4));
    writeFileSync(`${process.env.OUT}/${id}-pcb.svg`, convertCircuitJsonToPcbSvg(r.circuitJson as never));
    writeFileSync(`${process.env.OUT}/${id}-sch.svg`, convertCircuitJsonToSchematicSvg(r.circuitJson as never));
  }
}, 300_000);
