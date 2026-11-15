import { expect, test } from "@playwright/test";
import { collectErrors, expectNoOverflow, loadTemplate } from "./helpers";

const SIZES = [
  { w: 1440, h: 900, suffix: "" },
  { w: 1280, h: 800, suffix: "-1280" },
];

for (const size of SIZES) {
  test.describe(`pages at ${size.w}x${size.h}`, () => {
    test.use({ viewport: { width: size.w, height: size.h } });

    const shot = (name: string) => `screenshots/${name}${size.suffix}.png`;

    test("home", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForTimeout(600);
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("01-home") });
      expect(errors).toEqual([]);
    });

    test("home how it works", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("tab", { name: "How it works" }).click();
      await expect(page.getByRole("heading", { name: /Explore\. Build\./ })).toBeVisible();
      await page.waitForTimeout(900);
      await expectNoOverflow(page);
      await page.screenshot({ path: shot("01b-home-how") });
    });

    test("drones category", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/devices/drones");
      await expect(page.getByText("Brushed Micro Drone")).toBeVisible();
      await page.waitForTimeout(3500);
      await expectNoOverflow(page);
      await page.screenshot({ path: shot("03b-drones") });
      expect(errors).toEqual([]);
    });

    test("glove and about", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/glove");
      await expect(page.getByRole("button", { name: /Find glove/ })).toBeVisible();
      await page.waitForTimeout(2500);
      await expectNoOverflow(page);
      await page.screenshot({ path: shot("15-glove") });
      await page.goto("/about");
      await expect(page.getByText("Pushkar Prasad")).toBeVisible();
      await page.waitForTimeout(900);
      await expectNoOverflow(page);
      await page.screenshot({ path: shot("16-about") });
      expect(errors).toEqual([]);
    });

    test("hoop upload", async ({ page }) => {
      await loadTemplate(page, "gesture-ring");
      await page.getByRole("button", { name: "Import build" }).click();
      await expect(page.getByRole("dialog", { name: "Upload files" })).toBeVisible();
      await page.locator("input[type=file]").setInputFiles({ name: "my-build.json", mimeType: "application/json", buffer: Buffer.from("{}") });
      await page.waitForTimeout(600);
      await page.screenshot({ path: shot("17-hoop-upload") });
    });

    test("devices", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/devices");
      await expect(page.getByText("Smart Home")).toBeVisible();
      await page.waitForTimeout(600);
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("02-devices") });
      expect(errors).toEqual([]);
    });

    test("category robots", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/devices/robots");
      await expect(page.getByText("Robot Car")).toBeVisible();
      await page.waitForTimeout(2500);
      await page.getByRole("button", { name: "Motor driver", exact: true }).hover();
      await page.waitForTimeout(500);
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("03-category-robots") });
      expect(errors).toEqual([]);
    });

    test("more coming soon", async ({ page }) => {
      await page.goto("/devices/more");
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("04-more") });
    });

    test("builder with gesture ring", async ({ page }) => {
      const errors = collectErrors(page);
      await loadTemplate(page, "gesture-ring");
      await page.waitForTimeout(800);
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("05-builder-gesture-ring") });
      expect(errors).toEqual([]);
    });

    test("builder with notes (robot car)", async ({ page }) => {
      await loadTemplate(page, "robot-car");
      await page.waitForTimeout(800);
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("06-builder-notes") });
    });

    test("templates", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto("/templates");
      await expect(page.getByText("Gesture Ring")).toBeVisible();
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("10-templates") });
      expect(errors).toEqual([]);
    });

    test("checks page with notes", async ({ page }) => {
      const errors = collectErrors(page);
      await loadTemplate(page, "status-terminal");
      await page.goto("/checks");
      await expect(page.getByText("5 V signal into a 3.3 V pin").first()).toBeVisible();
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("11-checks") });
      expect(errors).toEqual([]);
    });

    test("board quad view with synced selection", async ({ page }) => {
      const errors = collectErrors(page);
      await loadTemplate(page, "gesture-ring");
      await page.goto("/board");
      await expect(page.getByRole("region", { name: "Parts" })).toBeVisible({ timeout: 60_000 });
      await page.getByRole("region", { name: "Parts" }).getByRole("button", { name: /^U1/ }).click();
      await expect(page.getByText(/U1 · Seeed XIAO ESP32-S3/)).toBeVisible();
      await page.waitForTimeout(1500);
      await expectNoOverflow(page);
      await page.screenshot({ path: shot("12-board-quad") });
      expect(errors).toEqual([]);
    });

    for (const cat of ["phones", "laptops", "projectors"]) {
      test(`anatomy ${cat}`, async ({ page }) => {
        const errors = collectErrors(page);
        await page.goto(`/devices/${cat}`);
        await expect(page.getByText("Anatomy")).toBeVisible();
        await page.waitForTimeout(2500);
        await expectNoOverflow(page);
        await page.screenshot({ path: shot(`13-anatomy-${cat}`) });
        expect(errors).toEqual([]);
      });
    }

    test("summary", async ({ page }) => {
      const errors = collectErrors(page);
      await loadTemplate(page, "handheld-console");
      await page.goto("/summary");
      await expect(page.getByAltText("QR code linking to this build")).toBeVisible({ timeout: 15_000 });
      await expectNoOverflow(page);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shot("14-summary") });
      expect(errors).toEqual([]);
    });

    test("builder schematic, pcb, 3d", async ({ page }) => {
      await loadTemplate(page, "gesture-ring");
      for (const [tab, name] of [
        ["Schematic", "07-schematic"],
        ["PCB", "08-pcb"],
        ["3D", "09-board-3d"],
      ] as const) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await page.waitForSelector("text=traces routed", { timeout: 60_000 });
        await page.waitForTimeout(1500);
        await expectNoOverflow(page);
        await page.waitForTimeout(700);
      await page.screenshot({ path: shot(name) });
      }
      await page.getByRole("tab", { name: "Build", exact: true }).click();
    });
  });
}
