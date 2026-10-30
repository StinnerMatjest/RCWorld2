import type { Metadata } from "next";
import CleanupClient from "@/app/components/cleanup/CleanupClient";

export const metadata: Metadata = {
  title: "Clean-up | Parkrating",
  robots: { index: false, follow: false },
};

export default function CleanupPage() {
  return (
    <main className="w-full min-h-screen bg-[#0f172a]">
      <CleanupClient />
    </main>
  );
}
