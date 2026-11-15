"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page dots + arrows for paginated lists (no scrolling anywhere). */
export function Pager({ page, pages, onChange, label = "page" }: { page: number; pages: number; onChange: (p: number) => void; label?: string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`${label} navigation`}>
      <button type="button" aria-label={`Previous ${label}`} disabled={page === 0} onClick={() => onChange(page - 1)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-line/60 disabled:opacity-30">
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to ${label} ${i + 1}`}
            aria-current={i === page}
            onClick={() => onChange(i)}
            className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-copper" : "w-1.5 bg-line-strong hover:bg-muted"}`}
          />
        ))}
      </div>
      <button type="button" aria-label={`Next ${label}`} disabled={page >= pages - 1} onClick={() => onChange(page + 1)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-line/60 disabled:opacity-30">
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
