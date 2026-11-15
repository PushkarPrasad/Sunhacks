"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Cpu, Hand, Layers, PencilRuler, ScanSearch, Spline, Workflow, type LucideIcon } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { onInput } from "@/lib/input/bus";
import { useBuild } from "@/stores/build";
import type { HandGesture } from "./HandRig";
import { useInput } from "@/stores/input";

const HeroModel = dynamic(() => import("./HeroModel"), { ssr: false, loading: () => <div className="h-full w-full" /> });
const HandRig = dynamic(() => import("./HandRig"), { ssr: false, loading: () => <div className="h-full w-full" /> });

const SLIDES = ["Hero", "Problem", "How it works", "Hands-on", "Start"] as const;

export function Home() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const go = (n: number) => {
    setDir(n > i ? 1 : -1);
    setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  };

  // Arrow keys, page arrows and hand swipes move between slides first, then between pages.
  useEffect(() => {
    const offs = [
      onInput("nextPage", () => {
        if (i >= SLIDES.length - 1) return false;
        go(i + 1);
        return true;
      }),
      onInput("prevPage", () => {
        if (i <= 0) return false;
        go(i - 1);
        return true;
      }),
    ];
    return () => offs.forEach((f) => f());
  });

  const reduce = useReducedMotion();
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60 }),
  };

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={i}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 220, damping: 30 }}
          className="absolute inset-0"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${SLIDES.length}: ${SLIDES[i]}`}
        >
          {i === 0 && <HeroSlide onNext={() => go(1)} />}
          {i === 1 && <ProblemSlide />}
          {i === 2 && <HowSlide />}
          {i === 3 && <HandsSlide />}
          {i === 4 && <StartSlide />}
        </motion.section>
      </AnimatePresence>

      {/* Slide controls */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-4">
        <button type="button" aria-label="Previous slide" disabled={i === 0} onClick={() => go(i - 1)} className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition hover:-translate-y-px hover:border-copper hover:text-ink disabled:opacity-30">
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
          {SLIDES.map((s, k) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={s}
              onClick={() => go(k)}
              className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-7 bg-copper" : "w-1.5 bg-line-strong hover:bg-muted"}`}
            />
          ))}
        </div>
        <button type="button" aria-label="Next slide" disabled={i === SLIDES.length - 1} onClick={() => go(i + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted transition hover:-translate-y-px hover:border-copper hover:text-ink disabled:opacity-30">
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

const wrap = "mx-auto h-full max-w-[1240px] px-12";

function Rise({ children, d = 0, className = "" }: { children: React.ReactNode; d?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + d * 0.08, type: "spring", stiffness: 200, damping: 26 }} className={className}>
      {children}
    </motion.div>
  );
}

function HeroSlide({ onNext }: { onNext: () => void }) {
  const router = useRouter();
  return (
    <div className={`${wrap} grid grid-cols-[1fr_1.15fr] items-center gap-8`}>
      <div className="relative z-10">
        <Rise>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">Hardware, opened up</p>
        </Rise>
        <Rise d={1}>
          <h1 className="mt-5 font-serif text-[104px] leading-[0.9] tracking-[-0.02em]">
            Magic
            <br />
            <span className="italic text-copper">Smoke</span>
          </h1>
        </Rise>
        <Rise d={2}>
          <p className="mt-6 text-[22px] leading-snug text-ink">{BRAND.tagline}</p>
          <p className="mt-2 max-w-[460px] text-[15px] text-muted">69 real modules, checked as you wire, a PCB in one click.</p>
        </Rise>
        <Rise d={3} className="mt-9 flex items-center gap-5">
          <button type="button" onClick={() => router.push("/devices")} className="flex h-12 items-center gap-2 rounded-full bg-copper px-6 text-[14px] text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:bg-copper-hover active:translate-y-0">
            Open a device <ArrowRight size={16} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={onNext} className="text-[14px] text-muted underline decoration-line-strong underline-offset-[6px] transition hover:text-ink hover:decoration-copper">
            See how it works
          </button>
        </Rise>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }} className="relative h-[78%]">
        <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgb(124_92_255/0.35),rgb(61_123_255/0.12)_45%,transparent_70%)] blur-2xl" aria-hidden="true" />
        <HeroModel />
      </motion.div>
    </div>
  );
}

function ProblemSlide() {
  const qs = ["Which parts do I need?", "How do they connect?", "Will it actually work?", "How does it become a PCB?"];
  return (
    <div className={`${wrap} flex flex-col justify-center`}>
      <Rise>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">The problem</p>
      </Rise>
      <Rise d={1}>
        <h2 className="mt-5 max-w-[920px] font-serif text-[72px] leading-[0.98] tracking-[-0.015em]">
          Every build starts with the same four questions.
        </h2>
      </Rise>
      <div className="mt-12 grid grid-cols-4 gap-4">
        {qs.map((q, k) => (
          <Rise key={q} d={2 + k}>
            <div className="h-full rounded-[14px] border border-line bg-card/70 p-5">
              <p className="font-mono text-[12px] text-copper">0{k + 1}</p>
              <p className="mt-3 text-[18px] leading-snug">{q}</p>
            </div>
          </Rise>
        ))}
      </div>
      <Rise d={6}>
        <p className="mt-10 max-w-[620px] text-[16px] text-muted">The answers are scattered across datasheets, forum threads and senior teammates. The devices we use every day stay sealed.</p>
      </Rise>
    </div>
  );
}

