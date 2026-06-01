import { permanentRedirect, notFound } from "next/navigation";
import ParkPageClient from "./ParkPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Scores = {
  overall: number;
  bestCoaster: number;
  parkAppearance: number;
  coasterDepth: number;
  waterRides: number;
  flatRidesAndDarkRides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
  visitCount: string;
} | null;

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

async function getPark(id: string) {
  const res = await fetch(`${BASE}api/park/${id}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || data.error) return null;
  return data;
}

async function getScores(id: string): Promise<Scores> {
  try {
    const res = await fetch(`${BASE}api/park/${id}/scores`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  description:          "Overview",
  bestCoaster:          "Best Coaster",
  coasterDepth:         "Coaster Depth",
  waterRides:           "Water Rides",
  flatRidesAndDarkRides: "Flat Rides & Dark Rides",
  flatridesAndDarkrides: "Flat Rides & Dark Rides",
  parkAppearance:       "Park Appearance",
  food:                 "Food",
  snacksAndDrinks:      "Snacks & Drinks",
  parkPracticality:     "Park Practicality",
  rideOperations:       "Ride Operations",
  parkManagement:       "Park Management",
};

async function getReviewTexts(id: string): Promise<{ texts: { category: string; text: string }[]; date: string | null }> {
  try {
    const res = await fetch(`${BASE}api/park/${id}/review`, { cache: "no-store" });
    if (!res.ok) return { texts: [], date: null };
    const data = await res.json();
    return { texts: data.texts ?? [], date: data.date ?? null };
  } catch {
    return { texts: [], date: null };
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const [data, scores] = await Promise.all([getPark(id), getScores(id)]);

  if (!data) return {};

  const scoreStr = scores?.overall != null ? `scores ${scores.overall}/10` : null;
  const visitsStr = scores?.visitCount ? `${scores.visitCount} visit${Number(scores.visitCount) !== 1 ? "s" : ""}` : null;

  return {
    title: `${data.name} | Parkrating`,
    description: scoreStr
      ? `${data.name} in ${data.country} ${scoreStr} on ParkRating across ${visitsStr}. Detailed theme park review covering coasters, food, ride operations and more.`
      : `${data.name} in ${data.country}. Read our theme park review, ratings and coaster rankings from our visit.`,
    alternates: {
      canonical: `https://parkrating.com/park/${data.slug}`,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const [data, scores, review] = await Promise.all([getPark(id), getScores(id), getReviewTexts(id)]);

  if (!data) notFound();

  if (isNumeric && data.slug) {
    permanentRedirect(`/park/${data.slug}`);
  }

  const jsonLd = scores ? {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    "name": data.name,
    "description": `ParkRating review of ${data.name} in ${data.country}. Overall score: ${scores.overall}/10.`,
    "url": `https://parkrating.com/park/${data.slug}`,
    ...(data.imagepath ? { "image": data.imagepath } : {}),
    "address": {
      "@type": "PostalAddress",
      "addressCountry": data.country,
      "addressLocality": data.city ?? undefined,
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": String(scores.overall),
      "bestRating": "11",
      "worstRating": "0",
      "reviewCount": String(scores.visitCount),
      "ratingExplanation": "Composite score across 10 categories rated by ParkRating reviewers. Scores are typically 0–10, but exceptional parks can break the scale and score 11.",
    },
    "additionalProperty": [
      { "@type": "PropertyValue", "name": "Best Coaster",            "value": String(scores.bestCoaster) },
      { "@type": "PropertyValue", "name": "Park Appearance",         "value": String(scores.parkAppearance) },
      { "@type": "PropertyValue", "name": "Coaster Depth",           "value": String(scores.coasterDepth) },
      { "@type": "PropertyValue", "name": "Water Rides",             "value": String(scores.waterRides) },
      { "@type": "PropertyValue", "name": "Flat Rides & Dark Rides", "value": String(scores.flatRidesAndDarkRides) },
      { "@type": "PropertyValue", "name": "Food",                    "value": String(scores.food) },
      { "@type": "PropertyValue", "name": "Snacks & Drinks",         "value": String(scores.snacksAndDrinks) },
      { "@type": "PropertyValue", "name": "Park Practicality",       "value": String(scores.parkPracticality) },
      { "@type": "PropertyValue", "name": "Ride Operations",         "value": String(scores.rideOperations) },
      { "@type": "PropertyValue", "name": "Park Management",         "value": String(scores.parkManagement) },
    ].filter(p => p.value !== "null"),
    ...(review.texts.length > 0 ? {
      "review": {
        "@type": "Review",
        "author": { "@type": "Organization", "name": "ParkRating", "url": "https://parkrating.com" },
        ...(review.date ? { "datePublished": review.date.split("T")[0] } : {}),
        "reviewBody": review.texts
          .map(t => `${CATEGORY_LABELS[t.category] ?? t.category}: ${t.text}`)
          .join("\n\n"),
      }
    } : {}),
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ParkPageClient initialId={id} />
    </>
  );
}