"use client";

import { useEffect, useState } from "react";
import ExplodedDevice from "@/components/device3d/ExplodedDevice";
import { categoriesById } from "@/data/categories";

/** Home hero: a device that slowly explodes and reassembles. */
export default function HeroModel() {
  const [exploded, setExploded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setExploded((e) => !e), 3600);
    return () => clearInterval(id);
  }, []);
  return <ExplodedDevice blocks={categoriesById.phones.blocks} active={active} onActive={setActive} exploded={exploded} />;
}
