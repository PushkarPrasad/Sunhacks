"use client";

// Glove connection: Web Bluetooth (filtered by service UUID, not name, because macOS caches old names) with
// Web Serial (USB, 115200 baud) as a fallback. Messages go to the shared input store (stores/input.ts), which
// owns grab, rotation and gesture fusion. Connecting also starts the webcam tracker in the same click.

import { create } from "zustand";
import { fireAction, pushOrientation, recenter, setGrab, useInput } from "@/stores/input";
import { startCamera } from "./camera";
import { GLOVE_COMMAND_CHAR, GLOVE_EVENT_CHAR, GLOVE_SERVICE, GLOVE_STALE_MS, LineBuffer, parseGloveLine, type GloveMsg } from "./gloveProtocol";

export type GloveStatus = "idle" | "searching" | "connected" | "disconnected" | "error";

interface GloveState {
  status: GloveStatus;
  transport: "bluetooth" | "usb" | null;
  sensor: string | null;
  deviceName: string | null;
  lastGesture: { name: string; at: number } | null;
  lastMessageAt: number;
  messages: number;
  hasSwitch: boolean;
  error: string | null;
}

export const useGlove = create<GloveState>(() => ({
  status: "idle",
  transport: null,
  sensor: null,
  deviceName: null,
  lastGesture: null,
  lastMessageAt: 0,
  messages: 0,
  hasSwitch: false,
  error: null,
}));

// ---- minimal typings for Web Bluetooth / Web Serial (not in the TS DOM lib) ----
interface Characteristic extends EventTarget {
  value: DataView | null;
  startNotifications(): Promise<Characteristic>;
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }> }>; disconnect(): void };
}
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  close(): Promise<void>;
}

let device: BtDevice | null = null;
let command: Characteristic | null = null;
let port: SerialPortLike | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let staleTimer: ReturnType<typeof setInterval> | null = null;

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

const LABEL = { SELECT: "Knock (select)", SWIPE_L: "Flick left", SWIPE_R: "Flick right", SHAKE: "Shake (recenter)" } as const;

function gesture(name: string) {
  useGlove.setState({ lastGesture: { name, at: Date.now() } });
}

export function handleGloveMessage(m: GloveMsg) {
  useGlove.setState((s) => ({ lastMessageAt: Date.now(), messages: s.messages + 1 }));
  switch (m.kind) {
    case "ready":
      useGlove.setState({ sensor: m.sensor });
      break;
    case "button":
      useGlove.setState({ hasSwitch: true });
      gesture(m.down ? "Switch down" : "Switch up");
      setGrab("glove", m.down);
      break;
    case "orient":
      pushOrientation({ roll: m.roll, pitch: m.pitch, yaw: m.yaw });
      break;
    case "gesture":
      gesture(LABEL[m.name]);
      if (m.name === "SHAKE") recenter("glove");
      else fireAction(m.name === "SELECT" ? "select" : m.name === "SWIPE_R" ? "nextPage" : "prevPage", "glove", LABEL[m.name]);
      break;
    default:
      break;
  }
}

function onLines(lines: string[]) {
  for (const l of lines) handleGloveMessage(parseGloveLine(l));
}

function watchStale() {
  if (staleTimer) clearInterval(staleTimer);
  staleTimer = setInterval(() => {
    const s = useGlove.getState();
    if (s.status === "connected" && s.lastMessageAt && Date.now() - s.lastMessageAt > GLOVE_STALE_MS) {
      useGlove.setState({ error: "No data from the glove for a few seconds. Check its power, then reconnect." });
    }
  }, 1000);
}

function disconnected() {
  command = null;
  if (staleTimer) clearInterval(staleTimer);
  staleTimer = null;
  if (useGlove.getState().status !== "idle") useGlove.setState({ status: "disconnected" });
  setGrab("glove", false);
}

/**
 * Glove + camera together. Call straight from a click handler: the Bluetooth chooser and the camera
 * permission prompt both need a user gesture, so both requests start before anything is awaited.
 */
export function connectGloveAndCamera(transport: "bluetooth" | "usb" = "bluetooth"): Promise<void> {
  const glove = transport === "usb" ? connectUsb() : connectBluetooth();
  if (useInput.getState().camera === "off" || useInput.getState().camera === "error") void startCamera();
  return glove;
}

