"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { emitInput } from "@/lib/input/bus";
import { GestureRecognizer, type GestureEvent, type Hand } from "@/lib/input/gestures";
import { useUi } from "@/stores/ui";

// Webcam hand tracking with MediaPipe Tasks Vision. Loaded only when the user turns gestures on.
const MP_VERSION = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const CLICKABLE = "button, a[href], [role=tab], [role=radio], [role=switch], [data-pin], summary, label";

type Status = "starting" | "ready" | "no-hand" | "error";

export function GestureLayer() {
  const setUi = useUi((s) => s.set);
  const video = useRef<HTMLVideoElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: Hand["landmarks"][] }; close: () => void } | null = null;
    const rec = new GestureRecognizer({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () => rec.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);

    const flash = (text: string) => {
      setLast(text);
      window.setTimeout(() => setLast((l) => (l === text ? null : l)), 1100);
    };

    const handle = (e: GestureEvent) => {
      const r = ring.current;
      switch (e.type) {
        case "cursor":
          if (r) {
            r.style.opacity = "1";
            r.style.transform = `translate(${e.x - 16}px, ${e.y - 16}px)`;
          }
          if (fill.current) fill.current.style.transform = `scale(${e.progress})`;
          if (!e.pinching) {
            const el = document.elementFromPoint(e.x, e.y);
            el?.dispatchEvent(new PointerEvent("pointermove", { clientX: e.x, clientY: e.y, bubbles: true, pointerType: "mouse" }));
          }
          break;
        case "lost":
          if (r) r.style.opacity = "0";
          break;
        case "pinchStart": {
          const el = document.elementFromPoint(e.x, e.y) as HTMLElement | null;
          const target = el?.closest<HTMLElement>(CLICKABLE);
          if (target && !target.closest("[data-gesture-ui]")) {
            target.focus({ preventScroll: true });
            target.click();
          } else emitInput("select", "gesture");
          break;
        }
        case "swipe":
          flash(e.dir === "right" ? "Next page" : "Previous page");
          emitInput(e.dir === "right" ? "nextPage" : "prevPage", "gesture");
          break;
        case "explode":
          flash("Explode");
          emitInput("explode", "gesture");
          break;
        case "collapse":
          flash("Collapse");
          emitInput("collapse", "gesture");
          break;
        case "zoom":
          emitInput(e.factor < 1 ? "zoomIn" : "zoomOut", "gesture", e.factor);
          break;
        case "rotate":
          emitInput("rotate", "gesture", e.delta);
          break;
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        landmarker = (await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
        })) as unknown as typeof landmarker;
        if (stopped) return;
        setStatus("no-hand");
        let lastT = -1;
        const loop = () => {
          if (stopped || !landmarker) return;
          const now = performance.now();
          if (v.readyState >= 2 && v.currentTime !== lastT) {
            lastT = v.currentTime;
            const res = landmarker.detectForVideo(v, now);
            const hands: Hand[] = (res.landmarks ?? []).map((landmarks) => ({ landmarks }));
            setStatus(hands.length ? "ready" : "no-hand");
            for (const e of rec.update(hands, now)) handle(e);
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was denied." : "Hand tracking could not start on this device.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
  }, []);

  return (
    <>
      {/* Copper ring cursor: fills while a pinch is held. */}
      <div ref={ring} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[60] h-8 w-8 rounded-full border-2 border-copper opacity-0 transition-opacity" style={{ willChange: "transform" }}>
        <div ref={fill} className="absolute inset-1 origin-center rounded-full bg-copper/70" style={{ transform: "scale(0)" }} />
      </div>
      <div data-gesture-ui className="fixed bottom-16 right-4 z-40 w-[208px] animate-fade overflow-hidden rounded-[12px] border border-line bg-card shadow-[var(--shadow-float)]" role="status" aria-live="polite">
        <div className="relative">
          <video ref={video} muted playsInline className="h-[132px] w-full -scale-x-100 bg-ink object-cover" />
          {last && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] text-paper">{last}</span>}
          <button type="button" aria-label="Turn gestures off" onClick={() => setUi({ gestures: false })} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/60 text-paper hover:bg-ink">
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-3 py-2 text-[11px] leading-snug text-muted">
          {status === "starting" && "Starting the camera…"}
          {status === "no-hand" && "Show one hand to the camera."}
          {status === "ready" && (
            <span>
              <b className="font-medium text-ink">Pinch</b> select · <b className="font-medium text-ink">swipe</b> page · <b className="font-medium text-ink">spread</b> explode · <b className="font-medium text-ink">fist</b> collapse · two-hand pinch zoom
            </span>
          )}
          {status === "error" && <span className="text-bad">{error}</span>}
        </div>
      </div>
    </>
  );
}
