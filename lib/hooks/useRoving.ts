"use client";

import { useCallback, type KeyboardEvent } from "react";

/**
 * Arrow-key movement between [data-roving] children of a container, laid out in `columns` columns.
 * Returns an onKeyDown handler for the container (which should carry data-arrows).
 */
export function useRoving(columns: number) {
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.shiftKey || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-roving]"));
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i < 0) {
        items[0]?.focus();
        e.preventDefault();
        return;
      }
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, Home: -i, End: items.length - 1 - i }[e.key]!;
      const next = i + delta;
      if (next >= 0 && next < items.length) {
        items[next].focus();
        e.preventDefault();
      }
    },
    [columns],
  );
}
