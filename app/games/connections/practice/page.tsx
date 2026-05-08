import type { Metadata } from "next";
import { Suspense } from "react";
import PracticeClient from "./PracticeClient";

export const metadata: Metadata = {
  title: "Connections Practice",
  robots: { index: false, follow: false },
};

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeClient />
    </Suspense>
  );
}
