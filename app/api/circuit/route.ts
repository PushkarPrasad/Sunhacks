import { partsById } from "@/data/parts";
import { cachedCircuit } from "@/lib/circuit/cache";
import { pcbSvg, responsive, schematicSvg } from "@/lib/circuit/render";
import { parseBuild } from "@/lib/circuit/validate";

export async function POST(req: Request) {
  const build = parseBuild(await req.json().catch(() => null));
  if (!build) return Response.json({ error: "Invalid build" }, { status: 400 });
  try {
    const r = await cachedCircuit(build, (id) => partsById[id]);
    return Response.json({
      circuitJson: r.circuitJson,
      schematicSvg: responsive(schematicSvg(r.circuitJson)),
      pcbSvg: responsive(pcbSvg(r.circuitJson)),
      board: r.board,
      errors: r.errors,
      skipped: r.skipped,
      placed: r.placed,
      ms: r.ms,
      traces: r.circuitJson.filter((e) => e.type === "pcb_trace").length,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Circuit generation failed" }, { status: 500 });
  }
}
