import { identifyDevice } from "@/lib/integrations/gemini";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { image?: string; mime?: string } | null;
  if (!body?.image || body.image.length > 8_000_000) return Response.json({ error: "Missing or oversized image" }, { status: 400 });
  const r = await identifyDevice(body.image, body.mime ?? "image/jpeg");
  return Response.json({
    ...r,
    message: r.mode === "mock" ? "Photo scanning needs a GEMINI_API_KEY on the server. Pick a category below." : r.categoryId ? undefined : "Could not tell from that photo. Pick a category below.",
  });
}
