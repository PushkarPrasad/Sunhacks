"use client";

import { GrabChip } from "@/components/device3d/GrabChip";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { onInput } from "@/lib/input/bus";
import type { ProductDef, Shell } from "./ProductModel";

const ProductModel = dynamic(() => import("./ProductModel"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const SHELLS: { id: Shell; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "transparent", label: "Transparent" },
  { id: "xray", label: "X-ray" },
];

/** Interactive product model (same controls as the drone): shell modes, explode, hover labels, inspector. */
export function ProductViewer({ def, initialExplode = 0.55 }: { def: ProductDef; initialExplode?: number }) {
  const [explode, setExplode] = useState(initialExplode);
  const [shell, setShell] = useState<Shell>("solid");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ id: string; x: number; y: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const offs = [
      onInput("toggleExplode", () => (setExplode((e) => (e > 0.5 ? 0 : 1)), true)),
      onInput("explode", () => (setExplode(1), true)),
      onInput("collapse", () => (setExplode(0), true)),
    ];
    const el = host.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setExplode((x) => Math.min(1, Math.max(0, x + e.deltaY * 0.0012)));
    };
    el?.addEventListener("wheel", onWheel, { passive: false });
    const ro = el ? new ResizeObserver(([e]) => setWidth(e.contentRect.width)) : null;
    if (el) ro?.observe(el);
    return () => {
      ro?.disconnect();
      offs.forEach((f) => f());
      el?.removeEventListener("wheel", onWheel);
    };
  }, []);

  const part = def.parts.find((p) => p.id === selected);
  const labelPart = def.parts.find((p) => p.id === anchor?.id);
  const lx = anchor ? Math.min(anchor.x + 90, width - 210) : 0;
  const ly = anchor ? Math.max(70, anchor.y - 60) : 0;

  return (
    <div ref={host} className="relative h-full w-full" aria-label={`${def.name} model. Scroll or press E to explode, click a part to inspect it.`}>
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgb(124_92_255/0.22),rgb(61_123_255/0.08)_45%,transparent_70%)] blur-2xl" aria-hidden="true" />
      <ProductModel def={def} explode={explode} shell={shell} hovered={hovered} selected={selected} onHover={setHovered} onSelect={setSelected} onAnchor={setAnchor} enableZoom={false} />
      <GrabChip />

      {anchor && labelPart && (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <polyline points={`${anchor.x},${anchor.y} ${lx - 14},${ly + 16} ${lx},${ly + 16}`} fill="none" stroke="var(--color-copper)" strokeWidth="1.25" />
            <circle cx={anchor.x} cy={anchor.y} r="3.5" fill="var(--color-copper)" />
          </svg>
          <div className="glass pointer-events-none absolute rounded-full border border-copper/50 px-3 py-1 text-[12px]" style={{ left: lx, top: ly }}>
            {labelPart.name}
          </div>
        </>
      )}

      {/* Controls */}
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <div className="glass flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="Shell">
          {SHELLS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={shell === s.id}
              onClick={() => setShell(s.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] transition ${shell === s.id ? "bg-copper text-white" : "text-muted hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <label className="glass absolute bottom-6 left-1/2 flex w-[300px] -translate-x-1/2 items-center gap-3 rounded-full border border-line px-4 py-2 text-[12px] text-muted">
        <span>Assembled</span>
        <input type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(e) => setExplode(Number(e.target.value) / 100)} className="flex-1 accent-[var(--color-copper)]" aria-label="Explode" />
        <span>Exploded</span>
      </label>

      <AnimatePresence>
        {part && (
          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="glass absolute bottom-20 left-6 w-[300px] rounded-[16px] border border-line p-5"
            aria-label="Part details"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif text-[26px] leading-tight">{part.name}</p>
              <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink">
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-muted">{part.role}</p>
            <dl className="mt-4 space-y-1.5 font-mono text-[12px]">
              {part.specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-peri">Maker equivalent: {part.maker}</p>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
