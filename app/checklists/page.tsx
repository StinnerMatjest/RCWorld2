import Link from "next/link";
import { headers } from "next/headers"; // <-- Add this import
import { Checklist, Park } from "@/app/types";
import CreateChecklistModal from "../components/checklists/CreateChecklistModal";
import ChecklistCard from "../components/checklists/ChecklistCard";

export const dynamic = "force-dynamic";

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
  } catch (error) {
    return "http://localhost:3000";
  }
}

async function getChecklists(): Promise<Checklist[]> {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/checklists`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch checklists");
  const data = await res.json();
  return data.checklists;
}

async function getParks(): Promise<Park[]> {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/parks`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch parks");
  const data = await res.json();
  return data.parks;
}

export default async function ChecklistsIndexPage() {
  const checklists = await getChecklists();
  const parks = await getParks();

  // Group checklists by status
  const inProgress = checklists.filter(c => c.visit_start && !c.is_finished);
  const notStarted = checklists.filter(c => !c.visit_start && !c.is_finished);
  const completed = checklists.filter(c => c.is_finished);

  return (
    <main className="min-h-screen bg-slate-950 px-4 pt-6 pb-24 text-slate-50">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Park Checklists 🎢</h1>
          <p className="mt-2 text-sm text-slate-400">
            Select a checklist to begin tracking your visit.
          </p>
        </header>

        <CreateChecklistModal parks={parks} />

        {checklists.length === 0 ? (
          <div className="text-center p-8 rounded-2xl border border-dashed border-slate-800 text-slate-500">
            No checklists found. Generate one above!
          </div>
        ) : (
          <div className="space-y-8">
            {/* In Progress Section */}
            {inProgress.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400">
                  Currently Visiting
                </h2>
                <div className="grid gap-4 sm:grid-cols-1">
                  {inProgress.map(checklist => (
                    <ChecklistCard key={checklist.id} checklist={checklist} />
                  ))}
                </div>
              </section>
            )}

            {/* Not Started Section */}
            {notStarted.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Ready to Start
                </h2>
                <div className="grid gap-4 sm:grid-cols-1">
                  {notStarted.map(checklist => (
                    <ChecklistCard key={checklist.id} checklist={checklist} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Section */}
            {completed.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  Past Visits
                </h2>
                <div className="grid gap-4 sm:grid-cols-1">
                  {completed.map(checklist => (
                    <ChecklistCard key={checklist.id} checklist={checklist} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}