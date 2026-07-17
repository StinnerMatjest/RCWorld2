import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/app/lib/adminAuth";
import DirectoryClient from "./DirectoryClient";

// Internal admin-only tool: keep it out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Reading the admin cookie makes this route dynamic; non-admins (and crawlers)
// are redirected to the public manufacturers page before any directory HTML is sent.
export const dynamic = "force-dynamic";

export default async function Page() {
  const isAdmin = await isAdminRequest({ cookies: await cookies() });
  if (!isAdmin) redirect("/manufacturers");
  return <DirectoryClient />;
}
