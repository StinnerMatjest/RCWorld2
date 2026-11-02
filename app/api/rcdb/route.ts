import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { parkCoasters, searchParks } from "@/app/lib/rcdb";

// GET /api/rcdb?q=everland -> { parks: [{ id, name, where, country }] }
// GET /api/rcdb?park=5017  -> { coasters: [{ id, name, year, scale }] }
// For making a checklist: find the park on RCDB, then its operating coasters.
// Admin only, so the site can't be used to fetch RCDB pages for anyone else.

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const park = req.nextUrl.searchParams.get("park") ?? "";
  try {
    if (/^\d{1,7}$/.test(park)) return NextResponse.json({ coasters: await parkCoasters(park) }, NO_STORE);
    if (q.length >= 2 && q.length <= 80) return NextResponse.json({ parks: await searchParks(q) }, NO_STORE);
    return NextResponse.json({ error: "Give q (2-80 letters) or park (an RCDB id)" }, { status: 400 });
  } catch (error) {
    console.error("RCDB lookup failed:", error);
    return NextResponse.json({ error: "RCDB did not answer" }, { status: 502 });
  }
}
