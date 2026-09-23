import { NextRequest, NextResponse } from "next/server";

// Same-origin image proxy for the carousel editor's in-browser export.
// The R2 bucket sends no CORS headers, so a canvas cannot read photos loaded
// straight from it. Only our own bucket is allowed through.
const ALLOWED_HOSTS = new Set(["pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev"]);

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "Missing u" }, { status: 400 });
  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return NextResponse.json({ error: "Bad url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }
  const res = await fetch(target.toString());
  if (!res.ok) return NextResponse.json({ error: "Upstream " + res.status }, { status: 502 });
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  if (!type.startsWith("image/")) return NextResponse.json({ error: "Not an image" }, { status: 415 });
  return new Response(res.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
