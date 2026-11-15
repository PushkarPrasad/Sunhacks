"use client";

import { Check, X } from "lucide-react";
import type { Finding } from "@/lib/types";
import { noteText } from "@/lib/i18n/notes";
import { useT } from "@/lib/hooks/useT";
import { useUi } from "@/stores/ui";

/** Left rule colour per severity: failures danger, warnings amber, passing notes emerald. */
const RULE: Record<Finding["severity"], string> = { fail: "var(--color-bad)", warn: "var(--color-warn)", ok: "var(--color-copper)" };
const LABEL: Record<Finding["severity"], string> = { fail: "Problem", warn: "Warning", ok: "Note" };

/** Kept for callers that still import it; notes no longer tilt. */
export function rotationFor(id: string): number {
  void id;
  return 0;
}

interface Props {
  finding: Finding;
  onApply?: () => void;
  onDismiss?: () => void;
  width?: number | string;
  text?: { title: string; body: string };
  className?: string;
  style?: React.CSSProperties;
}

export function StickyNote({ finding, onApply, onDismiss, width = 232, text, className = "", style }: Props) {
  const lang = useUi((s) => s.lang);
  const t = useT();
  const { title, body } = text ?? noteText(finding.code, finding.params, lang);
  return (
    <article
      className={`paper-note relative animate-pop rounded-[10px] px-4 pb-3 pt-3 text-ink ${className}`}
      style={{ width, borderLeftColor: RULE[finding.severity], ...style }}
      aria-label={`${finding.severity === "fail" ? "Problem" : "Warning"}: ${title}`}
      lang={lang}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: RULE[finding.severity] }}>
        {LABEL[finding.severity]}
      </p>
      <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{title}</p>
      <p className="mt-1 text-[12px] leading-snug text-muted">{body}</p>
      {(onApply || onDismiss) && (
        <div className="mt-3 flex items-center gap-2">
          {onApply && finding.fix && (
            <button type="button" onClick={onApply} className="flex h-7 items-center gap-1 rounded-[10px] bg-copper px-3 text-[12px] text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-copper-hover">
              <Check size={13} strokeWidth={2} /> {t("note.apply")}
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="flex h-7 items-center gap-1 rounded-[10px] border border-line px-2.5 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-ink">
              <X size={13} strokeWidth={2} /> {t("note.dismiss")}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
