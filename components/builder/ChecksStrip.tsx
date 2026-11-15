"use client";

import Link from "next/link";
import type { ChecksReport } from "@/lib/types";
import { useT } from "@/lib/hooks/useT";
import { StatusDot } from "@/components/ui/StatusDot";

export function ChecksStrip({ report }: { report: ChecksReport }) {
  const t = useT();
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-12 items-center justify-between gap-1 border-t border-line bg-paper/90 px-3 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
      {report.results.map((r) => (
        <Link
          key={r.id}
          href={`/checks#${r.id}`}
          className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[12px] transition-colors hover:bg-card"
          title={`${t(`check.${r.id}`)}: ${r.headline} ${r.detail}`}
        >
          <StatusDot status={r.status} />
          <span className="text-muted">{t(`check.${r.id}`)}</span>
          <span className="font-mono text-ink">{r.headline}</span>
        </Link>
      ))}
    </div>
  );
}
