import { notFound } from "next/navigation";
import ChecklistClient from "./ChecklistClient";
import { Checklist } from "@/app/types";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    return `${protocol}://${host || "localhost:3000"}`;
  } catch {
    return "http://localhost:3000";
  }
}

async function getChecklist(slug: string): Promise<Checklist | null> {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/checklists/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.checklist;
}

export default async function ChecklistPage({ params }: PageProps) {
  const { slug } = await params;

  const checklist = await getChecklist(slug);

  if (!checklist) {
    notFound();
  }

  return <ChecklistClient checklist={checklist} />;
}