import { beforeEach, describe, expect, test } from "vitest";
import { Euler, Quaternion } from "three";
import { gloveQuat, grabTarget, onKnock, onOrientation, onShake, onSwitch, quatAngleDeg, resetGrabForTests, setAxisFlips } from "@/lib/input/grab";
import { useModelPose } from "@/stores/modelPose";

const q = () => {
  const [x, y, z, w] = useModelPose.getState().q;
  return new Quaternion(x, y, z, w);
};
/** Angle in degrees between the model target and an expected rotation. */
const errDeg = (expected: Quaternion) => quatAngleDeg(q().clone().invert().multiply(expected));
const DEG = Math.PI / 180;

beforeEach(() => resetGrabForTests());

describe("grab and rotate (quaternion clutch)", () => {
  // Scripted stream from the spec: grab, rotate 90° on one axis in small steps, release; final rotation within 5°.
  const cases: [string, (t: number) => { roll: number; pitch: number; yaw: number }, Quaternion][] = [
    ["roll 90 (doorknob twist) spins the model clockwise in the screen plane", (t) => ({ roll: 90 * t, pitch: 0, yaw: 0 }), new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 } as never, -90 * DEG)],
    ["pitch 90 tips the model around the screen x axis", (t) => ({ roll: 0, pitch: 90 * t, yaw: 0 }), new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, 90 * DEG)],
    ["yaw 90 turns the model around the screen y axis", (t) => ({ roll: 0, pitch: 0, yaw: 90 * t }), new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 90 * DEG)],
  ];
  for (const [name, path, expected] of cases) {
    test(name, () => {
      onOrientation({ roll: 0, pitch: 0, yaw: 0 });
      onSwitch(true);
      for (let i = 1; i <= 30; i++) onOrientation(path(i / 30));
      onSwitch(false);
      // Moving the hand after release must not move the model.
      onOrientation({ roll: 10, pitch: -20, yaw: 33 });
      expect(errDeg(expected)).toBeLessThan(5);
      expect(useModelPose.getState().grabbed).toBe(false);
    });
  }

  test("grabbing again continues from where the model was left", () => {
    onOrientation({ roll: 0, pitch: 0, yaw: 0 });
    onSwitch(true);
    onOrientation({ roll: 0, pitch: 0, yaw: 45 });
    onSwitch(false);
    onOrientation({ roll: 0, pitch: 0, yaw: 170 }); // hand moves while released
    onSwitch(true);
    onOrientation({ roll: 0, pitch: 0, yaw: -145 }); // +45 more across the ±180 wrap
    onSwitch(false);
    expect(errDeg(new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, 90 * DEG))).toBeLessThan(5);
  });

  test("works when the grab starts away from zero and with drifted yaw", () => {
    onOrientation({ roll: 20, pitch: -10, yaw: 130 });
    onSwitch(true);
    for (let i = 1; i <= 20; i++) onOrientation({ roll: 20, pitch: -10, yaw: 130 + 4.5 * i });
    onSwitch(false);
    // Hand-space delta of +90 yaw starting from a tilted hand: the model turns 90° in total.
    expect(Math.abs(quatAngleDeg(q()) - 90)).toBeLessThan(5);
  });

  test("2° dead zone: a resting hand does not move the model", () => {
    onOrientation({ roll: 0, pitch: 0, yaw: 0 });
    onSwitch(true);
    for (let i = 0; i < 50; i++) onOrientation({ roll: Math.sin(i) * 0.8, pitch: Math.cos(i) * 0.8, yaw: Math.sin(i * 2) * 0.8 });
    expect(quatAngleDeg(q())).toBeLessThan(0.01);
  });

  test("axis flip inverts that axis", () => {
    setAxisFlips({ roll: false, pitch: false, yaw: true });
    onOrientation({ roll: 0, pitch: 0, yaw: 0 });
    onSwitch(true);
    onOrientation({ roll: 0, pitch: 0, yaw: 60 });
    expect(errDeg(new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as never, -60 * DEG))).toBeLessThan(1);
  });

  test("no switch: a knock toggles grab only while a 3D view is mounted", () => {
    expect(onKnock()).toBe(false); // no 3D view: knock is a click
    useModelPose.setState({ views: 1 });
    onOrientation({ roll: 0, pitch: 0, yaw: 0 });
    expect(onKnock()).toBe(true);
    expect(useModelPose.getState().grabbed).toBe(true);
    onOrientation({ roll: 0, pitch: 90, yaw: 0 });
    expect(onKnock()).toBe(true);
    expect(useModelPose.getState().grabbed).toBe(false);
    expect(errDeg(new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as never, 90 * DEG))).toBeLessThan(5);
  });

  test("once a switch is seen, knocks are clicks again", () => {
    useModelPose.setState({ views: 1 });
    onSwitch(true);
    onSwitch(false);
    expect(onKnock()).toBe(false);
  });

  test("shake returns to the default view", () => {
    onOrientation({ roll: 0, pitch: 0, yaw: 0 });
    onSwitch(true);
    onOrientation({ roll: 0, pitch: 0, yaw: 80 });
    onSwitch(false);
    onShake();
    expect(quatAngleDeg(q())).toBeLessThan(0.01);
  });

  test("gloveQuat is a proper XYZ Euler of the mapped axes", () => {
    const g = gloveQuat({ roll: 30, pitch: 20, yaw: 10 }, { roll: false, pitch: false, yaw: false });
    const e = new Quaternion().setFromEuler(new Euler(20 * DEG, 10 * DEG, -30 * DEG, "XYZ"));
    expect(quatAngleDeg(g.clone().invert().multiply(e))).toBeLessThan(0.01);
    expect(quatAngleDeg(grabTarget(g, g, new Quaternion()))).toBeLessThan(0.01);
  });
});
