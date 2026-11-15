"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { partsById } from "@/data/parts";
import type { Build } from "@/lib/types";
import { useBuild } from "@/stores/build";

// "Hoop Upload": drop a file, it becomes a ball, throw it through the hoop with the mouse or trackpad to import.
// Small 2D physics loop: gravity, wall and backboard bounces, two rim points, swish detection. No gestures.

const W = 560;
const H = 300;
const R = 17;
const GRAVITY = 1500;
const FLOOR = H - 14;
const REST = { x: 86, y: FLOOR - R };
const BOARD = { x: 482, top: 46, bottom: 136 };
const RIM = { front: 404, back: 470, y: 118 };

type Ball = { x: number; y: number; vx: number; vy: number; held: boolean; flying: boolean };

export function parseBuildFile(text: string): Build | null {
  try {
    const b = JSON.parse(text) as Build;
    if (!Array.isArray(b.instances) || !Array.isArray(b.wires)) return null;
    if (!b.instances.every((i) => partsById[i.partId] && typeof i.id === "string")) return null;
    return { ...b, id: `import_${Date.now().toString(36)}`, dismissed: b.dismissed ?? [], name: b.name || "Imported build" };
  } catch {
    return null;
  }
}

export function HoopUpload({ onClose }: { onClose: () => void }) {
  const loadBuild = useBuild((s) => s.loadBuild);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ball = useRef<Ball>({ ...REST, vx: 0, vy: 0, held: false, flying: false });
  const file = useRef<File | null>(null);
  const samples = useRef<{ x: number; y: number; t: number }[]>([]);
  const swish = useRef(0);
  const restSince = useRef(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  const importFile = useCallback(
    async (f: File) => {
      const text = await f.text();
      if (/\.kicad_(pcb|sch)$/i.test(f.name)) {
        setCount((c) => c + 1);
        setMessage(`${f.name} received. KiCad import is not supported yet, so the build is unchanged.`);
        return;
      }
      const b = parseBuildFile(text);
      if (!b) {
        setMessage(`${f.name} is not a Magic Smoke build file.`);
        return;
      }
      loadBuild(b);
      setCount((c) => c + 1);
      setMessage(`Imported “${b.name}”: ${b.instances.length} modules, ${b.wires.length} wires.`);
    },
    [loadBuild],
  );

  const take = (f: File | undefined) => {
    if (!f) return;
    file.current = f;
    setFileName(f.name);
    setMessage(null);
    ball.current = { ...REST, vx: 0, vy: 0, held: false, flying: false };
  };

  // Physics + drawing loop.
  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    g.scale(dpr, dpr);
    let raf = 0;
    let last = performance.now();

    const rimHit = (b: Ball, px: number, py: number) => {
      const dx = b.x - px;
      const dy = b.y - py;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0) {
        const nx = dx / d;
        const ny = dy / d;
        b.x = px + nx * R;
        b.y = py + ny * R;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 1.6 * vn * nx;
          b.vy -= 1.6 * vn * ny;
        }
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const b = ball.current;
      if (file.current && b.flying && !b.held) {
        const prevY = b.y;
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // walls, floor, ceiling
        if (b.x < R) {
          b.x = R;
          b.vx = Math.abs(b.vx) * 0.6;
        }
        if (b.x > W - R) {
          b.x = W - R;
          b.vx = -Math.abs(b.vx) * 0.6;
        }
        if (b.y > FLOOR - R) {
          b.y = FLOOR - R;
          b.vy = -Math.abs(b.vy) * 0.5;
          b.vx *= 0.82;
        }
        // backboard (front face)
        if (b.y > BOARD.top - R && b.y < BOARD.bottom + R && b.x + R > BOARD.x && b.x < BOARD.x + 8) {
          b.x = BOARD.x - R;
          b.vx = -Math.abs(b.vx) * 0.65;
        }
        rimHit(b, RIM.front, RIM.y);
        rimHit(b, RIM.back, RIM.y);
        // swish: centre passes the rim line going down, between the rim points
        if (prevY < RIM.y && b.y >= RIM.y && b.vy > 0 && b.x > RIM.front + 6 && b.x < RIM.back - 6) {
          swish.current = now;
          b.vx *= 0.3;
          const f = file.current;
          file.current = null;
          setFileName(null);
          setCelebrate((x) => x + 1);
          if (f) void importFile(f);
        }
        // at rest on the floor: a miss, roll back for another try
        if (b.y >= FLOOR - R - 0.5 && Math.abs(b.vy) < 60 && Math.abs(b.vx) < 40) {
          if (!restSince.current) restSince.current = now;
          if (now - restSince.current > 600) {
            ball.current = { ...REST, vx: 0, vy: 0, held: false, flying: false };
            restSince.current = 0;
          }
        } else restSince.current = 0;
      }
      draw(g, ball.current, !!file.current, now - swish.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [importFile]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-paper/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Upload files">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} className="relative w-[620px] rounded-[20px] border border-line bg-card p-7 shadow-[var(--shadow-float)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[22px] font-medium">Upload files</p>
            <p className="mt-1 text-[14px] text-muted">Drag and drop, or take the shot</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.span key={count} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="rounded-full border border-ok/40 bg-ok/10 px-3 py-1 font-mono text-[12px] text-ok">
              Uploaded {count}
            </motion.span>
            <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[10px] text-muted hover:bg-raised hover:text-ink">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files[0]);
          }}
          className={`mt-5 flex h-[76px] cursor-pointer items-center justify-center rounded-[14px] border-2 border-dashed text-[13px] transition ${over ? "border-copper bg-copper-soft text-ink" : "border-line-strong text-muted hover:border-copper/60"}`}
        >
          {fileName ? (
            <span>
              <span className="text-ink">{fileName}</span> is ready. Throw the ball through the hoop.
            </span>
          ) : (
            "Drop a build .json or a KiCad file here, or click to choose one"
          )}
          <input ref={input} type="file" accept=".json,.kicad_pcb,.kicad_sch" className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
        </label>

        <div className="relative mt-4 overflow-hidden rounded-[14px] border border-line bg-paper">
          <canvas
            ref={canvas}
            className={`block h-[300px] w-full touch-none ${fileName ? "cursor-grab active:cursor-grabbing" : ""}`}
            aria-label="Hoop. Press on the ball, drag and release to throw."
            onPointerDown={(e) => {
              if (!file.current) return;
              const p = local(e);
              const b = ball.current;
              if (Math.hypot(p.x - b.x, p.y - b.y) > R * 1.8) return;
              b.held = true;
              b.flying = false;
              samples.current = [{ ...p, t: performance.now() }];
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // synthetic or already-released pointer: dragging still works inside the canvas
              }
            }}
            onPointerMove={(e) => {
              const b = ball.current;
              if (!b.held) return;
              const p = local(e);
              b.x = Math.max(R, Math.min(W * 0.6, p.x));
              b.y = Math.max(R, Math.min(FLOOR - R, p.y));
              samples.current = [...samples.current.slice(-5), { x: b.x, y: b.y, t: performance.now() }];
            }}
            onPointerUp={() => {
              const b = ball.current;
              if (!b.held) return;
              const s = samples.current;
              const a = s[0];
              const z = s[s.length - 1];
              const dt = Math.max(0.016, (z.t - a.t) / 1000);
              b.vx = Math.max(-1600, Math.min(1600, (z.x - a.x) / dt));
              b.vy = Math.max(-1600, Math.min(1600, (z.y - a.y) / dt));
              b.held = false;
              b.flying = true;
            }}
          />
          <AnimatePresence>
            {celebrate > 0 && (
              <motion.div key={celebrate} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.4, delay: 0.4 }}>
                {Array.from({ length: 14 }, (_, k) => (
                  <motion.span
                    key={k}
                    className="absolute h-2 w-2 rounded-full"
                    style={{ left: (RIM.front + RIM.back) / 2 / (W / 100) + "%", top: (RIM.y / H) * 100 + "%", background: ["#0F9D6B", "#0A6B49", "#5EE2A8", "#E8B04B"][k % 4] }}
                    initial={{ x: 0, y: 0, scale: 1 }}
                    animate={{ x: Math.cos((k / 14) * Math.PI * 2) * 90, y: Math.sin((k / 14) * Math.PI * 2) * 60 - 20, scale: 0.4 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 text-[12px]">
          <p className="min-h-4 text-muted" role="status">
            {message}
          </p>
          <button
            type="button"
            onClick={() => {
              const f = file.current;
              if (f) {
                file.current = null;
                setFileName(null);
                void importFile(f);
              } else input.current?.click();
            }}
            className="shrink-0 text-muted underline underline-offset-4 hover:text-ink"
          >
            Just upload it
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function draw(g: CanvasRenderingContext2D, b: Ball, hasFile: boolean, sinceSwish: number) {
  g.clearRect(0, 0, W, H);
  // court floor
  g.strokeStyle = "#1F3A2F";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, FLOOR + 0.5);
  g.lineTo(W, FLOOR + 0.5);
  g.stroke();
  // pole + backboard
  g.fillStyle = "#2C5243";
  g.fillRect(BOARD.x + 30, BOARD.top + 30, 6, FLOOR - BOARD.top - 30);
  g.fillRect(BOARD.x + 6, BOARD.top + 46, 28, 5);
  g.fillStyle = "rgba(200,169,106,0.12)";
  g.strokeStyle = "#C8A96A";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(BOARD.x, BOARD.top - 10, 8, BOARD.bottom - BOARD.top + 20, 2);
  g.fill();
  g.stroke();
  // net (sways after a swish)
  const sway = sinceSwish < 700 ? Math.sin(sinceSwish / 40) * (1 - sinceSwish / 700) * 6 : 0;
  g.strokeStyle = "rgba(236,234,245,0.55)";
  g.lineWidth = 1.2;
  for (let k = 0; k <= 5; k++) {
    const x0 = RIM.front + ((RIM.back - RIM.front) * k) / 5;
    const x1 = RIM.front + 10 + ((RIM.back - RIM.front - 20) * k) / 5 + sway;
    g.beginPath();
    g.moveTo(x0, RIM.y);
    g.lineTo(x1, RIM.y + 46);
    g.stroke();
  }
  for (let r = 1; r <= 3; r++) {
    const y = RIM.y + r * 14;
    const inset = r * 3.3;
    g.beginPath();
    g.moveTo(RIM.front + inset + sway * (r / 3), y);
    g.lineTo(RIM.back - inset + sway * (r / 3), y);
    g.stroke();
  }
  // rim
  g.strokeStyle = "#0F9D6B";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(RIM.front, RIM.y);
  g.lineTo(RIM.back + 12, RIM.y);
  g.stroke();
  // ball: a basketball wearing a file icon
  if (!hasFile && !b.flying) {
    g.fillStyle = "rgba(163,161,184,0.45)";
    g.font = "13px sans-serif";
    g.fillText("Drop a file to get a ball", REST.x - 50, REST.y - 30);
    return;
  }
  g.save();
  g.translate(b.x, b.y);
  g.rotate(b.x / 30);
  g.fillStyle = "#F08A3C";
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(40,20,10,0.6)";
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.moveTo(-R, 0);
  g.lineTo(R, 0);
  g.moveTo(0, -R);
  g.lineTo(0, R);
  g.stroke();
  g.restore();
  // file glyph
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(b.x - 6, b.y - 8);
  g.lineTo(b.x + 3, b.y - 8);
  g.lineTo(b.x + 7, b.y - 4);
  g.lineTo(b.x + 7, b.y + 8);
  g.lineTo(b.x - 6, b.y + 8);
  g.closePath();
  g.fill();
}
