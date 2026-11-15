import { expect, test, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { loadTemplate } from "./helpers";

// Hoop Upload: open it from the toolbar and from /builder?hoop=1, throw the file-ball through the hoop with
// pointer events (the same path a mouse or trackpad takes), and check the build lands in the Builder.

async function savedBuildFile(page: Page): Promise<{ path: string; modules: number }> {
  await loadTemplate(page, "robot-car");
  const build = await page.evaluate(() => JSON.parse(localStorage.getItem("copperline-build")!).state.build);
  build.name = "Hoop Test Build";
  mkdirSync("test-results", { recursive: true });
  const path = "test-results/hoop-test-build.json";
  writeFileSync(path, JSON.stringify(build));
  return { path, modules: build.instances.length };
}

/** Press on the ball, drag (dx, dy) canvas units and let go: the release velocity comes from the drag. */
async function throwBall(page: Page, dx: number, dy: number) {
  await page.evaluate(
    ([dx, dy]) => {
      const c = document.querySelector<HTMLCanvasElement>("canvas[aria-label^='Hoop']")!;
      const r = c.getBoundingClientRect();
      const k = r.width / 560;
      const at = (x: number, y: number) => ({ clientX: r.left + x * k, clientY: r.top + y * (r.height / 300), bubbles: true, pointerId: 1, pointerType: "mouse", isPrimary: true });
      const bx = 86;
      const by = 286 - 17;
      c.dispatchEvent(new PointerEvent("pointerdown", at(bx, by)));
      c.dispatchEvent(new PointerEvent("pointermove", at(bx + dx / 2, by + dy / 2)));
      c.dispatchEvent(new PointerEvent("pointermove", at(bx + dx, by + dy)));
      c.dispatchEvent(new PointerEvent("pointerup", at(bx + dx, by + dy)));
    },
    [dx, dy],
  );
}

test("Upload button opens the hoop; a throw through the hoop imports the build", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const file = await savedBuildFile(page);
  await page.goto("/builder?new=1");
  await page.waitForURL("**/builder");
  await expect(page.locator("[data-instance]")).toHaveCount(0);

  await page.getByRole("button", { name: /^Upload$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Upload files" });
  await expect(dialog).toBeVisible();
  await dialog.locator("input[type=file]").setInputFiles(file.path);
  await expect(dialog).toContainText("is ready");

  // Release velocity = drag / 16 ms. Ideal is about (500, -720) px/s; sweep a few drags like a player would.
  let scored = false;
  for (const [dx, dy] of [[8, -11.5], [8.3, -11.4], [7.7, -11.6], [8.6, -11.2], [7.4, -11.8], [9, -11]]) {
    await throwBall(page, dx, dy);
    try {
      await expect(dialog.getByText("Uploaded 1")).toBeVisible({ timeout: 2500 });
      scored = true;
      break;
    } catch {
      await page.waitForTimeout(1200); // missed: the ball rolls back to the start
    }
  }
  expect(scored, "ball went through the hoop").toBe(true);
  await expect(dialog).toContainText("Imported “Hoop Test Build”");
  await page.screenshot({ path: "screenshots/v3-hoop.png" });
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("[data-instance]")).toHaveCount(file.modules);
  expect(errors).toEqual([]);
});

test("/builder?hoop=1 opens the hoop directly; Just upload it skips the game", async ({ page }) => {
  const file = await savedBuildFile(page);
  await page.goto("/builder?new=1");
  await page.waitForURL("**/builder");
  await page.goto("/builder?hoop=1");
  const dialog = page.getByRole("dialog", { name: "Upload files" });
  await expect(dialog).toBeVisible();
  await dialog.locator("input[type=file]").setInputFiles(file.path);
  await dialog.getByRole("button", { name: "Just upload it" }).click();
  await expect(dialog.getByText("Uploaded 1")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("[data-instance]")).toHaveCount(file.modules);
});

test("a real mouse drag picks the ball up and throws it", async ({ page }) => {
  const file = await savedBuildFile(page);
  await page.goto("/builder?hoop=1");
  const dialog = page.getByRole("dialog", { name: "Upload files" });
  await dialog.locator("input[type=file]").setInputFiles(file.path);
  const c = dialog.locator("canvas");
  const box = (await c.boundingBox())!;
  const k = box.width / 560;
  const bx = box.x + 86 * k;
  const by = box.y + (286 - 17) * (box.height / 300);
  const before = await c.screenshot();
  await page.mouse.move(bx, by);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(bx + i * 10, by - i * 14);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await c.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0); // the ball left its resting spot
});
