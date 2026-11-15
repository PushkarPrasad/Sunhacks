"use client";

import { useEffect } from "react";

const PULL = 3; // px at the very edge of the button; subtle on purpose

function reduced(): boolean {
  const root = document.documentElement;
  if (root.dataset.motion === "reduced") return true;
  if (root.dataset.motion === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Mouse-only magnetism for primary buttons marked `data-magnetic`: a 2-4 px pull toward the cursor.
 * One delegated listener, transform only (compositor-friendly), off under reduced motion and for touch/pen/hand input.
 * Uses `transform`, which composes with Tailwind v4's separate `translate` property used by hover lifts.
 */
export function useMagnetic() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const release = () => {
      if (current) current.style.transform = "";
      current = null;
    };

    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = e.target instanceof Element ? (e.target.closest("[data-magnetic]") as HTMLElement | null) : null;
      if (el !== current) release();
      if (!el || e.pointerType !== "mouse" || reduced() || (el as HTMLButtonElement).disabled) return;
      current = el;
      const r = el.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      el.style.transform = `translate3d(${(nx * PULL).toFixed(2)}px, ${(ny * PULL * 0.7).toFixed(2)}px, 0)`;
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      last = null;
      release();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      release();
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);
}
