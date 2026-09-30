import { NextRequest, NextResponse } from "next/server";
import { getOrBuildBoard, servableDates, localDate } from "@/app/lib/connectionsBoards";

// The day's Connections board. Boards are pre-built and stored in Postgres by
// the scheduler in app/lib/connectionsBoards.ts (started from
// instrumentation.ts), so this is normally a single row read. Building on
// demand here is only the fallback for a date nothing has built yet.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const admin = params.get("admin") === "1";
  const requested = params.get("date");
  // Players send their local date so the board rolls over at their midnight;
  // anything outside yesterday..tomorrow (server time) is refused.
  const allowed = servableDates();
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : localDate(0);
  if (!allowed.has(date)) {
    return NextResponse.json({ error: "Date out of range" }, { status: 400 });
  }

  try {
    const board = await getOrBuildBoard(date);
    const groups = admin ? board.admin : board.standard;
    return NextResponse.json(
      {
        date,
        groups,
        // One mode can fail while the other succeeds; report it per mode.
        error: groups.length === 4 ? null : board.error ?? "GENERATION_FAILED",
        usableCategories: board.usableCategories,
        builtAt: board.builtAt,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  } catch (err) {
    console.error("connections/daily:", err);
    return NextResponse.json({ error: "Failed to build today's puzzle" }, { status: 500 });
  }
}
