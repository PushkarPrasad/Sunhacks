import type { CheckResult, Finding } from "@/lib/types";
import { HOLE_INSET, packBoard, packItems, type PackResult } from "@/lib/build/pack";
import type { Analysis } from "./analysis";
import { worst } from "./util";

export function boardPack(a: Analysis): PackResult {
  return packBoard(packItems(a.build, a.getPart), a.build.board);
}

export function checkBoardFit(a: Analysis, pack: PackResult): CheckResult {
  const findings: Finding[] = [];
  const holeKeepout = 4 * Math.pow(HOLE_INSET * 2, 2);
  const usable = Math.max(1, pack.boardW * pack.boardH - holeKeepout);
  const util = pack.footprintArea / usable;
  const fixed = a.build.board;
  if (fixed) {
    const auto = packBoard(packItems(a.build, a.getPart));
    if (!pack.fits) {
      findings.push({
        checkId: "boardFit",
        id: "boardFit:small",
        severity: "fail",
        code: "board_too_small",
        params: { w: fixed.w, h: fixed.h, suggestW: auto.boardW, suggestH: auto.boardH, util: Math.round(util * 100) },
        instanceIds: [],
        fix: { kind: "resizeBoard", w: auto.boardW, h: auto.boardH },
      });
    } else if (util > 0.8) {
      findings.push({
        checkId: "boardFit",
        id: "boardFit:tight",
        severity: "warn",
        code: "board_tight",
        params: { w: fixed.w, h: fixed.h, util: Math.round(util * 100), suggestW: Math.ceil(fixed.w * 1.15), suggestH: Math.ceil(fixed.h * 1.15) },
        instanceIds: [],
        fix: { kind: "resizeBoard", w: Math.ceil(fixed.w * 1.15), h: Math.ceil(fixed.h * 1.15) },
      });
    }
  }
  return {
    id: "boardFit",
    status: worst(findings),
    headline: `${Math.min(999, Math.round(util * 100))}%`,
    detail: `of ${pack.boardW} × ${pack.boardH} mm${fixed ? "" : " (auto-sized)"} · 4 × M3 holes`,
    findings,
  };
}
