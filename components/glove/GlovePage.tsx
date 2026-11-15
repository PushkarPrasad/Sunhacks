"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bluetooth, Camera, Lightbulb, RefreshCw, RotateCcw, Unplug, Usb } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { bluetoothSupported, connectGlove, type GloveStatus, disconnectGlove, reconnect, sendGlove, serialSupported, useGlove } from "@/lib/input/glove";
import { recenter, useInput } from "@/stores/input";

const DroneModel = dynamic(() => import("@/components/device3d/DroneModel"), { ssr: false, loading: () => <div className="h-full w-full" /> });
const GlovePreview = dynamic(() => import("./GlovePreview"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const noop = () => () => {};
const STATUS_TEXT: Record<GloveStatus, string> = { idle: "Not connected", searching: "Searching", connected: "Glove connected", reconnecting: "Reconnecting…", stalled: "Stalled: reconnecting", disconnected: "Disconnected", error: "Not connected" };

const MAP: [string, string][] = [
  ["Fist or switch + turn wrist", "Rotate the model"],
  ["Flick left / right", "Previous / next page"],
  ["Knock", "Select"],
  ["Shake", "Recenter"],
];

export function GlovePage() {
  const g = useGlove();
  const o = useInput((s) => s.orientation);
  const grabbing = useInput((s) => s.grabbing);
  const camera = useInput((s) => s.camera);
  const events = useInput((s) => s.events);
  const linkLog = useGlove((s) => s.log);
  const connected = g.status === "connected";
  const supported = useSyncExternalStore(noop, () => bluetoothSupported() || serialSupported(), () => true);

  return (
    <div className="mx-auto grid h-full max-w-[1320px] grid-cols-[420px_1fr] gap-8 px-10 py-7">
      <section className="flex min-h-0 flex-col gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">Glove</p>
          <h1 className="mt-2 font-serif text-[44px] leading-none">{BRAND.gloveName}</h1>
        </div>

        <div className={`rounded-[18px] border bg-card/70 p-4 ${g.status === "disconnected" ? "border-bad/60" : "border-line"}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px]" role="status" aria-live="polite" data-testid="glove-status">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-ok shadow-[0_0_12px_rgb(94_226_168/0.7)]" : g.status === "searching" ? "animate-pulse bg-warn" : g.status === "disconnected" ? "bg-bad" : "bg-line-strong"}`} />
              {STATUS_TEXT[g.status]}
            </span>
            <span className="font-mono text-[11px] text-muted">
              {connected ? `${g.transport === "bluetooth" ? "Bluetooth" : "USB"}${g.sensor ? ` · ${g.sensor}` : ""}` : ""}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {g.status === "disconnected" ? (
              <button type="button" onClick={() => void reconnect()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-copper text-[13px] text-white shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:bg-copper-hover">
                <RefreshCw size={15} strokeWidth={1.75} /> Reconnect
              </button>
            ) : !connected ? (
              <>
                <button
                  type="button"
                  onClick={() => void connectGlove("bluetooth")}
                  disabled={g.status === "searching"}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-copper text-[13px] text-white shadow-[var(--shadow-btn)] transition hover:-translate-y-px hover:bg-copper-hover disabled:opacity-60"
                >
                  <Bluetooth size={15} strokeWidth={1.75} /> Connect Bluetooth
                </button>
                <button type="button" onClick={() => void connectGlove("usb")} className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong px-4 text-[13px] transition hover:-translate-y-px hover:border-copper">
                  <Usb size={15} strokeWidth={1.5} /> USB
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => void sendGlove("B")} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-line-strong text-[13px] transition hover:-translate-y-px hover:border-copper">
                  <Lightbulb size={15} strokeWidth={1.5} /> Blink LED
                </button>
                <button type="button" onClick={() => void disconnectGlove()} className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong px-4 text-[13px] transition hover:border-bad hover:text-bad">
                  <Unplug size={15} strokeWidth={1.5} /> Disconnect
                </button>
              </>
            )}
          </div>
          {g.error ? (
            <p className="mt-2.5 text-[12px] text-bad">{g.error}</p>
          ) : g.status === "disconnected" ? (
            <p className="mt-2.5 text-[12px] text-bad">The glove dropped out. Reconnect picks it up again.</p>
          ) : (
            !connected && <p className="mt-2.5 text-[12px] text-muted">{supported ? "Power the glove and keep it still for 2 s, then connect. The camera starts too." : "Glove connection needs Chrome or Edge."}</p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_132px] gap-3 rounded-[18px] border border-line bg-card/70 p-4">
          <dl className="grid content-start gap-2 font-mono text-[12px]">
            {(["roll", "pitch", "yaw"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <dt className="w-10 text-muted">{k}</dt>
                <dd className="relative h-1.5 flex-1 rounded-full bg-raised">
                  <span className="absolute left-1/2 top-0 h-1.5 rounded-full bg-copper" style={{ width: `${Math.min(50, Math.abs(o?.[k] ?? 0) / 3.6)}%`, transform: (o?.[k] ?? 0) < 0 ? "translateX(-100%)" : undefined }} />
                </dd>
                <dd className="w-11 text-right tabular-nums text-ink" data-testid={`glove-${k}`}>
                  {o ? `${o[k]}°` : "—"}
                </dd>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between text-muted">
              <span>Grab</span>
              <span className={grabbing ? "text-copper" : "text-ink"}>{grabbing ? "Grabbed" : g.hasSwitch ? "Released" : "Knock to grab"}</span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Camera</span>
              {camera === "on" ? (
                <span className="text-ok">On</span>
              ) : (
                <Link href="/calibrate" className="flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:text-copper">
                  <Camera size={12} strokeWidth={1.5} /> Start on Calibrate
                </Link>
              )}
            </div>
          </dl>
          <div className="h-[132px] overflow-hidden rounded-[12px] border border-line bg-raised/50" aria-label="Glove orientation preview">
            <GlovePreview />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="flex min-h-0 flex-col rounded-[18px] border border-line bg-card/70 p-4">
          <p className="text-[12px] text-muted">Last events</p>
          <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-hidden font-mono text-[12px]" data-testid="glove-events">
            {events.length === 0 && <li className="text-muted">Nothing yet. Flick, knock or shake the glove.</li>}
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 border-b border-line/50 pb-1">
                <span className="text-ink">{e.label}</span>
                <span className="text-muted">
                  {e.source} · {new Date(e.at).toLocaleTimeString([], { hour12: false })}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex min-h-0 flex-col rounded-[18px] border border-line bg-card/70 p-4">
          <p className="text-[12px] text-muted">Link log</p>
          <ol className="mt-2 min-h-0 flex-1 space-y-1 overflow-hidden font-mono text-[11px]" data-testid="link-log">
            {linkLog.length === 0 && <li className="text-muted">Connects, drops, reconnects and stalls appear here.</li>}
            {linkLog.slice(0, 9).map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex justify-between gap-2 border-b border-line/50 pb-1">
                <span className={e.kind === "stall" || e.kind === "disconnect" || e.kind === "give-up" ? "text-warn" : e.kind === "error" ? "text-bad" : "text-ink"}>{e.text}</span>
                <span className="shrink-0 text-muted">{new Date(e.at).toLocaleTimeString([], { hour12: false })}</span>
              </li>
            ))}
          </ol>
        </div>
        </div>
      </section>

      <section className="relative min-h-0 overflow-hidden rounded-[22px] border border-line bg-card/40" aria-label="Globe-grab model">
        <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,rgb(15_157_107/0.18),rgb(10_107_73/0.08)_45%,transparent_70%)] blur-2xl" aria-hidden="true" />
        <DroneModel explode={0} enableZoom={false} camera={[3.6, 2.6, 4.4]} />
        <ul className="glass absolute bottom-5 left-5 w-[300px] space-y-1 rounded-[14px] border border-line p-3 text-[12px]" aria-label="What the glove does">
          {MAP.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span>{k}</span>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ul>
        <div className="absolute right-5 top-5 flex gap-2">
          <Link href="/test/glove-camera.html" target="_blank" className="glass flex h-9 items-center rounded-[10px] border border-line px-3.5 text-[12px] text-muted transition hover:-translate-y-px hover:text-ink">
            Test page
          </Link>
          <button type="button" onClick={() => recenter("glove")} className="glass flex h-9 items-center gap-2 rounded-[10px] border border-line px-3.5 text-[12px] text-muted transition hover:-translate-y-px hover:text-ink">
            <RotateCcw size={14} strokeWidth={1.5} /> Recenter
          </button>
        </div>
      </section>
    </div>
  );
}
