"use client";

// Calibration wizard (P0-6). One stepper, six steps, an emerald check per step. Everything is saved through
// lib/input/handCal.ts (localStorage, wrapped in try/catch). This is the only page that can start the camera.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bluetooth, Check, RotateCcw, Usb } from "lucide-react";
import { angleDelta } from "@/lib/input/gloveProtocol";
import { connectGlove, reconnect, useGlove } from "@/lib/input/glove";
import { quatAngleDeg } from "@/lib/input/grab";
import { onHandFrame, startHandControl } from "@/lib/input/camera";
import { loadHandCal, resetHandCal, saveHandCal } from "@/lib/input/handCal";
import { mapRange } from "@/lib/input/openness";
import { fromLandmarks } from "@/lib/input/snap";
import { useInput } from "@/stores/input";
import { useModelPose } from "@/stores/modelPose";
import { Quaternion } from "three";

const PoseCube = dynamic(() => import("./PoseCube").then((m) => m.PoseCube), { ssr: false, loading: () => <div className="h-full w-full" /> });

const STEPS = ["Glove", "Grab", "Camera", "Openness", "Reach", "Click test"] as const;
type StepId = 0 | 1 | 2 | 3 | 4 | 5;

const Eyebrow = ({ children }: { children: React.ReactNode }) => <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">{children}</p>;

export function CalibratePage() {
  const [step, setStep] = useState<StepId>(0);
  const [done, setDone] = useState<boolean[]>([false, false, false, false, false, false]);
  const mark = (i: number) => setDone((d) => d.map((v, k) => (k === i ? true : v)));
  const next = () => setStep((s) => (Math.min(5, s + 1) as StepId));

  return (
    <div className="mx-auto grid h-full max-w-[1240px] grid-cols-[280px_1fr] gap-10 px-10 py-8">
      <aside className="flex min-h-0 flex-col">
        <Eyebrow>Calibrate</Eyebrow>
        <h1 className="mt-3 font-serif text-[44px] leading-none">Tune your hands</h1>
        <ol className="mt-8 space-y-1" aria-label="Calibration steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(i as StepId)}
                aria-current={i === step ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left text-[14px] transition ${i === step ? "border-line-strong bg-raised text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"}`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] ${done[i] ? "border-copper bg-copper text-paper" : "border-line-strong font-mono"}`} data-testid={`step-check-${i}`}>
                  {done[i] ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => {
            resetHandCal();
            setDone([false, false, false, false, false, false]);
            setStep(0);
          }}
          className="mt-auto flex h-9 items-center gap-2 self-start rounded-[10px] border border-line px-3 text-[12px] text-muted transition hover:border-line-strong hover:text-ink"
        >
          <RotateCcw size={13} strokeWidth={1.5} /> Reset calibration
        </button>
      </aside>

      <section className="flex min-h-0 flex-col rounded-[18px] border border-line bg-card/70 p-8" aria-label={STEPS[step]}>
        {step === 0 && <GloveStep onDone={() => mark(0)} onNext={next} />}
        {step === 1 && <GrabStep onDone={() => mark(1)} onNext={next} />}
        {step === 2 && <CameraStep onDone={() => mark(2)} onNext={next} />}
        {step === 3 && <OpennessStep onDone={() => mark(3)} onNext={next} />}
        {step === 4 && <ReachStep onDone={() => mark(4)} onNext={next} />}
        {step === 5 && <ClickStep onDone={() => mark(5)} />}
      </section>
    </div>
  );
}

function StepHeader({ n, title, line }: { n: number; title: string; line: string }) {
  return (
    <div>
      <Eyebrow>Step {n} of 6</Eyebrow>
      <h2 className="mt-2 font-serif text-[36px] leading-none">{title}</h2>
      <p className="mt-2 max-w-[560px] text-[14px] text-muted">{line}</p>
    </div>
  );
}

function NextButton({ ok, onNext, label = "Next step" }: { ok: boolean; onNext?: () => void; label?: string }) {
  if (!onNext) return null;
  return (
    <button data-magnetic type="button" disabled={!ok} onClick={onNext} className="mt-auto self-end rounded-[10px] bg-copper px-5 py-2.5 text-[13px] text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition hover:-translate-y-px hover:bg-copper-hover disabled:opacity-40">
      {label}
    </button>
  );
}

