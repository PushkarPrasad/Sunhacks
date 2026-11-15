"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MousePointer2, Plus, RotateCw, Spline, Trash2 } from "lucide-react";
import { parts, partsById } from "@/data/parts";
import { suggestionsFor, type Suggestion } from "@/data/compat";
import type { Instance, Part } from "@/lib/types";
import { pinKey } from "@/lib/build/nets";
import { setAddress as setInstanceAddress } from "@/lib/build/ops";
import { useBuild } from "@/stores/build";
import { Pager } from "@/components/ui/Pager";
import { Sparkline } from "@/components/ui/Sparkline";
import { useView } from "./viewStore";

type Tab = "specs" | "pins" | "pairs";
const PINS_PER_PAGE = 10;

export function Inspector() {
  const build = useBuild((s) => s.build);
  const selection = useBuild((s) => s.selection);
  const inst = selection?.kind === "instance" ? build.instances.find((i) => i.id === selection.id) : undefined;
  const wire = selection?.kind === "wire" ? build.wires.find((w) => w.id === selection.id) : undefined;
  const part = inst ? partsById[inst.partId] : undefined;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-paper" aria-label="Inspector">
      {inst && part ? <PartInspector key={inst.id} inst={inst} part={part} /> : wire ? <WireInspector wireId={wire.id} /> : <Overview />}
    </aside>
  );
}

