import { redirect, notFound } from "next/navigation";
import ParkPageClient from "./ParkPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);

const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/park/${id}`, {
  cache: "no-store",
});

  const data = await res.json();

  if (!res.ok || data.error) {
    notFound();
  }

  if (isNumeric && data.slug) {
    redirect(`/park/${data.slug}`);
  }

  return <ParkPageClient initialId={id} />;
}