// The main page flow: arrow keys, on-screen arrows, page dots and hand swipes all move along this list.

export const FLOW = [
  { path: "/", label: "Home" },
  { path: "/devices", label: "Devices" },
  { path: "/builder", label: "Builder" },
  { path: "/checks", label: "Checks" },
  { path: "/board", label: "Board" },
  { path: "/summary", label: "Summary" },
] as const;

/** Slim top navigation (V2). The page flow above still drives arrows, dots and swipes. */
export const NAV = [
  { path: "/", label: "Home" },
  { path: "/devices", label: "Devices" },
  { path: "/builder", label: "Builder" },
  { path: "/board", label: "Board" },
  { path: "/glove", label: "Glove" },
  { path: "/about", label: "About" },
] as const;

export function flowIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname.startsWith("/devices") || pathname.startsWith("/templates")) return 1;
  if (pathname.startsWith("/builder")) return 2;
  if (pathname.startsWith("/checks")) return 3;
  if (pathname.startsWith("/board")) return 4;
  if (pathname.startsWith("/summary") || pathname.startsWith("/share")) return 5;
  return 0;
}

export function neighbours(pathname: string) {
  const i = flowIndex(pathname);
  // Category pages sit between Devices and Builder.
  const prev = pathname.startsWith("/devices/") || pathname.startsWith("/templates") ? FLOW[1] : FLOW[i - 1];
  const next = FLOW[i + 1];
  return { index: i, prev, next };
}
