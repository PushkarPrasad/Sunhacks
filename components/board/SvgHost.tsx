"use client";

import { useEffect, useRef } from "react";

/**
 * Renders a generated SVG inside a shadow root so its <style> rules (circuit-to-svg emits global class names)
 * cannot leak into other SVGs on the page. `css` is extra CSS applied inside the same root (selection highlight).
 */
export function SvgHost({ svg, css = "", onPick, className = "" }: { svg: string; css?: string; onPick?: (path: EventTarget[]) => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const styleEl = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.innerHTML = `<style>:host{display:block;width:100%;height:100%} svg{width:100%;height:100%;display:block}</style><style data-extra></style>${svg}`;
    styleEl.current = root.querySelector("style[data-extra]");
  }, [svg]);

  useEffect(() => {
    if (styleEl.current) styleEl.current.textContent = css;
  }, [css, svg]);

  return <div ref={host} className={className} onClick={(e) => onPick?.(e.nativeEvent.composedPath())} />;
}
