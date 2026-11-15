import type { Finding } from "@/lib/types";
import type { Lang } from "@/lib/i18n/notes";
import { notesFor } from "@/lib/integrations/notes";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { findings?: Finding[]; lang?: Lang } | null;
  if (!Array.isArray(b?.findings)) return Response.json({ error: "Invalid request" }, { status: 400 });
  const lang = b.lang === "es" || b.lang === "hi" ? b.lang : "en";
  return Response.json(await notesFor(b.findings.slice(0, 30), lang));
}
