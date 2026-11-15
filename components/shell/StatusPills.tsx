"use client";

import Link from "next/link";
import { pillText, useGlove } from "@/lib/input/glove";
import { stopHandControl } from "@/lib/input/camera";
import { useInput } from "@/stores/input";

/** Glove link pill (opens the Glove tab) and, while running, the "Hand control on" pill with an off switch. */
export function StatusPills() {
  const status = useGlove((s) => s.status);
  const camera = useInput((s) => s.camera);
  const text = pillText(status);
  const dot = text === "Connected" ? "bg-ok" : text === "Off" ? "bg-line-strong" : text === "Stalled" ? "bg-bad" : "animate-pulse bg-warn";
  const handOn = camera === "on" || camera === "starting";
  return (
    <div className="flex items-center gap-2">
      {handOn && (
        <span className="flex h-8 items-center gap-2 rounded-[10px] border border-line px-2.5 text-[12px]" data-testid="hand-pill">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
          Hand control on
          <button type="button" onClick={() => stopHandControl()} className="rounded-[6px] px-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Turn hand control off">
            Off
          </button>
        </span>
      )}
      <Link href="/glove" className="flex h-8 items-center gap-2 rounded-[10px] border border-line px-2.5 text-[12px] text-muted transition hover:border-line-strong hover:text-ink" aria-label={`Glove: ${text}. Open the Glove tab.`} data-testid="glove-pill">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        Glove · {text}
      </Link>
    </div>
  );
}
