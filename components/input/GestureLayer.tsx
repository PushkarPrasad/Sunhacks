"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { emitInput } from "@/lib/input/bus";
import { cameraVideo, latestHands, onGesture, stopCamera } from "@/lib/input/camera";
import { fireAction, logInputEvent, useInput } from "@/stores/input";
import { useUi } from "@/stores/ui";

// Ring cursor, pinch-to-click and the picture-in-picture camera preview. The tracking engine itself lives in
// lib/input/camera.ts and is started by the Settings toggle or by connecting the glove.
const CLICKABLE = "button, a[href], [role=tab], [role=radio], [role=switch], [data-pin], summary, label";
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const PIP_W = 200;
const PIP_H = 150;

export function GestureLayer() {
  const ring = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const camera = useInput((s) => s.camera);
  const notice = useInput((s) => s.cameraNotice);
  const pipOpen = useInput((s) => s.pipOpen);
  const pose = useInput((s) => s.cameraPose);
  const grabbing = useInput((s) => s.grabbing);
  const active = camera === "on" || camera === "starting";

  useEffect(() => {
    if (!active) return;
    return onGesture((e) => {
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
            logInputEvent("Pinch (click)", "camera");
          } else fireAction("select", "camera", "Pinch (select)");
          break;
        }
        case "zoom":
          emitInput(e.factor < 1 ? "zoomIn" : "zoomOut", "gesture", e.factor);
          break;
        case "rotate":
          emitInput("rotate", "gesture", e.delta);
          break;
      }
    });
  }, [active]);

  const close = () => {
    stopCamera();
    useUi.getState().set({ gestures: false });
  };

  return (
    <>
      {active && (
        <div ref={ring} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[60] h-8 w-8 rounded-full border-2 border-copper opacity-0 transition-opacity" style={{ willChange: "transform" }}>
          <div ref={fill} className="absolute inset-1 origin-center rounded-full bg-copper/70" style={{ transform: "scale(0)" }} />
        </div>
      )}
      {active && pipOpen && (
        <div data-gesture-ui className="glass fixed bottom-16 right-4 z-[55] overflow-hidden rounded-[14px] border border-line shadow-[var(--shadow-float)]" style={{ width: PIP_W }}>
          <Pip />
          <div className="flex items-center justify-between px-2.5 py-1.5 font-mono text-[10px] text-muted">
            <span>{camera === "starting" ? "Starting camera" : grabbing ? "Grabbing" : pose === "none" ? "No hand" : pose}</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => useInput.setState({ pipOpen: false })} className="rounded px-1 hover:text-ink" aria-label="Hide camera preview">
                Hide
              </button>
              <button type="button" onClick={close} className="grid h-4 w-4 place-items-center rounded hover:text-bad" aria-label="Turn the camera off">
                <X size={12} strokeWidth={1.75} />
              </button>
            </span>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="glass fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line px-4 py-1.5 text-[12px] text-warn">
          {notice}
          <button type="button" onClick={() => useInput.setState({ cameraNotice: null })} aria-label="Dismiss" className="text-muted hover:text-ink">
            <X size={12} strokeWidth={1.75} />
          </button>
        </p>
      )}
    </>
  );
}

/** Mirrored camera frame with the hand skeleton drawn on top. */
function Pip() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      const v = cameraVideo();
      if (c && ctx) {
        ctx.save();
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
        if (v && v.readyState >= 2) ctx.drawImage(v, 0, 0, c.width, c.height);
        else {
          ctx.fillStyle = "#12121C";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        for (const lm of latestHands().hands) {
          ctx.strokeStyle = "rgba(165,180,252,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (const [a, b] of BONES) {
            ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
            ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
          }
          ctx.stroke();
          ctx.fillStyle = "#7C5CFF";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * c.width, p.y * c.height, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvas} width={PIP_W * 2} height={PIP_H * 2} style={{ width: PIP_W, height: PIP_H }} className="block bg-raised" aria-label="Camera preview with hand landmarks" />;
}
