import { permanentRedirect, notFound } from "next/navigation";
import CoasterPageClient from "./CoasterPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getCoaster(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}api/coasters/${id}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (!res.ok || data.error || !data.coaster) {
    return null;
  }

  return data.coaster;
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
  const coaster = await getCoaster(id);

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
        bestRating: 10,
        worstRating: 0,
        }
      : undefined,
    author: {
      "@type": "Organization",
      name: "Parkrating",
    },
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