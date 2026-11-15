"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Focus, Minus, Plus, StickyNote as NoteIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { partsById } from "@/data/parts";
import type { ChecksReport, Finding, Status } from "@/lib/types";
import { pinWorldPosition } from "@/lib/build/geometry";
import { pinKey } from "@/lib/build/nets";
import { onInput } from "@/lib/input/bus";
import { useBuild } from "@/stores/build";
import { ModuleCard } from "./ModuleCard";
import { NotesLayer } from "./NotesLayer";
import { useView } from "./viewStore";
import { wirePath, Wires } from "./Wires";

const getPart = (id: string) => partsById[id];
const GRID = 8;
const NOTES_PER_PAGE = 3;
const snap = (n: number) => Math.round(n / GRID) * GRID;

export function Canvas({ report }: { report: ChecksReport }) {
  const root = useRef<HTMLDivElement>(null);
  const build = useBuild((s) => s.build);
  const selection = useBuild((s) => s.selection);
  const pendingPin = useBuild((s) => s.pendingPin);
  const { select, clickPin, cancelWire, beginMove, moveLive, remove, removeWire, rotate, applyFix, dismiss, addPart } = useBuild.getState();
  const view = useView((s) => s.view);
  const size = useView((s) => s.size);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [notePage, setNotePage] = useState(0);
  const [hoverFinding, setHoverFinding] = useState<Finding | null>(null);
  const drag = useRef<{ kind: "pan" | "move"; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Size tracking.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => useView.getState().setSize(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit when a different build is loaded.
  const lastFit = useRef<string | null>(null);
  useEffect(() => {
    if (lastFit.current === build.id || size.w < 100) return;
    lastFit.current = build.id;
    useView.getState().fit(build, getPart);
  }, [build, size.w]);

  // Wheel zoom (non-passive so the page never scrolls).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        useView.getState().zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
      } else {
        const v = useView.getState().view;
        useView.getState().set({ x: v.x - e.deltaX });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Input bus: zoom, rotate, back/escape.
  useEffect(() => {
    const offs = [
      onInput("zoomIn", (e) => (useView.getState().zoomAt(e.value ? 1 / e.value : 1.15), true)),
      onInput("zoomOut", (e) => (useView.getState().zoomAt(e.value ? 1 / e.value : 1 / 1.15), true)),
      onInput("rotate", () => {
        const s = useBuild.getState().selection;
        if (s?.kind === "instance") {
          rotate(s.id);
          return true;
        }
        return false;
      }),
      onInput("back", () => {
        const st = useBuild.getState();
        if (st.pendingPin) {
          cancelWire();
          return true;
        }
        if (st.selection) {
          select(null);
          return true;
        }
        return false;
      }),
    ];
    return () => offs.forEach((f) => f());
  }, [cancelWire, rotate, select]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = root.current!.getBoundingClientRect();
    const v = useView.getState().view;
    return { x: (clientX - r.left - v.x) / v.k, y: (clientY - r.top - v.y) / v.k };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const v = useView.getState().view;
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const inst = useBuild.getState().build.instances.find((i) => i.id === id);
    if (!inst) return;
    drag.current = { kind: "move", id, sx: e.clientX, sy: e.clientY, ox: inst.x, oy: inst.y, moved: false };
    root.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    if (useBuild.getState().pendingPin) setMouse(toWorld(e.clientX, e.clientY));
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    if (!d.moved && d.kind === "move") beginMove();
    d.moved = true;
    if (d.kind === "pan") useView.getState().set({ x: d.ox + dx, y: d.oy + dy });
    else if (d.id) {
      const k = useView.getState().view.k;
      moveLive(d.id, snap(d.ox + dx / k), snap(d.oy + dy / k));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.kind === "pan" && !d.moved) {
      if (useBuild.getState().pendingPin) cancelWire();
      else select(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = useBuild.getState().selection;
    if ((e.key === "Delete" || e.key === "Backspace") && s) {
      if (s.kind === "instance") remove(s.id);
      else removeWire(s.id);
      e.preventDefault();
      return;
    }
    if (s?.kind === "instance" && e.key.startsWith("Arrow") && !e.shiftKey) {
      const inst = build.instances.find((i) => i.id === s.id);
      if (!inst) return;
      const step = e.altKey ? GRID * 4 : GRID;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      beginMove();
      moveLive(inst.id, inst.x + dx, inst.y + dy);
      e.preventDefault();
    }
  };

  // Drop from the palette.
  const onDrop = (e: React.DragEvent) => {
    const partId = e.dataTransfer.getData("application/x-copperline-part");
    if (!partId) return;
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    addPart(partId, snap(w.x - 80), snap(w.y - 20));
  };

  // Per-instance status from findings.
  const statusById = useMemo(() => {
    const m = new Map<string, Status>();
    for (const f of report.findings) {
      for (const id of f.instanceIds) {
        const prev = m.get(id);
        if (prev !== "fail") m.set(id, f.severity === "fail" ? "fail" : prev ?? "warn");
      }
    }
    return m;
  }, [report.findings]);

  const connectedByInstance = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const w of build.wires) {
      for (const end of [w.from, w.to]) {
        const s = m.get(end.instanceId) ?? new Set();
        s.add(end.pin);
        m.set(end.instanceId, s);
      }
    }
    return m;
  }, [build.wires]);

  // Sorted notes: failures first.
  const notes = useMemo(() => [...report.findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fail" ? -1 : 1)), [report.findings]);
  const pages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
  const page = Math.min(notePage, pages - 1);
  const visibleNotes = notes.slice(page * NOTES_PER_PAGE, page * NOTES_PER_PAGE + NOTES_PER_PAGE);

  const highlightWires = useMemo(() => {
    const s = new Set<string>();
    const fix = hoverFinding?.fix;
    if (fix && (fix.kind === "rewire" || fix.kind === "removeWire" || fix.kind === "insertLevelShifter")) s.add(fix.wireId);
    return s;
  }, [hoverFinding]);

  // Pending wire preview.
  let preview: string | null = null;
  if (pendingPin && mouse) {
    const inst = build.instances.find((i) => i.id === pendingPin.instanceId);
    const part = inst && getPart(inst.partId);
    const a = inst && part ? pinWorldPosition(inst, part, pendingPin.pin) : null;
    if (a) preview = wirePath(a, { ...mouse, side: a.side === "left" ? "right" : a.side === "right" ? "left" : a.side === "top" ? "bottom" : "top" });
  }

  const empty = build.instances.length === 0;

  return (
    <div
      ref={root}
      className={`relative h-full w-full overflow-hidden outline-none ${pendingPin ? "cursor-crosshair" : "cursor-default"}`}
      tabIndex={0}
      data-arrows
      aria-label="Build canvas. Click a pin, then another pin to wire them. Delete removes the selection, R rotates, plus and minus zoom."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setMouse(null)}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-copperline-part")) e.preventDefault();
      }}
      onDrop={onDrop}
    >
      <div
        className="dot-grid pointer-events-none absolute inset-0"
        style={{ backgroundSize: `${24 * view.k}px ${24 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      />
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <Wires build={build} getPart={getPart} selectedWire={selection?.kind === "wire" ? selection.id : null} onSelect={(id) => select({ kind: "wire", id })} highlight={highlightWires} />
        {build.instances.map((inst) => {
          const part = getPart(inst.partId);
          if (!part) return null;
          return (
            <ModuleCard
              key={inst.id}
              inst={inst}
              part={part}
              selected={selection?.kind === "instance" && selection.id === inst.id}
              status={statusById.get(inst.id) ?? null}
              connected={connectedByInstance.get(inst.id) ?? EMPTY}
              pendingPin={pendingPin?.instanceId === inst.id ? pendingPin.pin : null}
              wiring={!!pendingPin}
              onHeaderDown={onHeaderDown}
              onPin={(id, pin) => clickPin({ instanceId: id, pin })}
              onSelect={(id) => select({ kind: "instance", id })}
            />
          );
        })}
        {preview && (
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
            <path d={preview} fill="none" stroke="var(--color-copper)" strokeWidth={1.8} strokeDasharray="5 4" />
          </svg>
        )}
      </div>

      {empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-[360px] text-center">
            <p className="font-serif text-[34px] leading-tight">An empty board.</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Pick a controller from the palette, then add sensors and power. Click a pin, then another pin, to draw a wire.
            </p>
          </div>
        </div>
      )}

      {pendingPin && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-copper px-4 py-1.5 text-[12px] text-white shadow-[var(--shadow-float)]">
          Wiring from <span className="font-mono">{build.instances.find((i) => i.id === pendingPin.instanceId)?.label}.{pendingPin.pin}</span>. Click another pin, or Esc to cancel.
        </div>
      )}

      <NotesLayer
        findings={visibleNotes}
        build={build}
        getPart={getPart}
        view={view}
        size={size}
        onApply={(f) => f.fix && applyFix(f.id, f.fix)}
        onDismiss={(f) => dismiss(f.id)}
        onHover={setHoverFinding}
        muted={!!pendingPin}
      />

      {/* Zoom + notes controls */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        {notes.length > 0 && (
          <div className="flex h-9 items-center gap-1 rounded-full border border-line bg-card/90 pl-3 pr-1 text-[12px] shadow-[var(--shadow-float)] backdrop-blur">
            <NoteIcon size={14} strokeWidth={1.5} className="text-copper" />
            <span className="px-1 font-mono">
              {page * NOTES_PER_PAGE + 1}–{Math.min(notes.length, (page + 1) * NOTES_PER_PAGE)} of {notes.length}
            </span>
            <button type="button" aria-label="Previous notes" disabled={page === 0} onClick={() => setNotePage(page - 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-line/60 disabled:opacity-30">
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Next notes" disabled={page >= pages - 1} onClick={() => setNotePage(page + 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-line/60 disabled:opacity-30">
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      <div className="absolute bottom-[60px] right-4 z-30 flex flex-col overflow-hidden rounded-full border border-line bg-card/90 shadow-[var(--shadow-float)] backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Zoom in" onClick={() => useView.getState().zoomAt(1.15)} className="grid h-9 w-9 place-items-center hover:bg-line/60">
          <Plus size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => useView.getState().zoomAt(1 / 1.15)} className="grid h-9 w-9 place-items-center hover:bg-line/60">
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label="Fit to build" onClick={() => useView.getState().fit(build, getPart)} className="grid h-9 w-9 place-items-center hover:bg-line/60">
          <Focus size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

const EMPTY = new Set<string>();

export function isPinConnected(build: { wires: { from: { instanceId: string; pin: string }; to: { instanceId: string; pin: string } }[] }, instanceId: string, pin: string) {
  const k = pinKey({ instanceId, pin });
  return build.wires.some((w) => pinKey(w.from) === k || pinKey(w.to) === k);
}
