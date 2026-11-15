"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/flow";
import { useT } from "@/lib/hooks/useT";
import { Logo } from "@/components/ui/Logo";
import { BRAND } from "@/lib/brand";
import { SettingsPopover } from "./SettingsPopover";

export function TopBar() {
  const pathname = usePathname();
  const current = NAV.findIndex((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)));
  const t = useT();
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
      <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
        <Logo />
        <span className="font-serif text-[22px] leading-none tracking-tight">
          Magic <span className="italic text-copper">Smoke</span>
        </span>
      </Link>
      <nav aria-label="Main" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
        {NAV.map((f, i) => (
          <Link
            key={f.path}
            href={f.path}
            aria-current={i === current ? "page" : undefined}
            className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${i === current ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {f.label === "Glove" || f.label === "About" ? f.label : t(`nav.${f.label}`)}
            {i === current && <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-copper" />}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <SettingsPopover />
      </div>
    </header>
  );
}
