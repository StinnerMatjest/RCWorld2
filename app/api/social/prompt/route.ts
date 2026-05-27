import { NextResponse } from "next/server";
import { pool, loadPrompt } from "../db";

export async function GET() {
  return NextResponse.json({ prompt: await loadPrompt() });
}

export async function POST(req: Request) {
  const { prompt } = await req.json();
  await pool.query(
    `INSERT INTO social_settings (key, value, updated_at) VALUES ('custom_prompt', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [prompt]
  );
  return NextResponse.json({ ok: true });
}
