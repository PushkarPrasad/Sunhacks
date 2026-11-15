"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Clock, Copy, Link2 } from "lucide-react";
import { partsById } from "@/data/parts";
import { formatHours } from "@/lib/checks/power";
import { useChecks } from "@/lib/hooks/useChecks";
import { encodeBuild } from "@/lib/share";
import { useBuild } from "@/stores/build";
import { Pager } from "@/components/ui/Pager";
import { StatusDot } from "@/components/ui/StatusDot";
import { CountUp } from "@/components/ui/CountUp";

const PER_PAGE = 9;
// Assumptions for the Time and Cost Saved panel (shown on the page).
const RATE = 30; // USD per hour, maker / junior contractor rate
const MANUAL_BASE_H = 2;
const MANUAL_PER_MODULE_H = 0.25;
const MANUAL_PER_WIRE_H = 1 / 12;
const TOOL_BASE_H = 0.25;
const TOOL_PER_MODULE_H = 1 / 30;
const RESPIN_DAYS = 7;

export function SummaryPage() {
  const build = useBuild((s) => s.build);
  const hydrated = useBuild((s) => s.hydrated);
  const loadTemplate = useBuild((s) => s.loadTemplate);
  const report = useChecks();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [share, setShare] = useState<{ url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Group identical parts for the list.
  const rows = useMemo(() => {
    const m = new Map<string, { partId: string; labels: string[] }>();
    for (const i of build.instances) {
      const r = m.get(i.partId) ?? { partId: i.partId, labels: [] };
      r.labels.push(i.label);
      m.set(i.partId, r);
    }
    return [...m.values()].sort((a, b) => partsById[b.partId].priceUSD * b.labels.length - partsById[a.partId].priceUSD * a.labels.length);
  }, [build.instances]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages - 1);

  useEffect(() => {
    if (!hydrated || !build.instances.length) return;
    let alive = true;
    (async () => {
      let url = `${window.location.origin}/share?id=${encodeURIComponent(build.id)}`;
      try {
        const res = await fetch("/api/builds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(build) });
        if (!res.ok) throw new Error();
      } catch {
        url = `${window.location.origin}/share#${encodeBuild(build)}`;
      }
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#06100C", light: "#EEF4F0" } });
      if (alive) setShare({ url, qr });
    })();
    return () => {
      alive = false;
    };
  }, [build, hydrated]);

  const t = report.totals;
  const modules = build.instances.length;
  const manualH = MANUAL_BASE_H + modules * MANUAL_PER_MODULE_H + build.wires.length * MANUAL_PER_WIRE_H;
  const toolH = TOOL_BASE_H + modules * TOOL_PER_MODULE_H;
  const savedH = Math.max(0, manualH - toolH);
  const fails = report.findings.filter((f) => f.severity === "fail").length;

  if (!hydrated) return <div className="h-full" />;
  if (!modules)
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <p className="font-serif text-[40px]">Nothing to summarise yet.</p>
          <Link href="/devices" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-5 text-[13px] text-white hover:bg-copper-hover">
            Start a build
          </Link>
        </div>
      </div>
    );

  return (
    <div className="relative mx-auto grid h-full max-w-[1360px] grid-cols-[1.1fr_1fr_340px] gap-8 px-10 pb-6 pt-8">
      {/* Parts */}
      <section className="flex min-h-0 flex-col">
        <p className="eyebrow">Summary</p>
        <h1 className="mt-2 font-serif text-[44px] leading-[1.02]">{build.name}</h1>
        <p className="mt-2 text-[13px] text-muted">
          {modules} modules · {build.wires.length} wires · {rows.length} distinct parts
        </p>
        <div className="mt-5 min-h-0 flex-1 rounded-[12px] border border-line bg-card">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            <span>Part</span>
            <span>Qty</span>
            <span className="w-16 text-right">Cost</span>
          </div>
          <ul>
            {rows.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE).map((r) => {
              const p = partsById[r.partId];
              return (
                <li key={r.partId} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line/60 px-4 py-2 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{p.name}</span>
                    <span className="block truncate font-mono text-[10px] text-muted">{r.labels.join(" ")}</span>
                  </span>
                  <span className="font-mono text-[12px]">×{r.labels.length}</span>
                  <span className="w-16 text-right font-mono text-[12px]">${(p.priceUSD * r.labels.length).toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pt-3">
          <Pager page={current} pages={pages} onChange={setPage} label="parts page" />
        </div>
      </section>

      {/* Totals + time saved */}
      <section className="flex min-h-0 flex-col gap-4 pt-[30px]">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total cost" value={<CountUp value={t.totalUSD} format={(n) => `$${n.toFixed(2)}`} />} sub={`$${t.bomUSD.toFixed(2)} parts + $${t.boardUSD.toFixed(2)} boards`} />
          <Stat label="Average current" value={<CountUp value={t.averageCurrent_mA} format={(n) => `${Math.round(n)} mA`} />} sub={`${Math.round(t.peakCurrent_mA)} mA peak`} />
          <Stat
            label="Battery life"
            value={t.batteryLife_h !== null ? `≈ ${formatHours(t.batteryLife_h)}` : "USB"}
            sub={t.batteryLife_h !== null ? (t.batteryModel === "matlab" ? "MATLAB discharge curve" : "80% usable capacity") : "No battery in this build"}
          />
          <Stat label="Checks" value={fails ? `${fails} to fix` : "Passing"} sub={`${report.findings.length} open notes`} status={fails ? "fail" : report.findings.length ? "warn" : "ok"} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-line bg-card p-5">
          <div className="flex items-center gap-2">
            <Clock size={16} strokeWidth={1.5} className="text-copper" />
            <p className="text-[13px] font-medium">Time and Cost Saved</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[28px] leading-none tabular-nums">
                <CountUp value={savedH} format={(n) => `${n.toFixed(1)} h`} />
              </p>
              <p className="mt-1 text-[12px] text-muted">
                design time saved ({manualH.toFixed(1)} h by hand vs {toolH.toFixed(1)} h here)
              </p>
            </div>
            <div>
              <p className="font-mono text-[28px] leading-none tabular-nums">
                <CountUp value={savedH * RATE + (fails === 0 ? t.boardUSD : 0)} format={(n) => `$${Math.round(n)}`} />
              </p>
              <p className="mt-1 text-[12px] text-muted">{fails === 0 ? `labour + one avoided board respin (${RESPIN_DAYS} days)` : "labour; fix the failing checks to also avoid a respin"}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3" aria-label="Design time comparison">
            {[
              { label: "By hand", h: manualH, cls: "bg-line-strong" },
              { label: "Magic Smoke", h: toolH, cls: "bg-copper" },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{b.label}</span>
                  <span className="font-mono">{b.h.toFixed(1)} h</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-line/50">
                  <div className={`h-2 rounded-full ${b.cls}`} style={{ width: `${Math.max(3, (b.h / manualH) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-auto border-t border-line pt-3 text-[11px] text-muted" title={`By hand: ${MANUAL_BASE_H} h setup, 15 min per module, 5 min per wire. Here: 15 min plus 2 min per module. Respin: one more board order, about ${RESPIN_DAYS} days.`}>
            Assumes ${RATE}/h labour and a {RESPIN_DAYS}-day respin.
          </p>
        </div>
      </section>

      {/* Share */}
      <section className="flex min-h-0 flex-col pt-[30px]">
        <div className="flex flex-1 flex-col items-center rounded-[12px] border border-line bg-card p-5 text-center">
          <p className="flex items-center gap-2 self-start text-[13px] font-medium">
            <Link2 size={15} strokeWidth={1.5} /> Share this build
          </p>
          <div className="my-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {share ? <img src={share.qr} alt="QR code linking to this build" width={220} height={220} className="mx-auto rounded-lg" /> : <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-lg bg-line/50" />}
            <p className="mt-3 text-[12px] text-muted">Scan to open it, or to vote for it.</p>
          </div>
          <button
            type="button"
            disabled={!share}
            onClick={async () => {
              if (!share) return;
              await navigator.clipboard.writeText(share.url).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-copper shadow-[var(--shadow-btn)] text-[13px] text-white hover:bg-copper-hover disabled:opacity-50"
          >
            {copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.5} />}
            {copied ? "Copied" : "Copy share link"}
          </button>
          <p className="mt-2 w-full truncate font-mono text-[10px] text-muted">{share?.url ?? "…"}</p>
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/board" className="flex h-10 flex-1 items-center justify-center lift rounded-[10px] border border-line text-[13px] hover:border-line-strong hover:bg-raised">
            Board and exports
          </Link>
          <Link href="/builder" className="flex h-10 flex-1 items-center justify-center lift rounded-[10px] border border-line text-[13px] hover:border-line-strong hover:bg-raised">
            Keep editing
          </Link>
        </div>
      </section>

      {/* A small secret. */}
      <button
        type="button"
        aria-label="Open a secret template"
        title="?"
        onClick={() => {
          loadTemplate("overengineered-soda-can");
          router.push("/builder");
        }}
        className="absolute bottom-2 right-3 font-serif text-[13px] text-line-strong transition-colors hover:text-copper"
      >
        ∴
      </button>
    </div>
  );
}

function Stat({ label, value, sub, status }: { label: string; value: React.ReactNode; sub: string; status?: "ok" | "warn" | "fail" }) {
  return (
    <div className="lift rounded-[12px] border border-line bg-card p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        {status && <StatusDot status={status} />}
        {label}
      </p>
      <p className="mt-2.5 font-mono text-[24px] leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-[11px] text-muted">{sub}</p>
    </div>
  );
}
