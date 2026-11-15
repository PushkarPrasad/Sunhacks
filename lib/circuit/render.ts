import "server-only";
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg";
import type { CircuitJson } from "./generate";

// Design palette: charcoal board, copper traces, warm paper schematic.
export function pcbSvg(cj: CircuitJson): string {
  return convertCircuitJsonToPcbSvg(cj as never, {
    backgroundColor: "#1B1D20",
    includeVersion: false,
    colorOverrides: {
      copper: { top: "#C9773C", bottom: "#7C5A3E" },
      drill: "#0F1012",
      silkscreen: { top: "#E8E2D6", bottom: "#8E877B" },
      boardOutline: "#8E877B",
      substrate: "#24272B",
      soldermask: { top: "#24272B", bottom: "#24272B" },
      courtyard: { top: "#3A3E44", bottom: "#3A3E44" },
    },
  });
}

export function schematicSvg(cj: CircuitJson): string {
  return convertCircuitJsonToSchematicSvg(cj as never, {
    includeVersion: false,
    colorOverrides: {
      schematic: {
        background: "#F5F2EC",
        component_body: "#FBF9F5",
        component_outline: "#16181C",
        wire: "#B5652E",
        junction: "#B5652E",
        pin: "#16181C",
        pin_name: "#16181C",
        pin_number: "#6B6B6B",
        reference: "#16181C",
        value: "#6B6B6B",
        net_name: "#B5652E",
        label_local: "#16181C",
        label_global: "#16181C",
        label_background: "#FBF9F5",
        no_connect: "#6B6B6B",
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
