import { expect, test, type Page } from "@playwright/test";
import { syntheticHand } from "../tests/helpers/hand";

// Hand control with synthetic landmarks (no webcam in headless Chrome). The app's test hook feeds frames through the
// real pipeline: camera singleton -> openness tracker / snap pointer -> UI.

type P = { x: number; y: number; z: number };
async function feed(page: Page, image: P[], world: P[], score = 0.95) {
  await page.evaluate(
    ({ image, world, score }) => {
      const hook = (window as unknown as { __magicSmokeInput: { feedHands: (h: unknown[], w: unknown[], t: number, s: number[]) => void } }).__magicSmokeInput;
      hook.feedHands([{ landmarks: image }], [world], performance.now(), [score]);
    },
    { image, world, score },
  );
}
const cameraOn = (page: Page) => page.evaluate(() => (window as unknown as { __magicSmokeInput: { fakeCameraOn: () => void } }).__magicSmokeInput.fakeCameraOn());

test("palm openness drives the explode slider continuously (fist / half / open within ±10%)", async ({ page }) => {
  await page.goto("/devices/drones");
  await page.waitForTimeout(1500);
  await cameraOn(page);
  const slider = page.getByRole("slider", { name: "Explode" });
  for (const [open, want] of [
    [0, 0],
    [0.5, 50],
    [1, 100],
    [0.5, 50],
  ] as const) {
    for (let i = 0; i < 40; i++) {
      const h = syntheticHand(open, { noise: 0.002, seed: i + open * 100 });
      await feed(page, h.image, h.world);
      await page.waitForTimeout(25);
    }
    await expect(page.getByTestId("openness-meter")).toBeVisible();
    const v = Number(await slider.inputValue());
    expect(Math.abs(v - want), `openness ${open} -> slider ${v}`).toBeLessThanOrEqual(10);
  }
});

test("pinch clicks land on small targets with ±30 px noise (Calibrate click test)", async ({ page }) => {
  // Identity reach box so pointer pixels = normalized knuckle position × viewport.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("magic-smoke-handcal-v4", JSON.stringify({ reach: { x0: 0, y0: 0, x1: 1, y1: 1 } }));
    } catch {}
  });
  await page.goto("/calibrate");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Click test" }).click();
  await cameraOn(page);
  await page.waitForTimeout(600);
  const vw = page.viewportSize()!.width;
  const vh = page.viewportSize()!.height;
  const world = syntheticHand(1).world;
  let s = 99;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
  const handAt = (px: number, py: number, pinch: boolean): P[] => {
    const x = 1 - px / vw; // mirrored
    const y = py / vh;
    const lm: P[] = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
    lm[0] = { x, y: y + 0.15, z: 0 };
    lm[5] = { x, y, z: 0 };
    lm[9] = { x: x - 0.02, y, z: 0 };
    lm[8] = { x, y: y - 0.09, z: 0 };
    lm[4] = pinch ? { x: x + 0.01, y: y - 0.085, z: 0 } : { x: x + 0.12, y: y - 0.02, z: 0 };
    return lm;
  };
  for (let k = 0; k < 5; k++) {
    const box = (await page.getByTestId(`click-target-${k}`).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (let i = 0; i < 20; i++) {
      await feed(page, handAt(cx + rnd() * 30, cy + rnd() * 30, false), world);
      await page.waitForTimeout(30);
    }
    for (let i = 0; i < 5; i++) {
      await feed(page, handAt(cx + rnd() * 30, cy + 12 + rnd() * 30, true), world);
      await page.waitForTimeout(30);
    }
    for (let i = 0; i < 4; i++) {
      await feed(page, handAt(cx, cy, false), world);
      await page.waitForTimeout(30);
    }
  }
  await expect(page.getByTestId("click-rate")).toContainText("5 / 5 targets");
  await expect(page.getByTestId("click-rate")).toContainText("100% hit rate");
});
