import { permanentRedirect, notFound } from "next/navigation";
import CoasterPageClient from "./CoasterPageClient";
import { LEGACY_COASTER_SLUGS } from "@/app/lib/slug";
import { computeCoasterRanks, sortCoastersByRank } from "@/app/utils/ranking";
import type { CoasterGalleryImage, CoasterMini } from "@/app/components/coasterpage/coasterPageTypes";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function getCoaster(id: string) {
  const res = await fetch(`${BASE}api/coasters/${id}`, { cache: "force-cache", next: { tags: ["content"] } });
  const data = await res.json();
  if (!res.ok || data.error || !data.coaster) return null;
  return data.coaster;
}

async function getCoasterTexts(id: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}api/coasters/${id}/text`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const { texts } = await res.json();
    return texts ?? [];
  } catch {
    return [];
  }
}

// Rank badges and the neighbour lists need the whole catalogue; fetching it
// here (one cached request) keeps ~100 KB of JSON out of every visitor's browser.
async function getAllCoasters(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const { coasters } = await res.json();
    return Array.isArray(coasters) ? coasters : [];
  } catch {
    return [];
  }
}

type HeaderFocus = { mobile: string | null; desktop: string | null };
const NO_GALLERY = { headerImage: null, headerFocus: { mobile: null, desktop: null }, gallery: [] as CoasterGalleryImage[] };

async function getGallery(id: string): Promise<{ headerImage: string | null; headerFocus: HeaderFocus; gallery: CoasterGalleryImage[] }> {
  try {
    const res = await fetch(`${BASE}api/coasters/${id}/gallery`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return NO_GALLERY;
    const data = await res.json();
    return {
      headerImage: data.headerImage ?? null,
      headerFocus: { mobile: data.headerFocus?.mobile ?? null, desktop: data.headerFocus?.desktop ?? null },
      gallery: Array.isArray(data.gallery) ? data.gallery : [],
    };
  } catch {
    return NO_GALLERY;
  }
}

const toMini = (c: any, rank?: number): CoasterMini => ({
  id: Number(c.id),
  name: c.name,
  slug: c.slug,
  parkName: c.parkName,
  manufacturerName: c.manufacturerName,
  year: c.year ?? null,
  rating: c.rating === null || c.rating === undefined || c.rating === "" ? null : Number(c.rating),
  rank,
  isBest: Boolean(c.isBestCoaster ?? c.isbestcoaster),
});

/** Two coasters either side of this one in the worldwide list, plus itself. */
function rankLadder(all: any[], coasterId: number): CoasterMini[] {
  const sorted = sortCoastersByRank(all);
  const idx = sorted.findIndex((c) => String(c.id) === String(coasterId));
  if (idx === -1) return [];
  return sorted.slice(Math.max(0, idx - 2), idx + 3).map((c, i) => toMini(c, Math.max(0, idx - 2) + i + 1));
}

/** The rest of the park's lineup, best first. */
function parkSiblings(all: any[], coaster: any): CoasterMini[] {
  return sortCoastersByRank(all.filter((c) => String(c.parkId) === String(coaster.parkId) && String(c.id) !== String(coaster.id)))
    .slice(0, 6)
    .map((c) => toMini(c));
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const [coaster, texts] = await Promise.all([getCoaster(id), getCoasterTexts(id)]);
  if (!coaster) return {};
  // No written review yet: keep the page reachable but out of the index, so
  // an empty page never counts as thin content. Flips back when a review is saved.
  const hasReview = texts.some((t: any) => typeof t.text === "string" && t.text.trim() !== "");
  const { headerImage } = await getGallery(String(coaster.id));

  const parkName =
    coaster.parkName ||
    coaster.parkSlug.charAt(0).toUpperCase() +
      coaster.parkSlug.slice(1).replace(/-/g, " ");

  const ratingNumber = Number(coaster.rating);

  const formattedRating =
    !isNaN(ratingNumber)
      ? Number.isInteger(ratingNumber)
        ? ratingNumber
        : ratingNumber.toFixed(1)
      : null;

  const title = `${coaster.name} | Parkrating`;
  const description = formattedRating
    ? `Discover ${coaster.name}, rated ${formattedRating}/10 at ${parkName}. See our review, rating breakdown and ride details.`
    : `Discover ${coaster.name} at ${parkName}. See our review, rating breakdown and ride details.`;
  const images = [headerImage || "/images/og-default.png"];

  return {
    title,
    description,
    ...(hasReview ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: `https://parkrating.com/coasters/${coaster.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://parkrating.com/coasters/${coaster.slug}`,
      siteName: "ParkRating",
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const [coaster, coasterTexts] = await Promise.all([getCoaster(id), getCoasterTexts(id)]);

  if (!coaster) {
    // Slugs renamed in the 2026-09 ASCII normalisation: keep old links alive.
    let decoded = id;
    try { decoded = decodeURIComponent(id); } catch {}
    const target = LEGACY_COASTER_SLUGS[id] ?? LEGACY_COASTER_SLUGS[decoded];
    if (target) permanentRedirect(`/coasters/${target}`);
    notFound();
  }

  if (isNumeric && coaster.slug) {
    permanentRedirect(`/coasters/${coaster.slug}`);
  }

  // Seed the client render from the single-coaster response (the API joins the
  // park, so no full-catalog fetch is needed for the basics).
  const initParkName = coaster.parkName || null;
  const initParkSlug = coaster.parkSlug || null;
  const initParkId = coaster.parkId || null;
  const initTexts = [...coasterTexts].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const [allCoasters, { headerImage, headerFocus, gallery }] = await Promise.all([getAllCoasters(), getGallery(String(coaster.id))]);
  const initialRanks = allCoasters.length ? computeCoasterRanks(allCoasters, coaster) : null;
  const ladder = allCoasters.length ? rankLadder(allCoasters, coaster.id) : [];
  const siblings = allCoasters.length ? parkSiblings(allCoasters, coaster) : [];

  const parkName =
    coaster.parkName ||
    coaster.parkSlug.charAt(0).toUpperCase() +
      coaster.parkSlug.slice(1).replace(/-/g, " ");

  const ratingNumber = Number(coaster.rating);
  const highlights: { category: string; severity: string }[] = Array.isArray(coaster.highlights) ? coaster.highlights : [];
  const highs = highlights.filter((h) => /positive/i.test(h.severity)).map((h) => h.category);
  const lows = highlights.filter((h) => /negative/i.test(h.severity)).map((h) => h.category);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Review",
    url: `https://parkrating.com/coasters/${coaster.slug}`,
    itemReviewed: {
      "@type": "TouristAttraction",
      name: coaster.name,
      url: `https://parkrating.com/coasters/${coaster.slug}`,
      ...(headerImage ? { image: headerImage } : {}),
      containedInPlace: {
        "@type": "Place",
        name: parkName,
      },
    },
    reviewRating: !isNaN(ratingNumber)
      ? {
          "@type": "Rating",
          ratingValue: ratingNumber,
        bestRating: 11,
        worstRating: 0,
        }
      : undefined,
    author: {
      "@type": "Organization",
      name: "Parkrating",
      url: "https://parkrating.com",
    },
    ...(coasterTexts.length > 0 ? {
      reviewBody: coasterTexts
        .map(t => t.headline ? `${t.headline}: ${t.text}` : t.text)
        .join("\n\n"),
    } : {}),
    // The highs and lows, in schema.org's own review vocabulary.
    ...(highs.length > 0 ? { positiveNotes: { "@type": "ItemList", itemListElement: highs.map((h: string, i: number) => ({ "@type": "ListItem", position: i + 1, name: h })) } } : {}),
    ...(lows.length > 0 ? { negativeNotes: { "@type": "ItemList", itemListElement: lows.map((h: string, i: number) => ({ "@type": "ListItem", position: i + 1, name: h })) } } : {}),
    ...(headerImage ? { image: headerImage } : {}),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://parkrating.com" },
      { "@type": "ListItem", position: 2, name: "Coasters", item: "https://parkrating.com/coasterLibrary" },
      ...(coaster.parkSlug ? [{ "@type": "ListItem", position: 3, name: parkName, item: `https://parkrating.com/park/${coaster.parkSlug}` }] : []),
      { "@type": "ListItem", position: coaster.parkSlug ? 4 : 3, name: coaster.name, item: `https://parkrating.com/coasters/${coaster.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <CoasterPageClient
        key={id}
        initialId={id}
        initialCoaster={coaster}
        initialCoasterText={initTexts}
        initialRanks={initialRanks}
        initialHeaderImage={headerImage}
        initialHeaderFocus={headerFocus}
        initialGallery={gallery}
        initialLadder={ladder}
        initialSiblings={siblings}
        initialParkName={initParkName}
        initialParkSlug={initParkSlug}
        initialParkId={initParkId}
      />
    </>
  );
}
