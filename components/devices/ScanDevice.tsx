"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { categoriesById } from "@/data/categories";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "result"; text: string; categoryId?: string };

/** Identifies a device category from a photo (Gemini when keyed). Without a key it says so plainly. */
export function ScanDevice() {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const router = useRouter();

  const onFile = async (file: File) => {
    setState({ kind: "busy" });
    try {
      const data = await toBase64(file);
      const res = await fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: data, mime: file.type }) });
      const json = (await res.json()) as { categoryId: string | null; confidence?: number; mode: "live" | "mock"; message?: string };
      if (json.categoryId && categoriesById[json.categoryId]) {
        setState({ kind: "result", text: `Looks like ${categoriesById[json.categoryId].name.toLowerCase()}`, categoryId: json.categoryId });
      } else {
        setState({ kind: "result", text: json.message ?? "Could not tell from that photo. Pick a category below." });
      }
    } catch {
      setState({ kind: "result", text: "Scanning failed. Pick a category below." });
    }
  };

  return (
    <div className="flex items-center gap-3">
      {state.kind === "result" && (
        <p className="max-w-[340px] animate-fade text-right text-[13px] text-muted" role="status">
          {state.text}
          {state.categoryId && (
            <button type="button" className="ml-2 text-ink underline decoration-copper underline-offset-4" onClick={() => router.push(`/devices/${state.categoryId}`)}>
              Open
            </button>
          )}
        </p>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state.kind === "busy"}
        className="flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] transition-colors hover:border-ink disabled:opacity-60"
      >
        <ScanLine size={16} strokeWidth={1.5} />
        {state.kind === "busy" ? "Scanning…" : "Scan a Device"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
