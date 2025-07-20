import { NextResponse } from "next/server";

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
    // Optionally: Set a secure cookie here
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: "Incorrect password" },
    { status: 401 }
  );
}
