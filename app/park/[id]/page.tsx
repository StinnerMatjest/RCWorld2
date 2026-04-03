import { permanentRedirect, notFound } from "next/navigation";
import ParkPageClient from "./ParkPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getPark(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}api/park/${id}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    return null;
  }

  return data;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const data = await getPark(id);

  if (!data) return {};

return {
    title: `${data.name} | Parkrating`,
    description: data.rating
      ? `${data.name} in ${data.country} scores ${data.rating.toFixed(1)} out of 10. Read our theme park review, ratings and coaster rankings from our visit.`
      : `${data.name} in ${data.country}. Read our theme park review, ratings and coaster rankings from our visit.`,
    alternates: {
      canonical: `https://parkrating.com/park/${data.slug}`,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  const data = await getPark(id);

  if (!data) {
    notFound();
  }

  if (isNumeric && data.slug) {
    permanentRedirect(`/park/${data.slug}`);
  }

  return <ParkPageClient initialId={id} />;
}