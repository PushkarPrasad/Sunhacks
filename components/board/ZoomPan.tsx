"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Focus, Minus, Plus } from "lucide-react";
import { onInput } from "@/lib/input/bus";

/** Pan (drag) and zoom (wheel, +/−, gestures) for flat SVG views. */
export function ZoomPan({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const zoomAt = (f: number, cx?: number, cy?: number) =>
    setT((v) => {
      const el = root.current;
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      const px = cx ?? w / 2;
      const py = cy ?? h / 2;
      const k = Math.min(8, Math.max(0.5, v.k * f));
      // keep the point under the cursor fixed (transform origin is the centre)
      const ox = px - w / 2;
      const oy = py - h / 2;
      return { k, x: ox - ((ox - v.x) * k) / v.k, y: oy - ((oy - v.y) * k) / v.k };
    });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const offs = [onInput("zoomIn", (e) => (zoomAt(e.value ? 1 / e.value : 1.2), true)), onInput("zoomOut", (e) => (zoomAt(e.value ? 1 / e.value : 1 / 1.2), true))];
    return () => {
      el.removeEventListener("wheel", onWheel);
      offs.forEach((f) => f());
    };
  }, []);

  const btn = `grid h-9 w-9 place-items-center ${dark ? "hover:bg-raised" : "hover:bg-line/60"}`;
  return (
    <div
      ref={root}
      className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) setT((v) => ({ ...v, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <div className="h-full w-full" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>
        {children}
      </div>
      <div
        className={`absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-[12px] border shadow-[var(--shadow-float)] ${dark ? "border-line bg-card/90 text-ink" : "border-line bg-card/90"}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomAt(1.25)}>
          <Plus size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomAt(0.8)}>
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Reset view" className={btn} onClick={() => setT({ x: 0, y: 0, k: 1 })}>
          <Focus size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
