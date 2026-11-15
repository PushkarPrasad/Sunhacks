// Fake Web Bluetooth for Playwright (headless Chrome has none). Injected with page.addInitScript before any app code.
// window.__fakeGlove: send(line), drop(), failNext(n), stats() -> { connects, subscriptions, listeners }.
export const fakeBluetoothScript = () => {
  const enc = new TextEncoder();
  class FakeChar extends EventTarget {
    value: DataView | null = null;
    listeners = 0;
    constructor(public uuid: string) {
      super();
    }
    addEventListener(t: string, l: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
      if (t === "characteristicvaluechanged") this.listeners++;
      super.addEventListener(t, l, o);
    }
    removeEventListener(t: string, l: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions) {
      if (t === "characteristicvaluechanged") this.listeners--;
      super.removeEventListener(t, l, o);
    }
    async startNotifications() {
      stats.subscriptions++;
      return this;
    }
    async writeValueWithoutResponse(d: BufferSource) {
      stats.writes.push(new TextDecoder().decode(d));
    }
    async writeValue(d: BufferSource) {
      stats.writes.push(new TextDecoder().decode(d));
    }
  }
  const stats = { connects: 0, subscriptions: 0, writes: [] as string[], fail: 0 };
  let evt: FakeChar | null = null;
  const device = new (class extends EventTarget {
    name = "Copperline Glove";
    gatt = {
      connected: false,
      connect: async () => {
        await new Promise((r) => setTimeout(r, 30));
        if (stats.fail > 0) {
          stats.fail--;
          throw new Error("GATT Server is disconnected");
        }
        stats.connects++;
        device.gatt.connected = true;
        evt = new FakeChar("evt");
        const cmd = new FakeChar("cmd");
        return {
          getPrimaryService: async () => ({ getCharacteristic: async (u: string) => (u.endsWith("0001-e8f2-537e-4f6c-d104768a1214") ? evt : cmd) }),
        };
      },
      disconnect: () => {
        if (!device.gatt.connected) return;
        device.gatt.connected = false;
        setTimeout(() => device.dispatchEvent(new Event("gattserverdisconnected")), 10);
      },
    };
  })();
  // navigator.bluetooth is a read-only getter in Chrome; plain assignment is silently ignored.
  Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => device }, configurable: true });
  (window as unknown as { __fakeGlove: unknown }).__fakeGlove = {
    send: (line: string) => {
      if (!evt || !device.gatt.connected) return false;
      const b = enc.encode(line);
      evt.value = new DataView(b.buffer);
      evt.dispatchEvent(new Event("characteristicvaluechanged"));
      return true;
    },
    drop: () => device.gatt.disconnect(),
    failNext: (n: number) => (stats.fail = n),
    stats: () => ({ connects: stats.connects, subscriptions: stats.subscriptions, listeners: evt?.listeners ?? 0, writes: stats.writes }),
  };
};
