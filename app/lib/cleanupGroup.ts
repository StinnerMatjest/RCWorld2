// Pure helper shared by the clean-up tool's server (cleanup.ts) and its client: safe in the browser.

/** The overview group a task counts in: "place:<kind>" for framing places, else the task kind. */
export const groupOf = (t: { kind: string; place?: { kind: string } }) => (t.kind === "frame" && t.place ? `place:${t.place.kind}` : t.kind);
