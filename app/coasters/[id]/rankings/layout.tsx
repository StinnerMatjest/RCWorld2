import type { Metadata } from "next";

// The detailed-rankings view is a client-rendered utility page that repeats the
// coaster's data. Google was filing it as a duplicate of the coaster page, so
// keep it out of the index while still letting crawlers follow its links.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
