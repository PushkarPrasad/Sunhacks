import { beforeEach, expect, test } from "vitest";
import { angleDelta, LineBuffer, parseGloveLine } from "@/lib/input/gloveProtocol";
import { resetFuse, shouldFire } from "@/lib/input/fuse";

test("parses every glove message", () => {
  expect(parseGloveLine("READY:CURIE")).toEqual({ kind: "ready", sensor: "CURIE" });
  expect(parseGloveLine("BLE:OFF")).toEqual({ kind: "ble", on: false });
  expect(parseGloveLine("BTN:DOWN")).toEqual({ kind: "button", down: true });
  expect(parseGloveLine("G:SWIPE_L")).toEqual({ kind: "gesture", name: "SWIPE_L" });
  expect(parseGloveLine("G:THROW:120,-45")).toEqual({ kind: "throw", x: 1.2, y: -0.45 });
  expect(parseGloveLine("O:12.5,-3,359")).toEqual({ kind: "orient", roll: 12.5, pitch: -3, yaw: 359 });
  expect(parseGloveLine("O:1,2")).toEqual({ kind: "orient", roll: 1, pitch: 2 });
  expect(parseGloveLine("G:NOPE").kind).toBe("unknown");
  expect(parseGloveLine("O:x,y").kind).toBe("unknown");
});

test("yaw deltas wrap around 0/360", () => {
  expect(angleDelta(350, 10)).toBe(20);
  expect(angleDelta(10, 350)).toBe(-20);
  expect(angleDelta(90, 100)).toBe(10);
});

test("line buffer joins partial chunks", () => {
  const lb = new LineBuffer();
  expect(lb.push("READY:CU")).toEqual([]);
  expect(lb.push("RIE\nBTN:DO")).toEqual(["READY:CURIE"]);
  expect(lb.push("WN\r\n")).toEqual(["BTN:DOWN"]);
});

beforeEach(() => resetFuse());

test("webcam and glove reporting the same action within 300 ms fire once", () => {
  expect(shouldFire("select", "gesture", 1000)).toBe(true);
  expect(shouldFire("select", "glove", 1200)).toBe(false);
  expect(shouldFire("select", "glove", 1600)).toBe(true);
  // the same source repeating is not suppressed
  expect(shouldFire("nextPage", "glove", 2000)).toBe(true);
  expect(shouldFire("nextPage", "glove", 2100)).toBe(true);
});

test("globe-grab: holding the switch maps wrist turns to model rotation, release keeps it", async () => {
  const { handleGloveMessage, useGlove } = await import("@/lib/input/glove");
  const { useModelPose } = await import("@/stores/modelPose");
  useModelPose.getState().reset();
  handleGloveMessage(parseGloveLine("O:0,0,350"));
  handleGloveMessage(parseGloveLine("BTN:DOWN"));
  handleGloveMessage(parseGloveLine("O:0,10,20"));
  expect(useModelPose.getState().ry).toBeCloseTo((30 * Math.PI) / 180, 5);
  expect(useModelPose.getState().rx).toBeCloseTo((10 * Math.PI) / 180, 5);
  handleGloveMessage(parseGloveLine("BTN:UP"));
  handleGloveMessage(parseGloveLine("O:0,40,90"));
  expect(useModelPose.getState().ry).toBeCloseTo((30 * Math.PI) / 180, 5);
  expect(useGlove.getState().lastGesture?.name).toBe("Release");
});
