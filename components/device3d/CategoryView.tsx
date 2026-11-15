"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers, Minimize2 } from "lucide-react";
import { categoriesById } from "@/data/categories";
import { parts, partsById } from "@/data/parts";
import { templatesForCategory } from "@/data/templates";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { runChecks } from "@/lib/checks";
import { fmtUSD } from "@/lib/checks/util";
import { onInput } from "@/lib/input/bus";
import { useBuild } from "@/stores/build";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { StatusDot } from "@/components/ui/StatusDot";

/** Categories drawn as full anatomy figures (numbered callouts); the rest use the plain exploded view. */
const ANATOMY = new Set(["phones", "laptops", "projectors"]);

const ExplodedDevice = dynamic(() => import("./ExplodedDevice"), { ssr: false, loading: () => <div className="h-full w-full" /> });

export function CategoryView({ id }: { id: string }) {
  const category = categoriesById[id];
  const [exploded, setExploded] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const router = useRouter();
  const loadTemplate = useBuild((s) => s.loadTemplate);
  const blocks = category.blocks;

  useEffect(() => {
    const offs = [
      onInput("toggleExplode", () => (setExploded((e) => !e), true)),
      onInput("explode", () => (setExploded(true), true)),
      onInput("collapse", () => (setExploded(false), true)),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  const starters = useMemo(
    () =>
      templatesForCategory(id).map((t) => {
        const build = buildFromTemplate(t, (pid) => partsById[pid], { preview: true });
        const report = runChecks(build, parts);
        const fails = report.findings.filter((f) => f.severity === "fail").length;
        const warns = report.findings.filter((f) => f.severity === "warn").length;
        return { t, report, fails, warns, count: t.instances.length };
      }),
    [id],
  );

  const shown = blocks.find((b) => b.id === active) ?? (focusIndex >= 0 ? blocks[focusIndex] : null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      const n = (focusIndex + 1) % blocks.length;
      setFocusIndex(n);
      setActive(blocks[n].id);
      e.preventDefault();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      const n = (focusIndex - 1 + blocks.length) % blocks.length;
      setFocusIndex(n);
      setActive(blocks[n].id);
      e.preventDefault();
    }
  };

  return (
    <div className="grid h-full grid-cols-[1.15fr_1fr]">
      <section
        className="relative min-h-0 border-r border-line outline-none"
        aria-label={`${category.name} exploded view. Use arrow keys to step through the blocks, E to explode or collapse.`}
        tabIndex={0}
        data-arrows
        onKeyDown={onKeyDown}
      >
        <div className="dot-grid absolute inset-0 [background-size:20px_20px] opacity-60" />
        <ExplodedDevice blocks={blocks} active={active} onActive={setActive} exploded={exploded} anatomy={ANATOMY.has(id)} />
        <div className="pointer-events-none absolute left-8 top-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{ANATOMY.has(id) ? "Anatomy" : "Generic architecture"}</p>
          <p className="mt-1 text-[13px] text-muted">Hover or use the arrow keys to inspect a block</p>
        </div>
        <div className="absolute right-6 top-6 flex gap-2">
          <button
            type="button"
            onClick={() => setExploded((e) => !e)}
            className="flex h-9 items-center gap-2 rounded-full border border-line-strong bg-card/80 px-3.5 text-[13px] backdrop-blur hover:border-ink"
            aria-pressed={exploded}
          >
            {exploded ? <Minimize2 size={15} strokeWidth={1.5} /> : <Layers size={15} strokeWidth={1.5} />}
            {exploded ? "Collapse" : "Explode"}
            <kbd className="rounded border border-line px-1 font-mono text-[10px] text-muted">E</kbd>
          </button>
        </div>
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
          <div className={`w-[340px] shrink-0 rounded-[12px] border border-line bg-card/90 p-4 shadow-[var(--shadow-float)] backdrop-blur transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} aria-live="polite">
            {shown && (
              <>
                <p className="font-serif text-[22px] leading-tight">{shown.name}</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">{shown.description}</p>
                <p className="mt-3 flex items-center gap-2 whitespace-nowrap font-mono text-[11px] text-muted">
                  <span className="h-px w-4 bg-copper" /> Maker equivalent <span className="truncate text-ink">{shown.makerEquivalent}</span>
                </p>
              </>
            )}
          </div>
          <ul className={`flex flex-wrap justify-end gap-1.5 ${ANATOMY.has(id) ? "sr-only" : ""}`} aria-label="Blocks">
            {blocks.map((b, i) => (
              <li key={b.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(b.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => {
                    setActive(b.id);
                    setFocusIndex(i);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${active === b.id ? "border-copper bg-copper text-paper" : "border-line bg-card/80 text-muted hover:text-ink"}`}
                >
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-0 flex-col px-10 pb-8 pt-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-line">
            <CategoryIcon name={category.icon} size={20} />
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Device · {blocks.length} blocks</p>
        </div>
        <h1 className="mt-4 font-serif text-[52px] leading-none">{category.name}</h1>
        <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-muted">{category.description}</p>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Starter builds</p>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3" data-arrows>
          {starters.map(({ t, report, fails, warns, count }) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                loadTemplate(t.id);
                router.push("/builder");
              }}
              className="group flex flex-col rounded-[12px] border border-line bg-card p-5 text-left transition-colors hover:border-ink"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-[26px] leading-tight">{t.name}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">{t.description}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong transition-colors group-hover:border-ink group-hover:bg-copper-hover group-hover:text-white">
                  <ArrowRight size={16} strokeWidth={1.5} />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-5 font-mono text-[12px] text-muted">
                <span>{count} parts</span>
                <span>{fmtUSD(report.totals.totalUSD)}</span>
                {report.totals.batteryLife_h !== null && <span>≈ {report.totals.batteryLife_h} h battery</span>}
                <span className="ml-auto flex items-center gap-1.5">
                  <StatusDot status={fails ? "fail" : warns ? "warn" : "ok"} />
                  {fails + warns ? `${fails + warns} note${fails + warns > 1 ? "s" : ""}` : "All checks pass"}
                </span>
              </div>
            </button>
          ))}
        </div>
        <Link href="/builder?new=1" className="mt-4 self-start text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          Or start this one from scratch
        </Link>
      </section>
    </div>
  );
}
