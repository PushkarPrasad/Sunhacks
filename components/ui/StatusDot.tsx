import type { Status } from "@/lib/types";

export const statusColor: Record<Status, string> = { ok: "bg-ok", warn: "bg-warn", fail: "bg-bad" };
export const statusText: Record<Status, string> = { ok: "text-ok", warn: "text-warn", fail: "text-bad" };
export const statusLabel: Record<Status, string> = { ok: "Pass", warn: "Check", fail: "Fix" };

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  return <span aria-label={statusLabel[status]} className={`inline-block shrink-0 rounded-full ${statusColor[status]}`} style={{ width: size, height: size }} />;
}
