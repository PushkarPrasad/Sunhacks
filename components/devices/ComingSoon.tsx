import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ComingSoon() {
  return (
    <div className="grid h-full place-items-center px-12">
      <div className="max-w-[520px] text-center">
        <p className="eyebrow">More (Coming Soon)</p>
        <h1 className="mt-4 font-serif text-[56px] leading-none">More devices are on the way.</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-muted">
          Tablets, projectors, game consoles, cameras and weather stations are next. Until then, Start blank opens an
          empty board with every module in the catalogue.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/devices" className="flex h-10 items-center gap-2 lift rounded-[10px] border border-line px-4 text-[13px] hover:border-line-strong hover:bg-raised">
            <ArrowLeft size={15} strokeWidth={1.5} /> All devices
          </Link>
          <Link href="/builder?new=1" className="flex h-10 items-center rounded-[10px] bg-copper shadow-[var(--shadow-btn)] px-4 text-[13px] text-white hover:bg-copper-hover">
            Start from scratch
          </Link>
        </div>
      </div>
    </div>
  );
}
