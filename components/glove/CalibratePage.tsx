"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Bluetooth, Check, RotateCcw, Usb } from "lucide-react";
import { calibrate, initialCal, PITCH_NEED, ROLL_NEED, TWIST_NEED, type CalState } from "@/lib/input/calibration";
import { connectGlove, reconnect, useGlove } from "@/lib/input/glove";
import { useInput } from "@/stores/input";

const GlovePreview = dynamic(() => import("./GlovePreview"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const STEPS = [
  { title: "Keep still", line: "Rest your hand on the table for 2 seconds. This sets the zero point." },
  { title: "Tilt to each side", line: `Roll left and right past ${ROLL_NEED}°, then tip forward and back past ${PITCH_NEED}°.` },
  { title: "Grab and twist", line: `Hold the switch or make a fist for the camera, then turn your wrist more than ${TWIST_NEED}°.` },
];

export function CalibratePage() {
  const g = useGlove();
  const o = useInput((s) => s.orientation);
  const grabbing = useInput((s) => s.grabbing);
  const [cal, setCal] = useState<CalState>(initialCal);
  const connected = g.status === "connected";

  // Every glove sample advances the wizard (subscription, so no render per sample is needed to drive it).
  useEffect(
    () =>
      useInput.subscribe((s, prev) => {
        if (!s.orientation || s.orientation === prev.orientation) return;
        const sample = { ...s.orientation, t: performance.now() };
        setCal((c) => calibrate(c, sample, s.grabbing));
      }),
    [],
  );

  const done = [cal.step > 0, cal.step > 1, cal.step > 2];
  const delta = (k: "roll" | "pitch") => (o && cal.baseline ? Math.round(o[k] - cal.baseline[k]) : null);

  return (
    <div className="mx-auto grid h-full max-w-[1240px] grid-cols-[1fr_380px] gap-10 px-12 py-8">
      <section className="flex min-h-0 flex-col">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">Calibrate</p>
        <h1 className="mt-3 font-serif text-[52px] leading-none">Tune the glove in three moves.</h1>

        {!connected && (
          <div className="mt-6 flex items-center gap-3 rounded-[16px] border border-line bg-card/70 p-4 text-[13px]">
            <span className="flex-1 text-muted">{g.status === "disconnected" ? "The glove dropped out." : "Connect the glove to start."}</span>
            {g.status === "disconnected" ? (
              <button type="button" onClick={() => void reconnect()} className="flex h-9 items-center gap-2 rounded-full bg-copper px-4 text-white hover:bg-copper-hover">
                Reconnect
              </button>
            ) : (
              <>
                <button type="button" onClick={() => void connectGlove("bluetooth")} className="flex h-9 items-center gap-2 rounded-full bg-copper px-4 text-white shadow-[var(--shadow-glow)] hover:bg-copper-hover">
                  <Bluetooth size={14} strokeWidth={1.75} /> Connect Bluetooth
                </button>
                <button type="button" onClick={() => void connectGlove("usb")} className="flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 hover:border-copper">
                  <Usb size={14} strokeWidth={1.5} /> USB
                </button>
              </>
            )}
          </div>
        )}

        <ol className="mt-6 space-y-3" aria-label="Calibration steps">
          {STEPS.map((st, i) => {
            const active = cal.step === i;
            return (
              <li
                key={st.title}
                data-step={i + 1}
                data-done={done[i]}
                className={`flex gap-4 rounded-[18px] border p-5 transition-colors duration-300 ${active ? "border-copper/60 bg-copper-soft" : done[i] ? "border-ok/40 bg-card/60" : "border-line bg-card/40 opacity-70"}`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-[13px] ${done[i] ? "border-ok bg-ok text-paper shadow-[0_0_14px_rgb(61_220_151/0.6)]" : active ? "border-copper text-ink" : "border-line-strong text-muted"}`}
                  aria-label={done[i] ? "Done" : `Step ${i + 1}`}
                >
                  {done[i] ? <Check size={18} strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[18px]">{st.title}</p>
                  <p className="mt-1 text-[13px] text-muted">{st.line}</p>
                  {i === 0 && active && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                      <div className="h-full rounded-full bg-copper transition-[width] duration-150" style={{ width: `${cal.stillProgress * 100}%` }} />
                    </div>
                  )}
                  {i === 1 && (active || done[1]) && (
                    <div className="mt-3 flex flex-wrap gap-2 font-mono text-[12px]">
                      {(
                        [
                          ["left", "Roll left"],
                          ["right", "Roll right"],
                          ["forward", "Tip forward"],
                          ["back", "Tip back"],
                        ] as const
                      ).map(([k, label]) => (
                        <span key={k} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${cal.tilt[k] ? "border-ok/60 text-ok" : "border-line text-muted"}`}>
                          {cal.tilt[k] && <Check size={12} strokeWidth={2.5} />} {label}
                        </span>
                      ))}
                    </div>
                  )}
                  {i === 2 && active && (
                    <p className="mt-3 font-mono text-[12px] text-muted">
                      {grabbing ? <span className="text-copper">Grabbing</span> : "Not grabbing"} · turned {Math.round(cal.twist)}° of {TWIST_NEED}°
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex items-center gap-4">
          {cal.step === 3 && <p className="text-[15px] text-ok">All three steps pass. The glove is ready.</p>}
          <button type="button" onClick={() => setCal(initialCal())} className="ml-auto flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-[13px] hover:border-copper">
            <RotateCcw size={14} strokeWidth={1.5} /> Start over
          </button>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <div className="h-[260px] overflow-hidden rounded-[20px] border border-line bg-card/50" aria-label="Glove orientation preview">
          <GlovePreview />
        </div>
        <dl className="grid grid-cols-3 gap-2 font-mono text-[12px]">
          {(["roll", "pitch", "yaw"] as const).map((k) => (
            <div key={k} className="rounded-[12px] border border-line bg-card/60 px-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="mt-0.5 text-[16px] tabular-nums" data-testid={`cal-${k}`}>
                {o ? `${o[k]}°` : "—"}
              </dd>
            </div>
          ))}
        </dl>
        {cal.baseline && (
          <p className="font-mono text-[12px] text-muted">
            From zero: roll {delta("roll")}° · pitch {delta("pitch")}°
          </p>
        )}
        <p className="text-[12px] text-muted">
          {connected ? `Connected over ${g.transport === "bluetooth" ? "Bluetooth" : "USB"}.` : "Waiting for the glove."} The board also calibrates its gyro at power-on, so keep it still for 2 s after switching it on.
        </p>
      </aside>
    </div>
  );
}
