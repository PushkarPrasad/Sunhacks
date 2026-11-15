"use client";

import { memo } from "react";
import type { Instance, Part, PinType } from "@/lib/types";
import { cardGeometry, HEADER_H } from "@/lib/build/geometry";
import type { Status } from "@/lib/types";

export const PIN_COLORS: Partial<Record<PinType, string>> = {
  power_in: "var(--color-bad)",
  power_out: "var(--color-bad)",
  ground: "var(--color-ink)",
  nc: "var(--color-line-strong)",
};

interface Props {
  inst: Instance;
  part: Part;
  selected: boolean;
  status: Status | null;
  connected: Set<string>;
  pendingPin: string | null;
  wiring: boolean;
  onHeaderDown: (e: React.PointerEvent, id: string) => void;
  onPin: (id: string, pin: string) => void;
  onSelect: (id: string) => void;
}

function ModuleCardImpl({ inst, part, selected, status, connected, pendingPin, wiring, onHeaderDown, onPin, onSelect }: Props) {
  const g = cardGeometry(part, inst.rotation);
  const vertical = inst.rotation === 90 || inst.rotation === 270;
  const ring = status === "fail" ? "ring-2 ring-bad/70" : status === "warn" ? "ring-2 ring-warn/60" : "";
  return (
    <div
      className={`absolute select-none rounded-[10px] border bg-card shadow-[0_1px_2px_rgb(22_24_28/0.05)] transition-[border-color,box-shadow] ${selected ? "border-ink shadow-[var(--shadow-float)]" : "border-line-strong"} ${ring}`}
      style={{ left: inst.x, top: inst.y, width: g.w, height: g.h }}
      data-instance={inst.id}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        onSelect(inst.id);
        onHeaderDown(e, inst.id);
      }}
    >
      <div className={`flex cursor-grab items-start justify-between gap-2 px-3 pt-2 active:cursor-grabbing ${vertical ? "absolute inset-x-0 top-[34px]" : ""}`} style={{ height: vertical ? undefined : HEADER_H }}>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium leading-tight">{inst.title ?? part.name}</p>
          <p className="truncate font-mono text-[10px] leading-tight text-muted">
            {inst.label}
            {inst.title ? ` · ${part.name}` : ""}
          </p>
        </div>
        {inst.config?.i2cAddress && <span className="shrink-0 rounded bg-copper-soft px-1 font-mono text-[9px] text-copper">{inst.config.i2cAddress}</span>}
      </div>
      {Object.entries(g.pins).map(([name, p]) => {
        const def = part.pins.find((x) => x.name === name)!;
        const isConnected = connected.has(name);
        const isPending = pendingPin === name;
        const color = PIN_COLORS[def.type] ?? "var(--color-copper)";
        const side = p.side;
        return (
          <button
            key={name}
            type="button"
            data-pin={name}
            title={`${name} · ${def.function}`}
            aria-label={`${inst.label} pin ${name}, ${def.function}${isConnected ? ", connected" : ""}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPin(inst.id, name);
            }}
            className={`group absolute flex items-center ${side === "left" ? "flex-row" : side === "right" ? "flex-row-reverse" : side === "top" ? "flex-col" : "flex-col-reverse"}`}
            style={
              side === "left"
                ? { left: -6, top: p.y - 9, height: 18, width: g.w / 2 }
                : side === "right"
                  ? { right: -6, top: p.y - 9, height: 18, width: g.w / 2 }
                  : side === "top"
                    ? { top: -6, left: p.x - 9, width: 18, height: 64 }
                    : { bottom: -6, left: p.x - 9, width: 18, height: 64 }
            }
          >
            <span
              className={`relative z-10 block h-3 w-3 shrink-0 rounded-full border-2 transition-transform group-hover:scale-125 ${isPending ? "scale-125 animate-pulse" : ""} ${wiring ? "group-hover:ring-4 group-hover:ring-copper/25" : ""}`}
              style={{ borderColor: color, background: isConnected || isPending ? color : "var(--color-card)" }}
            />
            <span
              className={`truncate font-mono text-[10px] leading-none ${def.type === "nc" ? "text-line-strong" : "text-muted"} group-hover:text-ink ${side === "left" ? "pl-1.5" : side === "right" ? "pr-1.5" : "py-1"}`}
              style={side === "top" || side === "bottom" ? { writingMode: "vertical-rl", maxHeight: 50 } : undefined}
            >
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const ModuleCard = memo(ModuleCardImpl);
