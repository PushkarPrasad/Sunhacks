import { describe, expect, test } from "vitest";
import { interpolate, noteDictionaries, noteText } from "@/lib/i18n/notes";

const FORBIDDEN = /\b(AI|assistant|I think|chat)\b/i;

describe("notes", () => {
  test("interpolates params and optional segments", () => {
    expect(interpolate("A {x}[?y] and {y}[/y].", { x: 1 })).toBe("A 1.");
    expect(interpolate("A {x}[?y] and {y}[/y].", { x: 1, y: "two" })).toBe("A 1 and two.");
  });

  test("every code exists in all three languages", () => {
    const codes = Object.keys(noteDictionaries.en);
    for (const lang of ["es", "hi"] as const) expect(Object.keys(noteDictionaries[lang]).sort()).toEqual([...codes].sort());
  });

  test("wording is grounded: no AI / assistant / chat language, no claims of human review", () => {
    for (const dict of Object.values(noteDictionaries))
      for (const { title, body } of Object.values(dict)) {
        expect(title + body).not.toMatch(FORBIDDEN);
        expect(title + body).not.toMatch(/expert|engineer reviewed/i);
      }
  });

  test("the brief's example reads naturally", () => {
    const n = noteText("rail_over_limit", { rail: "5 V", load: 640, limit: 500, source: "AMS1117", suggestion: "MT3608" });
    expect(n.body).toBe("Based on the checks we ran, your 5 V rail needs 640 mA, which is over the 500 mA limit of AMS1117. We suggest swapping it for the MT3608.");
  });
});
