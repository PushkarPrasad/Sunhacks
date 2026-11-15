import { expect, test, type Page } from "@playwright/test";
import { fakeBluetoothScript } from "./fixtures/fakeBluetooth";

// Headless check of public/test/glove-camera.html with simulated glove lines, synthetic MediaPipe landmarks
// (world + image) and the fake Web Bluetooth fixture. No camera, no hardware.

type P3 = { x: number; y: number; z: number };
type Hand = { image: P3[]; world: P3[] | null; score: number } | null;
type Rect = { x: number; y: number; w: number; h: number };
type SnapInfo = { vw: number; vh: number; reach: { x0: number; y0: number; x1: number; y1: number }; goal: string; hits: number; attempts: number; locked: string | null; targets: { id: string; rect: Rect }[] };
type TP = {
  line(l: string): void;
  frame(h: Hand, t: number): void;
  frames(list: { hand: Hand; t: number }[]): { hits: number; attempts: number; goal: string };
  openness(): { value: number | null; driving: boolean; raw: number; why: string };
  snapInfo(): SnapInfo;
  pose(): { q: number[]; shown: number[]; grabbed: boolean; hasSwitch: boolean; switchDown: boolean | null };
  link(): { status: string; readyCount: number; heartbeat: string };
  linkLog(): { at: number; kind: string; text: string }[];
  camera(): { started: boolean };
};
type Fake = { send(l: string): boolean; drop(): void; failNext(n: number): void; stats(): { connects: number; subscriptions: number; listeners: number } };

const tp = <R>(page: Page, fn: (t: TP, arg: never) => R, arg?: unknown) =>
  page.evaluate(([f, a]) => new Function("t", "a", `return (${f})(t, a)`)((window as unknown as { __testPage: TP }).__testPage, a), [fn.toString(), arg] as const) as Promise<R>;
const line = (page: Page, l: string) => page.evaluate((x) => (window as unknown as { __testPage: TP }).__testPage.line(x), l);

// ---------- synthetic hands ----------
const DEG = Math.PI / 180;
/**
 * World landmarks (metres) for a hand with the palm square to the camera (palm in the x-y plane). Each finger bends
 * by mcp/pip/dip degrees out of the palm plane, so the angle between consecutive bones is exactly that bend.
 */
