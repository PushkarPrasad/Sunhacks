"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { partsById } from "@/data/parts";
import { decodeBuild } from "@/lib/share";
import type { Build } from "@/lib/types";
import { useBuild } from "@/stores/build";

function ShareLoader() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useBuild((s) => s.hydrated);
  const loadBuild = useBuild((s) => s.loadBuild);
  const id = params.get("id");
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  const [fromHash] = useState(() => (hash ? decodeBuild(hash) : null));
  const [fetched, setFetched] = useState<Build | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const shared = fromHash ?? fetched;
  const error = hash && !fromHash ? "This share link is damaged." : !hash && !id ? "This share link has no build in it." : fetchError;

  useEffect(() => {
    if (hash || !id) return;
    fetch(`/api/builds?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: Build) => setFetched(b))
      .catch(() => setFetchError("That build is no longer stored on this server."));
  }, [hash, id]);

  if (error)
    return (
      <div className="grid h-full place-items-center text-center">
        <p className="font-serif text-[32px]">{error}</p>
      </div>
    );
  if (!shared) return <div className="grid h-full place-items-center text-muted">Opening shared build…</div>;

  const cost = shared.instances.reduce((s, i) => s + (partsById[i.partId]?.priceUSD ?? 0), 0);
  return (
    <div className="grid h-full place-items-center px-10">
      <div className="w-full max-w-[560px] text-center">
        <p className="eyebrow">Shared build</p>
        <h1 className="mt-3 font-serif text-[56px] leading-none">{shared.name}</h1>
        <p className="mt-4 text-[15px] text-muted">
          {shared.instances.length} modules · {shared.wires.length} wires · ${cost.toFixed(2)} in parts
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {[...new Set(shared.instances.map((i) => partsById[i.partId]?.name))].slice(0, 10).map((n) => (
            <span key={n} className="rounded-full border border-line px-3 py-1 text-[12px]">
              {n}
            </span>
          ))}
        </div>
        <button
          type="button"
          disabled={!hydrated}
          onClick={() => {
            loadBuild({ ...shared, id: `copy_${Date.now().toString(36)}` });
            router.push("/builder");
          }}
          data-magnetic className="mt-8 inline-flex h-11 items-center rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-6 text-[14px] text-paper hover:bg-copper-hover disabled:opacity-50"
        >
          Open a copy in the builder
        </button>
      </div>
    </div>
  );
}

export function SharePage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <ShareLoader />
    </Suspense>
  );
}