// ---------------- 1. Glove ----------------
const STILL_MS = 2000;
function GloveStep({ onDone, onNext }: { onDone: () => void; onNext: () => void }) {
  const status = useGlove((s) => s.status);
  const o = useInput((s) => s.orientation);
  const [flips, setFlips] = useState(() => loadHandCal().flips);
  const [phaseState, setPhase] = useState<"connect" | "still" | "tilt" | "twist" | "done">("connect");
  // Connecting moves straight on to "keep still" (derived, no extra state update).
  const phase = phaseState === "connect" && status === "connected" ? "still" : phaseState;
  const [stillPct, setStillPct] = useState(0);
  const [tilt, setTilt] = useState({ left: false, right: false, up: false, down: false });
  const [twist, setTwist] = useState(0);
  const base = useRef<{ roll: number; pitch: number; yaw: number } | null>(null);
  const window_ = useRef<{ roll: number; pitch: number; yaw: number; t: number }[]>([]);

  useEffect(() => {
    if (!o) return;
    const now = Date.now();
    if (phase === "still") {
      let w = [...window_.current, { ...o, t: now }].filter((x) => now - x.t <= STILL_MS);
      const span = (k: "roll" | "pitch" | "yaw") => Math.max(...w.map((x) => x[k])) - Math.min(...w.map((x) => x[k]));
      if (span("roll") > 3 || span("pitch") > 3 || span("yaw") > 3) w = [{ ...o, t: now }];
      window_.current = w;
      const covered = now - w[0].t;
      setStillPct(Math.min(1, covered / STILL_MS));
      if (covered >= STILL_MS * 0.95) {
        base.current = { roll: o.roll, pitch: o.pitch, yaw: o.yaw };
        setPhase("tilt");
      }
    } else if (phase === "tilt" && base.current) {
      const dr = angleDelta(base.current.roll, o.roll);
      const dp = angleDelta(base.current.pitch, o.pitch);
      setTilt((t) => {
        const n = { left: t.left || dr <= -30, right: t.right || dr >= 30, up: t.up || dp <= -25, down: t.down || dp >= 25 };
        if (n.left && n.right && n.up && n.down) {
          base.current = { roll: o.roll, pitch: o.pitch, yaw: o.yaw };
          setPhase("twist");
        }
        return n;
      });
    } else if (phase === "twist" && base.current) {
      const t = Math.abs(angleDelta(base.current.roll, o.roll));
      setTwist((x) => Math.max(x, t));
      if (t > 45) {
        setPhase("done");
        onDone();
      }
    }
  }, [o, phase, onDone]);

  const toggleFlip = (k: "roll" | "pitch" | "yaw") => {
    const f = { ...flips, [k]: !flips[k] };
    setFlips(f);
    saveHandCal({ flips: f });
  };

  return (
    <div className="flex h-full flex-col">
      <StepHeader n={1} title="Glove" line="Connect, keep still for two seconds, tilt to each side, then twist like turning a doorknob." />
      <div className="mt-6 grid flex-1 grid-cols-[1fr_300px] gap-8">
        <div className="space-y-4">
          {status !== "connected" ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => void (status === "disconnected" ? reconnect() : connectGlove("bluetooth"))} data-magnetic className="flex h-10 items-center gap-2 rounded-[10px] bg-copper px-4 text-[13px] text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition hover:bg-copper-hover">
                <Bluetooth size={15} strokeWidth={1.75} /> {status === "disconnected" ? "Reconnect" : "Connect Bluetooth"}
              </button>
              <button type="button" onClick={() => void connectGlove("usb")} className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong px-4 text-[13px] transition hover:border-copper">
                <Usb size={15} strokeWidth={1.5} /> USB
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-ok">Glove connected.</p>
          )}
          <Phase label="Keep still" active={phase === "still"} done={["tilt", "twist", "done"].includes(phase)} pct={phase === "still" ? stillPct : undefined}>
            The glove LED flashes once a second while it runs. If it stops flashing, the board hung: press its reset button.
          </Phase>
          <Phase label="Tilt left, right, up, down" active={phase === "tilt"} done={["twist", "done"].includes(phase)}>
            {(["left", "right", "up", "down"] as const).map((k) => (
              <span key={k} className={`mr-2 inline-flex rounded-[6px] border px-2 py-0.5 font-mono text-[11px] ${tilt[k] ? "border-copper text-ink" : "border-line text-muted"}`}>
                {k}
              </span>
            ))}
          </Phase>
          <Phase label="Twist like a doorknob" active={phase === "twist"} done={phase === "done"} pct={phase === "twist" ? Math.min(1, twist / 45) : undefined}>
            Turn your wrist at least 45°.
          </Phase>
        </div>
        <div className="rounded-[14px] border border-line bg-raised/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Live axes</p>
          {(["roll", "pitch", "yaw"] as const).map((k) => (
            <div key={k} className="mt-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="capitalize">{k}</span>
                <span className="font-mono text-muted">{o ? `${Math.round(o[k])}°` : "—"}</span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-line">
                <span className="absolute top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-copper" style={{ left: `${50 + ((o?.[k] ?? 0) / 180) * 50}%` }} />
              </div>
              <label className="mt-1 flex min-h-6 cursor-pointer items-center gap-2 text-[11px] text-muted hover:text-ink">
                <input type="checkbox" checked={flips[k]} onChange={() => toggleFlip(k)} className="h-4 w-4 accent-[var(--color-copper)]" /> Flip {k}
              </label>
            </div>
          ))}
        </div>
      </div>
      <NextButton ok={phase === "done"} onNext={onNext} />
    </div>
  );
}

