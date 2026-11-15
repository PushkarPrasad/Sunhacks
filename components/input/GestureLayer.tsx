"use client";

// Hand pointer UI (P0-4): snap-to-target cursor and pinch-to-click. No camera preview anywhere (P0-5); the tracker
// itself is the singleton in lib/input/camera.ts, started only from the Calibration tab.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { emitInput } from "@/lib/input/bus";
import { onGesture, onHandFrame } from "@/lib/input/camera";
import { loadHandCal, onHandCal } from "@/lib/input/handCal";
import { fromLandmarks, SnapPointer, type Target } from "@/lib/input/snap";
import { fireAction, logInputEvent, useInput } from "@/stores/input";

const TARGETS = "[data-snap], a[href], button:not([disabled]), [role=button], [role=tab], [role=radio], [role=switch], input[type=range], summary";

interface CursorState {
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
  pinching: boolean;
  visible: boolean;
}

/** Visible interactive elements with ids for the snap pointer (ids are stable per element). */
const ids = new WeakMap<Element, string>();
let nextId = 0;
function scanTargets(): { targets: Target[]; byId: Map<string, HTMLElement> } {
  const byId = new Map<string, HTMLElement>();
  const targets: Target[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(TARGETS)) {
    if (el.closest("[data-snap-ignore]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.pointerEvents === "none" || Number(style.opacity) === 0) continue;
    let id = ids.get(el);
    if (!id) ids.set(el, (id = `t${++nextId}`));
    byId.set(id, el);
    targets.push({ id, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
  }
  return { targets, byId };
}

export function GestureLayer() {
  const camera = useInput((s) => s.camera);
  const notice = useInput((s) => s.cameraNotice);
  const active = camera === "on" || camera === "starting";
  const pathname = usePathname();
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, w: 28, h: 28, locked: false, pinching: false, visible: false });
  const scan = useRef<ReturnType<typeof scanTargets>>({ targets: [], byId: new Map() });
  const pointer = useRef<SnapPointer | null>(null);

  // Rebuild target rects on route change, scroll, resize, and every 500 ms for dynamic UI.
  useEffect(() => {
    if (!active) return;
    const rescan = () => (scan.current = scanTargets());
    rescan();
    const t = setTimeout(rescan, 450); // after the page transition settles
    const iv = setInterval(rescan, 500);
    addEventListener("scroll", rescan, true);
    addEventListener("resize", rescan);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      removeEventListener("scroll", rescan, true);
      removeEventListener("resize", rescan);
    };
  }, [active, pathname]);

  useEffect(() => {
    if (!active) return;
    pointer.current = new SnapPointer(loadHandCal().reach);
    const offCal = onHandCal((c) => pointer.current && (pointer.current.reach = c.reach));
    const offFrame = onHandFrame((hands) => {
      const p = pointer.current;
      if (!p) return;
      const lm = hands[0];
      if (!lm) {
        p.reset();
        setCursor((c) => (c.visible ? { ...c, visible: false } : c));
        return;
      }
      const { source, pinch } = fromLandmarks(lm);
      const out = p.update(source, pinch, performance.now(), scan.current.targets, innerWidth, innerHeight);
      const el = out.locked ? scan.current.byId.get(out.locked) : undefined;
      const r = el?.getBoundingClientRect();
      const pad = 6;
      setCursor(
        r
          ? { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2, locked: true, pinching: out.pinching, visible: true }
          : { x: out.raw.x - 14, y: out.raw.y - 14, w: 28, h: 28, locked: false, pinching: out.pinching, visible: true },
      );
      // Hover for 3D scenes and CSS: move a synthetic pointer to the effective point.
      if (!out.pinching) {
        const hx = r ? r.left + r.width / 2 : out.raw.x;
        const hy = r ? r.top + r.height / 2 : out.raw.y;
        document.elementFromPoint(hx, hy)?.dispatchEvent(new PointerEvent("pointermove", { clientX: hx, clientY: hy, bubbles: true, pointerType: "mouse" }));
      }
      if (out.click) {
        const target = out.click !== "none" ? scan.current.byId.get(out.click) : undefined;
        if (target && document.contains(target)) {
          target.focus({ preventScroll: true });
          target.click();
          logInputEvent("Pinch (click)", "camera");
        } else fireAction("select", "camera", "Pinch (select)");
      }
    });
    const offGesture = onGesture((e) => {
      if (e.type === "zoom") emitInput(e.factor < 1 ? "zoomIn" : "zoomOut", "gesture", e.factor);
      else if (e.type === "rotate") emitInput("rotate", "gesture", e.delta);
    });
    return () => {
      offCal();
      offFrame();
      offGesture();
      pointer.current = null;
    };
  }, [active]);

  return (
    <>
      {active && (
        <motion.div
          aria-hidden="true"
          data-testid="hand-cursor"
          data-locked={cursor.locked ? "true" : "false"}
          className={`pointer-events-none fixed left-0 top-0 z-[60] border-2 ${cursor.pinching ? "border-ok bg-ok/15" : "border-copper"} ${cursor.locked ? "rounded-[12px]" : "rounded-full"}`}
          initial={false}
          animate={{ x: cursor.x, y: cursor.y, width: cursor.w, height: cursor.h, opacity: cursor.visible ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.6 }}
        />
      )}
      {notice && (
        <p role="status" className="glass fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[10px] border border-line px-4 py-1.5 text-[12px] text-warn">
          {notice}
          <button type="button" onClick={() => useInput.setState({ cameraNotice: null })} aria-label="Dismiss" className="text-muted hover:text-ink">
            <X size={12} strokeWidth={1.75} />
          </button>
        </p>
      )}
    </>
  );
}
