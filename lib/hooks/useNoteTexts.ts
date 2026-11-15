"use client";

import { useEffect, useState } from "react";
import type { Finding } from "@/lib/types";
import { useContextData } from "@/stores/context";
import { useUi } from "@/stores/ui";

type Texts = Record<string, { title: string; body: string }>;

/**
 * Polished note text from the server (notes-service or Gemini) when one is configured. Until it arrives,
 * and whenever nothing is configured, notes render the local template text.
 */
export function useNoteTexts(findings: Finding[]): Texts {
  const lang = useUi((s) => s.lang);
  const integrations = useContextData((s) => s.integrations);
  const enabled = integrations.gemini === "live" || integrations.notesService === "live";
  const key = `${lang}|${findings.map((f) => f.id + JSON.stringify(f.params)).join(";")}`;
  const [state, setState] = useState<{ key: string; texts: Texts }>({ key: "", texts: {} });

  useEffect(() => {
    if (!enabled || !findings.length) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ findings, lang }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { notes?: Texts } | null) => alive && j?.notes && setState({ key, texts: j.notes }))
        .catch(() => {});
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // findings are captured by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return state.key === key ? state.texts : {};
}
