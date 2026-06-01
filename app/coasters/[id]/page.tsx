import { permanentRedirect, notFound } from "next/navigation";
import CoasterPageClient from "./CoasterPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function getCoaster(id: string) {
  const res = await fetch(`${BASE}api/coasters/${id}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error || !data.coaster) return null;
  return data.coaster;
}

async function getCoasterTexts(id: string): Promise<{ headline: string; text: string }[]> {
  try {
    const res = await fetch(`${BASE}api/coasters/${id}/text`, { cache: "no-store" });
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
    coaster.parkSlug.charAt(0).toUpperCase() +
    coaster.parkSlug.slice(1).replace(/-/g, " ");

  const ratingNumber = Number(coaster.rating);

  const formattedRating =
    !isNaN(ratingNumber)
      ? Number.isInteger(ratingNumber)
        ? ratingNumber
        : ratingNumber.toFixed(1)
      : null;

  return {
    title: `${coaster.name} | Parkrating`,
    description: formattedRating
      ? `Discover ${coaster.name}, rated ${formattedRating}/10 at ${parkName}. See our review, rating breakdown and ride details.`
      : `Discover ${coaster.name} at ${parkName}. See our review, rating breakdown and ride details.`,
    alternates: {
      canonical: `https://parkrating.com/coasters/${coaster.slug}`,
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
      <CoasterPageClient initialId={id} />
    </>
  );
}