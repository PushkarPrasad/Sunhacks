"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FLOW, neighbours } from "@/lib/flow";
import { useT } from "@/lib/hooks/useT";

export function PageNav() {
  const pathname = usePathname();
  const { index, prev, next } = neighbours(pathname);
  const t = useT();
  return (
    <footer className="relative z-20 flex h-12 shrink-0 items-center justify-between border-t border-line px-6 text-[13px]">
      <div className="w-48">
        {prev && (
          <Link href={prev.path} className="group inline-flex items-center gap-2 text-muted hover:text-ink" aria-label={`Previous page: ${prev.label}`}>
            <ArrowLeft size={16} strokeWidth={1.5} className="transition-transform group-hover:-translate-x-0.5" />
            {t(`nav.${prev.label}`)}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2" aria-label="Pages">
        {FLOW.map((f, i) => (
          <Link
            key={f.path}
            href={f.path}
            aria-label={f.label}
            aria-current={i === index ? "page" : undefined}
            className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-6 bg-copper" : "w-1.5 bg-line-strong hover:bg-muted"}`}
          />
        ))}
      </div>
      <div className="flex w-48 justify-end">
        {next && (
          <Link href={next.path} className="group inline-flex items-center gap-2 text-muted hover:text-ink" aria-label={`Next page: ${next.label}`}>
            {t(`nav.${next.label}`)}
            <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </footer>
  );
}
