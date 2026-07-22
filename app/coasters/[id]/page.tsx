import { permanentRedirect, notFound } from "next/navigation";
import CoasterPageClient from "./CoasterPageClient";

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

// All coasters — the client uses this for the ranking widget and to resolve the
// coaster's park. Seed it so the page renders server-side without the skeleton.
async function getAllCoasters(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}api/coasters`, { cache: "force-cache", next: { tags: ["content"] } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.coasters ?? [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const coaster = await getCoaster(id);
  if (!coaster) return {};

  const parkName =
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
      images: ["/images/Parkrating.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/Parkrating.png"],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const [coaster, coasterTexts] = await Promise.all([getCoaster(id), getCoasterTexts(id)]);

  if (!coaster) {
    notFound();
  }

  if (isNumeric && coaster.slug) {
    permanentRedirect(`/coasters/${coaster.slug}`);
  }

  // Seed the client render (resolved the same way the client does — from the list).
  const allCoasters = await getAllCoasters();
  const inList = allCoasters.find((c: any) => String(c.id) === String(coaster.id));
  const initParkName = inList?.parkName || "Unknown Park";
  const initParkSlug = inList?.parkSlug || coaster.parkSlug || null;
  const initParkId = inList?.parkId || coaster.parkId || null;
  const initTexts = [...coasterTexts].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

  const parkName =
    coaster.parkSlug.charAt(0).toUpperCase() +
    coaster.parkSlug.slice(1).replace(/-/g, " ");

  const ratingNumber = Number(coaster.rating);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Attraction",
      name: coaster.name,
      containedInPlace: {
        "@type": "Place",
        name: parkName,
      },
    },
    reviewRating: !isNaN(ratingNumber)
      ? {
          "@type": "Rating",
    ratingValue: Math.min(ratingNumber, 10),
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <CoasterPageClient
        initialId={id}
        initialCoaster={coaster}
        initialAllCoasters={allCoasters}
        initialCoasterText={initTexts}
        initialParkName={initParkName}
        initialParkSlug={initParkSlug}
        initialParkId={initParkId}
      />
    </>
  );
}