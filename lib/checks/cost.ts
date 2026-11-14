import type { CheckResult, Finding } from "@/lib/types";
import { displayName, type Analysis } from "./analysis";
import { fmtUSD, worst } from "./util";

export const DEFAULT_BUDGET = 50;

/**
 * Local carrier-board estimate used when the quote adapter has not answered:
 * 5 boards, 2 layers, 1.6 mm, HASL. $2 up to 100x100 mm, then $0.05 per extra cm² per board, plus shipping.
 * Assumptions are shown in the quote panel.
 */
export function estimateBoardUSD(w_mm: number, h_mm: number, qty = 5): number {
  const area_cm2 = (w_mm * h_mm) / 100;
  const base = 2;
  const extra = Math.max(0, area_cm2 - 100) * 0.05 * qty;
  const shipping = 6;
  return Math.round((base + extra + shipping) * 100) / 100;
}

export function bomTotal(a: Analysis): number {
  return Math.round(a.build.instances.reduce((s, i) => s + (a.part(i.id)?.priceUSD ?? 0), 0) * 100) / 100;
}

export function checkCost(a: Analysis, boardUSD: number): CheckResult {
  const findings: Finding[] = [];
  const bom = bomTotal(a);
  const total = Math.round((bom + boardUSD) * 100) / 100;
  const budget = a.build.budgetUSD ?? DEFAULT_BUDGET;
  if (total > budget) {
    const priciest = [...a.build.instances]
      .map((i) => ({ id: i.id, price: a.part(i.id)?.priceUSD ?? 0 }))
      .sort((x, y) => y.price - x.price)
      .slice(0, 2);
    findings.push({
      checkId: "cost",
      id: "cost:budget",
      severity: total > budget * 1.2 ? "fail" : "warn",
      code: "over_budget",
      params: {
        total: fmtUSD(total),
        budget: fmtUSD(budget),
        over: fmtUSD(total - budget),
        top: priciest.map((p) => `${displayName(a, p.id)} (${fmtUSD(p.price)})`).join(", "),
      },
      instanceIds: priciest.map((p) => p.id),
    });
  }
  return {
    id: "cost",
    status: worst(findings),
    headline: fmtUSD(total),
    detail: `${fmtUSD(bom)} parts + ${fmtUSD(boardUSD)} board · budget ${fmtUSD(budget)}`,
    findings,
  };
}
