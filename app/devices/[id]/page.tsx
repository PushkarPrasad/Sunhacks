import { notFound, redirect } from "next/navigation";
import { categories, categoriesById } from "@/data/categories";
import { CategoryView } from "@/components/device3d/CategoryView";
import { ComingSoon } from "@/components/devices/ComingSoon";

// Every category is generated at build time; the dynamic fallback only serves redirects and 404s, so this segment
// opts out of instant-navigation validation (it reads params at the top level).
export const instant = false;

export function generateStaticParams() {
  return [...categories.filter((c) => c.kind !== "custom").map((c) => ({ id: c.id })), { id: "phones" }, { id: "robots" }, { id: "smartwatches" }];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // V2 category links still work after the V3 reorganisation.
  const moved: Record<string, string> = { phones: "phones-laptops", robots: "rovers", smartwatches: "wearables" };
  if (moved[id]) redirect(`/devices/${moved[id]}`);
  const category = categoriesById[id];
  if (!category || category.kind === "custom") notFound();
  if (category.kind === "more") return <ComingSoon />;
  return <CategoryView id={id} />;
}
