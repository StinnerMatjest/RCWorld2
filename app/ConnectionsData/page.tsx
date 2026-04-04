import { notFound } from "next/navigation";
import ConnectionsTestClient from "./ConnectionsTestClient";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConnectionsTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ConnectionsTestClient />;
}