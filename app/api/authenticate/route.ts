import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();

  const correctPassword = process.env.ACCESS_PASSWORD;
  console.log("Server password:", JSON.stringify(process.env.ACCESS_PASSWORD));

  if (password === correctPassword) {
    // Optionally: Set a secure cookie here
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 });
}
