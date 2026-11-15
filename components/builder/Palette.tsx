"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, CircleDot, Cog, Cpu, Monitor, Radio, Search, Thermometer, Volume2, X, type LucideIcon } from "lucide-react";
import { parts } from "@/data/parts";
import type { PartCategory } from "@/lib/types";
import { useBuild } from "@/stores/build";
import { Pager } from "@/components/ui/Pager";
import { useView } from "./viewStore";

const TABS: { id: PartCategory; label: string; icon: LucideIcon }[] = [
  { id: "controllers", label: "Controllers", icon: Cpu },
  { id: "sensors", label: "Sensors", icon: Thermometer },
  { id: "displays", label: "Displays", icon: Monitor },
  { id: "motion", label: "Motion", icon: Cog },
  { id: "power", label: "Power", icon: BatteryCharging },
  { id: "communication", label: "Comms", icon: Radio },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "passives", label: "Passives", icon: CircleDot },
];
const ROW = 58;

export function Palette() {
  const [tab, setTab] = useState<PartCategory>("controllers");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(7);
  const listRef = useRef<HTMLDivElement>(null);
  const addPart = useBuild((s) => s.addPart);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPerPage(Math.max(3, Math.floor((e.contentRect.height + 6) / ROW))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return parts.filter((p) => `${p.name} ${p.manufacturer} ${p.tags?.join(" ")} ${p.interface.join(" ")}`.toLowerCase().includes(q));
    return parts.filter((p) => p.category === tab);
  }, [tab, query]);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = items.slice(current * perPage, current * perPage + perPage);

  const add = (id: string) => {
    // The store finds free space near the middle of the view.
    const c = useView.getState().center();
    addPart(id, c.x - 90, c.y - 80);
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-paper" aria-label="Parts palette">
      <div className="px-4 pt-4">
        <label className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-card px-3 focus-within:border-ink">
          <Search size={15} strokeWidth={1.5} className="text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search 69 modules"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
            aria-label="Search parts"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-muted hover:text-ink">
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </label>
      </div>
      <div className="grid grid-cols-4 gap-1 px-4 pt-3" role="tablist" aria-label="Part categories">
        {TABS.map((t) => {
          const active = !query && t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.id);
                setQuery("");
                setPage(0);
              }}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition-colors ${active ? "bg-copper text-white" : "text-muted hover:bg-line/60 hover:text-ink"}`}
            >
              <t.icon size={16} strokeWidth={1.5} />
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="px-4 pb-2 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {query ? `${items.length} results` : `${TABS.find((t) => t.id === tab)!.label} · ${items.length}`}
      </p>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3" role="tabpanel">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-copperline-part", p.id);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => add(p.id)}
            className="group flex h-[52px] shrink-0 items-center justify-between gap-3 rounded-[10px] border border-transparent px-3 text-left transition-colors hover:border-line hover:bg-card"
            title="Click to add, or drag onto the canvas"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-tight">{p.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted">{(p.tags ?? p.interface).slice(0, 3).join(" · ")}</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-muted group-hover:text-ink">${p.priceUSD.toFixed(2)}</span>
          </button>
        ))}
      </div>
      <div className="py-3">
        <Pager page={current} pages={pages} onChange={setPage} label="parts page" />
      </div>
    </aside>
  );
}
