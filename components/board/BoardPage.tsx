"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Braces, FileArchive, FileCode2, FileSpreadsheet, X } from "lucide-react";
import { useChecks } from "@/lib/hooks/useChecks";
import { useCircuit } from "@/lib/hooks/useCircuit";
import { onInput } from "@/lib/input/bus";
import { DEMO_USD_PER_SOL, SOLANA_RECIPIENT, solanaPayUrl } from "@/lib/integrations/solana";
import { useBuild } from "@/stores/build";
import { QuadView } from "./QuadView";

type Kind = "gerber" | "bom" | "kicad" | "json";
const EXPORTS: { kind: Kind; label: string; sub: string; icon: typeof FileArchive }[] = [
  { kind: "gerber", label: "Gerber zip", sub: "9 layers + drill", icon: FileArchive },
  { kind: "bom", label: "BOM CSV", sub: "parts, prices, links", icon: FileSpreadsheet },
  { kind: "kicad", label: "KiCad files", sub: ".kicad_pcb + .kicad_sch", icon: FileCode2 },
  { kind: "json", label: "Circuit JSON", sub: "tscircuit format", icon: Braces },
];
const QTYS = [5, 10, 30, 100];

interface Quote {
  qty: number;
  boardUSD: number;
  perBoardUSD: number;
  leadDays: number;
  source: string;
  live: boolean;
  assumptions: string[];
  assemblyNote: string;
}

export function BoardPage() {
  const build = useBuild((s) => s.build);
  const hydrated = useBuild((s) => s.hydrated);
  const report = useChecks();
  const circuit = useCircuit(build, hydrated && build.instances.length > 0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qty, setQty] = useState(5);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pay, setPay] = useState(false);
  const board = circuit.data?.board;

  useEffect(() => {
    if (!board) return;
    let alive = true;
    fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ w: board.w, h: board.h, qty }) })
      .then((r) => r.json())
      .then((q: Quote) => alive && setQuote(q))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [board, qty]);

  const download = async (kind: Kind) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ build, kind }) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `board-${kind}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setMessage(`Downloaded ${name}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadRef = useRef(download);
  useEffect(() => {
    downloadRef.current = download;
  });
  useEffect(() => onInput("exportBoard", () => (void downloadRef.current("gerber"), true)), []);


  const fails = report.findings.filter((f) => f.severity === "fail").length;
  const total = (report.totals.bomUSD + (quote?.boardUSD ?? report.totals.boardUSD)).toFixed(2);

  if (!hydrated) return <div className="h-full" />;
  if (!build.instances.length)
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <p className="font-serif text-[40px]">No board yet.</p>
          <p className="mt-2 text-muted">Place and wire modules in the builder first.</p>
          <Link href="/builder" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-5 text-[13px] text-white hover:bg-copper-hover">
            Open the builder
          </Link>
        </div>
      </div>
    );

  return (
    <div className="grid h-full grid-cols-[1fr_400px]">
      <section className="relative min-h-0">
        {circuit.data ? (
          <QuadView build={build} data={circuit.data} />
        ) : (
          <div className="grid h-full place-items-center bg-pcb text-[13px] text-muted" role="status">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-copper" /> {circuit.error ?? "Placing modules and routing the carrier board…"}
            </span>
          </div>
        )}
      </section>

      <aside className="flex min-h-0 flex-col gap-5 border-l border-line px-6 py-6">
        <div>
          <p className="eyebrow">Carrier board</p>
          <h1 className="mt-1 font-serif text-[34px] leading-none">{build.name}</h1>
          <p className="mt-2 font-mono text-[12px] text-muted">
            {board ? `${board.w} × ${board.h} mm · 2 layers · ${circuit.data?.traces ?? 0} traces · 4 × M3` : "Routing…"}
          </p>
          {fails > 0 && (
            <Link href="/checks" className="mt-2 inline-block text-[12px] text-bad underline underline-offset-4">
              {fails} check{fails > 1 ? "s" : ""} still failing. Review before ordering.
            </Link>
          )}
        </div>

        <div>
          <p className="mb-2 text-[12px] font-medium">Export</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPORTS.map((e) => (
              <button
                key={e.kind}
                type="button"
                disabled={!circuit.data || busy !== null}
                onClick={() => download(e.kind)}
                className="flex items-start gap-2.5 rounded-[10px] border border-line bg-card p-3 text-left lift hover:border-line-strong disabled:opacity-50"
              >
                <e.icon size={17} strokeWidth={1.5} className="mt-0.5 shrink-0 text-copper" />
                <span>
                  <span className="block text-[13px] leading-tight">{busy === e.kind ? "Preparing…" : e.label}</span>
                  <span className="block text-[11px] text-muted">{e.sub}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 h-4 text-[11px] text-muted" role="status">
            {message}
          </p>
        </div>

        <div className="rounded-[12px] border border-line bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium">Manufacturing quote</p>
            <span className={`rounded px-1.5 py-px text-[10px] ${quote?.live ? "bg-ok/10 text-ok" : "bg-line/70 text-muted"}`}>{quote ? (quote.live ? quote.source : "estimate") : "…"}</span>
          </div>
          <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Quantity">
            {QTYS.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={qty === q}
                onClick={() => setQty(q)}
                className={`flex-1 rounded-md border py-1 font-mono text-[12px] ${qty === q ? "border-copper bg-copper text-white" : "border-line hover:border-line-strong"}`}
              >
                {q}
              </button>
            ))}
          </div>
          <dl className="mt-3 space-y-1.5 font-mono text-[12px]">
            <div className="flex justify-between">
              <dt className="text-muted">Boards ×{qty}</dt>
              <dd>${quote?.boardUSD.toFixed(2) ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Parts ×1</dt>
              <dd>${report.totals.bomUSD.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5 text-[13px]">
              <dt>First build</dt>
              <dd>${total}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted" title={quote?.assumptions.join("\n")}>
            {quote ? `${quote.leadDays}-day lead time · 2-layer FR-4` : ""}
          </p>
        </div>

      </aside>

      {pay && quote && <PayModal usd={quote.boardUSD} name={build.name} onClose={() => setPay(false)} />}
    </div>
  );
}

function PayModal({ usd, name, onClose }: { usd: number; name: string; onClose: () => void }) {
  const sol = Math.max(0.01, usd / DEMO_USD_PER_SOL);
  const url = solanaPayUrl({ recipient: SOLANA_RECIPIENT, amountSol: sol, label: "Magic Smoke (devnet demo)", message: `Board order: ${name}` });
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#06100C", light: "#EEF4F0" } }).then(setQr);
  }, [url]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Solana Pay devnet demo">
      <div className="w-[380px] rounded-[16px] border border-line bg-card p-6 text-center shadow-[var(--shadow-float)]">
        <div className="flex justify-between">
          <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] text-warn">Devnet demo · no real money</span>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted hover:text-ink">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="Solana Pay QR code" width={240} height={240} className="mx-auto mt-4" />}
        <p className="mt-3 font-mono text-[14px]">{sol.toFixed(4)} SOL</p>
        <p className="mt-1 text-[11px] text-muted">
          ${usd.toFixed(2)} at a fixed demo rate of ${DEMO_USD_PER_SOL}/SOL. Scan with a wallet set to devnet.
        </p>
        <a href={url} className="mt-4 inline-flex h-9 items-center rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-4 text-[12px] text-white hover:bg-copper-hover">
          Open in wallet
        </a>
      </div>
    </div>
  );
}
