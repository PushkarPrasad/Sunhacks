import { expect, test } from "@playwright/test";

// The Calibration tab with simulated glove lines (no Bluetooth in headless Chrome).
test("calibration wizard: keep still, tilt each side, grab and twist; each step turns green", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/calibrate");
  await expect(page.getByRole("heading", { name: /Tune the glove/ })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __magicSmokeGlove?: unknown }).__magicSmokeGlove);
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
  const step = (n: number) => page.locator(`[data-step="${n}"]`);

  await send(Array.from({ length: 60 }, (_, i) => `O:${2 + (i % 2)},1,10`));
  await expect(step(1)).toHaveAttribute("data-done", "true", { timeout: 15_000 });
  await expect(step(2)).toHaveAttribute("data-done", "false");

  await send(["O:-32,1,10", "O:36,1,10", "O:2,28,10", "O:2,-26,10"]);
  await expect(step(2)).toHaveAttribute("data-done", "true");

  await send(["BTN:DOWN", "O:2,1,10", "O:2,1,40", "O:2,1,70", "BTN:UP"]);
  await expect(step(3)).toHaveAttribute("data-done", "true");
  await expect(page.getByText("All three steps pass.")).toBeVisible();
  await page.screenshot({ path: "screenshots/v3-calibrate.png" });
  expect(errors).toEqual([]);
});
