"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Download, Play, Redo2, Undo2 } from "lucide-react";
import { templatesById } from "@/data/templates";
import { useChecks } from "@/lib/hooks/useChecks";
import { useBuild } from "@/stores/build";
import { useUi, type BuilderTab } from "@/stores/ui";
import { Canvas } from "./Canvas";
import { ChecksStrip } from "./ChecksStrip";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";

const CircuitView = dynamic(() => import("@/components/board/CircuitView").then((m) => m.CircuitView), { ssr: false });
const HoopUpload = dynamic(() => import("./HoopUpload").then((m) => m.HoopUpload), { ssr: false });
const SnakeGame = dynamic(() => import("@/components/game/SnakeGame").then((m) => m.SnakeGame), { ssr: false });

const TABS: { id: BuilderTab; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "schematic", label: "Schematic" },
  { id: "pcb", label: "PCB" },
  { id: "3d", label: "3D" },
];

/** Handles /builder?new=1 and /builder?template=id (from server-rendered links). */
function UrlActions({ onHoop }: { onHoop: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useBuild((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    if (params.get("new") === "1") {
      useBuild.getState().newBuild();
      router.replace("/builder");
    }
    if (params.get("hoop") === "1") {
      onHoop();
      router.replace("/builder");
    }
    const t = params.get("template");
    if (t && templatesById[t]) {
      useBuild.getState().loadTemplate(t);
      router.replace("/builder");
    }
  }, [params, router, hydrated, onHoop]);
  return null;
}

/** Small basketball icon for the Upload button (Hoop Upload). */
function Basketball() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#F08A3C" fillOpacity=".25" />
      <path d="M2.5 12h19M12 2.5v19M5.3 5.3c2.4 2.2 3.4 4.4 3.4 6.7s-1 4.5-3.4 6.7M18.7 5.3c-2.4 2.2-3.4 4.4-3.4 6.7s1 4.5 3.4 6.7" />
    </svg>
  );
}

export function BuilderPage() {
  const hydrated = useBuild((s) => s.hydrated);
  const build = useBuild((s) => s.build);
  const canUndo = useBuild((s) => s.past.length > 0);
  const canRedo = useBuild((s) => s.future.length > 0);
  const { undo, redo, rename } = useBuild.getState();
  const tab = useUi((s) => s.builderTab);
  const setUi = useUi((s) => s.set);
  const report = useChecks();
  const [playing, setPlaying] = useState(false);
  const [importing, setImporting] = useState(false);
  const openHoop = useCallback(() => setImporting(true), []);
  const template = build.templateId ? templatesById[build.templateId] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(el.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">Builder</h1>
      <Suspense fallback={null}>
        <UrlActions onHoop={openHoop} />
      </Suspense>
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            aria-label="Build name"
            value={hydrated ? build.name : ""}
            onChange={(e) => rename(e.target.value)}
            className="min-w-0 max-w-[340px] flex-1 truncate rounded-md bg-transparent px-1 font-serif text-[24px] leading-none outline-none hover:bg-card focus:bg-card"
          />
          {template && <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">from template</span>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-[12px] border border-line bg-card p-0.5" role="tablist" aria-label="Builder views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setUi({ builderTab: t.id })}
              className={`rounded-[9px] px-4 py-1.5 text-[13px] transition-colors ${tab === t.id ? "bg-copper text-paper" : "text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-end gap-1">
          {template?.game && (
            <button type="button" onClick={() => setPlaying(true)} data-magnetic className="mr-2 flex h-9 items-center gap-2 rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-4 text-[13px] text-paper hover:bg-copper-hover">
              <Play size={14} strokeWidth={2} /> Run
            </button>
          )}
          <button
            type="button"
            onClick={() => setImporting(true)}
            title="Upload a build file (Hoop Upload)"
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] text-ink transition hover:-translate-y-px hover:border-copper hover:bg-raised"
          >
            <Basketball /> Upload
          </button>
          <button
            type="button"
            aria-label="Save build file"
            title="Save build file"
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([JSON.stringify(build, null, 2)], { type: "application/json" }));
              a.download = `${build.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "build"}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            }}
            className="mr-1 grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-raised hover:text-ink"
          >
            <Download size={16} strokeWidth={1.5} />
          </button>
          <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} className="grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-line/60 hover:text-ink disabled:opacity-30">
            <Undo2 size={17} strokeWidth={1.5} />
          </button>
          <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} className="grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-line/60 hover:text-ink disabled:opacity-30">
            <Redo2 size={17} strokeWidth={1.5} />
          </button>
          <Link href="/checks" className="group ml-2 flex h-9 items-center gap-1.5 lift rounded-[10px] border border-line px-4 text-[13px] hover:border-line-strong hover:bg-raised">
            Checks <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[264px_1fr_320px]">
        <Palette />
        <div className="relative min-h-0">
          {!hydrated ? (
            <div className="h-full" />
          ) : tab === "build" ? (
            <>
              <Canvas report={report} />
              <ChecksStrip report={report} />
            </>
          ) : (
            <CircuitView view={tab} />
          )}
        </div>
        <Inspector />
      </div>
      {importing && <HoopUpload onClose={() => setImporting(false)} />}
      {playing && template?.game && <SnakeGame template={template} onClose={() => setPlaying(false)} />}
    </div>
  );
}
