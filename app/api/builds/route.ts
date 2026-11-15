import { parseBuild } from "@/lib/circuit/validate";
import { loadBuild, saveBuild } from "@/lib/integrations/mongo";

export async function POST(req: Request) {
  const build = parseBuild(await req.json().catch(() => null));
  if (!build) return Response.json({ error: "Invalid build" }, { status: 400 });
  return Response.json(await saveBuild(build));
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  const build = await loadBuild(id);
  return build ? Response.json(build) : Response.json({ error: "Not found" }, { status: 404 });
}
