"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AtSign, CircuitBoard, DollarSign, Gauge, Pin, Ruler, Zap, type LucideIcon } from "lucide-react";
import type { CheckId } from "@/lib/types";
import { useChecks } from "@/lib/hooks/useChecks";
import { useNoteTexts } from "@/lib/hooks/useNoteTexts";
import { useT } from "@/lib/hooks/useT";
import { useBuild } from "@/stores/build";
import { StickyNote } from "@/components/notes/StickyNote";
import { Pager } from "@/components/ui/Pager";
import { statusText, StatusDot } from "@/components/ui/StatusDot";

const ICONS: Record<CheckId, LucideIcon> = { power: Zap, voltage: Gauge, pins: Pin, addresses: AtSign, cost: DollarSign, boardFit: Ruler };
const PER_PAGE = 4;

export function ChecksPage() {
  const report = useChecks();
  const hydrated = useBuild((s) => s.hydrated);
  const build = useBuild((s) => s.build);
  const { applyFix, dismiss } = useBuild.getState();
  const t = useT();
  const [filter, setFilter] = useState<CheckId | null>(() => {
    if (typeof window === "undefined") return null;
    const h = window.location.hash.slice(1) as CheckId;
    return h && ICONS[h] ? h : null;
  });
  const [page, setPage] = useState(0);

  const notes = useMemo(
    () => report.findings.filter((f) => !filter || f.checkId === filter).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fail" ? -1 : 1)),
    [report.findings, filter],
  );
  const texts = useNoteTexts(notes);
  const pages = Math.max(1, Math.ceil(notes.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = notes.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const fails = report.findings.filter((f) => f.severity === "fail").length;
  const warns = report.findings.length - fails;

  if (!hydrated) return <div className="h-full" />;

  return (
    <div className="mx-auto flex h-full max-w-[1320px] flex-col px-10 pb-6 pt-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{build.name}</p>
          <h1 className="mt-2 font-serif text-[48px] leading-none">{t("nav.Checks")}</h1>
          <p className="mt-3 text-[15px] text-muted">
            {build.instances.length === 0
              ? "Add modules in the builder and the checks run as you wire."
              : fails + warns === 0
                ? "Every check passed. The build is ready for a board."
                : `${fails ? `${fails} to fix` : ""}${fails && warns ? " and " : ""}${warns ? `${warns} to review` : ""} across six checks.`}
          </p>
        </div>
        <Link href="/builder" className="flex h-10 items-center gap-2 lift rounded-[10px] border border-line px-4 text-[13px] hover:border-line-strong hover:bg-raised">
          <ArrowLeft size={15} strokeWidth={1.5} /> Back to builder
        </Link>
      </div>

      <div className="mt-7 grid min-h-0 flex-1 grid-cols-[1.05fr_1fr] gap-8">
        <div className="grid min-h-0 grid-cols-2 grid-rows-3 gap-4" data-arrows>
          {report.results.map((r) => {
            const Icon = ICONS[r.id];
            const active = filter === r.id;
            return (
              <button
                key={r.id}
                id={r.id}
                type="button"
                onClick={() => {
                  setFilter(active ? null : r.id);
                  setPage(0);
                }}
                aria-pressed={active}
                className={`flex min-h-0 flex-col justify-between rounded-[12px] border bg-card p-5 text-left transition-colors ${active ? "border-copper" : "border-line hover:border-line-strong"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-muted">
                    <Icon size={16} strokeWidth={1.5} /> {t(`check.${r.id}`)}
                  </span>
                  <span className={`flex items-center gap-1.5 text-[12px] ${statusText[r.status]}`}>
                    <StatusDot status={r.status} />
                    {r.status === "ok" ? "Pass" : r.status === "warn" ? "Review" : "Fix"}
                  </span>
                </div>
                <div>
                  <p className="font-mono text-[30px] leading-none tracking-tight">{r.headline}</p>
                  <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-muted">{r.detail}</p>
                </div>
                {r.id === "power" && report.totals.batteryModel && (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Battery model: {report.totals.batteryModel === "matlab" ? "MATLAB discharge curve" : "80% usable capacity"}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-col rounded-[12px] border border-line bg-card/50 p-5">
          <div className="flex items-center justify-between">
            <p className="font-serif text-[26px] leading-none">
              {t("notes.title")}
              {filter && <span className="ml-2 font-sans text-[13px] text-muted">· {t(`check.${filter}`)}</span>}
            </p>
            {filter && (
              <button type="button" onClick={() => setFilter(null)} className="text-[12px] text-muted underline underline-offset-4 hover:text-ink">
                Show all
              </button>
            )}
          </div>
          {notes.length === 0 ? (
            <div className="grid flex-1 place-items-center">
              <div className="text-center">
                <CircuitBoard size={28} strokeWidth={1.2} className="mx-auto text-ok" />
                <p className="mt-3 text-[14px] text-muted">{t("notes.none")}</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-5 gap-y-6 pt-6">
              {shown.map((f) => (
                <StickyNote key={f.id} finding={f} text={texts[f.id]} width="100%" onApply={() => f.fix && applyFix(f.id, f.fix)} onDismiss={() => dismiss(f.id)} />
              ))}
            </div>
          )}
          <Pager page={current} pages={pages} onChange={setPage} label="notes page" />
        </div>
      </div>
    </div>
  );
}
