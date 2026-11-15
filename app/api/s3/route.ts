import { partsById } from "@/data/parts";
import { cachedCircuit } from "@/lib/circuit/cache";
import { gerberZip, slug } from "@/lib/circuit/exports";
import { parseBuild } from "@/lib/circuit/validate";
import { uploadExport } from "@/lib/integrations/aws";

/** Uploads the Gerber zip to S3 when configured; otherwise tells the client to download instead. */
export async function POST(req: Request) {
  const build = parseBuild(await req.json().catch(() => null));
  if (!build) return Response.json({ error: "Invalid build" }, { status: 400 });
  const r = await cachedCircuit(build, (id) => partsById[id]);
  const zip = await gerberZip(r.circuitJson, build.name);
  const key = `exports/${slug(build.name)}-${build.id}-gerbers.zip`;
  try {
    return Response.json(await uploadExport(key, new Uint8Array(zip), "application/zip"));
  } catch (e) {
    return Response.json({ mode: "mock", error: e instanceof Error ? e.message : "Upload failed" });
  }
}
