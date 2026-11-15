"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Template } from "@/lib/types";
import { onInput } from "@/lib/input/bus";

// Simulated ST7789 (240×240) running Snake, driven by the template's button mapping.
const PX = 240;
const CELLS = 20;
const CELL = PX / CELLS;
type Dir = "up" | "down" | "left" | "right";
const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

interface State {
  snake: [number, number][];
  dir: Dir;
  next: Dir;
  food: [number, number];
  score: number;
  over: boolean;
  running: boolean;
}

function freshState(): State {
  return { snake: [[10, 10], [9, 10], [8, 10]], dir: "right", next: "right", food: [15, 10], score: 0, over: false, running: false };
}

function placeFood(snake: [number, number][]): [number, number] {
  for (;;) {
    const f: [number, number] = [Math.floor(Math.random() * CELLS), Math.floor(Math.random() * CELLS)];
    if (!snake.some(([x, y]) => x === f[0] && y === f[1])) return f;
  }
}

export function SnakeGame({ template, onClose }: { template: Template; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<State>(freshState());
  const [hud, setHud] = useState({ score: 0, over: false, running: false, best: 0 });
  const [pressed, setPressed] = useState<string | null>(null);
  const buttons = template.game!.buttons;

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    ctx.fillStyle = "#0E1012";
    ctx.fillRect(0, 0, PX, PX);
    ctx.fillStyle = "#1A1D21";
    for (let i = 0; i < CELLS; i++) for (let j = 0; j < CELLS; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * CELL, j * CELL, CELL, CELL);
    ctx.fillStyle = "#E8C547";
    ctx.beginPath();
    ctx.arc(s.food[0] * CELL + CELL / 2, s.food[1] * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill();
    s.snake.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? "#5EE2A8" : "#0F9D6B";
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    });
    if (!s.running || s.over) {
      ctx.fillStyle = "rgba(14,16,18,0.72)";
      ctx.fillRect(0, 0, PX, PX);
      ctx.fillStyle = "#F5F2EC";
      ctx.textAlign = "center";
      ctx.font = "bold 22px ui-monospace, monospace";
      ctx.fillText(s.over ? "GAME OVER" : "SNAKE", PX / 2, PX / 2 - 8);
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(s.over ? `score ${s.score} · press A` : "press A to start", PX / 2, PX / 2 + 16);
    }
  }, []);

  const press = useCallback(
    (button: Dir | "a") => {
      const s = state.current;
      setPressed(button);
      setTimeout(() => setPressed(null), 120);
      if (button === "a") {
        if (s.over || !s.running) {
          const best = Math.max(hud.best, s.score);
          state.current = { ...freshState(), running: true };
          setHud({ score: 0, over: false, running: true, best });
        }
        return;
      }
      if (button !== OPP[s.dir]) s.next = button;
    },
    [hud.best],
  );

  // Game loop.
  useEffect(() => {
    draw();
    const id = setInterval(() => {
      const s = state.current;
      if (!s.running || s.over) return;
      s.dir = s.next;
      const [hx, hy] = s.snake[0];
      const [dx, dy] = VEC[s.dir];
      const head: [number, number] = [(hx + dx + CELLS) % CELLS, (hy + dy + CELLS) % CELLS];
      if (s.snake.some(([x, y]) => x === head[0] && y === head[1])) {
        s.over = true;
        setHud((h) => ({ ...h, over: true, best: Math.max(h.best, s.score) }));
      } else {
        s.snake.unshift(head);
        if (head[0] === s.food[0] && head[1] === s.food[1]) {
          s.score += 1;
          s.food = placeFood(s.snake);
          setHud((h) => ({ ...h, score: s.score }));
        } else s.snake.pop();
      }
      draw();
    }, 120);
    return () => clearInterval(id);
  }, [draw]);

  // Keyboard (arrows / WASD / Enter / Space) and the shared input bus (gestures, ring).
  useEffect(() => {
    const map: Record<string, Dir | "a"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", Enter: "a", " ": "a" };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const b = map[e.key];
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      press(b);
    };
    window.addEventListener("keydown", onKey, true);
    const offs = [
      onInput("prevPage", () => (press("left"), true)),
      onInput("nextPage", () => (press("right"), true)),
      onInput("select", () => (press("a"), true)),
      onInput("back", () => (onClose(), true)),
    ];
    return () => {
      window.removeEventListener("keydown", onKey, true);
      offs.forEach((f) => f());
    };
  }, [press, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid animate-fade place-items-center bg-ink/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Snake on the simulated ST7789 screen">
      <div className="relative flex items-center gap-10 rounded-[40px] bg-[#22252A] px-12 py-10 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
        <button type="button" onClick={onClose} aria-label="Close game" className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-[10px] text-paper/60 hover:bg-paper/10 hover:text-paper">
          <X size={16} strokeWidth={1.5} />
        </button>
        <div className="relative grid h-[120px] w-[120px] grid-cols-3 grid-rows-3 gap-1">
          <span />
          <PadButton press={press} pressed={pressed} buttons={buttons} b="up" label="▲" className="h-full w-full" />
          <span />
          <PadButton press={press} pressed={pressed} buttons={buttons} b="left" label="◀" className="h-full w-full" />
          <span />
          <PadButton press={press} pressed={pressed} buttons={buttons} b="right" label="▶" className="h-full w-full" />
          <span />
          <PadButton press={press} pressed={pressed} buttons={buttons} b="down" label="▼" className="h-full w-full" />
          <span />
        </div>
        <div className="flex flex-col items-center">
          <div className="rounded-[10px] border-[10px] border-[#0B0C0E] bg-black">
            <canvas ref={canvas} width={PX} height={PX} className="block h-[300px] w-[300px] [image-rendering:pixelated]" />
          </div>
          <p className="mt-3 font-mono text-[11px] text-paper/60">
            ST7789 240×240 · score {hud.score} · best {hud.best}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <PadButton press={press} pressed={pressed} buttons={buttons} b="a" label="A" className="h-16 w-16 text-[18px]" />
          <p className="max-w-[120px] text-center font-mono text-[10px] leading-snug text-paper/50">Arrows / WASD · Enter = A · swipe or ring to steer</p>
        </div>
      </div>
    </div>
  );
}

function PadButton(props: { b: Dir | "a"; label: string; className: string; press: (b: Dir | "a") => void; pressed: string | null; buttons: Record<string, string> }) {
  const { b, label, className, press, pressed, buttons } = props;
  return (
    <button
      type="button"
      aria-label={`${label} (${buttons[b]})`}
      onClick={() => press(b)}
      className={`grid place-items-center rounded-full border border-paper/20 text-[11px] text-paper/80 transition-colors ${pressed === b ? "bg-copper text-paper" : "bg-paper/10 hover:bg-paper/20"} ${className}`}
    >
      {label}
    </button>
  );
}
