import { permanentRedirect, notFound } from "next/navigation";
import CoasterPageClient from "./CoasterPageClient";
import { LEGACY_COASTER_SLUGS } from "@/app/lib/slug";

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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const coaster = await getCoaster(id);
  if (!coaster) return {};

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

  return {
    title,
    description,
    alternates: {
      canonical: `https://parkrating.com/coasters/${coaster.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://parkrating.com/coasters/${coaster.slug}`,
      siteName: "ParkRating",
      type: "article",
      images: ["/images/og-default.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/og-default.png"],
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
  // park, so no full-catalog fetch is needed; rankings are fetched client-side).
  const initParkName = coaster.parkName || null;
  const initParkSlug = coaster.parkSlug || null;
  const initParkId = coaster.parkId || null;
  const initTexts = [...coasterTexts].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const parkName =
    coaster.parkName ||
    coaster.parkSlug.charAt(0).toUpperCase() +
      coaster.parkSlug.slice(1).replace(/-/g, " ");

  const ratingNumber = Number(coaster.rating);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Review",
    url: `https://parkrating.com/coasters/${coaster.slug}`,
    itemReviewed: {
      "@type": "TouristAttraction",
      name: coaster.name,
      url: `https://parkrating.com/coasters/${coaster.slug}`,
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
        initialId={id}
        initialCoaster={coaster}
        initialCoasterText={initTexts}
        initialParkName={initParkName}
        initialParkSlug={initParkSlug}
        initialParkId={initParkId}
      />
    </>
  );
}