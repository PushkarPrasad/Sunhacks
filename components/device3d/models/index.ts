// Hyper-real product models by category. Categories not listed here have no model yet (see CategoryView).
import type { ProductDef } from "../product/ProductModel";
import { CUBE } from "./cube";
import { ROVER } from "./rover";
import { ARM } from "./arm";
import { PHONE } from "./phone";
import { LAPTOP } from "./laptop";
import { GLOVE } from "./glove";
import { CANSAT } from "./cansat";
import { WEATHER } from "./weather";
import { RC_CAR } from "./rccar";
import { PRINTER } from "./printer";
import { SYNTH } from "./synth";

export const MODELS: Record<string, ProductDef> = {
  "balancing-robots": CUBE,
  rovers: ROVER,
  "robot-arms": ARM,
  "phones-laptops:phone": PHONE,
  "phones-laptops:laptop": LAPTOP,
  wearables: GLOVE,
  "space-cansats": CANSAT,
  "smart-home": WEATHER,
  "rc-vehicles": RC_CAR,
  "printers-cnc": PRINTER,
  audio: SYNTH,
};
