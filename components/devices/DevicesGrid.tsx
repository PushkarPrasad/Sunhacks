"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, PencilRuler } from "lucide-react";
import { visibleCategories as categories } from "@/data/categories";
import { templatesForCategory } from "@/data/templates";
import { useRoving } from "@/lib/hooks/useRoving";
import { useBuild } from "@/stores/build";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ScanDevice } from "./ScanDevice";

export function DevicesGrid() {
  const router = useRouter();
  const newBuild = useBuild((s) => s.newBuild);
  const onKeyDown = useRoving(4);
  const startBlank = () => {
    newBuild();
    router.push("/builder");
  };

  // Focus the first device card on arrival so arrow keys work at once (autoFocus does not apply to links).
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col px-12 pb-8 pt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Start from a device</p>
          <h1 className="mt-2 font-serif text-[48px] leading-none">What are you building?</h1>
        </div>
        <div className="flex items-center gap-3">
          <ScanDevice />
          <button data-magnetic
            type="button"
            onClick={startBlank}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-copper px-4 text-[13px] text-paper shadow-[var(--shadow-glow)] transition hover:-translate-y-px hover:bg-copper-hover"
          >
            <PencilRuler size={15} strokeWidth={1.5} /> Start blank
          </button>
        </div>
      </div>
      <div className="mt-8 grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-4" data-arrows onKeyDown={onKeyDown} role="list">
        {categories.map((c, i) => {
          const muted = c.kind === "more";
          const count = c.kind === "device" ? templatesForCategory(c.id).length : 0;
          return (
            <div key={c.id} role="listitem" className="flex min-h-0">
            <Link
              ref={i === 0 ? first : undefined}
              href={`/devices/${c.id}`}
              data-roving
              className={`group relative flex min-h-0 flex-1 flex-col justify-between rounded-[12px] border p-5 text-left transition-[border-color,background-color] duration-300 ${
                muted ? "border-dashed border-line-strong bg-transparent text-muted hover:border-muted" : "border-line bg-card hover:border-ink"
              }} ${i === 0 ? "border-copper/60 bg-[linear-gradient(160deg,rgb(15_157_107/0.14),rgb(10_107_73/0.04))] hover:border-copper" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-[10px] border ${
                    muted ? "border-line-strong" : "border-line group-hover:border-ink"
                  }`}
                >
                  <CategoryIcon name={c.icon} />
                </span>
                <ArrowUpRight size={16} strokeWidth={1.5} className="opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
              </div>
              <div>
                <p className={`font-serif text-[26px] leading-tight ${muted ? "" : ""}`}>{c.name}</p>
                <p className={`mt-1 line-clamp-2 text-[13px] leading-snug text-muted`}>{c.description}</p>
                {count > 0 && <p className="mt-2 font-mono text-[11px] text-muted">{count} starter builds</p>}
              </div>
            </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
