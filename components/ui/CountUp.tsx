"use client";

import { useEffect, useRef, useState } from "react";

function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const root = document.documentElement.dataset.motion;
  if (root === "reduced") return true;
  if (root === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts from the last shown value to `value` over `ms` with an ease-out curve.
 * Renders `format(value)` straight away when motion is reduced. One rAF loop, DOM text only.
 */
export function CountUp({ value, format, ms = 700 }: { value: number; format: (n: number) => string; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value) || reducedMotion()) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);

  return <>{format(shown)}</>;
}
