import { expect, test } from "vitest";
import { parseCommand } from "@/components/input/VoiceController";

test("voice commands from the brief", () => {
  expect(parseCommand("Open phones")).toEqual({ kind: "go", path: "/devices/phones" });
  expect(parseCommand("start from scratch")).toEqual({ kind: "action", action: "startScratch" });
  expect(parseCommand("explode")).toEqual({ kind: "action", action: "explode" });
  expect(parseCommand("show checks")).toEqual({ kind: "action", action: "showChecks" });
  expect(parseCommand("export board")).toEqual({ kind: "action", action: "exportBoard" });
  expect(parseCommand("open smart home")).toEqual({ kind: "go", path: "/devices/smart-home" });
  expect(parseCommand("open game consoles")).toEqual({ kind: "go", path: "/devices/game-consoles" });
  expect(parseCommand("banana")).toBeNull();
});
