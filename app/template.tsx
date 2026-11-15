"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { flowIndex } from "@/lib/flow";

let lastIndex = 0;

/** Slow, subtle slide + fade between pages; direction follows the page flow. */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = flowIndex(pathname);
  const dx = index >= lastIndex ? "14px" : "-14px";
  useEffect(() => {
    lastIndex = index;
  }, [index]);
  return (
    <div key={pathname} className="h-full animate-page-in" style={{ ["--page-dx" as string]: dx }}>
      {children}
    </div>
  );
}
