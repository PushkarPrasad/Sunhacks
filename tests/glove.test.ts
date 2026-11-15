import { beforeEach, expect, test } from "vitest";
import { angleDelta, LineBuffer, parseGloveLine } from "@/lib/input/gloveProtocol";
import { resetFuse, shouldFire } from "@/lib/input/fuse";

test("parses every message the Arduino 101 sketch sends", () => {
  expect(parseGloveLine("READY:CURIE")).toEqual({ kind: "ready", sensor: "CURIE" });
  expect(parseGloveLine("BTN:DOWN")).toEqual({ kind: "button", down: true });
  expect(parseGloveLine("BTN:UP")).toEqual({ kind: "button", down: false });
  expect(parseGloveLine("G:SWIPE_L")).toEqual({ kind: "gesture", name: "SWIPE_L" });
  expect(parseGloveLine("G:SWIPE_R")).toEqual({ kind: "gesture", name: "SWIPE_R" });
  expect(parseGloveLine("G:SELECT")).toEqual({ kind: "gesture", name: "SELECT" });
  expect(parseGloveLine("G:SHAKE")).toEqual({ kind: "gesture", name: "SHAKE" });
  expect(parseGloveLine("O:12,-3,-179")).toEqual({ kind: "orient", roll: 12, pitch: -3, yaw: -179 });
  expect(parseGloveLine("O:12,-3,5\0\0")).toEqual({ kind: "orient", roll: 12, pitch: -3, yaw: 5 });
});

test("old formats are ignored", () => {
  for (const l of ["MODE:MOTION", "A:1,2,3", "G:THROW:120,-45", "BLE:ON", "O:1,2", "O:x,y,z", "G:NOPE"]) expect(parseGloveLine(l).kind, l).toBe("unknown");
});

test("yaw deltas wrap around ±180", () => {
  expect(angleDelta(170, -170)).toBe(20);
  expect(angleDelta(-170, 170)).toBe(-20);
  expect(angleDelta(350, 10)).toBe(20);
  expect(angleDelta(90, 100)).toBe(10);
});

test("line buffer joins partial chunks", () => {
  const lb = new LineBuffer();
  expect(lb.push("READY:CU")).toEqual([]);
  expect(lb.push("RIE\nBTN:DO")).toEqual(["READY:CURIE"]);
  expect(lb.push("WN\r\n")).toEqual(["BTN:DOWN"]);
});

beforeEach(() => resetFuse());

test("a second event of the same action within 300 ms is dropped, from either source", () => {
  expect(shouldFire("select", "camera", 1000)).toBe(true);
  expect(shouldFire("select", "glove", 1200)).toBe(false);
  expect(shouldFire("select", "glove", 1350)).toBe(true);
  expect(shouldFire("nextPage", "glove", 2000)).toBe(true);
  expect(shouldFire("nextPage", "glove", 2100)).toBe(false);
  expect(shouldFire("prevPage", "glove", 2100)).toBe(true);
});

test("glove messages drive the quaternion grab end to end (switch held, release keeps the pose)", async () => {
  const { handleGloveMessage } = await import("@/lib/input/glove");
  const { resetInputForTests, useInput } = await import("@/stores/input");
  const { resetGrabForTests, quatAngleDeg } = await import("@/lib/input/grab");
  const { useModelPose } = await import("@/stores/modelPose");
  const { Quaternion } = await import("three");
  resetInputForTests();
  resetGrabForTests();
  handleGloveMessage(parseGloveLine("O:0,0,170"));
  handleGloveMessage(parseGloveLine("BTN:DOWN"));
  expect(useModelPose.getState().grabbed).toBe(true);
  expect(useInput.getState().grabbing).toBe(true);
  handleGloveMessage(parseGloveLine("O:0,0,-160")); // +30° yaw across the wrap
  const angle = () => quatAngleDeg(new Quaternion(...useModelPose.getState().q));
  expect(Math.abs(angle() - 30)).toBeLessThan(1);
  handleGloveMessage(parseGloveLine("BTN:UP"));
  handleGloveMessage(parseGloveLine("O:0,40,90"));
  expect(Math.abs(angle() - 30)).toBeLessThan(1);
});

test("shake animates back to the default view", async () => {
  const { handleGloveMessage } = await import("@/lib/input/glove");
  const { useModelPose } = await import("@/stores/modelPose");
  useModelPose.getState().setQ([0, 0.5, 0, 0.866]);
  handleGloveMessage(parseGloveLine("G:SHAKE"));
  expect(useModelPose.getState().q).toEqual([0, 0, 0, 1]);
});
