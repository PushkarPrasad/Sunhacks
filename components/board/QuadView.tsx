"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2 } from "lucide-react";
import { partsById } from "@/data/parts";
import type { Build } from "@/lib/types";
import type { CircuitResult } from "@/lib/hooks/useCircuit";
import { SvgHost } from "./SvgHost";
import { ZoomPan } from "./ZoomPan";

const Board3D = dynamic(() => import("./Board3D"), { ssr: false });

type Pane = "schematic" | "pcb" | "3d" | "parts";
const TITLES: Record<Pane, string> = { schematic: "Schematic", pcb: "PCB", "3d": "3D board", parts: "Parts" };

/** Maps designators (U1, S2...) to the pcb/schematic component ids used as data attributes in the SVGs. */
function idMaps(cj: CircuitResult["circuitJson"]) {
  const bySource = new Map<string, string>();
  for (const e of cj) if (e.type === "source_component") bySource.set(String(e.source_component_id), String(e.name));
  const pcb = new Map<string, string>();
  const sch = new Map<string, string>();
  for (const e of cj) {
    const label = bySource.get(String(e.source_component_id));
    if (!label) continue;
    if (e.type === "pcb_component") pcb.set(label, String(e.pcb_component_id));
    if (e.type === "schematic_component") sch.set(label, String(e.schematic_component_id));
  }
  return { pcb, sch, pcbToLabel: new Map([...pcb].map(([l, id]) => [id, l])), schToLabel: new Map([...sch].map(([l, id]) => [id, l])) };
}

/** Schematic, PCB, 3D and parts list side by side; selecting a part anywhere highlights it everywhere. */
export function QuadView({ build, data }: { build: Build; data: CircuitResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Pane | null>(null);
  const maps = useMemo(() => idMaps(data.circuitJson), [data.circuitJson]);
  const toggle = (label: string | null) => setSelected((s) => (s === label ? null : label));

  const pcbId = selected ? maps.pcb.get(selected) : undefined;
  const schId = selected ? maps.sch.get(selected) : undefined;
  const pcbCss = pcbId ? `[data-pcb-component-id="${pcbId}"] { stroke: #F4E3A1 !important; fill: #F4E3A1 !important; }` : "";
  const schCss = schId ? `[data-schematic-component-id="${schId}"] { stroke: #B5652E !important; } [data-schematic-component-id="${schId}"] rect { fill: #F1E3D7 !important; }` : "";

  const onPick = (path: EventTarget[], kind: "pcb" | "sch") => {
    const attr = kind === "pcb" ? "data-pcb-component-id" : "data-schematic-component-id";
    for (const t of path) {
      const id = (t as Element).getAttribute?.(attr);
      const label = id ? (kind === "pcb" ? maps.pcbToLabel : maps.schToLabel).get(id) : undefined;
      if (label) return toggle(label);
    }
  };

  const panes: Pane[] = focus ? [focus] : ["schematic", "pcb", "3d", "parts"];
  return (
    <div className={`grid h-full gap-px bg-line ${focus ? "grid-cols-1" : "grid-cols-2 grid-rows-2"}`}>
      {panes.map((p) => (
        <section key={p} className={`relative min-h-0 overflow-hidden ${p === "pcb" ? "bg-pcb" : "bg-paper"}`} aria-label={TITLES[p]}>
          <header className={`absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-3 text-[12px] ${p === "pcb" ? "text-paper/80" : "text-muted"}`}>
            <span className="font-mono uppercase tracking-[0.14em] text-[10px]">{TITLES[p]}</span>
            <button
              type="button"
              aria-label={focus ? `Back to four views` : `Expand ${TITLES[p]}`}
              onClick={() => setFocus(focus ? null : p)}
              className={`grid h-7 w-7 place-items-center rounded-full ${p === "pcb" ? "hover:bg-paper/10" : "hover:bg-line/60"}`}
            >
              {focus ? <Minimize2 size={14} strokeWidth={1.5} /> : <Maximize2 size={14} strokeWidth={1.5} />}
            </button>
          </header>
          {p === "schematic" && (
            <ZoomPan>
              <SvgHost className="h-full w-full cursor-pointer p-6 pt-10" svg={data.schematicSvg} css={schCss} onPick={(p) => onPick(p, "sch")} />
            </ZoomPan>
          )}
          {p === "pcb" && (
            <ZoomPan dark>
              <SvgHost className="h-full w-full cursor-pointer p-6 pt-10" svg={data.pcbSvg} css={pcbCss} onPick={(p) => onPick(p, "pcb")} />
            </ZoomPan>
          )}
          {p === "3d" && <Board3D circuitJson={data.circuitJson} build={build} selected={selected} onSelect={toggle} />}
          {p === "parts" && <PartsPane build={build} selected={selected} onSelect={toggle} placed={new Set(data.placed)} />}
        </section>
      ))}
    </div>
  );
}

function PartsPane({ build, selected, onSelect, placed }: { build: Build; selected: string | null; onSelect: (l: string) => void; placed: Set<string> }) {
  const [page, setPage] = useState(0);
  const per = 9;
  const pages = Math.max(1, Math.ceil(build.instances.length / per));
  const list = build.instances.slice(page * per, page * per + per);
  const sel = build.instances.find((i) => i.label === selected);
  const selPart = sel ? partsById[sel.partId] : undefined;
  return (
    <div className="flex h-full flex-col px-4 pb-3 pt-10">
      <ul className="min-h-0 flex-1" data-arrows>
        {list.map((i) => {
          const p = partsById[i.partId];
          return (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onSelect(i.label)}
                aria-pressed={selected === i.label}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-[5px] text-left text-[12px] transition-colors ${selected === i.label ? "bg-copper-soft" : "hover:bg-card"}`}
              >
                <span className="w-10 shrink-0 font-mono text-[11px] text-muted">{i.label}</span>
                <span className="min-w-0 flex-1 truncate">{i.title ?? p.name}</span>
                <span className="font-mono text-[11px] text-muted">{placed.has(i.id) ? p.footprint.split("_")[0] : "off-board"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
        <span className="truncate">{selPart ? `${sel!.label} · ${selPart.name} · $${selPart.priceUSD.toFixed(2)}` : "Select a part in any view"}</span>
        {pages > 1 && (
          <span className="flex shrink-0 gap-1">
            {Array.from({ length: pages }, (_, k) => (
              <button key={k} type="button" aria-label={`Parts page ${k + 1}`} onClick={() => setPage(k)} className={`h-1.5 rounded-full ${k === page ? "w-4 bg-ink" : "w-1.5 bg-line-strong"}`} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
