// Runs once when the Next.js server process starts (not during `next build`).
// Arms the Connections board scheduler so the daily boards are built ahead of
// time instead of on a player's first request. See app/lib/connectionsBoards.ts.
//
// The import must sit inside the NEXT_RUNTIME check exactly like this: the
// file is also bundled for the edge runtime, and webpack only drops the
// Node-only Postgres import when it can see the runtime condition around it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startConnectionsBoardScheduler } = await import("./app/lib/connectionsBoards");
    startConnectionsBoardScheduler();
  }
}
