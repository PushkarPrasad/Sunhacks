import { expect, test } from "vitest";
import { parseCommand } from "@/components/input/VoiceController";

test("voice commands from the brief", () => {
  expect(parseCommand("Open phones")).toEqual({ kind: "go", path: "/devices/phones-laptops" });
  expect(parseCommand("start from scratch")).toEqual({ kind: "action", action: "startScratch" });
  expect(parseCommand("explode")).toEqual({ kind: "action", action: "explode" });
  expect(parseCommand("show checks")).toEqual({ kind: "action", action: "showChecks" });
  expect(parseCommand("export board")).toEqual({ kind: "action", action: "exportBoard" });
  expect(parseCommand("open smart home")).toEqual({ kind: "go", path: "/devices/smart-home" });
  expect(parseCommand("open game consoles")).toBeNull();
  expect(parseCommand("open drones")).toEqual({ kind: "go", path: "/devices/drones" });
  expect(parseCommand("show me rovers")).toEqual({ kind: "go", path: "/devices/rovers" });
  expect(parseCommand("banana")).toBeNull();
});
