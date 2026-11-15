"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { categoriesById, deviceCategories } from "@/data/categories";
import { parts, partsById } from "@/data/parts";
import { visibleTemplates } from "@/data/templates";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { runChecks } from "@/lib/checks";
import { useRoving } from "@/lib/hooks/useRoving";
import { useBuild } from "@/stores/build";
import { Pager } from "@/components/ui/Pager";
import { StatusDot } from "@/components/ui/StatusDot";

const PER_PAGE = 6;

export function TemplatesPage() {
  const [cat, setCat] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const router = useRouter();
  const loadTemplate = useBuild((s) => s.loadTemplate);
  const onKeyDown = useRoving(3);

  const all = useMemo(
    () =>
      visibleTemplates
        .map((t) => {
          const r = runChecks(buildFromTemplate(t, (id) => partsById[id], { preview: true }), parts);
          const fails = r.findings.filter((f) => f.severity === "fail").length;
          return { t, total: r.totals.totalUSD, notes: r.findings.length, fails };
        })
        .sort((a, b) => Number(!!b.t.featured) - Number(!!a.t.featured)),
    [],
  );
  const list = all.filter((x) => !cat || x.t.categoryId === cat);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, pages - 1);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col px-12 pb-6 pt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Templates</p>
      <h1 className="mt-2 font-serif text-[48px] leading-none">Start from a working build</h1>
      <div className="mt-5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by device">
        {[{ id: null, name: "All" }, ...deviceCategories].map((c) => (
          <button
            key={c.id ?? "all"}
            type="button"
            role="radio"
            aria-checked={cat === c.id}
            onClick={() => {
              setCat(c.id);
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-[12px] ${cat === c.id ? "border-ink bg-ink text-paper" : "border-line hover:border-line-strong"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-4" data-arrows onKeyDown={onKeyDown}>
        {list.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE).map(({ t, total, notes, fails }) => (
          <button
            key={t.id}
            type="button"
            data-roving
            onClick={() => {
              loadTemplate(t.id);
              router.push("/builder");
            }}
            className="group flex min-h-0 flex-col rounded-[12px] border border-line bg-card p-5 text-left transition-colors hover:border-ink"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{categoriesById[t.categoryId].name}</span>
              {t.featured && <span className="rounded-full bg-copper-soft px-2 py-0.5 text-[10px] text-copper">Featured</span>}
            </div>
            <p className="mt-3 font-serif text-[26px] leading-tight">{t.name}</p>
            <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-muted">{t.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {[...new Set(t.instances.map((i) => partsById[i.partId].name.replace(/\s*\(.*?\)/g, "")))]
                .filter((n) => !/^(Resistor|Capacitor|Diode|Tactile|Copper touch)/.test(n))
                .slice(0, 5)
                .map((n) => (
                  <span key={n} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                    {n}
                  </span>
                ))}
            </div>
            <div className="mt-auto flex items-center gap-4 pt-3 font-mono text-[11px] text-muted">
              <span>{t.instances.length} parts</span>
              <span>${total.toFixed(2)}</span>
              <span className="flex items-center gap-1.5">
                <StatusDot status={fails ? "fail" : notes ? "warn" : "ok"} size={7} />
                {notes ? `${notes} note${notes > 1 ? "s" : ""}` : "passes"}
              </span>
              <ArrowRight size={15} strokeWidth={1.5} className="ml-auto text-ink transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
      <div className="pt-4">
        <Pager page={current} pages={pages} onChange={setPage} label="templates page" />
      </div>
    </div>
  );
}
