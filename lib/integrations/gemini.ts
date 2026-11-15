import "server-only";
import { categories } from "@/data/categories";
import type { Suggestion } from "@/data/compat";
import { env, fetchJson } from "./config";

// Gemini is used for three narrow jobs only: re-order rule-based part suggestions, tighten sticky-note text,
// and guess a device category from a photo. It never adds parts or changes check results.

interface GenResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function generate(parts: unknown[], json = true): Promise<string | null> {
  if (!env.geminiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) },
  };
  const r = await fetchJson<GenResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.geminiKey },
    body: JSON.stringify(body),
    timeoutMs: 12_000,
  });
  return r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? null;
}

/** Re-orders rule-based candidates. Unknown ids from the model are dropped; missing ones keep rule order. */
export async function rankSuggestions(partName: string, candidates: Suggestion[], presentNames: string[]): Promise<{ ranked: Suggestion[]; mode: "live" | "mock" }> {
  if (!env.geminiKey) return { ranked: candidates, mode: "mock" };
  try {
    const text = await generate([
      {
        text:
          `A maker is building a hardware project containing: ${presentNames.join(", ") || "nothing yet"}. ` +
          `They selected "${partName}". Order these candidate part ids from most to least useful to add next. ` +
          `Return JSON {"order": [ids]} using only these ids: ${JSON.stringify(candidates.map((c) => ({ id: c.partId, reason: c.reason })))}`,
      },
    ]);
    const order = (JSON.parse(text ?? "{}") as { order?: string[] }).order ?? [];
    const byId = new Map(candidates.map((c) => [c.partId, c]));
    const ranked = [...order.filter((id) => byId.has(id)).map((id) => byId.get(id)!), ...candidates.filter((c) => !order.includes(c.partId))];
    return { ranked, mode: "live" };
  } catch {
    return { ranked: candidates, mode: "mock" };
  }
}

/** Tightens note wording. Must keep every number; falls back to the template text on any doubt. */
export async function polishNote(note: { title: string; body: string }, lang: string): Promise<{ title: string; body: string }> {
  if (!env.geminiKey) return note;
  try {
    const text = await generate([
      {
        text:
          `Rewrite this hardware design note to be clear and neutral, max 2 sentences, language code "${lang}". ` +
          `Keep every number, unit and part name exactly. Do not mention AI, assistants, opinions ("I think") or human review. ` +
          `Return JSON {"title": string, "body": string}. Note: ${JSON.stringify(note)}`,
      },
    ]);
    const out = JSON.parse(text ?? "{}") as { title?: string; body?: string };
    const nums = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).sort().join(",");
    if (!out.title || !out.body || nums(out.title + out.body) !== nums(note.title + note.body)) return note;
    if (/\b(AI|assistant|I think|chat)\b/i.test(out.title + out.body)) return note;
    return { title: out.title, body: out.body };
  } catch {
    return note;
  }
}

/** Guesses a device category from a photo. Returns null without a key. */
export async function identifyDevice(imageBase64: string, mime: string): Promise<{ categoryId: string | null; mode: "live" | "mock" }> {
  if (!env.geminiKey) return { categoryId: null, mode: "mock" };
  const ids = categories.filter((c) => c.kind === "device").map((c) => c.id);
  try {
    const text = await generate([
      { inlineData: { mimeType: mime || "image/jpeg", data: imageBase64 } },
      { text: `Which kind of device is shown? Answer JSON {"category": one of ${JSON.stringify(ids)} or null}.` },
    ]);
    const c = (JSON.parse(text ?? "{}") as { category?: string | null }).category ?? null;
    return { categoryId: c && ids.includes(c) ? c : null, mode: "live" };
  } catch {
    return { categoryId: null, mode: "mock" };
  }
}
