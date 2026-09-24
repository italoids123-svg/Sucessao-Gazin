import { notFound } from "next/navigation";
import LevelPage from "@/components/LevelPage";
import { NIVEIS } from "@/lib/config.ts";

export function generateStaticParams() {
  return NIVEIS.filter((n) => n.temPagina).map((n) => ({ slug: n.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!NIVEIS.some((n) => n.slug === slug && n.temPagina)) notFound();
  return <LevelPage slug={slug} />;
}
