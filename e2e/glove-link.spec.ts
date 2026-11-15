import { expect, test, type Page } from "@playwright/test";
import { Quaternion } from "three";
import { fakeBluetoothScript } from "./fixtures/fakeBluetooth";

type Fake = { send(l: string): boolean; drop(): void; failNext(n: number): void; stats(): { connects: number; subscriptions: number; listeners: number; writes: string[] } };
const send = (page: Page, line: string) => page.evaluate((l) => (window as unknown as { __fakeGlove: Fake }).__fakeGlove.send(l), line);
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __fakeGlove: Fake }).__fakeGlove.stats());
const pill = (page: Page) => page.getByTestId("glove-pill");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(fakeBluetoothScript);
});

test("Bluetooth link: survives navigation, auto-reconnects, recovers from a stall", async ({ page }) => {
  await page.goto("/glove");
  await page.waitForTimeout(1200); // let the page hydrate before clicking
  await page.getByRole("button", { name: /Connect Bluetooth/ }).click();
  await expect(pill(page)).toContainText("Connected");
  expect(await send(page, "READY:CURIE")).toBe(true);

  // Client-side navigation keeps the same link (no reconnect, no extra subscription).
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Devices" }).click();
  await page.waitForURL("**/devices");
  await expect(pill(page)).toContainText("Connected");
  expect(await send(page, "G:SWIPE_R")).toBe(true);
  let s = await stats(page);
  expect(s.connects).toBe(1);
  expect(s.subscriptions).toBe(1);

  // The link drops: same device reconnects with backoff, no chooser, re-subscribed with exactly one listener.
  await page.evaluate(() => (window as unknown as { __fakeGlove: Fake }).__fakeGlove.failNext(1));
  await page.evaluate(() => (window as unknown as { __fakeGlove: Fake }).__fakeGlove.drop());
  await expect(pill(page)).toContainText("Reconnecting");
  await expect(pill(page)).toContainText("Connected", { timeout: 6000 });
  s = await stats(page);
  expect(s.connects).toBe(2);
  expect(s.subscriptions).toBe(2);
  expect(s.listeners).toBe(1);

  // Stall: nothing arrives for more than 4 s, so the watchdog drops and reconnects.
  await expect(pill(page)).toContainText(/Stalled|Reconnecting/, { timeout: 6000 });
  await expect(pill(page)).toContainText("Connected", { timeout: 6000 });
  expect((await stats(page)).connects).toBe(3);

  // The Glove tab shows the link log.
  await page.getByTestId("glove-pill").click();
  await page.waitForURL("**/glove");
  const log = page.getByTestId("link-log");
  await expect(log).toContainText("Link dropped");
  await expect(log).toContainText("Reconnected");
  await expect(log).toContainText("No data for");
});

test("grab and rotate: switch held, 90° on each axis, release keeps the model there (within 5°)", async ({ page }) => {
  await page.goto("/devices/drones");
  // connect from the Glove tab (the pill), then come back through client navigation
  await page.waitForTimeout(1200);
  await page.getByTestId("glove-pill").click();
  await page.waitForURL("**/glove");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Connect Bluetooth/ }).click();
  await expect(pill(page)).toContainText("Connected");
  // Like the real firmware, send READY every 3 s so the 4 s stall watchdog stays quiet during navigation.
  await page.evaluate(() => setInterval(() => (window as unknown as { __fakeGlove: { send(l: string): boolean } }).__fakeGlove.send("READY:CURIE"), 3000));
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Devices" }).click();
  await page.getByRole("listitem").filter({ hasText: "Drones" }).first().click();
  await page.waitForURL("**/devices/drones");
  await page.waitForTimeout(1500);

  const DEG = Math.PI / 180;
  const cases: [string, (t: number) => string, Quaternion][] = [
    ["yaw", (t) => `O:0,0,${Math.round(90 * t)}`, new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 90 * DEG)],
    ["pitch", (t) => `O:0,${Math.round(90 * t)},0`, new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, 90 * DEG)],
    ["roll", (t) => `O:${Math.round(90 * t)},0,0`, new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 } as never, -90 * DEG)],
  ];
  for (const [axis, path, expected] of cases) {
    await expect(pill(page)).toContainText("Connected", { timeout: 8000 });
    await send(page, "G:SHAKE");
    await send(page, "O:0,0,0");
    await page.waitForTimeout(400);
    expect(await send(page, "BTN:DOWN"), `${axis}: BTN:DOWN delivered`).toBe(true);
    await expect(page.getByTestId("grab-chip")).toHaveText("Grabbed");
    for (let i = 1; i <= 15; i++) {
      await send(page, path(i / 15));
      await page.waitForTimeout(30);
    }
    await send(page, "BTN:UP");
    await send(page, "O:15,-20,40"); // moving after release must not move the model
    await page.waitForTimeout(800); // let the 0.25 slerp settle
    const applied = await page.evaluate(() => (window as unknown as { __magicSmokePoseApplied: number[] }).__magicSmokePoseApplied);
    const q = new Quaternion(applied[0], applied[1], applied[2], applied[3]);
    const err = (2 * Math.acos(Math.min(1, Math.abs(q.dot(expected)))) * 180) / Math.PI;
    expect(err, `${axis} error in degrees`).toBeLessThan(5);
  }
  await expect(page.getByTestId("grab-chip")).toHaveText("");
});
