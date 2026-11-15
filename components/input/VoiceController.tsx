"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { categories } from "@/data/categories";
import { emitInput, type InputAction } from "@/lib/input/bus";

// Hold Space to speak a command (Web Speech API). The gesture ring's pinky pad sends Space, so this works
// hands-free. Commands: "open phones", "start from scratch", "explode", "collapse", "show checks",
// "export board", "next page", "previous page", "go home".

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type VoiceCommand = { kind: "action"; action: InputAction } | { kind: "go"; path: string } | null;

export function parseCommand(raw: string): VoiceCommand {
  const t = raw.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/scratch|blank|empty board/.test(t)) return { kind: "action", action: "startScratch" };
  if (/explode|expand|open up/.test(t)) return { kind: "action", action: "explode" };
  if (/collapse|close up|put back/.test(t)) return { kind: "action", action: "collapse" };
  if (/check/.test(t)) return { kind: "action", action: "showChecks" };
  if (/export|gerber|download/.test(t)) return { kind: "action", action: "exportBoard" };
  if (/next( page)?$|forward/.test(t)) return { kind: "action", action: "nextPage" };
  if (/previous|back/.test(t)) return { kind: "action", action: "prevPage" };
  if (/home/.test(t) && !/smart home/.test(t)) return { kind: "go", path: "/" };
  for (const c of categories) {
    if (c.kind !== "device") continue;
    // "Phones & Laptops" answers to "phones", "phone", "laptops"...; "Smart Home & IoT" to "smart home".
    const words = c.name.toLowerCase().split(/\s*&\s*/);
    const names = [...words, ...words.map((w) => w.replace(/s$/, "")), c.id.replace(/-/g, " ")];
    if (names.some((n) => t.includes(n))) return { kind: "go", path: `/devices/${c.id}` };
  }
  if (/device/.test(t)) return { kind: "go", path: "/devices" };
  if (/builder|canvas/.test(t)) return { kind: "go", path: "/builder" };
  if (/board|pcb/.test(t)) return { kind: "go", path: "/board" };
  if (/summary|share/.test(t)) return { kind: "go", path: "/summary" };
  return null;
}

export function VoiceController() {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const transcript = useRef("");

  useEffect(() => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

    const typing = (el: EventTarget | null) => {
      const h = el as HTMLElement | null;
      return !!h && (h.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(h.tagName));
    };

    const run = (said: string) => {
      const cmd = parseCommand(said);
      if (!cmd) {
        setResult(said ? `Not a command: “${said}”` : "Did not catch that");
      } else if (cmd.kind === "go") {
        setResult(`“${said}”`);
        router.push(cmd.path);
      } else {
        setResult(`“${said}”`);
        emitInput(cmd.action, "voice");
      }
      window.setTimeout(() => setResult(null), 1800);
    };

    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e.target) || e.metaKey || e.ctrlKey) return;
      if (document.querySelector("[aria-modal=true]")) return; // games and dialogs own Space
      e.preventDefault();
      if (!Ctor) {
        setResult("Voice commands need Chrome or Edge");
        window.setTimeout(() => setResult(null), 1800);
        return;
      }
      const r = new Ctor();
      r.lang = "en-US";
      r.interimResults = true;
      r.continuous = true;
      transcript.current = "";
      r.onresult = (ev) => {
        const all = Array.from(ev.results as ArrayLike<ArrayLike<{ transcript: string }>>).map((x) => x[0].transcript).join(" ");
        transcript.current = all;
        setText(all);
      };
      r.onerror = () => setListening(false);
      r.onend = () => {
        setListening(false);
        if (rec.current === r) {
          rec.current = null;
          run(transcript.current.trim());
        }
      };
      rec.current = r;
      setText("");
      setListening(true);
      try {
        r.start();
      } catch {
        setListening(false);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !rec.current) return;
      e.preventDefault();
      rec.current.stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [router]);

  if (!listening && !result) return null;
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 animate-fade items-center gap-2 rounded-full bg-copper px-4 py-2 text-[13px] text-white shadow-[var(--shadow-float)]" role="status" aria-live="polite">
      <Mic size={15} strokeWidth={1.5} className={listening ? "animate-pulse text-copper" : ""} />
      {listening ? text || "Listening… release Space when done" : result}
    </div>
  );
}
