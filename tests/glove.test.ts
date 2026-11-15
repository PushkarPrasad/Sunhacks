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

test("globe-grab: switch held turns the model from the grab-start baseline, release keeps it", async () => {
  const { handleGloveMessage } = await import("@/lib/input/glove");
  const { resetInputForTests, useInput } = await import("@/stores/input");
  const { useModelPose } = await import("@/stores/modelPose");
  resetInputForTests();
  useModelPose.getState().reset();
  handleGloveMessage(parseGloveLine("O:0,0,170"));
  handleGloveMessage(parseGloveLine("BTN:DOWN"));
  expect(useInput.getState().grabbing).toBe(true);
  // smoothed: many samples converge on the target
  for (let i = 0; i < 40; i++) handleGloveMessage(parseGloveLine("O:0,10,-160"));
  expect(useModelPose.getState().ry).toBeCloseTo((30 * Math.PI) / 180, 3);
  expect(useModelPose.getState().rx).toBeCloseTo((10 * Math.PI) / 180, 3);
  handleGloveMessage(parseGloveLine("BTN:UP"));
  handleGloveMessage(parseGloveLine("O:0,40,90"));
  expect(useModelPose.getState().ry).toBeCloseTo((30 * Math.PI) / 180, 3);
  expect(useInput.getState().events[0].label).toBe("Switch up");
});

test("a camera fist counts as a grab, so fist + twist works with no switch", async () => {
  const { handleGloveMessage } = await import("@/lib/input/glove");
  const { resetInputForTests, setGrab, useInput } = await import("@/stores/input");
  const { useModelPose } = await import("@/stores/modelPose");
  resetInputForTests();
  useModelPose.getState().reset();
  handleGloveMessage(parseGloveLine("O:5,0,0"));
  setGrab("camera", true);
  for (let i = 0; i < 40; i++) handleGloveMessage(parseGloveLine("O:5,0,60"));
  expect(useModelPose.getState().ry).toBeCloseTo((60 * Math.PI) / 180, 3);
  setGrab("camera", false);
  expect(useInput.getState().grabbing).toBe(false);
});

test("shake recenters the model", async () => {
  const { handleGloveMessage } = await import("@/lib/input/glove");
  const { useModelPose } = await import("@/stores/modelPose");
  useModelPose.getState().set({ ry: 1 });
  handleGloveMessage(parseGloveLine("G:SHAKE"));
  expect(useModelPose.getState().ry).toBe(0);
});
