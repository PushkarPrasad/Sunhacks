import { expect, test, vi } from "vitest";
vi.mock("motion/react", () => ({}));
import { partsById } from "@/data/parts";
import { templates } from "@/data/templates";
import { buildFromTemplate } from "@/lib/build/fromTemplate";
import { parseBuildFile } from "@/components/builder/HoopUpload";

test("Hoop Upload accepts saved build files and rejects anything else", () => {
  const b = buildFromTemplate(templates[0], (id) => partsById[id]);
  const parsed = parseBuildFile(JSON.stringify(b))!;
  expect(parsed.instances).toHaveLength(b.instances.length);
  expect(parsed.id).not.toBe(b.id);
  expect(parseBuildFile("{}")).toBeNull();
  expect(parseBuildFile("not json")).toBeNull();
  expect(parseBuildFile(JSON.stringify({ ...b, instances: [{ id: "x", partId: "nope" }] }))).toBeNull();
});
