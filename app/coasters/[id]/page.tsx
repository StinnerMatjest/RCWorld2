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

  return {
    title: `${coaster.name} | Parkrating`,
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

  return <CoasterPageClient initialId={id} />;
}