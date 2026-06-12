import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/adminAuth";

// Server-side guard for all mutating API calls. The admin UI being hidden
// behind admin mode is purely client-side — this is the actual enforcement.
// Add any new visitor-facing mutation endpoints to this allowlist.
const PUBLIC_MUTATIONS = [
  "/api/authenticate", // login itself
  "/api/zoomle/flag",  // players flag bad zooms from the game
];

export async function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return NextResponse.next();
  }
  const path = req.nextUrl.pathname;
  if (PUBLIC_MUTATIONS.some(p => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (await isAdminRequest(req)) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = { matcher: "/api/:path*" };
