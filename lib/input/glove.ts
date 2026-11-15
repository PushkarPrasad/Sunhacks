"use client";

// Glove connection: Web Bluetooth first (filtered by service UUID, so a renamed firmware still matches),
// Web Serial (USB, 115200 baud) as a fallback. Messages drive the input bus and the globe-grab model rotation.

import { create } from "zustand";
import { useModelPose } from "@/stores/modelPose";
import { emitFused } from "./fuse";
import { angleDelta, GLOVE_COMMAND_CHAR, GLOVE_EVENT_CHAR, GLOVE_SERVICE, LineBuffer, parseGloveLine, type GloveMsg } from "./gloveProtocol";

export type GloveStatus = "idle" | "searching" | "connected" | "disconnected" | "error";
type Orientation = { roll: number; pitch: number; yaw?: number };

interface GloveState {
  status: GloveStatus;
  transport: "bluetooth" | "usb" | null;
  sensor: string | null;
  lastGesture: { name: string; at: number } | null;
  orientation: Orientation | null;
  grabbing: boolean;
  error: string | null;
}

export const useGlove = create<GloveState>(() => ({
  status: "idle",
  transport: null,
  sensor: null,
  lastGesture: null,
  orientation: null,
  grabbing: false,
  error: null,
}));

// ---- minimal typings for Web Bluetooth / Web Serial (not in the TS DOM lib) ----
interface Characteristic extends EventTarget {
  value: DataView | null;
  startNotifications(): Promise<Characteristic>;
  writeValue(data: BufferSource): Promise<void>;
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
let grabStart: { o: Orientation; rx: number; ry: number; rz: number } | null = null;
const DEG = Math.PI / 180;

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

function gesture(name: string) {
  useGlove.setState({ lastGesture: { name, at: Date.now() } });
}

export function handleGloveMessage(m: GloveMsg) {
  switch (m.kind) {
    case "ready":
      useGlove.setState({ sensor: m.sensor });
      break;
    case "button": {
      useGlove.setState({ grabbing: m.down });
      gesture(m.down ? "Grab" : "Release");
      const o = useGlove.getState().orientation;
      const p = useModelPose.getState();
      grabStart = m.down && o ? { o, rx: p.rx, ry: p.ry, rz: p.rz } : null;
      break;
    }
    case "orient": {
      useGlove.setState({ orientation: { roll: m.roll, pitch: m.pitch, yaw: m.yaw } });
      const st = useGlove.getState();
      if (st.grabbing && !grabStart) {
        const p = useModelPose.getState();
        grabStart = { o: { roll: m.roll, pitch: m.pitch, yaw: m.yaw }, rx: p.rx, ry: p.ry, rz: p.rz };
      }
      if (st.grabbing && grabStart) {
        // Turn the model like a globe: yaw (or roll without a yaw sensor) spins it, pitch tilts it.
        const dPitch = angleDelta(grabStart.o.pitch, m.pitch);
        const dRoll = angleDelta(grabStart.o.roll, m.roll);
        const dYaw = m.yaw !== undefined && grabStart.o.yaw !== undefined ? angleDelta(grabStart.o.yaw, m.yaw) : dRoll;
        useModelPose.getState().set({
          rx: grabStart.rx + dPitch * DEG,
          ry: grabStart.ry + dYaw * DEG,
          rz: m.yaw !== undefined ? grabStart.rz - dRoll * DEG * 0.5 : grabStart.rz,
        });
      }
      break;
    }
    case "gesture": {
      const map = { SELECT: "select", SWIPE_L: "prevPage", SWIPE_R: "nextPage", SHAKE: "back", ZOOM_IN: "zoomIn", ZOOM_OUT: "zoomOut" } as const;
      const label = { SELECT: "Tap", SWIPE_L: "Flick left", SWIPE_R: "Flick right", SHAKE: "Shake", ZOOM_IN: "Zoom in", ZOOM_OUT: "Zoom out" }[m.name];
      gesture(label);
      emitFused(map[m.name], "glove");
      break;
    }
    // G:THROW is ignored on purpose: Hoop Upload is mouse and trackpad only.
    default:
      break;
  }
}

function onLines(lines: string[]) {
  for (const l of lines) handleGloveMessage(parseGloveLine(l));
}

function disconnected() {
  command = null;
  useGlove.setState({ status: "disconnected", grabbing: false });
  grabStart = null;
}

export async function connectBluetooth(): Promise<void> {
  const bt = (navigator as unknown as { bluetooth?: { requestDevice(o: unknown): Promise<BtDevice> } }).bluetooth;
  if (!bt) {
    useGlove.setState({ status: "error", error: "This browser has no Web Bluetooth. Try Chrome, or connect over USB." });
    return;
  }
  try {
    useGlove.setState({ status: "searching", error: null });
    device = await bt.requestDevice({ filters: [{ services: [GLOVE_SERVICE] }], optionalServices: [GLOVE_SERVICE] });
    device.addEventListener("gattserverdisconnected", disconnected);
    await attachBluetooth();
  } catch (e) {
    useGlove.setState({ status: device ? "disconnected" : "idle", error: (e as Error).name === "NotFoundError" ? null : (e as Error).message });
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
    // Each notification is one message; also accept newline-joined batches.
    onLines(text.includes("\n") ? lb.push(text) : [text]);
  });
  await events.startNotifications();
  useGlove.setState({ status: "connected", transport: "bluetooth", error: null });
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
    useGlove.setState({ status: "connected", transport: "usb", error: null });
    void readSerial(port);
  } catch (e) {
    useGlove.setState({ status: "idle", error: (e as Error).name === "NotFoundError" ? null : (e as Error).message });
  }
}

async function readSerial(p: SerialPortLike) {
  const lb = new LineBuffer();
  const dec = new TextDecoder();
  try {
    const reader = p.readable!.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onLines(lb.push(dec.decode(value, { stream: true })));
    }
  } catch {
    // unplugged
  }
  port = null;
  disconnected();
}

export async function reconnect(): Promise<void> {
  const t = useGlove.getState().transport;
  if (t === "bluetooth" && device?.gatt) {
    try {
      useGlove.setState({ status: "searching", error: null });
      await attachBluetooth();
      return;
    } catch (e) {
      useGlove.setState({ status: "disconnected", error: (e as Error).message });
      return;
    }
  }
  if (t === "usb") return connectUsb();
  return connectBluetooth();
}

export async function disconnectGlove(): Promise<void> {
  try {
    device?.gatt?.disconnect();
    await port?.close();
  } catch {
    // already gone
  }
  disconnected();
}

/** One-byte command: 'B' blinks the glove LED, 'S' toggles raw streaming. */
export async function sendGlove(byte: "B" | "S"): Promise<void> {
  const data = new TextEncoder().encode(byte);
  try {
    if (command) await command.writeValue(data);
    else if (port?.writable) {
      const w = port.writable.getWriter();
      await w.write(data);
      w.releaseLock();
    }
  } catch {
    // best effort
  }
}
