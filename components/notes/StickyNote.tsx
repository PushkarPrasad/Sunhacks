"use client";

import { Check, X } from "lucide-react";
import type { Finding } from "@/lib/types";
import { noteText } from "@/lib/i18n/notes";
import { useT } from "@/lib/hooks/useT";
import { useUi } from "@/stores/ui";

const SEV: Record<Finding["severity"], string> = { fail: "var(--color-bad)", warn: "var(--color-warn)", ok: "var(--color-ok)" };

export function rotationFor(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 25) - 12) / 10; // -1.2 .. 1.2 degrees
}

interface Props {
  finding: Finding;
  onApply?: () => void;
  onDismiss?: () => void;
  width?: number;
  text?: { title: string; body: string };
  className?: string;
  style?: React.CSSProperties;
}

export function StickyNote({ finding, onApply, onDismiss, width = 232, text, className = "", style }: Props) {
  const lang = useUi((s) => s.lang);
  const t = useT();
  const { title, body } = text ?? noteText(finding.code, finding.params, lang);
  const rot = rotationFor(finding.id);
  return (
    <article
      className={`paper-note relative animate-pop rounded-[3px] px-3.5 pb-3 pt-3.5 text-ink ${className}`}
      style={{ width, transform: `rotate(${rot}deg)`, ["--note-rot" as string]: `${rot}deg`, ...style }}
      aria-label={`${finding.severity === "fail" ? "Problem" : "Warning"}: ${title}`}
      lang={lang}
    >
      <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.3)]" style={{ background: SEV[finding.severity] }} aria-hidden="true" />
      {/* Mascot slot: replace /public/mascot.svg with the team's drawing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot.svg" alt="" aria-hidden="true" className="absolute -right-2 -top-3 h-7 w-7 rotate-6 opacity-90" />
      <p className="pr-4 text-[13px] font-semibold leading-snug">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-ink/80">{body}</p>
      {(onApply || onDismiss) && (
        <div className="mt-2.5 flex items-center gap-2">
          {onApply && finding.fix && (
            <button type="button" onClick={onApply} className="flex h-7 items-center gap-1 rounded-full bg-ink px-3 text-[12px] text-paper transition-colors hover:bg-copper">
              <Check size={13} strokeWidth={2} /> {t("note.apply")}
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="flex h-7 items-center gap-1 rounded-full px-2 text-[12px] text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink">
              <X size={13} strokeWidth={2} /> {t("note.dismiss")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
