"use client";

import dynamic from "next/dynamic";
import { useBuild } from "@/stores/build";
import { useCircuit } from "@/lib/hooks/useCircuit";
import { ZoomPan } from "./ZoomPan";

const Board3D = dynamic(() => import("./Board3D"), { ssr: false });

export function CircuitView({ view, compact = false }: { view: "schematic" | "pcb" | "3d"; compact?: boolean }) {
  const build = useBuild((s) => s.build);
  const { data, loading, error } = useCircuit(build, build.instances.length > 0);
  const dark = view === "pcb";

  if (!build.instances.length) {
    return <Empty dark={dark} text="Add modules on the Build tab first." />;
  }
  return (
    <div className={`relative h-full w-full overflow-hidden ${dark ? "bg-pcb text-paper" : view === "3d" ? "bg-paper" : "bg-paper"}`}>
      {data && view === "schematic" && (
        <ZoomPan>
          <div className="h-full w-full p-6 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: data.schematicSvg }} />
        </ZoomPan>
      )}
      {data && view === "pcb" && (
        <ZoomPan dark>
          <div className="h-full w-full p-8 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: data.pcbSvg }} />
        </ZoomPan>
      )}
      {data && view === "3d" && <Board3D circuitJson={data.circuitJson} build={build} />}
      {loading && (
        <div className={`absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-1.5 text-[12px] shadow-[var(--shadow-float)] ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`} role="status">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-copper" /> {data ? "Re-routing the carrier board…" : "Placing modules and routing the carrier board…"}
        </div>
      )}
      {error && <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-bad px-4 py-1.5 text-[12px] text-paper">{error}</p>}
      {data && !compact && (
        <div className={`absolute bottom-4 left-4 flex gap-4 rounded-full px-4 py-1.5 font-mono text-[11px] ${dark ? "bg-paper/10 text-paper/80" : "border border-line bg-card/90 text-muted"}`}>
          <span>
            {data.board.w} × {data.board.h} mm
          </span>
          <span>{data.placed.length} modules</span>
          <span>{data.traces} traces routed</span>
          {data.skipped.length > 0 && <span>{data.skipped.length} off-board</span>}
          {data.errors.length > 0 && <span className="text-warn">{data.errors.length} DRC notes</span>}
        </div>
      )}
    </div>
  );
}

function Empty({ text, dark }: { text: string; dark: boolean }) {
  return (
    <div className={`grid h-full place-items-center ${dark ? "bg-pcb text-paper/70" : "text-muted"}`}>
      <p className="text-[14px]">{text}</p>
    </div>
  );
}
