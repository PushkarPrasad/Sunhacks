import { expect, test } from "@playwright/test";

// V4 Calibration wizard with simulated glove lines (no Bluetooth in headless Chrome).
test("calibration wizard: glove still / tilt / twist, then grab, each step turns green", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/calibrate");
  await expect(page.getByRole("heading", { name: "Tune your hands" })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __magicSmokeGlove?: unknown }).__magicSmokeGlove);
  await page.waitForTimeout(800);
  const send = (lines: string[], gap = 40) =>
    page.evaluate(
      async ([ls, g]) => {
        const glove = (window as unknown as { __magicSmokeGlove: { line(l: string): void; connected(): void } }).__magicSmokeGlove;
        glove.connected();
        for (const l of ls as string[]) {
          glove.line(l);
          await new Promise((r) => setTimeout(r, g as number));
        }
      },
      [lines, gap] as const,
    );
  const check = (n: number) => page.getByTestId(`step-check-${n}`);

  await send(Array.from({ length: 60 }, (_, i) => `O:${2 + (i % 2)},1,10`)); // keep still ~2.4 s
  await send(["O:-32,1,10", "O:36,1,10", "O:2,-28,10", "O:2,28,10", "O:2,1,10"]); // tilt each side
  await send(["O:20,1,10", "O:40,1,10", "O:52,1,10"]); // doorknob twist
  await expect(check(0).locator("svg")).toBeVisible();

  await page.getByRole("button", { name: "Next step" }).click();
  await send(["O:0,0,0", "BTN:DOWN", "O:0,0,20", "O:0,0,40", "O:0,0,60", "BTN:UP"]);
  await expect(check(1).locator("svg")).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: "screenshots/v4-calibrate.png" });
  expect(errors).toEqual([]);
});
