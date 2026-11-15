import { expect, type Page } from "@playwright/test";

/** Every page must fit one screen: no document scroll, nothing wider or taller than the viewport. */
export async function expectNoOverflow(page: Page) {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    sw: document.documentElement.scrollWidth,
    ih: window.innerHeight,
    iw: window.innerWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
  }));
  expect(m.sh, "page height").toBeLessThanOrEqual(m.ih);
  expect(m.sw, "page width").toBeLessThanOrEqual(m.iw);
  expect(m.bodyOverflow).toBe("hidden");
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/Failed to load resource|favicon|WebGL|THREE\.WebGLRenderer/.test(msg.text())) errors.push(msg.text());
  });
  return errors;
}

export async function loadTemplate(page: Page, id: string) {
  await page.goto(`/builder?template=${id}`);
  await page.waitForURL("**/builder");
  await page.waitForSelector("[data-instance]");
}
