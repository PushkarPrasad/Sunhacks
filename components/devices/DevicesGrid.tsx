"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { categories } from "@/data/categories";
import { templatesForCategory } from "@/data/templates";
import { useRoving } from "@/lib/hooks/useRoving";
import { useBuild } from "@/stores/build";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ScanDevice } from "./ScanDevice";

export function DevicesGrid() {
  const router = useRouter();
  const newBuild = useBuild((s) => s.newBuild);
  const onKeyDown = useRoving(4);

  const open = (id: string, kind: string) => {
    if (kind === "custom") {
      newBuild();
      router.push("/builder");
    } else {
      router.push(`/devices/${id}`);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col px-12 pb-8 pt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Start from a device</p>
          <h1 className="mt-2 font-serif text-[48px] leading-none">What are you building?</h1>
        </div>
        <ScanDevice />
      </div>
      <div className="mt-8 grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-4" data-arrows onKeyDown={onKeyDown} role="list">
        {categories.map((c, i) => {
          const muted = c.kind === "more";
          const count = c.kind === "device" ? templatesForCategory(c.id).length : 0;
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              data-roving
              autoFocus={i === 0}
              onClick={() => open(c.id, c.kind)}
              className={`group relative flex min-h-0 flex-col justify-between rounded-[12px] border p-5 text-left transition-[border-color,background-color] duration-300 ${
                muted ? "border-dashed border-line-strong bg-transparent text-muted hover:border-muted" : "border-line bg-card hover:border-ink"
              } ${c.kind === "custom" ? "bg-copper text-white hover:border-copper" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full border ${
                    c.kind === "custom" ? "border-paper/30" : muted ? "border-line-strong" : "border-line group-hover:border-ink"
                  }`}
                >
                  <CategoryIcon name={c.icon} />
                </span>
                <ArrowUpRight size={16} strokeWidth={1.5} className="opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
              </div>
              <div>
                <p className={`font-serif text-[26px] leading-tight ${muted ? "" : ""}`}>{c.name}</p>
                <p className={`mt-1 line-clamp-2 text-[13px] leading-snug ${c.kind === "custom" ? "text-paper/70" : "text-muted"}`}>{c.description}</p>
                {count > 0 && <p className="mt-2 font-mono text-[11px] text-muted">{count} starter builds</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
