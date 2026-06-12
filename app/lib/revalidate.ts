import { revalidateTag } from "next/cache";

// All public server fetches are tagged "content" (home, parks, coasters,
// manufacturers, park/coaster detail pages, sitemap). Any admin mutation
// calls this so visitors get cached speed but edits show up immediately.
// Coarse on purpose: one tag, site this size rebuilds pages in milliseconds.
export function revalidateContent() {
  try {
    revalidateTag("content");
  } catch (err) {
    console.error("revalidateContent failed:", err);
  }
}
