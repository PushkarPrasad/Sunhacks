import { expect, test } from "vitest";
import { partsById } from "@/data/parts";
import { templates } from "@/data/templates";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { decodeBuild, encodeBuild } from "@/lib/share";

test("share encoding round-trips a template build", () => {
  const b = buildFromTemplate(templates.find((t) => t.id === "robot-car")!, (id) => partsById[id]);
  const d = decodeBuild(encodeBuild(b))!;
  expect(d.name).toBe(b.name);
  expect(d.instances.map((i) => [i.id, i.partId, i.label, i.x, i.y])).toEqual(b.instances.map((i) => [i.id, i.partId, i.label, i.x, i.y]));
  expect(d.wires.map((w) => [w.from, w.to])).toEqual(b.wires.map((w) => [w.from, w.to]));
  expect(decodeBuild("not-valid")).toBeNull();
});
