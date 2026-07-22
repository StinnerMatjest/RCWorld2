import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ListArticleClient from "./ListArticleClient";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type PageProps = { params: Promise<{ slug: string }> };

async function getList(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}api/lists/${slug}`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rankingList ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) return {};

  const description = (list.introText ?? "").trim().slice(0, 160) || `${list.title} — a curated ranking by ParkRating.`;

  return {
    title: `${list.title} | ParkRating`,
    description,
    alternates: { canonical: `https://parkrating.com/lists/${slug}` },
    openGraph: {
      title: `${list.title} | ParkRating`,
      description,
      url: `https://parkrating.com/lists/${slug}`,
      siteName: "ParkRating",
      type: "article",
    },
  };
}

// Render at request time, not build time (Docker build has no env/API).
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const list = await getList(slug);
  if (!list) notFound();

  const items = [...(list.items ?? [])].sort((a: any, b: any) => a.rank - b.rank);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": list.title,
    "description": list.introText,
    "url": `https://parkrating.com/lists/${slug}`,
    "numberOfItems": items.length,
    "itemListElement": items.map((item: any) => ({
      "@type": "ListItem",
      "position": item.rank,
      "name": item.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListArticleClient initialList={list} />
    </>
  );
}
