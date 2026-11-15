import "server-only";
import type { Finding } from "@/lib/types";
import { noteText, type Lang } from "@/lib/i18n/notes";
import { env, fetchJson } from "./config";
import { polishNote } from "./gemini";

// Sticky-note text. Order: standalone notes-service (Maritime) if NOTES_SERVICE_URL is set, else in-process
// templates, optionally tightened by Gemini. Template text is always the fallback.
export async function notesFor(findings: Finding[], lang: Lang): Promise<{ notes: Record<string, { title: string; body: string }>; mode: string }> {
  if (env.notesServiceUrl) {
    try {
      const r = await fetchJson<{ notes: Record<string, { title: string; body: string }> }>(`${env.notesServiceUrl.replace(/\/$/, "")}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ findings, lang }),
        timeoutMs: 6000,
      });
      return { notes: r.notes, mode: "notes-service" };
    } catch {
      // fall back below
    }
  }
  const notes: Record<string, { title: string; body: string }> = {};
  await Promise.all(
    findings.slice(0, 12).map(async (f) => {
      notes[f.id] = await polishNote(noteText(f.code, f.params, lang), lang);
    }),
  );
  return { notes, mode: env.geminiKey ? "templates+gemini" : "templates" };
}
