import type { Build, ChecksContext, ChecksReport, Part } from "@/lib/types";
import { analyze, type Analysis } from "./analysis";
import { checkAddresses } from "./addresses";
import { boardPack, checkBoardFit } from "./boardFit";
import { bomTotal, checkCost, estimateBoardUSD } from "./cost";
import { checkPins } from "./pins";
import { batteryEstimates, checkPower, railSummaries } from "./power";
import { checkVoltage } from "./voltage";

export { analyze } from "./analysis";
export type { Analysis } from "./analysis";

/** Runs all six checks. Pure: same build + catalogue + context always gives the same report. */
export function runChecks(build: Build, catalogue: Part[], ctx: ChecksContext = {}): ChecksReport {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const getPart = (id: string) => byId.get(id);
  const a: Analysis = analyze(build, getPart);
  const pack = boardPack(a);
  const boardUSD = ctx.boardEstimateUSD ?? estimateBoardUSD(pack.boardW, pack.boardH);

  const results = [
    checkPower(a, catalogue, ctx.batteryCurves),
    checkVoltage(a),
    checkPins(a),
    checkAddresses(a),
    checkCost(a, boardUSD),
    checkBoardFit(a, pack),
  ];
  const dismissed = new Set(build.dismissed);
  for (const r of results) r.findings = r.findings.filter((f) => !dismissed.has(f.id));
  const findings = results.flatMap((r) => r.findings);

  const est = batteryEstimates(a, ctx.batteryCurves);
  const totalTyp = a.rails
    .filter((r) => r.sourceKind === "battery" || r.sourceKind === "usb-assumed" || (r.sourceKind === "regulator" && !upstreamFed(a, r.net.id)))
    .reduce((s, r) => s + (a.railLoads.get(r.net.id) ?? []).reduce((x, l) => x + l.typical, 0), 0);
  const totalPeak = a.rails
    .filter((r) => r.sourceKind === "battery" || r.sourceKind === "usb-assumed" || (r.sourceKind === "regulator" && !upstreamFed(a, r.net.id)))
    .reduce((s, r) => s + (a.railLoads.get(r.net.id) ?? []).reduce((x, l) => x + l.peak, 0), 0);
  const bom = bomTotal(a);

  return {
    results,
    rails: railSummaries(a),
    findings,
    totals: {
      bomUSD: bom,
      boardUSD,
      totalUSD: Math.round((bom + boardUSD) * 100) / 100,
      averageCurrent_mA: Math.round(totalTyp * 10) / 10,
      peakCurrent_mA: Math.round(totalPeak * 10) / 10,
      batteryLife_h: est[0]?.hours ?? null,
      batteryModel: est[0]?.model ?? null,
      footprintArea_mm2: pack.footprintArea,
      boardArea_mm2: pack.boardW * pack.boardH,
    },
  };
}

/** True when a regulator's own input comes from another rail (so it is not a root supply). */
function upstreamFed(a: Analysis, netId: string): boolean {
  const rail = a.railOf.get(netId);
  if (!rail?.source) return false;
  const src = rail.source;
  for (const r of a.rails) {
    if (r.net.id === netId) continue;
    if ((a.railLoads.get(r.net.id) ?? []).some((l) => l.instanceId === src.instanceId)) return true;
  }
  return false;
}
