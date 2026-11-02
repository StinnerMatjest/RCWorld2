import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";
import { liveParks } from "@/app/lib/parkLive";

// GET /api/live-parks?name=Everland -> { parks: [{ key, name, where }], guess }
// Every park with live waits or ride status, for picking a checklist's park;
// `guess` is the one that looks like `name`. Admin only, like making checklists.

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const name = req.nextUrl.searchParams.get("name")?.slice(0, 120) || undefined;
  try {
    return NextResponse.json(await liveParks(name), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Live park list failed:", error);
    return NextResponse.json({ parks: [], guess: null }, { status: 502 });
  }
}
