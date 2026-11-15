import { notFound } from "next/navigation";
import { categories, categoriesById } from "@/data/categories";
import { CategoryView } from "@/components/device3d/CategoryView";
import { ComingSoon } from "@/components/devices/ComingSoon";

export function generateStaticParams() {
  return categories.filter((c) => c.kind !== "custom").map((c) => ({ id: c.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = categoriesById[id];
  if (!category || category.kind === "custom") notFound();
  if (category.kind === "more") return <ComingSoon />;
  return <CategoryView id={id} />;
}
