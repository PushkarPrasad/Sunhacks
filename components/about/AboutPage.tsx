"use client";

import { motion } from "motion/react";
import { BRAND } from "@/lib/brand";

// Team photos: drop a square image at /public/team/<first-name>.jpg and set `photo` below.
const TEAM: { name: string; hue: string; photo?: string }[] = [
  { name: "Aayoush Iyer", hue: "from-[#0F9D6B] to-[#0A6B49]" },
  { name: "Meghana Yerragovula", hue: "from-[#0A6B49] to-[#C8A96A]" },
  { name: "Nicole Galvan Ayon", hue: "from-[#14B47C] to-[#0A6B49]" },
  { name: "Pushkar Prasad", hue: "from-[#14B47C] to-[#0F9D6B]" },
];

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

export function AboutPage() {
  return (
    <div className="mx-auto grid h-full max-w-[1240px] grid-cols-[1.05fr_1fr] items-center gap-16 px-12">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 26 }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-champagne">About {BRAND.name}</p>
        <h1 className="mt-5 font-serif text-[64px] leading-[0.98] tracking-[-0.015em]">
          The tool we kept
          <br />
          <span className="italic text-copper">wishing we had.</span>
        </h1>
        <div className="mt-8 max-w-[520px] text-[16px] leading-relaxed text-muted">
          <p>As engineering students, we kept running into the same problem: projects that just wouldn&apos;t work, and no easy way to find out why before we&apos;d spent the time and money. All four of us work on a NASA team at ASU building rovers, and a tool like this would let us simulate and test versions of our designs, then see every issue and benefit before we build. The motion, the fluidity and the ease of use come from the movies we grew up on, the ones that made us want to be engineers in the first place.</p>
        </div>
      </motion.div>
      <ul className="grid grid-cols-2 gap-5" aria-label="Team">
        {TEAM.map((m, k) => (
          <motion.li
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + k * 0.08, type: "spring", stiffness: 200, damping: 26 }}
            className="rounded-[18px] border border-line bg-card/70 p-6 lift hover:border-line-strong"
          >
            {m.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo} alt={m.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${m.hue} font-serif text-[24px] text-white`} aria-hidden="true">
                {initials(m.name)}
              </span>
            )}
            <p className="mt-5 text-[17px] font-medium leading-tight">{m.name}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