function Phase({ label, active, done, pct, children }: { label: string; active: boolean; done: boolean; pct?: number; children: React.ReactNode }) {
  return (
    <div className={`rounded-[12px] border p-4 transition ${active ? "border-line-strong bg-raised/50" : "border-line"} ${!active && !done ? "opacity-60" : ""}`}>
      <p className="flex items-center gap-2 text-[14px]">
        <span className={`grid h-5 w-5 place-items-center rounded-full border ${done ? "border-copper bg-copper text-paper" : "border-line-strong"}`}>{done && <Check size={11} strokeWidth={2.5} />}</span>
        {label}
      </p>
      <div className="mt-2 text-[12px] text-muted">{children}</div>
      {pct !== undefined && (
        <div className="mt-3 h-1 rounded-full bg-line">
          <div className="h-1 rounded-full bg-copper transition-[width] duration-150" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </div>
  );
}

// ---------------- 2. Grab ----------------
function GrabStep({ onDone, onNext }: { onDone: () => void; onNext: () => void }) {
  const grabbed = useModelPose((s) => s.grabbed);
  const q = useModelPose((s) => s.q);
  const hasSwitch = useGlove((s) => s.hasSwitch);
  const turned = quatAngleDeg(new Quaternion(...q));
  const ok = turned > 30;
  useEffect(() => {
    if (ok) onDone();
  }, [ok, onDone]);
  return (
    <div className="flex h-full flex-col">
      <StepHeader n={2} title="Grab" line={hasSwitch ? "Hold the switch to grab, turn your wrist to spin the cube, release to let go." : "Knock once to grab, turn your wrist to spin the cube, knock again to let go. A switch, if wired, works too."} />
      <div className="relative mt-6 min-h-0 flex-1 overflow-hidden rounded-[14px] border border-line bg-raised/30">
        <PoseCube />
        <span className={`absolute left-4 top-4 rounded-[8px] border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${grabbed ? "border-copper text-ink" : "border-line text-muted"}`}>{grabbed ? "Grabbed" : "Released"}</span>
        <span className="absolute bottom-4 left-4 font-mono text-[12px] text-muted">Turned {Math.round(turned)}°</span>
      </div>
      <NextButton ok={ok} onNext={onNext} />
    </div>
  );
}

// ---------------- 3. Camera ----------------
function CameraStep({ onDone, onNext }: { onDone: () => void; onNext: () => void }) {
  const camera = useInput((s) => s.camera);
  const seen = useInput((s) => s.handSeen);
  const notice = useInput((s) => s.cameraNotice);
  useEffect(() => {
    if (camera === "on") onDone();
  }, [camera, onDone]);
  return (
    <div className="flex h-full flex-col">
      <StepHeader n={3} title="Camera" line="Hand control uses your webcam. Frames stay in this browser. It keeps running across pages, with no video on screen, until you switch it off in the top bar." />
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => void startHandControl()}
          disabled={camera === "on" || camera === "starting"}
          data-magnetic className="rounded-[10px] bg-copper px-5 py-2.5 text-[14px] text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_8px_24px_-12px_rgb(15_157_107/0.7)] transition hover:-translate-y-px hover:bg-copper-hover disabled:opacity-50"
        >
          {camera === "on" ? "Hand control on" : camera === "starting" ? "Starting…" : "Start hand control"}
        </button>
        <span className="text-[13px] text-muted" role="status">
          {camera === "on" ? (seen ? "Hand seen." : "Show one hand to the camera.") : notice ?? ""}
        </span>
      </div>
      <NextButton ok={camera === "on"} onNext={onNext} />
    </div>
  );
}

// ---------------- 4. Openness ----------------
const HOLD_MS = 1500;
function OpennessStep({ onDone, onNext }: { onDone: () => void; onNext: () => void }) {
  const raw = useInput((s) => s.opennessRaw);
  const camera = useInput((s) => s.camera);
  const [phase, setPhase] = useState<"fist" | "open" | "done">("fist");
  const [pct, setPct] = useState(0);
  const samples = useRef<{ v: number; t: number }[]>([]);
  const fistVal = useRef<number | null>(null);
  const [range, setRange] = useState(() => loadHandCal().openness);

  useEffect(() => {
    if (raw === null || phase === "done") return;
    const now = Date.now();
    // A pose counts while it stays inside a 0.08 band.
    let s = [...samples.current, { v: raw, t: now }];
    const vs = s.map((x) => x.v);
    if (Math.max(...vs) - Math.min(...vs) > 0.08) s = [{ v: raw, t: now }];
    const goodPose = phase === "fist" ? raw < 0.6 : raw > 0.6;
    if (!goodPose) s = [];
    samples.current = s;
    const covered = s.length ? now - s[0].t : 0;
    setPct(Math.min(1, covered / HOLD_MS));
    if (covered >= HOLD_MS) {
      const med = [...s.map((x) => x.v)].sort((a, b) => a - b)[Math.floor(s.length / 2)];
      samples.current = [];
      if (phase === "fist") {
        fistVal.current = med;
        setPhase("open");
        setPct(0);
      } else if (fistVal.current !== null) {
        const r = { fist: fistVal.current, open: med };
        saveHandCal({ openness: r });
        setRange(r);
        setPhase("done");
        onDone();
      }
    }
  }, [raw, phase, onDone]);

  const live = raw === null ? null : mapRange(raw, range);
  return (
    <div className="flex h-full flex-col">
      <StepHeader n={4} title="Openness" line="Hold a fist for a moment, then open your hand fully. Half-open will then mean half exploded." />
      {camera !== "on" && <p className="mt-6 text-[13px] text-warn">Start hand control in step 3 first.</p>}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {(["fist", "open"] as const).map((k) => (
          <Phase key={k} label={k === "fist" ? "Hold a fist" : "Open fully"} active={phase === k} done={k === "fist" ? phase !== "fist" : phase === "done"} pct={phase === k ? pct : undefined}>
            {k === "fist" ? "Curl all four fingers." : "Spread your fingers, palm to the camera."}
          </Phase>
        ))}
      </div>
      <div className="mt-6">
        <div className="flex justify-between font-mono text-[11px] text-muted">
          <span>Openness</span>
          <span data-testid="cal-openness">{live === null ? "—" : live.toFixed(2)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-line">
          <div className="h-2 rounded-full bg-ok transition-[width] duration-150" style={{ width: `${(live ?? 0) * 100}%` }} />
        </div>
      </div>
      <NextButton ok={phase === "done"} onNext={onNext} />
    </div>
  );
}

// ---------------- 5. Reach ----------------
const CORNERS = [
  { id: "tl", x: 0.06, y: 0.12, label: "Top left" },
  { id: "tr", x: 0.94, y: 0.12, label: "Top right" },
  { id: "br", x: 0.94, y: 0.9, label: "Bottom right" },
  { id: "bl", x: 0.06, y: 0.9, label: "Bottom left" },
];
function ReachStep({ onDone, onNext }: { onDone: () => void; onNext: () => void }) {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(0);
  const got = useRef<{ x: number; y: number }[]>([]);
  const win = useRef<{ x: number; y: number; t: number }[]>([]);
  const idx = useRef(0);

  useEffect(
    () =>
      onHandFrame((hands) => {
        if (idx.current >= 4) return;
        const lm = hands[0];
        if (!lm) {
          win.current = [];
          return;
        }
        const { source } = fromLandmarks(lm);
        const now = Date.now();
        let w = [...win.current, { ...source, t: now }];
        const xs = w.map((p) => p.x);
        const ys = w.map((p) => p.y);
        if (Math.max(...xs) - Math.min(...xs) > 0.03 || Math.max(...ys) - Math.min(...ys) > 0.03) w = [{ ...source, t: now }];
        win.current = w;
        const covered = now - w[0].t;
        setPct(Math.min(1, covered / 1000));
        if (covered >= 1000) {
          got.current[idx.current] = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
          idx.current++;
          win.current = [];
          setI(idx.current);
          setPct(0);
          if (idx.current === 4) {
            const g = got.current;
            const box = { x0: (g[0].x + g[3].x) / 2, x1: (g[1].x + g[2].x) / 2, y0: (g[0].y + g[1].y) / 2, y1: (g[2].y + g[3].y) / 2 };
            // Corner dots sit 6%/12% in from the edges; extend the box so the dots map where they are drawn.
            const ex = (box.x1 - box.x0) * (0.06 / 0.88);
            const ey = (box.y1 - box.y0) * (0.12 / 0.78);
            saveHandCal({ reach: { x0: box.x0 - ex, x1: box.x1 + ex, y0: box.y0 - ey, y1: box.y1 + ey } });
            onDone();
          }
        }
      }),
    [onDone],
  );

  return (
    <div className="relative flex h-full flex-col">
      <StepHeader n={5} title="Reach" line="Point at each dot with your hand where it is comfortable, and hold for about a second." />
      <div className="pointer-events-none fixed inset-0 z-40" data-snap-ignore>
        {CORNERS.map((c, k) => (
          <span key={c.id} className={`absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${k < i ? "border-copper bg-copper" : k === i ? "border-ok" : "border-line-strong"}`} style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}>
            {k === i && <span className="h-3 w-3 rounded-full bg-ok" style={{ transform: `scale(${0.4 + pct})` }} />}
          </span>
        ))}
      </div>
      <p className="mt-8 text-[14px]" role="status">
        {i < 4 ? `Point at the ${CORNERS[i].label.toLowerCase()} dot.` : "Reach saved."}
      </p>
      <NextButton ok={i >= 4} onNext={onNext} />
    </div>
  );
}

// ---------------- 6. Click test ----------------
const SPOTS = [
  [12, 30],
  [78, 26],
  [46, 52],
  [18, 74],
  [80, 72],
];
function ClickStep({ onDone }: { onDone: () => void }) {
  const [hit, setHit] = useState<boolean[]>([false, false, false, false, false]);
  const [attempts, setAttempts] = useState(0);
  const hits = hit.filter(Boolean).length;
  // Every pinch counts as an attempt (clicks on targets and misses alike).
  useEffect(
    () =>
      useInput.subscribe((s, prev) => {
        const e = s.events[0];
        if (e && e !== prev.events[0] && e.label.startsWith("Pinch")) setAttempts((a) => a + 1);
      }),
    [],
  );
  useEffect(() => {
    if (hits === 5) onDone();
  }, [hits, onDone]);
  return (
    <div className="flex h-full flex-col">
      <StepHeader n={6} title="Click test" line="Pinch each target. A near miss still lands: the pointer snaps to the closest button." />
      <div className="relative mt-6 min-h-0 flex-1 rounded-[14px] border border-line bg-raised/30" data-testid="click-area">
        {SPOTS.map(([x, y], k) => (
          <button
            key={k}
            type="button"
            data-testid={`click-target-${k}`}
            onClick={() => setHit((h) => h.map((v, j) => (j === k ? true : v)))}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[10px] border px-4 py-2 text-[12px] transition ${hit[k] ? "border-copper bg-copper text-paper" : "border-line-strong hover:border-copper"}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {hit[k] ? "Hit" : `Target ${k + 1}`}
          </button>
        ))}
      </div>
      <p className="mt-4 font-mono text-[13px]" data-testid="click-rate">
        {hits} / 5 targets · {attempts ? `${Math.round((hits / attempts) * 100)}% hit rate (${attempts} pinches)` : "no pinches yet"}
      </p>
    </div>
  );
}
