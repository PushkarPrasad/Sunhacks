import "server-only";
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg";
import type { CircuitJson } from "./generate";

// Design palette: charcoal board, copper traces, warm paper schematic.
export function pcbSvg(cj: CircuitJson): string {
  return convertCircuitJsonToPcbSvg(cj as never, {
    backgroundColor: "#0E0E16",
    includeVersion: false,
    colorOverrides: {
      copper: { top: "#C9773C", bottom: "#5B4FA8" },
      drill: "#0F1012",
      silkscreen: { top: "#E8E2D6", bottom: "#8E877B" },
      boardOutline: "#8E877B",
      substrate: "#24272B",
      soldermask: { top: "#24272B", bottom: "#24272B" },
      courtyard: { top: "#3A3E44", bottom: "#3A3E44" },
    },
  });
}

/** Aspect-correct output size from the schematic's own bounds, so the diagram fills its frame. */
function schematicSize(cj: CircuitJson): { width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of cj) {
    if (e.type !== "schematic_component") continue;
    const c = e as unknown as { center: { x: number; y: number }; size?: { width: number; height: number } };
    const w = (c.size?.width ?? 1) / 2 + 1.2;
    const h = (c.size?.height ?? 1) / 2 + 0.8;
    minX = Math.min(minX, c.center.x - w);
    maxX = Math.max(maxX, c.center.x + w);
    minY = Math.min(minY, c.center.y - h);
    maxY = Math.max(maxY, c.center.y + h);
  }
  if (!isFinite(minX)) return { width: 1200, height: 800 };
  const aspect = Math.min(2.4, Math.max(0.6, (maxX - minX) / (maxY - minY)));
  return { width: 1400, height: Math.round(1400 / aspect) };
}

export function schematicSvg(cj: CircuitJson): string {
  return convertCircuitJsonToSchematicSvg(cj as never, {
    ...schematicSize(cj),
    includeVersion: false,
    colorOverrides: {
      schematic: {
        background: "#0E0E16",
        component_body: "#1A1A2A",
        component_outline: "#A5B4FC",
        wire: "#9479FF",
        junction: "#9479FF",
        pin: "#A3A1B8",
        pin_name: "#ECEAF5",
        pin_number: "#6E6C85",
        reference: "#ECEAF5",
        value: "#A3A1B8",
        net_name: "#A5B4FC",
        label_local: "#ECEAF5",
        label_global: "#ECEAF5",
        label_background: "#1A1A2A",
        no_connect: "#6E6C85",
      },
    },
  });
}

/** Make an SVG scale to its container (keep the viewBox, drop fixed width/height). */
export function responsive(svg: string): string {
  return svg.replace(/<svg([^>]*?)\swidth="[\d.]+"([^>]*?)\sheight="[\d.]+"/, (_m, a: string, b: string) => {
    const hasViewBox = /viewBox=/.test(a + b);
    const w = /width="([\d.]+)"/.exec(svg)?.[1];
    const h = /height="([\d.]+)"/.exec(svg)?.[1];
    return `<svg${a}${b}${hasViewBox ? "" : ` viewBox="0 0 ${w} ${h}"`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"`;
  });
}
