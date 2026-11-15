import { partsById } from "@/data/parts";
import { suggestionsFor, type Suggestion } from "@/data/compat";
import { rankSuggestions } from "@/lib/integrations/gemini";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { partId?: string; present?: string[] } | null;
  const part = body?.partId ? partsById[body.partId] : undefined;
  if (!part) return Response.json({ error: "Unknown part" }, { status: 400 });
  // Candidates always come from the rule map on the server; the client cannot inject parts.
  const present = new Set(body?.present ?? []);
  const candidates: Suggestion[] = suggestionsFor(part.id, present);
  const names = [...present].map((id) => partsById[id]?.name).filter(Boolean) as string[];
  const { ranked, mode } = await rankSuggestions(part.name, candidates, names);
  return Response.json({ ranked, mode });
}
