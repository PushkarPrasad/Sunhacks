"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutTemplate, PencilRuler, Smartphone } from "lucide-react";
import { categories } from "@/data/categories";
import { parts } from "@/data/parts";
import { templates } from "@/data/templates";
import { useBuild } from "@/stores/build";
import { ExplodedIllustration, ScratchIllustration } from "./Illustrations";

const FEATURED = ["gesture-ring", "robot-car", "plant-monitor", "handheld-console"];

export function Home() {
  const router = useRouter();
  const newBuild = useBuild((s) => s.newBuild);
  const loadTemplate = useBuild((s) => s.loadTemplate);
  const deviceCount = categories.filter((c) => c.kind === "device").length;

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col px-12 pb-8 pt-10">
      <div className="flex items-end justify-between gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Hardware project builder</p>
          <h1 className="mt-3 font-serif text-[64px] leading-[0.98] tracking-[-0.01em]">
            Build real hardware,
            <br />
            <span className="italic text-copper">from the inside out.</span>
          </h1>
        </div>
        <p className="mb-2 max-w-[400px] text-[15px] leading-relaxed text-muted">
          Start from a device you know or a blank board. Place real modules, wire them pin to pin, and leave with a schematic, a
          routed carrier board and a parts list.
        </p>
      </div>

      <div className="mt-9 grid min-h-0 flex-1 grid-cols-2 gap-6" data-arrows>
        <PrimaryBlock
          icon={<Smartphone size={20} strokeWidth={1.5} />}
          title="Start From a Device"
          body="Open up a phone, robot or camera. See its generic insides in an exploded view, then build a maker-scale version with real parts."
          meta={`${deviceCount} device types`}
          onClick={() => router.push("/devices")}
          art={<ExplodedIllustration />}
        />
        <PrimaryBlock
          icon={<PencilRuler size={20} strokeWidth={1.5} />}
          title="Start From Scratch"
          body="An empty canvas and a drawer of real modules: controllers, sensors, displays, motors and power. Wire anything you like."
          meta={`${parts.length} modules`}
          onClick={() => {
            newBuild();
            router.push("/builder");
          }}
          art={<ScratchIllustration />}
        />
      </div>

      <div className="mt-6 flex items-center gap-6 rounded-[12px] border border-line bg-card/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink">
            <LayoutTemplate size={18} strokeWidth={1.5} />
          </span>
          <div>
            <p className="font-serif text-[22px] leading-none">Templates</p>
            <p className="mt-1 text-xs text-muted">Working builds to start from</p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {FEATURED.map((id) => {
            const t = templates.find((x) => x.id === id)!;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  loadTemplate(id);
                  router.push("/builder");
                }}
                className="rounded-full border border-line px-3.5 py-1.5 text-[13px] transition-colors hover:border-ink"
              >
                {t.name}
              </button>
            );
          })}
        </div>
        <Link href="/templates" className="group flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          All templates
          <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        {/* Mascot slot: replace /public/mascot.svg with the team's drawing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot.svg" alt="Copperline mascot" width={56} height={56} className="-my-2 h-14 w-14" />
      </div>
    </div>
  );
}

function PrimaryBlock(props: { icon: React.ReactNode; title: string; body: string; meta: string; onClick: () => void; art: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      data-roving
      className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-line bg-card p-8 text-left transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-ink"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">{props.icon}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{props.meta}</span>
      </div>
      <div className="mt-auto flex items-end justify-between gap-6">
        <div className="max-w-[300px]">
          <h2 className="font-serif text-[40px] leading-[1.02]">{props.title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">{props.body}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
          <ArrowRight size={18} strokeWidth={1.5} />
        </span>
      </div>
      <div className="pointer-events-none absolute right-6 top-6 h-[46%] w-[46%] opacity-90 transition-transform duration-500 group-hover:-translate-y-1">{props.art}</div>
    </button>
  );
}
