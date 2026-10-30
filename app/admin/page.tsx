import type { Metadata } from "next";
import CleanupClient from "@/app/components/cleanup/CleanupClient";

// The main admin page: how complete the site is, what to fix next, reviews to write, tiebreaks to settle.
export const metadata: Metadata = {
  title: "Admin | Parkrating",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="w-full min-h-screen bg-[#0f172a]">
      <CleanupClient />
    </main>
  );
}
