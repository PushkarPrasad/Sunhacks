"use client";

// Glove link (P0-1). One module-level singleton outside React: the BluetoothDevice, characteristics, listeners and
// timers live here, so client-side page navigation never drops the link (a full page reload would).
//
//   connect         Web Bluetooth chooser filtered by service UUID (names are cached by macOS), or USB serial.
//   auto-reconnect  on gattserverdisconnected (not user-initiated): device.gatt.connect() on the same device, no
//                   chooser. Back off 0.5 s, 1 s, 2 s, 4 s, then every 5 s for up to 2 minutes. Re-subscribe
//                   to notifications after every reconnect (old listener removed first).
//   watchdog        no message for 4 s (READY arrives every 3 s) = stalled: disconnect, which triggers the
//                   reconnect path above.
//   writes          one promise-chain queue, writeValueWithoutResponse when available.
//   log             every connect, disconnect, reconnect and stall goes into a ring buffer for the Glove tab.

import { create } from "zustand";
import { fireAction, logInputEvent, pushOrientation, recenter, setSwitch } from "@/stores/input";
import { onKnock, onOrientation, onSwitch, releaseGrab } from "./grab";
import { GLOVE_COMMAND_CHAR, GLOVE_EVENT_CHAR, GLOVE_SERVICE, LineBuffer, parseGloveLine, type GloveMsg } from "./gloveProtocol";

export type GloveStatus = "idle" | "searching" | "connected" | "reconnecting" | "stalled" | "disconnected" | "error";

export interface LinkLogEntry {
  at: number;
  kind: "connect" | "disconnect" | "reconnect" | "retry" | "stall" | "give-up" | "error";
  text: string;
}

interface GloveState {
  status: GloveStatus;
  transport: "bluetooth" | "usb" | null;
  sensor: string | null;
  deviceName: string | null;
  lastGesture: { name: string; at: number } | null;
  lastMessageAt: number;
  lastReadyAt: number;
  messages: number;
  hasSwitch: boolean;
  error: string | null;
  attempt: number;
  log: LinkLogEntry[];
}

export const useGlove = create<GloveState>(() => ({
  status: "idle",
  transport: null,
  sensor: null,
  deviceName: null,
  lastGesture: null,
  lastMessageAt: 0,
  lastReadyAt: 0,
  messages: 0,
  hasSwitch: false,
  error: null,
  attempt: 0,
  log: [],
}));

/** Timing constants (exported for tests and the Glove tab). */
export const STALL_MS = 4000;
export const BACKOFF_MS = [500, 1000, 2000, 4000];
export const RETRY_EVERY_MS = 5000;
export const RETRY_FOR_MS = 120_000;
const LOG_MAX = 60;

export function linkLog(kind: LinkLogEntry["kind"], text: string) {
  useGlove.setState((s) => ({ log: [{ at: Date.now(), kind, text }, ...s.log].slice(0, LOG_MAX) }));
}

// ---- minimal typings for Web Bluetooth / Web Serial (not in the TS DOM lib) ----
interface Characteristic extends EventTarget {
  value: DataView | null;
  startNotifications(): Promise<Characteristic>;
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface BtServer {
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }>;
}
interface BtDevice extends EventTarget {
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<BtServer>; disconnect(): void };
}
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  close(): Promise<void>;
}

// ---- the singleton ----
let device: BtDevice | null = null;
let events: Characteristic | null = null;
let command: Characteristic | null = null;
let port: SerialPortLike | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let watchdog: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryStartedAt = 0;
let userClosed = false;
let attaching = false;
const lines = new LineBuffer();
const decoder = new TextDecoder();

export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const serialSupported = () => typeof navigator !== "undefined" && "serial" in navigator;

const LABEL = { SELECT: "Knock", SWIPE_L: "Flick left", SWIPE_R: "Flick right", SHAKE: "Shake (reset view)" } as const;

function gesture(name: string) {
  useGlove.setState({ lastGesture: { name, at: Date.now() } });
}

