// app/checklists/[slug]/page.tsx
import { notFound } from "next/navigation";
import ChecklistClient from "./ChecklistClient";
import { Checklist } from "@/app/types";

async function getChecklist(slug: string): Promise<Checklist | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  const res = await fetch(`${baseUrl}/api/checklists/${slug}`, {
    cache: "no-store", 
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to fetch checklist");
  }

  const data = await res.json();
  return data.checklist;
}

export default async function Page({ params }: { params: { slug: string } }) {
  const checklist = await getChecklist(params.slug);

  if (!checklist) {
    notFound();
  }

  return <ChecklistClient checklist={checklist} />;
}