function worldHand(mcp: number, pip: number, dip: number): P3[] {
  const w: P3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const mcps: [number, P3][] = [[5, { x: -0.03, y: -0.09, z: 0 }], [9, { x: -0.01, y: -0.095, z: 0 }], [13, { x: 0.01, y: -0.09, z: 0 }], [17, { x: 0.03, y: -0.08, z: 0 }]];
  const lens = [0.04, 0.025, 0.02];
  for (const [i, m] of mcps) {
    w[i] = m;
    const l = Math.hypot(m.x, m.y);
    const d = { x: m.x / l, y: m.y / l };
    let phi = 0;
    let p = m;
    [mcp, pip, dip].forEach((bend, k) => {
      phi += bend * DEG;
      p = { x: p.x + lens[k] * d.x * Math.cos(phi), y: p.y + lens[k] * d.y * Math.cos(phi), z: p.z - lens[k] * Math.sin(phi) };
      w[i + k + 1] = p;
    });
  }
  [1, 2, 3, 4].forEach((k) => (w[k] = { x: -0.03 - 0.015 * k, y: -0.02 - 0.01 * k, z: 0 }));
  return w;
}
/** Image landmarks (normalized) with the index MCP (landmark 5) at (x, y); pinch puts the thumb tip on the index tip. */
function imageHand(x: number, y: number, pinch = false): P3[] {
  const lm: P3[] = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  lm[0] = { x: x + 0.03, y: y + 0.13, z: 0 };
  [5, 9, 13, 17].forEach((m, i) => {
    lm[m] = { x: x + 0.025 * i, y: y - (i === 0 ? 0 : 0.005), z: 0 };
    for (let k = 1; k <= 3; k++) lm[m + k] = { x: lm[m].x, y: lm[m].y - 0.035 * k, z: 0 };
  });
  [1, 2, 3].forEach((k) => (lm[k] = { x: x - 0.03 * k, y: y + 0.1 - 0.02 * k, z: 0 }));
  lm[4] = pinch ? { ...lm[8] } : { x: x - 0.1, y: y + 0.03, z: 0 };
  return lm;
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const qAngleDeg = (a: number[], b: number[]) => (2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180) / Math.PI;
const qmul = (a: number[], b: number[]) => [
  a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
  a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
  a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

test("openness meter, snap grid and quaternion grab with simulated input", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/test/glove-camera.html");
  await page.waitForFunction(() => (window as unknown as { __testPage?: unknown }).__testPage);
  await expect(page.locator("#score")).toContainText("0 / 17");

  // ---- openness: fist / half / open within ±0.1 (world landmarks, One Euro, gates, 300 ms engage) ----
  let t = 10_000;
  const still = imageHand(0.5, 0.45);
  const poses: [string, P3[], number][] = [
    ["open", worldHand(0, 0, 0), 1],
    ["half", worldHand(38, 38, 38), 0.5],
    ["fist", worldHand(80, 90, 60), 0],
  ];
  const measured: Record<string, number> = {};
  for (const [name, world, expected] of poses) {
    const list = Array.from({ length: 45 }, () => ({ hand: { image: still, world, score: 0.95 }, t: (t += 33) }));
    await tp(page, (x, a: { hand: Hand; t: number }[]) => x.frames(a), list);
    const o = await tp(page, (x) => x.openness());
    expect(o.driving, `${name} drives`).toBe(true);
    expect(Math.abs((o.value ?? NaN) - expected), `${name} openness ${o.value}`).toBeLessThanOrEqual(0.1);
    measured[name] = o.value ?? NaN;
    const shown = Number(await page.getByTestId("openness-value").textContent());
    expect(Math.abs(shown - expected)).toBeLessThanOrEqual(0.1);
  }
  // gate: palm turned edge-on holds the last value
  const edgeOn = worldHand(0, 0, 0).map((p) => ({ x: p.z, y: p.y, z: p.x }));
  await tp(page, (x, a: { hand: Hand; t: number }[]) => x.frames(a), Array.from({ length: 10 }, () => ({ hand: { image: still, world: edgeOn, score: 0.95 }, t: (t += 33) })));
  const held = await tp(page, (x) => x.openness());
  expect(held.driving).toBe(false);
  expect(held.value).toBe(measured.fist);
  console.log(`openness measured: open ${measured.open.toFixed(3)}, half ${measured.half.toFixed(3)}, fist ${measured.fist.toFixed(3)}`);
  await tp(page, (x, a: number) => x.frame(null, a), (t += 33));

  // ---- snap grid: scripted pointer path with ±30 px noise, pinch to click, ≥ 95% hits ----
  const info = await tp(page, (x) => x.snapInfo());
  const { vw, vh, reach } = info;
  const toSource = (px: number, py: number) => ({ x: 1 - (reach.x0 + (px / vw) * (reach.x1 - reach.x0)), y: reach.y0 + (py / vh) * (reach.y1 - reach.y0) });
  const rand = rng(42);
  const noise = () => (rand() * 2 - 1) * 30;
  let pos = { x: vw / 2, y: vh / 2 };
  let goal = info.goal;
  const CLICKS = 40;
  let result = { hits: 0, attempts: 0, goal };
  let ringChecked = false;
  for (let c = 0; c < CLICKS; c++) {
    const r = info.targets.find((x) => x.id === goal)!.rect;
    const to = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    const frames: { hand: Hand; t: number }[] = [];
    const at = (px: number, py: number, pinch: boolean) => {
      const s = toSource(px + noise(), py + noise());
      frames.push({ hand: { image: imageHand(s.x, s.y, pinch), world: null, score: 0.95 }, t: (t += 33) });
    };
    for (let i = 1; i <= 10; i++) at(pos.x + ((to.x - pos.x) * i) / 10, pos.y + ((to.y - pos.y) * i) / 10, false);
    for (let i = 0; i < 8; i++) at(to.x, to.y, false);
    if (!ringChecked) {
      // stop on the target and check that the cursor ring has morphed onto the locked button
      await tp(page, (x, a: { hand: Hand; t: number }[]) => x.frames(a), frames.splice(0));
      const s = await tp(page, (x) => x.snapInfo());
      expect(s.locked).toBe(goal);
      await page.waitForTimeout(300);
      const ring = await page.locator("#ring").boundingBox();
      const btn = await page.locator(`#${goal}`).boundingBox();
      expect(await page.locator("#ring").getAttribute("class")).toContain("locked");
      expect(Math.abs(ring!.width - (btn!.width + 10))).toBeLessThan(2);
      expect(Math.abs(ring!.x - (btn!.x - 5))).toBeLessThan(2);
      await page.screenshot({ path: "test-results/glove-camera-snap.png" });
      ringChecked = true;
    }
    for (let i = 0; i < 3; i++) at(to.x, to.y, true);
    for (let i = 0; i < 3; i++) at(to.x, to.y, false);
    result = await tp(page, (x, a: { hand: Hand; t: number }[]) => x.frames(a), frames);
    pos = to;
    goal = result.goal;
  }
  const rate = result.hits / result.attempts;
  console.log(`snap grid: ${result.hits} hits / ${result.attempts} attempts = ${(rate * 100).toFixed(1)}%`);
  expect(result.attempts).toBe(CLICKS);
  expect(rate).toBeGreaterThanOrEqual(0.95);
  await expect(page.locator("#snapScore")).toHaveText(`${result.hits} / ${result.attempts}`);
  await expect(page.locator("#snapRate")).toHaveText(`${Math.round(rate * 100)}%`);
  await tp(page, (x, a: number) => x.frame(null, a), (t += 33));

  // ---- grab: no switch yet, so a knock toggles grab ----
  await expect(page.locator("#grabMode")).toHaveText("knock toggles");
  await expect(page.locator("#swSeen")).toHaveText("no");
  await line(page, "O:0,0,0");
  await line(page, "G:SELECT");
  await expect(page.getByTestId("grab-state")).toHaveText("Grabbed");
  await line(page, "G:SELECT");
  await expect(page.getByTestId("grab-state")).toHaveText("Released");

  // ---- grab with the switch: yaw 90° rotates the cube; release keeps it ----
  for (const o of ["READY:CURIE", "O:35,0,0", "O:-35,0,0", "O:0,30,0", "O:0,-30,0", "O:0,0,40", "O:0,0,-40", "O:0,0,0", "G:SWIPE_L", "G:SWIPE_R", "G:SHAKE"]) await line(page, o);
  for (let i = 0; i < 10; i++) await line(page, "O:0,0,0");
  await page.waitForTimeout(400);
  const q0 = (await tp(page, (x) => x.pose())).q;
  await line(page, "BTN:DOWN");
  await expect(page.getByTestId("grab-state")).toHaveText("Grabbed");
  await expect(page.locator("#swState")).toHaveText("down");
  await expect(page.locator("#swSeen")).toHaveText("yes");
  await expect(page.locator("#grabMode")).toHaveText("switch (hold)");
  for (let i = 1; i <= 15; i++) await line(page, `O:0,0,${i * 6}`);
  await line(page, "BTN:UP");
  await expect(page.getByTestId("grab-state")).toHaveText("Released");
  await expect(page.locator("#swState")).toHaveText("up");
  const qRel = (await tp(page, (x) => x.pose())).q;
  const yaw90 = [0, Math.sin(45 * DEG), 0, Math.cos(45 * DEG)];
  const expected = qmul(yaw90, q0);
  const grabErr = qAngleDeg(qRel, expected);
  const turned = qAngleDeg(qRel, q0);
  expect(turned).toBeGreaterThan(85);
  expect(grabErr).toBeLessThan(1);
  await line(page, "O:15,-20,40"); // moving after release must not move the cube
  await page.waitForTimeout(800); // let the 0.25 slerp settle
  const after = await tp(page, (x) => x.pose());
  const keepErr = qAngleDeg(after.q, qRel);
  const shownErr = qAngleDeg(after.shown, qRel);
  expect(keepErr).toBeLessThan(0.5);
  expect(shownErr).toBeLessThan(2);
  console.log(`grab: turned ${turned.toFixed(1)}°, error vs qDelta*qModel0 ${grabErr.toFixed(2)}°, drift after release ${keepErr.toFixed(2)}°, shown cube error ${shownErr.toFixed(2)}°`);

  const doneIds = await page.evaluate(() => (window as unknown as { __test: { done(): string[] } }).__test.done());
  for (const id of ["c_hand", "c_fist", "c_half", "c_open", "c_snap", "c_rate", "r_turn", "r_keep", "g_sw"]) expect(doneIds).toContain(id);
  expect((await tp(page, (x) => x.camera())).started).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/glove-camera-bench.png" });
});

test("link: heartbeat, stall after 4 s, drop and reconnect with backoff in the log", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(fakeBluetoothScript);
  await page.goto("/test/glove-camera.html");
  await page.waitForFunction(() => (window as unknown as { __testPage?: unknown }).__testPage);
  await page.waitForTimeout(1000);
  const fake = <R>(fn: (f: Fake) => R) => page.evaluate(new Function("return (" + fn.toString() + ")(window.__fakeGlove)") as () => R);
  const status = page.getByTestId("link-status");
  const logEl = page.getByTestId("link-log");

  await page.getByRole("button", { name: "Connect Bluetooth" }).click();
  await expect(status).toContainText("Connected");
  await expect(logEl).toContainText("Connected to Copperline Glove over Bluetooth");
  expect((await tp(page, (x) => x.camera())).started).toBe(false); // connecting never starts the camera
  expect(await fake((f) => f.send("READY:CURIE"))).toBe(true);
  expect(await fake((f) => f.send("O:0,0,0"))).toBe(true);
  await expect(page.locator("#readyCount")).toHaveText("1");
  await expect(page.getByTestId("heartbeat")).toHaveText("Live");

  // Drop: same device, backoff, first attempt fails, second reconnects; one listener after re-subscribing.
  await fake((f) => f.failNext(1));
  await fake((f) => f.drop());
  await expect(status).toContainText("Reconnecting");
  await expect(status).toContainText("Connected", { timeout: 6000 });
  await expect(logEl).toContainText("Link dropped");
  await expect(logEl).toContainText("Attempt 1 in 0.5 s");
  await expect(logEl).toContainText("Attempt 1 failed");
  await expect(logEl).toContainText("Attempt 2 in 1 s");
  await expect(logEl).toContainText("Reconnected (attempt 2)");
  let s = await fake((f) => f.stats());
  expect(s.connects).toBe(2);
  expect(s.subscriptions).toBe(2);
  expect(s.listeners).toBe(1);
  expect(await fake((f) => f.send("READY:CURIE"))).toBe(true);
  await expect(page.locator("#readyCount")).toHaveText("2");
  const lastMsg = Date.now();

  // Silence: after 4 s the heartbeat reads Stalled, the watchdog logs the stall and reconnects.
  await expect(page.getByTestId("heartbeat")).toHaveText("Live");
  await expect(page.getByTestId("heartbeat")).toHaveText("Stalled", { timeout: 7000 });
  const stalledAfter = Date.now() - lastMsg;
  expect(stalledAfter).toBeGreaterThanOrEqual(3900);
  await expect(logEl).toContainText("No data for", { timeout: 3000 });
  await expect.poll(async () => (await fake((f) => f.stats())).connects, { timeout: 6000 }).toBe(3);
  s = await fake((f) => f.stats());
  expect(s.listeners).toBe(1);
  console.log(`stall shown ${stalledAfter} ms after the last message`);

  const entries = await tp(page, (x) => x.linkLog());
  for (const k of ["connect", "disconnect", "backoff", "retry", "reconnect", "stall"]) expect(entries.map((e) => e.kind)).toContain(k);
  await expect(logEl).toContainText(/\d\d:\d\d:\d\d\.\d{3}/);
  await expect(page.locator(".tip")).toHaveText("If the glove LED keeps flashing once a second but this stops updating, the link is the problem; if the LED stops, the board hung.");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/glove-camera-link.png" });
});
