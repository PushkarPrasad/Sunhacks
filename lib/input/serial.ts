"use client";

// Optional haptics for the gesture ring over USB (Web Serial, Chrome/Edge only). We send a single byte 'B'
// and the ring firmware buzzes for 150 ms. Everything here is a safe no-op when Web Serial is unavailable.

import { create } from "zustand";

type Status = "idle" | "connecting" | "connected" | "unsupported" | "error";

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  close(): Promise<void>;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

interface RingState {
  status: Status;
  port: SerialPortLike | null;
}

export const useRing = create<RingState>(() => ({ status: "idle", port: null }));

function serial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null;
}

export function ringSupported(): boolean {
  return serial() !== null;
}

export function ringStatus(s: Status): string {
  return { idle: "Connect", connecting: "Connecting…", connected: "Connected", unsupported: "Chrome only", error: "Retry" }[s];
}

export async function connectRing(): Promise<void> {
  const s = serial();
  if (!s) {
    useRing.setState({ status: "unsupported" });
    return;
  }
  try {
    useRing.setState({ status: "connecting" });
    const port = await s.requestPort();
    await port.open({ baudRate: 115200 });
    useRing.setState({ status: "connected", port });
  } catch {
    useRing.setState({ status: "error", port: null });
  }
}

/** Buzz the ring once. Resolves quietly if no ring is connected. */
export async function buzzRing(): Promise<void> {
  const { port } = useRing.getState();
  if (!port?.writable) return;
  try {
    const writer = port.writable.getWriter();
    await writer.write(new TextEncoder().encode("B"));
    writer.releaseLock();
  } catch {
    useRing.setState({ status: "error", port: null });
  }
}
