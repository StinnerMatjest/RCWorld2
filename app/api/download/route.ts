import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "image.jpg");

    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
