import { partsById } from "@/data/parts";
import { cachedCircuit } from "@/lib/circuit/cache";
import { bomCsv, gerberZip, kicadZip, slug } from "@/lib/circuit/exports";
import { parseBuild } from "@/lib/circuit/validate";

const getPart = (id: string) => partsById[id];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { build?: unknown; kind?: string } | null;
  const build = parseBuild(body?.build);
  const kind = body?.kind;
  if (!build || !kind) return Response.json({ error: "Invalid request" }, { status: 400 });
  const r = await cachedCircuit(build, getPart);
  const name = slug(build.name);
  const file = (data: BodyInit, type: string, filename: string) =>
    new Response(data, { headers: { "content-type": type, "content-disposition": `attachment; filename="${filename}"` } });
  switch (kind) {
    case "gerber":
      return file(new Uint8Array(await gerberZip(r.circuitJson, build.name)), "application/zip", `${name}-gerbers.zip`);
    case "bom":
      return file(await bomCsv(r.circuitJson, build, getPart), "text/csv; charset=utf-8", `${name}-bom.csv`);
    case "kicad":
      return file(new Uint8Array(await kicadZip(r.circuitJson, build.name)), "application/zip", `${name}-kicad.zip`);
    case "json":
      return file(JSON.stringify(r.circuitJson, null, 2), "application/json", `${name}.circuit.json`);
    default:
      return Response.json({ error: "Unknown export kind" }, { status: 400 });
  }
}