export async function connectBluetooth(): Promise<void> {
  const bt = (navigator as unknown as { bluetooth?: { requestDevice(o: unknown): Promise<BtDevice> } }).bluetooth;
  if (!bt) {
    useGlove.setState({ status: "error", error: "This browser has no Web Bluetooth. Use Chrome, or connect over USB." });
    return;
  }
  try {
    useGlove.setState({ status: "searching", error: null });
    const picked = await bt.requestDevice({ filters: [{ services: [GLOVE_SERVICE] }], optionalServices: [GLOVE_SERVICE] });
    if (device && device !== picked) device.removeEventListener("gattserverdisconnected", disconnected);
    device = picked;
    device.addEventListener("gattserverdisconnected", disconnected);
    useGlove.setState({ deviceName: device.name ?? null });
    await attachBluetooth();
  } catch (e) {
    const err = e as Error;
    useGlove.setState({ status: device ? "disconnected" : "idle", error: err.name === "NotFoundError" ? null : err.message });
  }
}

async function attachBluetooth() {
  if (!device?.gatt) throw new Error("No GATT server");
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(GLOVE_SERVICE);
  const events = await service.getCharacteristic(GLOVE_EVENT_CHAR);
  command = await service.getCharacteristic(GLOVE_COMMAND_CHAR).catch(() => null);
  const lb = new LineBuffer();
  const dec = new TextDecoder();
  events.addEventListener("characteristicvaluechanged", () => {
    if (!events.value) return;
    const text = dec.decode(events.value);
    // Each notification is one message (20-byte characteristic); also accept newline-joined batches.
    onLines(text.includes("\n") ? lb.push(text) : [text]);
  });
  await events.startNotifications();
  useGlove.setState({ status: "connected", transport: "bluetooth", error: null, lastMessageAt: Date.now() });
  watchStale();
}

export async function connectUsb(): Promise<void> {
  const serial = (navigator as unknown as { serial?: { requestPort(): Promise<SerialPortLike> } }).serial;
  if (!serial) {
    useGlove.setState({ status: "error", error: "This browser has no Web Serial. Use Chrome or Edge." });
    return;
  }
  try {
    useGlove.setState({ status: "searching", error: null });
    port = await serial.requestPort();
    await port.open({ baudRate: 115200 });
    useGlove.setState({ status: "connected", transport: "usb", error: null, deviceName: "USB serial", lastMessageAt: Date.now() });
    watchStale();
    void readSerial(port);
  } catch (e) {
    const err = e as Error;
    const busy = err.name === "InvalidStateError" || err.name === "NetworkError" || /open|busy|access/i.test(err.message);
    useGlove.setState({
      status: "error",
      error: err.name === "NotFoundError" ? null : busy ? "Could not open the port. Close the Arduino Serial Monitor first, then try again." : err.message,
    });
    if (err.name === "NotFoundError") useGlove.setState({ status: "idle" });
  }
}

async function readSerial(p: SerialPortLike) {
  const lb = new LineBuffer();
  const dec = new TextDecoder();
  try {
    reader = p.readable!.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onLines(lb.push(dec.decode(value, { stream: true })));
    }
  } catch {
    // unplugged
  }
  reader = null;
  port = null;
  disconnected();
}

/** One click: reattach the same Bluetooth device, reopen USB, or fall back to the chooser. */
export async function reconnect(): Promise<void> {
  const t = useGlove.getState().transport;
  if (t === "bluetooth" && device?.gatt) {
    try {
      useGlove.setState({ status: "searching", error: null });
      await attachBluetooth();
      return;
    } catch {
      return connectBluetooth();
    }
  }
  if (t === "usb") return connectUsb();
  return connectBluetooth();
}

export async function disconnectGlove(): Promise<void> {
  try {
    device?.gatt?.disconnect();
    await reader?.cancel();
    await port?.close();
  } catch {
    // already gone
  }
  disconnected();
}

/** One-byte command. 'B' blinks the glove LED 3 times. Writes are queued through one promise chain. */
export function sendGlove(byte: "B"): Promise<void> {
  const data = new TextEncoder().encode(byte);
  writeChain = writeChain
    .then(async () => {
      if (command) {
        if (command.writeValueWithoutResponse) await command.writeValueWithoutResponse(data);
        else await command.writeValue(data);
      } else if (port?.writable) {
        const w = port.writable.getWriter();
        try {
          await w.write(data);
        } finally {
          w.releaseLock();
        }
      }
    })
    .catch(() => {
      // best effort; the next write still runs
    });
  return writeChain;
}

if (typeof window !== "undefined") {
  // Test hook: Playwright feeds simulated protocol lines (no Bluetooth in headless Chrome).
  (window as unknown as { __magicSmokeGlove?: unknown }).__magicSmokeGlove = {
    line: (l: string) => handleGloveMessage(parseGloveLine(l)),
    connected: () => useGlove.setState({ status: "connected", transport: "bluetooth", lastMessageAt: Date.now() }),
    dropped: () => disconnected(),
  };
}
