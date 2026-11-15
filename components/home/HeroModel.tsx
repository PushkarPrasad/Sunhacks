"use client";

import { useEffect, useState } from "react";
import DroneModel from "@/components/device3d/DroneModel";

/** Home hero: the drone slowly explodes and reassembles while turning. */
export default function HeroModel() {
  const [explode, setExplode] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setExplode((e) => (e > 0.5 ? 0 : 0.85)), 3800);
    return () => clearInterval(id);
  }, []);
  return <DroneModel explode={explode} autoRotate enableZoom={false} camera={[3.8, 2.4, 4.4]} />;
}
