import JSZip from "jszip";
import { partsById } from "@/data/parts";
import { cachedCircuit } from "@/lib/circuit/cache";
import { bomCsv, gerberZip, slug } from "@/lib/circuit/exports";
import { parseBuild } from "@/lib/circuit/validate";
import { uploadToHoop } from "@/lib/integrations/hoop";

const getPart = (id: string) => partsById[id];

/** Packages Gerbers + BOM + Circuit JSON + the build and uploads to Hoop (or returns the zip in mock mode). */
export async function POST(req: Request) {
  const build = parseBuild(await req.json().catch(() => null));
  if (!build) return Response.json({ error: "Invalid build" }, { status: 400 });
  const r = await cachedCircuit(build, getPart);
  const zip = new JSZip();
  zip.file("gerbers.zip", await gerberZip(r.circuitJson, build.name));
  zip.file("bom.csv", await bomCsv(r.circuitJson, build, getPart));
  zip.file("circuit.json", JSON.stringify(r.circuitJson));
  zip.file("build.json", JSON.stringify(build, null, 2));
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = `${slug(build.name)}-project.zip`;
  const result = await uploadToHoop(data, filename, { name: build.name, board: r.board, parts: build.instances.length, traces: r.circuitJson.filter((e) => e.type === "pcb_trace").length });
  if (result.mode === "mock" || result.error) {
    return new Response(data as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${filename}"`, "x-hoop-mode": result.error ? "error" : "mock" } });
  }
  return Response.json(result);
}
