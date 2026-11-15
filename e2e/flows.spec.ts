import { expect, test } from "@playwright/test";
import { collectErrors, loadTemplate } from "./helpers";

test("start from scratch: add parts, wire pin to pin, see checks update", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Start From Scratch/ }).click();
  await page.waitForURL("**/builder");
  await expect(page.getByText("An empty board.")).toBeVisible();
  await page.getByRole("button", { name: /ESP32 DevKitC/ }).first().click();
  await page.getByRole("tab", { name: "Sensors" }).click();
  await page.getByRole("button", { name: /BME280 breakout/ }).click();
  await expect(page.locator("[data-instance]")).toHaveCount(2);
  // Wire BME280 VIN -> ESP32 3V3
  await page.getByRole("button", { name: /S1 pin VIN/ }).click();
  await page.getByRole("button", { name: /U1 pin 3V3/ }).click();
  await expect(page.getByRole("button", { name: /S1 pin VIN.*connected/ })).toBeVisible();
  await expect(page.getByText(/BME280 breakout has no ground|BME280 breakout is missing wires/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("start from a device: category -> starter build -> builder", async ({ page }) => {
  await page.goto("/devices");
  await page.getByRole("listitem").filter({ hasText: "Smart Home" }).click();
  await page.waitForURL("**/devices/smart-home");
  await page.getByRole("button", { name: /Plant Monitor/ }).click();
  await page.waitForURL("**/builder");
  await expect(page.getByRole("textbox", { name: "Build name" })).toHaveValue("Plant Monitor");
  await expect(page.locator("[data-instance]")).toHaveCount(5);
});

test("Apply on a sticky note inserts a level shifter and clears the voltage failure", async ({ page }) => {
  await loadTemplate(page, "robot-car");
  const note = page.getByRole("article", { name: /5 V signal into a 3.3 V pin/ });
  await expect(note).toBeVisible();
  await note.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Level shifter (BSS138, 4-ch)")).toBeVisible();
  await expect(page.getByRole("article", { name: /5 V signal into a 3.3 V pin/ })).toHaveCount(0);
  // Undo restores it
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("article", { name: /5 V signal into a 3.3 V pin/ })).toBeVisible();
});

test("Gesture Ring exports Gerber and BOM", async ({ page }) => {
  await loadTemplate(page, "gesture-ring");
  await page.goto("/board");
  await page.waitForSelector("text=traces routed", { timeout: 60_000 });
  const [gerber] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Gerber zip/ }).click()]);
  expect(gerber.suggestedFilename()).toBe("gesture-ring-gerbers.zip");
  const [bom] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /BOM CSV/ }).click()]);
  expect(bom.suggestedFilename()).toBe("gesture-ring-bom.csv");
  const fs = await import("node:fs/promises");
  const csv = await fs.readFile((await bom.path())!, "utf8");
  expect(csv).toContain("Seeed XIAO ESP32-S3");
  expect(csv.split("\n").filter(Boolean).length).toBe(14);
});

test("keyboard: arrows move between pages, E toggles the exploded view", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("ArrowRight");
  await page.waitForURL("**/devices");
  await page.goto("/devices/phones");
  await expect(page.getByRole("button", { name: /Collapse/ })).toBeVisible();
  await page.keyboard.press("e");
  await expect(page.getByRole("button", { name: /Explode/ })).toBeVisible();
});

test("share link round trip", async ({ page }) => {
  await loadTemplate(page, "smart-speaker");
  await page.goto("/summary");
  await expect(page.getByAltText("QR code linking to this build")).toBeVisible({ timeout: 15_000 });
  const url = await page.locator("p.font-mono.truncate").last().textContent();
  expect(url).toContain("/share");
  await page.goto(url!);
  await expect(page.getByRole("heading", { name: "Smart Speaker" })).toBeVisible();
});