const STEPS: { icon: LucideIcon; title: string; line: string; art: "explode" | "wire" | "check" | "board" }[] = [
  { icon: ScanSearch, title: "Explore", line: "Open a real device and see every part.", art: "explode" },
  { icon: Spline, title: "Build", line: "Place real modules and wire pin to pin.", art: "wire" },
  { icon: Workflow, title: "Check", line: "Power, voltage, pins and cost, live.", art: "check" },
  { icon: Cpu, title: "Board", line: "Schematic, routed PCB and factory files.", art: "board" },
];

function HowSlide() {
  return (
    <div className={`${wrap} flex flex-col justify-center`}>
      <Rise>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">How it works</p>
        <h2 className="mt-4 font-serif text-[60px] leading-none">Explore. Build. Check. Board.</h2>
      </Rise>
      <div className="mt-12 grid grid-cols-4 gap-5">
        {STEPS.map((s, k) => (
          <Rise key={s.title} d={1 + k}>
            <div className="group h-full rounded-[16px] border border-line bg-card/70 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-copper/60">
              <div className="h-[150px] overflow-hidden rounded-[10px] border border-line bg-paper/80">
                <StepArt kind={s.art} />
              </div>
              <div className="mt-5 flex items-center gap-2">
                <s.icon size={17} strokeWidth={1.5} className="text-copper" />
                <p className="text-[18px] font-medium">{s.title}</p>
                <span className="ml-auto font-mono text-[11px] text-muted">0{k + 1}</span>
              </div>
              <p className="mt-2 text-[14px] leading-snug text-muted">{s.line}</p>
            </div>
          </Rise>
        ))}
      </div>
    </div>
  );
}

/** Small looping diagram per step (3 s cycles). */
function StepArt({ kind }: { kind: "explode" | "wire" | "check" | "board" }) {
  const loop = { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };
  if (kind === "explode")
    return (
      <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
        {[0, 1, 2, 3].map((l) => (
          <motion.path
            key={l}
            d="M40 90 L100 66 L160 90 L100 114 Z"
            fill={["#1A1A2A", "#2A2148", "#141A33", "#1F1F33"][l]}
            stroke={l === 2 ? "#7C5CFF" : "#3B3B55"}
            strokeWidth="1.2"
            animate={{ y: [0, (l - 1.5) * -18, 0] }}
            transition={{ ...loop, delay: l * 0.05 }}
          />
        ))}
      </svg>
    );
  if (kind === "wire")
    return (
      <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
        <rect x="24" y="40" width="48" height="70" rx="6" fill="#1A1A2A" stroke="#3B3B55" />
        <rect x="128" y="34" width="48" height="34" rx="6" fill="#1A1A2A" stroke="#3B3B55" />
        <rect x="128" y="84" width="48" height="34" rx="6" fill="#1A1A2A" stroke="#3B3B55" />
        {[
          "M72 56 C100 56 100 50 128 50",
          "M72 72 C100 72 100 100 128 100",
          "M72 92 C102 92 98 110 128 110",
        ].map((d, k) => (
          <motion.path key={d} d={d} fill="none" stroke={k === 2 ? "#3D7BFF" : "#7C5CFF"} strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1] }} transition={{ ...loop, delay: k * 0.35 }} />
        ))}
      </svg>
    );
  if (kind === "check")
    return (
      <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => {
            const fail = r === 1 && c === 0;
            return (
              <g key={`${r}${c}`}>
                <rect x={30 + c * 74} y={22 + r * 38} width="66" height="30" rx="6" fill="#1A1A2A" stroke="#2A2A3D" />
                <motion.circle cx={44 + c * 74} cy={37 + r * 38} r="4" fill={fail ? "#FF6B6B" : "#3DDC97"} animate={{ opacity: fail ? [1, 0.25, 1] : [0.4, 1, 0.4] }} transition={{ ...loop, delay: (r + c) * 0.2 }} />
                <rect x={54 + c * 74} y={33 + r * 38} width="30" height="7" rx="3" fill="#3B3B55" />
              </g>
            );
          }),
        )}
      </svg>
    );
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
      <rect x="36" y="22" width="128" height="106" rx="6" fill="#0E0E16" stroke="#3B3B55" />
      {[[46, 32], [154, 32], [46, 118], [154, 118]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="#2A2A3D" />
      ))}
      <rect x="62" y="44" width="32" height="44" rx="2" fill="#1A1A2A" stroke="#A5B4FC" strokeOpacity=".4" />
      <motion.path d="M94 56 H126 V96 H142 M94 76 H112 V110 H70 V88" fill="none" stroke="#C9773C" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1] }} transition={loop} />
      {[126, 142, 112, 70].map((x, k) => (
        <circle key={k} cx={x} cy={[56, 96, 110, 88][k]} r="3" fill="#C9773C" />
      ))}
    </svg>
  );
}

