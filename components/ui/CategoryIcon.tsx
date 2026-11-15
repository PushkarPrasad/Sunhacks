import { BicepsFlexed, Box, Car, Printer, Satellite, Bot, Drone, Camera, Ellipsis, Gamepad2, House, Laptop, PencilRuler, Projector, Smartphone, Speaker, Tablet, Watch, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Drone, PencilRuler, Smartphone, Laptop, Tablet, Projector, Watch, House, Bot, Gamepad2, Speaker, Camera, Ellipsis, Gyro: Box, Arm: BicepsFlexed, Satellite, Car, Printer };

export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Ellipsis;
  return <Icon size={size} strokeWidth={1.5} />;
}