export function handleGloveMessage(m: GloveMsg) {
  const now = Date.now();
  useGlove.setState((s) => ({ lastMessageAt: now, messages: s.messages + 1, ...(s.status === "stalled" ? { status: "connected" as const } : {}) }));
  switch (m.kind) {
    case "ready":
      useGlove.setState({ sensor: m.sensor, lastReadyAt: now });
      break;
    case "button":
      useGlove.setState({ hasSwitch: true });
      gesture(m.down ? "Switch down (grab)" : "Switch up (release)");
      setSwitch(m.down);
      onSwitch(m.down);
      break;
    case "orient":
      pushOrientation({ roll: m.roll, pitch: m.pitch, yaw: m.yaw });
      onOrientation({ roll: m.roll, pitch: m.pitch, yaw: m.yaw });
      break;
    case "gesture":
      if (m.name === "SHAKE") {
        gesture(LABEL.SHAKE);
        recenter("glove");
      } else if (m.name === "SELECT") {
        if (onKnock()) {
          gesture("Knock (grab toggle)");
          logInputEvent("Knock (grab toggle)", "glove");
        } else {
          gesture(LABEL.SELECT);
          fireAction("select", "glove", "Knock (select)");
        }
      } else {
        gesture(LABEL[m.name]);
        fireAction(m.name === "SWIPE_R" ? "nextPage" : "prevPage", "glove", LABEL[m.name]);
      }
      break;
    default:
      break;
  }
}

function onNotify() {
  if (!events?.value) return;
  const text = decoder.decode(events.value);
  // One message per notification (20-byte characteristic); also accept newline-joined batches.
  for (const l of text.includes("\n") ? lines.push(text) : [text]) handleGloveMessage(parseGloveLine(l));
}

function startWatchdog() {
  if (watchdog) clearInterval(watchdog);
  let lastTick = Date.now();
  let graceUntil = 0;
  watchdog = setInterval(() => {
    const now = Date.now();
    // If this tick ran late, the page itself was blocked (e.g. a 3D scene compiling); notifications are queued
    // behind it, not lost. Give them time to arrive before judging the link.
    if (now - lastTick > 1500) graceUntil = now + 1500;
    lastTick = now;
    if (now < graceUntil) return;
    const s = useGlove.getState();
    if (s.status !== "connected" || !s.lastMessageAt) return;
    if (Date.now() - s.lastMessageAt > STALL_MS) {
      linkLog("stall", `No data for ${((Date.now() - s.lastMessageAt) / 1000).toFixed(1)} s`);
      useGlove.setState({ status: "stalled" });
      if (s.transport === "bluetooth" && device?.gatt) {
        // Dropping the link makes the browser fire gattserverdisconnected, which runs the reconnect loop.
        try {
          device.gatt.disconnect();
        } catch {
          void scheduleReconnect();
        }
        // Some stacks do not emit the event for a local disconnect; make sure a retry is queued.
        setTimeout(() => {
          if (useGlove.getState().status === "stalled") void scheduleReconnect();
        }, 300);
      }
    }
  }, 500);
}

function stopTimers() {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function releaseGrabOnDrop() {
  setSwitch(false);
  releaseGrab();
}

/** Subscribe to the event characteristic on a (re)connected GATT server. */
async function attach(): Promise<void> {
  if (!device?.gatt) throw new Error("No GATT server");
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(GLOVE_SERVICE);
  const ev = await service.getCharacteristic(GLOVE_EVENT_CHAR);
  // Never stack listeners: remove the one from the previous connection first.
  events?.removeEventListener("characteristicvaluechanged", onNotify);
  events = ev;
  events.addEventListener("characteristicvaluechanged", onNotify);
  command = await service.getCharacteristic(GLOVE_COMMAND_CHAR).catch(() => null);
  await events.startNotifications();
  useGlove.setState({ status: "connected", transport: "bluetooth", error: null, lastMessageAt: Date.now(), attempt: 0 });
  startWatchdog();
}

function onGattDisconnected() {
  events?.removeEventListener("characteristicvaluechanged", onNotify);
  events = null;
  command = null;
  releaseGrabOnDrop();
  if (userClosed) {
    linkLog("disconnect", "Disconnected by you");
    useGlove.setState({ status: "disconnected" });
    stopTimers();
    return;
  }
  linkLog("disconnect", "Link dropped");
  void scheduleReconnect();
}

/** Reconnect to the same device with backoff; no chooser needed. */
async function scheduleReconnect(): Promise<void> {
  if (!device?.gatt || userClosed || retryTimer || attaching) return;
  if (useGlove.getState().status !== "reconnecting") {
    retryStartedAt = Date.now();
    useGlove.setState({ status: "reconnecting", attempt: 0 });
  }
  const attempt = useGlove.getState().attempt;
  if (Date.now() - retryStartedAt > RETRY_FOR_MS) {
    linkLog("give-up", "Gave up after 2 minutes. Press Reconnect.");
    useGlove.setState({ status: "disconnected", error: "The glove did not come back. Check its power, then press Reconnect." });
    stopTimers();
    return;
  }
  const wait = attempt < BACKOFF_MS.length ? BACKOFF_MS[attempt] : RETRY_EVERY_MS;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (userClosed) return;
    attaching = true;
    useGlove.setState({ attempt: attempt + 1 });
    try {
      await attach();
      linkLog("reconnect", `Reconnected (attempt ${attempt + 1})`);
    } catch (e) {
      linkLog("retry", `Attempt ${attempt + 1} failed: ${(e as Error).message || "no response"}`);
      attaching = false;
      void scheduleReconnect();
      return;
    }
    attaching = false;
  }, wait);
}

