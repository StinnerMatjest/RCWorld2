import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, isAdminRequest } from "@/app/lib/adminAuth";

// Lets the client check whether its admin cookie is actually valid, so a stale
// localStorage admin flag can't show admin UI whose saves the server rejects.
export async function GET(req: NextRequest) {
  return NextResponse.json({ admin: await isAdminRequest(req) });
}

export async function POST(req: Request) {
  const { password } = await req.json();

  const correctPassword = process.env.ACCESS_PASSWORD;

  if (!correctPassword) {
    console.error("ACCESS_PASSWORD is not defined on the server.");
    return NextResponse.json(
      { success: false, error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (password === correctPassword) {
    // The cookie is what actually authorizes admin API calls (see middleware.ts)
    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE, await adminToken(correctPassword), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  return NextResponse.json(
    { success: false, error: "Incorrect password" },
    { status: 401 }
  );
}
