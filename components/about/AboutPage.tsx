"use client";

import { motion } from "motion/react";
import { BRAND } from "@/lib/brand";

// Team photos: drop a square image at /public/team/<first-name>.jpg and set `photo` below.
const TEAM: { name: string; role: string; hue: string; photo?: string }[] = [
  { name: "Aayoush Iyer", role: "Role coming soon", hue: "from-[#7C5CFF] to-[#3D7BFF]" },
  { name: "Meghana Yerragovula", role: "Role coming soon", hue: "from-[#3D7BFF] to-[#A5B4FC]" },
  { name: "Nicole Galvan Ayon", role: "Role coming soon", hue: "from-[#9479FF] to-[#5B45D9]" },
  { name: "Pushkar Prasad", role: "Role coming soon", hue: "from-[#5B7CFF] to-[#7C5CFF]" },
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
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-peri">About {BRAND.name}</p>
        <h1 className="mt-5 font-serif text-[64px] leading-[0.98] tracking-[-0.015em]">
          The tool we kept
          <br />
          <span className="italic text-copper">wishing we had.</span>
        </h1>
        <div className="mt-8 max-w-[520px] space-y-4 text-[16px] leading-relaxed text-muted">
          <p>We are engineering students. One of us leads a student team on a NASA project; the rest of us are friends studying electrical engineering.</p>
          <p>On every project, the same thing slowed us down: no good way to design the PCB, and no easy way to see what we were wiring, how, and why.</p>
          <p className="text-ink">We grew up on the fluid, futuristic interfaces from the movies we watched as kids, so we built the one we always wanted.</p>
        </div>
      </motion.div>
      <ul className="grid grid-cols-2 gap-5" aria-label="Team">
        {TEAM.map((m, k) => (
          <motion.li
            key={m.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + k * 0.08, type: "spring", stiffness: 200, damping: 26 }}
            className="rounded-[18px] border border-line bg-card/70 p-6 transition duration-300 hover:-translate-y-0.5 hover:border-copper/50"
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
            <p className="mt-1 text-[13px] text-muted">{m.role}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
