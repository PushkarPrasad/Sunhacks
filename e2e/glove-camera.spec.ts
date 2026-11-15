import { expect, test } from "@playwright/test";

// Headless check of public/test/glove-camera.html with simulated glove lines and fake landmarks.
type P = { x: number; y: number };
function hand(shape: "open" | "spread" | "fist" | "pinch", cx = 0.5, cy = 0.5): P[] {
  const lm: P[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy }));
  lm[0] = { x: cx, y: cy + 0.15 };
  lm[9] = { x: cx, y: cy };
  const off = shape === "spread" ? [-0.12, -0.04, 0.04, 0.12] : [-0.06, -0.02, 0.02, 0.06];
  [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(([tip, pip], i) => {
    const curled = shape === "fist" || (shape === "pinch" && i > 0);
    lm[pip] = { x: cx + off[i], y: cy - 0.05 };
    lm[tip] = curled ? { x: cx + off[i], y: cy + 0.02 } : { x: cx + off[i], y: cy - 0.15 };
  });
  lm[4] = shape === "pinch" ? { ...lm[8] } : { x: cx - 0.12, y: cy + 0.02 };
  return lm;
}

test("glove + camera test page passes every check with simulated input", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/test/glove-camera.html");
  await page.waitForFunction(() => (window as unknown as { __test?: unknown }).__test);
  await expect(page.locator("#score")).toContainText("0 / 16");

  const line = (l: string) => page.evaluate((x) => (window as unknown as { __test: { line(l: string): void } }).__test.line(x), l);
  const hands = (h: P[][], t: number) => page.evaluate(([a, b]) => (window as unknown as { __test: { hands(h: unknown, t: number): void } }).__test.hands(a, b as number), [h, t] as const);

  // glove
  await line("READY:CURIE");
  for (let i = 0; i < 12; i++) await line("O:0,0,0");
  for (const o of ["O:35,0,0", "O:-35,0,0", "O:0,30,0", "O:0,-30,0", "O:0,0,40", "O:0,0,-40", "O:0,0,0"]) await line(o);
  await line("G:SWIPE_L");
  await line("G:SWIPE_R");
  await line("G:SELECT");
  await line("G:SHAKE");
  await line("MODE:MOTION"); // old format: ignored
  await expect(page.locator("#score")).toContainText("9 / 16");

  // camera
  let t = 10_000;
  await hands([hand("open")], (t += 33));
  await hands([hand("pinch")], (t += 33));
  await hands([hand("open")], (t += 33));
  for (let i = 0; i < 12; i++) await hands([hand("spread")], (t += 33));
  t += 1000;
  for (let i = 0; i <= 10; i++) await hands([hand("open", 0.7 - i * 0.035)], (t += 30));
  t += 1000;
  for (let i = 0; i <= 10; i++) await hands([hand("open", 0.35 + i * 0.035)], (t += 30));
  t += 1000;
  // fusion: fist held (grab) then twist the glove 60 degrees
  for (let i = 0; i < 20; i++) await hands([hand("fist")], (t += 33));
  await line("O:0,0,0");
  await line("O:0,0,30");
  await line("O:0,0,60");
  const rot = await page.evaluate(() => (window as unknown as { __test: { rotation(): { y: number } } }).__test.rotation());
  expect(rot.y).toBeGreaterThan(30 + 45);
  await expect(page.locator("#score")).toContainText("16 / 16");

  // the optional switch joins the score once seen
  await line("BTN:DOWN");
  await line("BTN:UP");
  await expect(page.locator("#score")).toContainText("17 / 17");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "screenshots/v3-glove-camera-test.png" });
});
