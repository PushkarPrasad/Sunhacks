// Hyper-real product models by category. Categories not listed here have no model yet (see CategoryView).
import type { ProductDef } from "../product/ProductModel";
import { CUBE } from "./cube";
import { ROVER } from "./rover";

export const MODELS: Record<string, ProductDef> = {
  "balancing-robots": CUBE,
  rovers: ROVER,
};