const POSES: { name: string; does: string; g: HandGesture }[] = [
  { name: "Pinch", does: "select", g: "pinch" },
  { name: "Spread", does: "explode", g: "spread" },
  { name: "Fist", does: "collapse", g: "fist" },
  { name: "Swipe", does: "next page", g: "swipe" },
  { name: "Grab + twist", does: "rotate (glove)", g: "twist" },
];

function HandsSlide() {
  const [k, setK] = useState(0);
  const live = useInput((s) => s.camera === "on" && s.handSeen);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setK((x) => (x + 1) % POSES.length), 3000);
    return () => clearInterval(id);
  }, [tick]);
  const play = (n: number) => {
    setK(n);
    setTick((t) => t + 1); // restart the 3 s cycle from the clicked row
  };
  return (
    <div className={`${wrap} grid grid-cols-[1fr_1fr] items-center gap-12`}>
      <div>
        <Rise>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">Hands-on</p>
          <h2 className="mt-4 font-serif text-[64px] leading-[0.98]">Drive it with your hands.</h2>
          <p className="mt-5 max-w-[440px] text-[16px] text-muted">A webcam tracks your hand pose. A glove with a motion sensor and an optional switch lets you grab a model and turn it like a globe.</p>
        </Rise>
        <ul className="mt-9 space-y-2" aria-label="Gestures">
          {POSES.map((p, n) => (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => play(n)}
                aria-pressed={n === k}
                className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-2.5 text-left text-[14px] transition-colors duration-500 hover:border-copper/60 ${n === k ? "border-copper/60 bg-copper-soft" : "border-line"}`}
              >
                <span>{p.name}</span>
                <span className="font-mono text-[12px] text-muted">{p.does}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Rise d={2} className="relative h-[440px] overflow-hidden rounded-[20px] border border-line bg-card/50">
        <div className="absolute inset-10 rounded-full bg-[radial-gradient(circle,rgb(61_123_255/0.22),transparent_65%)] blur-2xl" aria-hidden="true" />
        <div className="absolute inset-0" aria-label={`3D hand showing the ${POSES[k].name.toLowerCase()} gesture`} role="img">
          <HandRig gesture={POSES[k].g} startedAt={tick} />
        </div>
        <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-[12px] backdrop-blur">
          <Hand size={14} strokeWidth={1.5} className="text-ok" /> {live ? "Your hand, live" : POSES[k].name}
        </div>
      </Rise>
    </div>
  );
}

function StartSlide() {
  const router = useRouter();
  const newBuild = useBuild((s) => s.newBuild);
  const cards: { icon: LucideIcon; title: string; line: string; go: () => void; primary?: boolean }[] = [
    { icon: Layers, title: "Start From a Device", line: "Open a phone, drone or robot and build your own version.", go: () => router.push("/devices"), primary: true },
    {
      icon: PencilRuler,
      title: "Start From Scratch",
      line: "An empty board and a drawer of real modules.",
      go: () => {
        newBuild();
        router.push("/builder");
      },
    },
  ];
  return (
    <div className={`${wrap} flex flex-col justify-center`}>
      <Rise>
        <h2 className="text-center font-serif text-[64px] leading-none">Where do you want to begin?</h2>
      </Rise>
      <div className="mx-auto mt-12 grid w-full max-w-[980px] grid-cols-2 gap-6">
        {cards.map((c, k) => (
          <Rise key={c.title} d={1 + k}>
            <button
              type="button"
              onClick={c.go}
              className={`group flex h-[260px] w-full flex-col justify-between rounded-[20px] border p-8 text-left transition duration-300 hover:-translate-y-1 ${c.primary ? "border-copper/60 bg-[linear-gradient(135deg,rgb(124_92_255/0.28),rgb(61_123_255/0.12))] hover:shadow-[var(--shadow-glow)]" : "border-line bg-card/70 hover:border-copper/60"}`}
            >
              <span className={`grid h-12 w-12 place-items-center rounded-full ${c.primary ? "bg-copper text-white" : "border border-line-strong"}`}>
                <c.icon size={22} strokeWidth={1.5} />
              </span>
              <span>
                <span className="block font-serif text-[40px] leading-none">{c.title}</span>
                <span className="mt-3 flex items-center justify-between text-[15px] text-muted">
                  {c.line}
                  <ArrowRight size={20} strokeWidth={1.5} className="text-ink transition-transform group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </Rise>
        ))}
      </div>
    </div>
  );
}
