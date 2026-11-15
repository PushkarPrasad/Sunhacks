"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2, Usb } from "lucide-react";
import { useT } from "@/lib/hooks/useT";
import { connectRing, ringStatus, useRing } from "@/lib/input/serial";
import { useUi } from "@/stores/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { Lang } from "@/lib/i18n/notes";

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "hi", label: "हिन्दी" },
];

export function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ui = useUi();
  const t = useT();
  const ring = useRing();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("settings.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
      >
        <Settings2 size={18} strokeWidth={1.5} />
      </button>
      {open && (
        <div role="dialog" aria-label={t("settings.title")} className="absolute right-0 top-11 w-[300px] animate-fade rounded-[12px] border border-line bg-card p-3 shadow-[var(--shadow-float)]">
          <p className="px-2 pb-2 pt-1 font-serif text-xl">{t("settings.title")}</p>
          <p className="px-2 pb-1 text-xs uppercase tracking-wider text-muted">{t("settings.language")}</p>
          <div className="mb-2 grid grid-cols-3 gap-1 px-2" role="radiogroup">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={ui.lang === l.id}
                onClick={() => ui.set({ lang: l.id })}
                className={`rounded-md border px-2 py-1.5 text-[13px] ${ui.lang === l.id ? "border-ink bg-copper text-white" : "border-line hover:border-line-strong"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-1">
            <Toggle id="set-contrast" label={t("settings.contrast")} checked={ui.highContrast} onChange={(v) => ui.set({ highContrast: v })} />
            <Toggle id="set-motion" label={t("settings.motion")} checked={ui.motion === "reduced"} onChange={(v) => ui.set({ motion: v ? "reduced" : "system" })} />
          </div>
          <div className="mt-1 border-t border-line px-2 pt-2">
            <button
              type="button"
              onClick={() => connectRing()}
              disabled={ring.status === "unsupported" || ring.status === "connected"}
              className="flex w-full items-center justify-between rounded-lg py-1.5 text-left text-sm disabled:text-muted"
            >
              <span className="flex items-center gap-2">
                <Usb size={16} strokeWidth={1.5} />
                {t("settings.ring")}
              </span>
              <span className="font-mono text-[11px] text-muted">{ringStatus(ring.status)}</span>
            </button>
            <p className="pt-1 text-xs text-muted">{t("settings.voice")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
