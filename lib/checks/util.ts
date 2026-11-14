import type { Finding, Status } from "@/lib/types";

export function worst(findings: Pick<Finding, "severity">[]): Status {
  if (findings.some((f) => f.severity === "fail")) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "ok";
}

export const fmtUSD = (n: number) => `$${n.toFixed(2)}`;
