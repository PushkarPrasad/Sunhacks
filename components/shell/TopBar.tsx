"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hand } from "lucide-react";
import { FLOW, flowIndex } from "@/lib/flow";
import { useT } from "@/lib/hooks/useT";
import { useUi } from "@/stores/ui";
import { Logo } from "@/components/ui/Logo";
import { SettingsPopover } from "./SettingsPopover";

export function TopBar() {
  const pathname = usePathname();
  const current = flowIndex(pathname);
  const t = useT();
  const gestures = useUi((s) => s.gestures);
  const set = useUi((s) => s.set);
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Copperline home">
        <Logo />
        <span className="font-serif text-[22px] leading-none tracking-tight">Copperline</span>
      </Link>
      <nav aria-label="Main" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
        {FLOW.map((f, i) => (
          <Link
            key={f.path}
            href={f.path}
            aria-current={i === current ? "page" : undefined}
            className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${i === current ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {t(`nav.${f.label}`)}
            {i === current && <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-copper" />}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => set({ gestures: !gestures })}
          aria-pressed={gestures}
          title="Hand gestures (webcam)"
          className={`flex h-9 items-center gap-2 rounded-full px-3 text-[13px] transition-colors ${gestures ? "bg-ink text-paper" : "text-muted hover:bg-line/60 hover:text-ink"}`}
        >
          <Hand size={16} strokeWidth={1.5} />
          <span>{gestures ? "Gestures on" : "Gestures"}</span>
        </button>
        <SettingsPopover />
      </div>
    </header>
  );
}
