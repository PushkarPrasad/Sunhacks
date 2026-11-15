"use client";

import { usePathname } from "next/navigation";

/**
 * Page transition: fade plus an 8px rise, 240ms ease-out (see `--animate-page-in` in globals.css).
 * Under prefers-reduced-motion or the Reduce motion setting the global rules cut it to 1ms.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="h-full animate-page-in">
      {children}
    </div>
  );
}
