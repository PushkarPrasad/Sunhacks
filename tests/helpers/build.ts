import { parts, partsById } from "@/data/parts";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { applyFix } from "@/lib/build/ops";
import { runChecks } from "@/lib/checks";
import type { Build, ChecksContext, Finding, Template } from "@/lib/types";

export const getPart = (id: string) => partsById[id];

export function mk(instances: [string, string][], wires: [string, string][], extra: Partial<Template> = {}): Build {
  const t: Template = {
    id: "test",
    name: "Test",
    categoryId: "custom",
    description: "",
    instances: instances.map(([ref, partId]) => ({ ref, partId })),
    wires,
    ...extra,
  };
  return buildFromTemplate(t, getPart);
}

export function check(b: Build, ctx?: ChecksContext) {
  return runChecks(b, parts, ctx);
}

export function codes(b: Build, checkId?: string): string[] {
  return check(b)
    .findings.filter((f) => !checkId || f.checkId === checkId)
    .map((f) => f.code);
}

export function find(b: Build, code: string): Finding | undefined {
  return check(b).findings.find((f) => f.code === code);
}

export function apply(b: Build, f: Finding): Build {
  if (!f.fix) throw new Error(`finding ${f.code} has no fix`);
  return applyFix(b, f.fix, getPart);
}

/** Instance id for a template ref, matched by part id + order. */
export function idOf(b: Build, partId: string, nth = 0): string {
  return b.instances.filter((i) => i.partId === partId)[nth].id;
}

// Common power front-ends.
export const USB_ESP32: [string, string][] = [
  ["usb.VBUS", "mcu.5V"],
  ["usb.GND", "mcu.GND"],
];