/** Connect the glove only. The camera never starts from here (V4): hand control starts on the Calibration tab. */
export function connectGlove(transport: "bluetooth" | "usb" = "bluetooth"): Promise<void> {
  return transport === "usb" ? connectUsb() : connectBluetooth();
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
    if (device && device !== picked) device.removeEventListener("gattserverdisconnected", onGattDisconnected);
    if (device !== picked) picked.addEventListener("gattserverdisconnected", onGattDisconnected);
    device = picked;
    userClosed = false;
    stopTimers();
    useGlove.setState({ deviceName: device.name ?? null });
    attaching = true;
    await attach();
    attaching = false;
    linkLog("connect", `Connected to ${device.name ?? "glove"} over Bluetooth`);
  } catch (e) {
    attaching = false;
    const err = e as Error;
    if (err.name !== "NotFoundError") linkLog("error", err.message);
    useGlove.setState({ status: device?.gatt?.connected ? "connected" : device ? "disconnected" : "idle", error: err.name === "NotFoundError" ? null : err.message });
  }
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
    userClosed = false;
    useGlove.setState({ status: "connected", transport: "usb", error: null, deviceName: "USB serial", lastMessageAt: Date.now() });
    linkLog("connect", "Connected over USB");
    startWatchdog();
    void readSerial(port);
  } catch (e) {
    const err = e as Error;
    const busy = err.name === "InvalidStateError" || err.name === "NetworkError" || /open|busy|access/i.test(err.message);
    if (err.name === "NotFoundError") {
      useGlove.setState({ status: "idle", error: null });
      return;
    }
    linkLog("error", err.message);
    useGlove.setState({ status: "error", error: busy ? "Could not open the port. Close the Arduino Serial Monitor first, then try again." : err.message });
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
      if (value) for (const l of lb.push(dec.decode(value, { stream: true }))) handleGloveMessage(parseGloveLine(l));
    }
  } catch {
    // unplugged
  }
  reader = null;
  port = null;
  releaseGrabOnDrop();
  stopTimers();
  linkLog("disconnect", userClosed ? "USB closed by you" : "USB unplugged");
  useGlove.setState({ status: "disconnected" });
}

/** One click: reattach the same Bluetooth device (no chooser), reopen USB, or open the chooser. */
export async function reconnect(): Promise<void> {
  const t = useGlove.getState().transport;
  userClosed = false;
  if (t === "bluetooth" && device?.gatt) {
    stopTimers();
    useGlove.setState({ status: "reconnecting", attempt: 0, error: null });
    retryStartedAt = Date.now();
    try {
      attaching = true;
      await attach();
      linkLog("reconnect", "Reconnected");
    } catch {
      void scheduleReconnect();
    } finally {
      attaching = false;
    }
    return;
  }
  if (t === "usb") return connectUsb();
  return connectBluetooth();
}

export async function disconnectGlove(): Promise<void> {
  userClosed = true;
  stopTimers();
  try {
    device?.gatt?.disconnect();
    await reader?.cancel();
    await port?.close();
  } catch {
    // already gone
  }
  releaseGrabOnDrop();
  useGlove.setState({ status: "disconnected" });
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

/** Status pill text for the nav. */
export function pillText(s: GloveStatus): "Connected" | "Reconnecting…" | "Stalled" | "Off" {
  if (s === "connected") return "Connected";
  if (s === "reconnecting" || s === "searching") return "Reconnecting…";
  if (s === "stalled") return "Stalled";
  return "Off";
}

if (typeof window !== "undefined") {
  // Test hook: Playwright feeds simulated protocol lines (no Bluetooth in headless Chrome).
  (window as unknown as { __magicSmokeGlove?: unknown }).__magicSmokeGlove = {
    line: (l: string) => handleGloveMessage(parseGloveLine(l)),
    connected: () => {
      useGlove.setState({ status: "connected", transport: "bluetooth", lastMessageAt: Date.now() });
      startWatchdog();
    },
    dropped: () => onGattDisconnected(),
  };
}
