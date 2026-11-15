import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

// P0-5: the camera may only start from the camera singleton (used by the Calibration tab) and the test page.
test("getUserMedia appears only in lib/input/camera.ts and public/test/glove-camera.html", () => {
  const root = path.resolve(__dirname, "..");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|html|js|mjs)$/.test(f) && readFileSync(p, "utf8").includes("getUserMedia")) hits.push(path.relative(root, p));
    }
  };
  for (const d of ["app", "components", "lib", "stores", "public"]) walk(path.join(root, d));
  expect(hits.sort()).toEqual(["lib/input/camera.ts", "public/test/glove-camera.html"]);
});
