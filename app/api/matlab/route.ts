import { connection } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { BatteryCurve } from "@/lib/types";

// Discharge tables written by matlab/battery_discharge.m. Read at request time so re-running MATLAB needs no rebuild.
export async function GET() {
  await connection();
  const dir = path.join(process.cwd(), "data", "matlab");
  const batteryCurves: BatteryCurve[] = [];
  try {
    for (const f of await readdir(dir)) {
      if (!f.endsWith("_discharge.json")) continue;
      const c = JSON.parse(await readFile(path.join(dir, f), "utf8")) as BatteryCurve;
      if (Array.isArray(c.rows) && c.chemistry) batteryCurves.push(c);
    }
  } catch {
    // no folder: simple formula
  }
  return Response.json({ batteryCurves });
}
