"use client";

// Global keyboard map. The gesture ring is a Bluetooth keyboard, so it lands here too:
// Enter = select, Escape = back, E = explode/collapse, Space (hold) = voice, arrows = items/pages, +/- zoom, R rotate.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { emitInput, onInput } from "@/lib/input/bus";
import { neighbours } from "@/lib/flow";

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** True when focus is inside a roving group or widget that uses arrow keys itself. */
function arrowsOwned(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.("[data-arrows]");
}

export function KeyboardMap() {
  const router = useRouter();
  const pathname = usePathname();

  // Page navigation handlers (lowest priority: pages can consume first).
  useEffect(() => {
    const { prev, next } = neighbours(pathname);
    const offPrev = onInput("prevPage", () => {
      if (prev) router.push(prev.path);
      return true;
    });
    const offNext = onInput("nextPage", () => {
      if (next) router.push(next.path);
      return true;
    });
    const offBack = onInput("back", () => {
      if (prev) router.push(prev.path);
      return true;
    });
    const offChecks = onInput("showChecks", () => {
      router.push("/checks");
      return true;
    });
    const offScratch = onInput("startScratch", () => {
      router.push("/builder?new=1");
      return true;
    });
    const offExport = onInput("exportBoard", () => {
      router.push("/board");
      return true;
    });
    return () => [offPrev, offNext, offBack, offChecks, offScratch, offExport].forEach((f) => f());
  }, [pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      const key = e.key;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        // Widgets that use arrows (grids, palette, canvas) mark themselves with data-arrows; Shift always pages.
        if (e.shiftKey || !arrowsOwned(e.target)) {
          e.preventDefault();
          emitInput(key === "ArrowLeft" ? "prevPage" : "nextPage", "keyboard");
        }
        return;
      }
      if (key === "Escape") {
        if (emitInput("back", "keyboard")) e.preventDefault();
        return;
      }
      if (key === "e" || key === "E") {
        emitInput("toggleExplode", "keyboard");
        return;
      }
      if (key === "+" || key === "=") {
        emitInput("zoomIn", "keyboard");
        return;
      }
      if (key === "-" || key === "_") {
        emitInput("zoomOut", "keyboard");
        return;
      }
      if (key === "r" || key === "R") {
        emitInput("rotate", "keyboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
