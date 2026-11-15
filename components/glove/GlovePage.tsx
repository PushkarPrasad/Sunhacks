"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Bluetooth, RotateCcw, Unplug, Usb } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { bluetoothSupported, connectBluetooth, connectUsb, disconnectGlove, reconnect, serialSupported, useGlove } from "@/lib/input/glove";
import { useModelPose } from "@/stores/modelPose";

const DroneModel = dynamic(() => import("@/components/device3d/DroneModel"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const noop = () => () => {};

const STATUS_TEXT = { idle: "Not connected", searching: "Searching", connected: "Glove connected", disconnected: "Disconnected", error: "Not connected" } as const;

const MAP: [string, string][] = [
  ["Hold switch + turn wrist", "Rotate the model"],
  ["Flick left / right", "Previous / next page"],
  ["Tap", "Select"],
  ["Shake", "Back"],
  ["Hold + tilt", "Zoom"],
];

export function GlovePage() {
  const g = useGlove();
  const resetPose = useModelPose((s) => s.reset);
  const connected = g.status === "connected";
  // Checked after mount so server and client render the same first frame.
  const supported = useSyncExternalStore(noop, () => bluetoothSupported() || serialSupported(), () => true);

  return (
    <div className="mx-auto grid h-full max-w-[1320px] grid-cols-[400px_1fr] gap-10 px-10 py-8">
      <section className="flex min-h-0 flex-col">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">Glove</p>
        <h1 className="mt-3 font-serif text-[52px] leading-none">{BRAND.gloveName}</h1>

        <div className="mt-7 rounded-[18px] border border-line bg-card/70 p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px]" role="status" aria-live="polite">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-ok shadow-[0_0_12px_rgb(61_220_151/0.8)]" : g.status === "searching" ? "animate-pulse bg-warn" : "bg-line-strong"}`} />
              {STATUS_TEXT[g.status]}
            </span>
            {connected && <span className="font-mono text-[11px] text-muted">{g.transport === "bluetooth" ? "Bluetooth" : "USB"}</span>}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-[12px]">
            <div className="rounded-[10px] border border-line px-3 py-2">
              <dt className="text-muted">Sensor</dt>
              <dd className="mt-0.5 text-ink">{g.sensor ?? "—"}</dd>
            </div>
            <div className="rounded-[10px] border border-line px-3 py-2">
              <dt className="text-muted">Switch</dt>
              <dd className={`mt-0.5 ${g.grabbing ? "text-copper" : "text-ink"}`}>{g.grabbing ? "Held (grabbing)" : "Released"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2">
            {!connected ? (
              <>
                <button
                  type="button"
                  onClick={() => (g.status === "disconnected" ? reconnect() : connectBluetooth())}
                  disabled={g.status === "searching"}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-copper text-[13px] text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-px hover:bg-copper-hover disabled:opacity-60"
                >
                  <Bluetooth size={15} strokeWidth={1.75} /> {g.status === "disconnected" ? "Reconnect" : "Find glove"}
                </button>
                <button type="button" onClick={connectUsb} className="flex h-10 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] transition hover:-translate-y-px hover:border-copper">
                  <Usb size={15} strokeWidth={1.5} /> USB
                </button>
              </>
            ) : (
              <button type="button" onClick={disconnectGlove} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-line-strong text-[13px] transition hover:border-bad hover:text-bad">
                <Unplug size={15} strokeWidth={1.5} /> Disconnect
              </button>
            )}
          </div>
          {g.error && <p className="mt-3 text-[12px] text-bad">{g.error}</p>}
          {!g.error && !connected && (
            <p className="mt-3 text-[12px] text-muted">
              {supported ? "Switch the glove on, then find it. USB works when Bluetooth is off." : "Glove connection needs Chrome or Edge."}
            </p>
          )}
        </div>

        <div className="mt-5 rounded-[18px] border border-line bg-card/70 p-5">
          <p className="text-[12px] text-muted">Last gesture</p>
          <div className="mt-1 h-10">
            <AnimatePresence mode="wait">
              <motion.p key={g.lastGesture?.at ?? 0} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-serif text-[32px] leading-none">
                {g.lastGesture?.name ?? "—"}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <ul className="mt-5 space-y-1.5 text-[13px]" aria-label="What the glove does">
          {MAP.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1.5">
              <span>{k}</span>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative min-h-0 overflow-hidden rounded-[22px] border border-line bg-card/40" aria-label="Live orientation">
        <div className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle,rgb(61_123_255/0.2),rgb(124_92_255/0.1)_45%,transparent_70%)] blur-2xl" aria-hidden="true" />
        <DroneModel explode={0} enableZoom={false} camera={[3.6, 2.6, 4.4]} />
        <Dial roll={g.orientation?.roll ?? 0} pitch={g.orientation?.pitch ?? 0} yaw={g.orientation?.yaw} live={connected} />
        <button type="button" onClick={resetPose} className="glass absolute right-5 top-5 flex h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[12px] text-muted transition hover:-translate-y-px hover:text-ink">
          <RotateCcw size={14} strokeWidth={1.5} /> Reset rotation
        </button>
        <p className="absolute bottom-5 right-5 text-[12px] text-muted">Hold the switch and turn your wrist to spin the model.</p>
      </section>
    </div>
  );
}

/** Orientation dial: roll as the horizon line, pitch as its offset, yaw as the compass tick. */
function Dial({ roll, pitch, yaw, live }: { roll: number; pitch: number; yaw?: number; live: boolean }) {
  const off = Math.max(-40, Math.min(40, pitch * 0.6));
  return (
    <div className="glass absolute bottom-5 left-5 rounded-[18px] border border-line p-3">
      <svg width="132" height="132" viewBox="-66 -66 132 132" role="img" aria-label={`Roll ${roll.toFixed(0)} degrees, pitch ${pitch.toFixed(0)} degrees${yaw !== undefined ? `, yaw ${yaw.toFixed(0)} degrees` : ""}`}>
        <defs>
          <clipPath id="dial">
            <circle r="54" />
          </clipPath>
        </defs>
        <circle r="58" fill="none" stroke="var(--color-line-strong)" />
        <g clipPath="url(#dial)" transform={`rotate(${-roll})`}>
          <rect x="-80" y={off} width="160" height="90" fill="rgb(124 92 255 / 0.22)" />
          <line x1="-80" x2="80" y1={off} y2={off} stroke="var(--color-copper)" strokeWidth="1.5" />
        </g>
        <line x1="-22" x2="22" y1="0" y2="0" stroke="var(--color-ink)" strokeWidth="2" />
        {yaw !== undefined && <circle cx={Math.sin(yaw * (Math.PI / 180)) * 58} cy={-Math.cos(yaw * (Math.PI / 180)) * 58} r="4" fill="var(--color-blue)" />}
      </svg>
      <p className={`mt-1 text-center font-mono text-[10px] ${live ? "text-ok" : "text-muted"}`}>
        {roll.toFixed(0)}° · {pitch.toFixed(0)}°{yaw !== undefined ? ` · ${yaw.toFixed(0)}°` : ""}
      </p>
    </div>
  );
}