function Overview() {
  const build = useBuild((s) => s.build);
  const total = build.instances.reduce((s, i) => s + (partsById[i.partId]?.priceUSD ?? 0), 0);
  const tips = [
    ["Pin → pin", "Draw a wire"],
    ["Drag a module", "Move it"],
    ["R", "Rotate the selection"],
    ["Delete", "Remove the selection"],
    ["+ / −", "Zoom"],
    ["Esc", "Cancel a wire"],
  ];
  return (
    <div className="flex h-full flex-col px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Build</p>
      <p className="mt-1 font-serif text-[28px] leading-tight">{build.name}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Modules", build.instances.length],
          ["Wires", build.wires.length],
          ["Parts", `$${total.toFixed(0)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-line bg-card px-3 py-2.5">
            <p className="font-mono text-[18px] leading-none">{v}</p>
            <p className="mt-1 text-[11px] text-muted">{k}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-[13px] text-muted">
        <MousePointer2 size={15} strokeWidth={1.5} /> Select a module to inspect it.
      </div>
      <ul className="mt-auto space-y-2 border-t border-line pt-4">
        {tips.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="font-mono text-ink">{k}</span>
            <span className="text-muted">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WireInspector({ wireId }: { wireId: string }) {
  const build = useBuild((s) => s.build);
  const removeWire = useBuild((s) => s.removeWire);
  const w = build.wires.find((x) => x.id === wireId)!;
  const end = (r: { instanceId: string; pin: string }) => {
    const i = build.instances.find((x) => x.id === r.instanceId);
    const p = i && partsById[i.partId];
    const def = p?.pins.find((x) => x.name === r.pin);
    return { label: `${i?.label}.${r.pin}`, name: i?.title ?? p?.name, fn: def?.function };
  };
  const a = end(w.from);
  const b = end(w.to);
  return (
    <div className="flex h-full flex-col px-5 py-5">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        <Spline size={13} strokeWidth={1.5} /> Wire
      </p>
      {[a, b].map((e, i) => (
        <div key={i} className="mt-4 rounded-[10px] border border-line bg-card p-3">
          <p className="font-mono text-[14px]">{e.label}</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {e.name} · {e.fn}
          </p>
        </div>
      ))}
      <button type="button" onClick={() => removeWire(wireId)} className="mt-4 flex h-9 items-center justify-center gap-2 rounded-full border border-line-strong text-[13px] hover:border-bad hover:text-bad">
        <Trash2 size={15} strokeWidth={1.5} /> Delete wire
      </button>
    </div>
  );
}

function Unverified({ field, part }: { field: string; part: Part }) {
  if (!part.unverified?.includes(field)) return null;
  return (
    <span className="ml-1.5 rounded border border-warn/40 px-1 py-px font-sans text-[9px] uppercase tracking-wide text-warn" title="Not confirmed against a datasheet">
      unverified
    </span>
  );
}

function PartInspector({ inst, part }: { inst: Instance; part: Part }) {
  const [tab, setTab] = useState<Tab>("specs");
  const rotate = useBuild((s) => s.rotate);
  const remove = useBuild((s) => s.remove);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {inst.label} · {part.category}
            </p>
            <p className="mt-1 font-serif text-[26px] leading-[1.05]">{inst.title ?? part.name}</p>
            <p className="mt-1 text-[12px] text-muted">
              {inst.title ? `${part.name} · ` : ""}
              {part.manufacturer}
              {!part.verified && <span className="ml-2 rounded border border-warn/40 px-1 py-px text-[9px] uppercase tracking-wide text-warn">unverified fields</span>}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" aria-label="Rotate (R)" title="Rotate (R)" onClick={() => rotate(inst.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-line/60 hover:text-ink">
              <RotateCw size={15} strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Delete (Del)" title="Delete (Del)" onClick={() => remove(inst.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bad/10 hover:text-bad">
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-muted">{part.description}</p>
        <div className="mt-4 flex gap-1 rounded-full border border-line p-0.5" role="tablist">
          {(["specs", "pins", "pairs"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full py-1.5 text-[12px] transition-colors ${tab === t ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
            >
              {t === "specs" ? "Specs" : t === "pins" ? `Pins · ${part.pins.length}` : "Pairs well with"}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 px-5 pb-4 pt-4">
        {tab === "specs" && <Specs inst={inst} part={part} />}
        {tab === "pins" && <Pins inst={inst} part={part} />}
        {tab === "pairs" && <Pairs part={part} />}
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-[7px] text-[12px] last:border-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 text-right font-mono text-ink">{children}</span>
    </div>
  );
}

interface PriceInfo {
  priceUSD: number;
  source: string;
  live: boolean;
}
interface History {
  points: { t: string; price: number }[];
  sample: boolean;
}

function Specs({ inst, part }: { inst: Instance; part: Part }) {
  const [price, setPrice] = useState<PriceInfo | null>(null);
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/prices?ids=${part.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.prices?.[part.id] && setPrice(j.prices[part.id]))
      .catch(() => {});
    fetch(`/api/prices/history?partId=${part.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setHistory(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [part.id]);

  const addr = inst.config?.i2cAddress ?? part.i2cAddresses?.default;
  const setAddress = (a: string) => {
    const st = useBuild.getState();
    st.commit(setInstanceAddress(st.build, inst.id, a));
  };

  return (
    <div className="flex h-full flex-col">
      <div>
        <Row k="Interface">{part.interface.join(" · ")}</Row>
        <Row k="Supply">
          {part.supplyVoltageMin === part.supplyVoltageMax ? `${part.supplyVoltageMin} V` : `${part.supplyVoltageMin}–${part.supplyVoltageMax} V`}
          <Unverified field="supplyVoltageMax" part={part} />
        </Row>
        <Row k="Logic">{part.logicVoltage ? `${part.logicVoltage} V${part.logicFollowsSupply ? " (follows supply)" : ""}` : "—"}</Row>
        <Row k="Current">
          {part.currentTypical_mA} typ · {part.currentPeak_mA} peak mA
          <Unverified field={part.unverified?.find((f) => f.startsWith("current")) ?? "_"} part={part} />
        </Row>
        {part.power?.maxOutput_mA !== undefined && part.role !== "controller" && (
          <Row k="Output">
            {part.power.outputVoltage ? `${part.power.outputVoltage} V · ` : ""}
            {part.power.maxOutput_mA} mA max
            <Unverified field="power.maxOutput_mA" part={part} />
          </Row>
        )}
        {part.power?.capacity_mAh !== undefined && (
          <Row k="Capacity">
            {part.power.capacity_mAh} mAh
            <Unverified field="power.capacity_mAh" part={part} />
          </Row>
        )}
        {part.i2cAddresses && (
          <div className="flex items-center justify-between gap-3 border-b border-line/70 py-[6px] text-[12px]">
            <span className="text-muted">I2C address</span>
            <span className="flex gap-1">
              {[part.i2cAddresses.default, ...part.i2cAddresses.alternates].slice(0, 4).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAddress(a)}
                  title={a === part.i2cAddresses!.default ? "Default" : part.i2cAddresses!.selectHow}
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${addr === a ? "bg-ink text-paper" : "border border-line text-muted hover:border-ink"}`}
                >
                  {a}
                </button>
              ))}
            </span>
          </div>
        )}
        <Row k="Footprint">{part.footprint === "none" ? "off-board" : part.footprint}</Row>
        <Row k="Price">
          ${part.priceUSD.toFixed(2)}
          {price && price.live && Math.abs(price.priceUSD - part.priceUSD) > 0.009 && <span className="ml-1 text-copper">· ${price.priceUSD.toFixed(2)} live</span>}
          <Unverified field="priceUSD" part={part} />
        </Row>
      </div>
      <div className="mt-3 rounded-[10px] border border-line bg-card p-3">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Price trend · 90 days</span>
          {history?.sample && <span className="rounded bg-line/70 px-1.5 py-px text-[10px]">sample data</span>}
        </div>
        <div className="mt-2 h-10">{history && history.points.length > 1 ? <Sparkline values={history.points.map((p) => p.price)} /> : <div className="h-full" />}</div>
        {price && <p className="mt-1 text-[10px] text-muted">{price.live ? `Live from ${price.source}` : "Stored catalogue price"}</p>}
      </div>
      <div className="mt-auto pt-3">
        <a href={part.datasheetUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] text-ink underline decoration-copper underline-offset-4">
          Datasheet <ExternalLink size={12} strokeWidth={1.5} />
        </a>
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted">{part.source}</p>
      </div>
    </div>
  );
}

function Pins({ inst, part }: { inst: Instance; part: Part }) {
  const [page, setPage] = useState(0);
  const build = useBuild((s) => s.build);
  const clickPin = useBuild((s) => s.clickPin);
  const connected = useMemo(() => {
    const s = new Set<string>();
    for (const w of build.wires) for (const e of [w.from, w.to]) if (e.instanceId === inst.id) s.add(e.pin);
    return s;
  }, [build.wires, inst.id]);
  const pages = Math.ceil(part.pins.length / PINS_PER_PAGE);
  const shown = part.pins.slice(page * PINS_PER_PAGE, page * PINS_PER_PAGE + PINS_PER_PAGE);
  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1">
        {shown.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => clickPin({ instanceId: inst.id, pin: p.name })}
              title="Start or finish a wire on this pin"
              className="flex w-full items-center gap-2 border-b border-line/70 py-[7px] text-left text-[12px] hover:bg-card"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${connected.has(p.name) ? "bg-copper" : "border border-line-strong"}`} key={pinKey({ instanceId: inst.id, pin: p.name })} />
              <span className="w-16 shrink-0 font-mono">{p.name}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{p.function}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted">{p.type.replace("_", " ")}</span>
            </button>
          </li>
        ))}
      </ul>
      <Pager page={page} pages={pages} onChange={setPage} label="pins page" />
    </div>
  );
}

function Pairs({ part }: { part: Part }) {
  const build = useBuild((s) => s.build);
  const addPart = useBuild((s) => s.addPart);
  const present = useMemo(() => new Set(build.instances.map((i) => i.partId)), [build.instances]);
  const base = useMemo(() => suggestionsFor(part.id, present), [part.id, present]);
  const [ranked, setRanked] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    if (base.length < 2) return;
    let alive = true;
    fetch("/api/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partId: part.id, candidates: base, present: [...present] }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ranked?: Suggestion[] } | null) => alive && j?.ranked && setRanked(j.ranked))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [base, part.id, present]);

  const list = (ranked ?? base).slice(0, 5);
  if (!list.length) return <p className="text-[12px] text-muted">Everything this part usually pairs with is already in the build.</p>;
  return (
    <ul className="space-y-2">
      {list.map((s) => {
        const p = parts.find((x) => x.id === s.partId)!;
        return (
          <li key={s.partId} className="flex items-center gap-3 rounded-[10px] border border-line bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{p.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{s.reason}</p>
            </div>
            <button
              type="button"
              aria-label={`Add ${p.name}`}
              onClick={() => {
                const c = useView.getState().center();
                addPart(p.id, Math.round(c.x / 8) * 8, Math.round(c.y / 8) * 8);
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong hover:border-ink hover:bg-ink hover:text-paper"
            >
              <Plus size={15} strokeWidth={1.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
