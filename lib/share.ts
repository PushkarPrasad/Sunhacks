import type { Build, Instance } from "@/lib/types";

// Compact URL-safe build encoding, used for share links when the build cannot be saved on the server.

type Packed = { n: string; t?: string; i: [string, string, string, number, number, number, string][]; w: [string, string, string, string][]; id: string[] };

const toB64Url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function encodeBuild(b: Build): string {
  const packed: Packed = {
    n: b.name,
    t: b.templateId,
    i: b.instances.map((i) => [i.partId, i.label, i.title ?? "", i.x, i.y, i.rotation, i.config?.i2cAddress ?? ""]),
    w: b.wires.map((w) => [w.from.instanceId, w.from.pin, w.to.instanceId, w.to.pin]),
    id: b.instances.map((i) => i.id),
  };
  return toB64Url(JSON.stringify(packed));
}

export function decodeBuild(s: string): Build | null {
  try {
    const p = JSON.parse(fromB64Url(s)) as Packed;
    const instances: Instance[] = p.i.map(([partId, label, title, x, y, rotation, addr], k) => ({
      id: p.id[k],
      partId,
      label,
      ...(title ? { title } : {}),
      x,
      y,
      rotation: rotation as Instance["rotation"],
      ...(addr ? { config: { i2cAddress: addr } } : {}),
    }));
    return {
      id: `shared_${p.id[0] ?? "b"}`,
      name: p.n,
      templateId: p.t,
      instances,
      wires: p.w.map(([a, ap, b, bp], k) => ({ id: `w${k}`, from: { instanceId: a, pin: ap }, to: { instanceId: b, pin: bp } })),
      dismissed: [],
      createdAt: 0,
      updatedAt: 0,
    };
  } catch {
    return null;
  }
}
