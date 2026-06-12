"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminMode } from "@/app/context/AdminModeContext";

type Entry = {
  id: number;
  createdAt: string;
  parkId: number | null;
  entityType: string;
  entityId: number | null;
  entityLabel: string | null;
  action: string;
  summary: string;
  details: Record<string, unknown> | null;
  parkName: string | null;
  parkSlug: string | null;
};

type Park = { id: number; name: string };

// UI pills map to one or more entity_type values in the table.
const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Ratings", types: ["rating"] },
  { label: "Texts", types: ["park_text", "coaster_text"] },
  { label: "Images", types: ["image"] },
  { label: "Coasters", types: ["coaster", "coaster_spec", "coaster_highlight"] },
  { label: "Parks", types: ["park"] },
];

const TYPE_ICONS: Record<string, string> = {
  rating: "⭐",
  park_text: "📝",
  coaster_text: "📝",
  image: "🖼️",
  coaster: "🎢",
  coaster_spec: "📐",
  coaster_highlight: "✨",
  park: "🏰",
};

const ACTION_STYLES: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-400",
  update: "bg-sky-500/15 text-sky-400",
  delete: "bg-red-500/15 text-red-400",
  publish: "bg-orange-500/15 text-orange-400",
  unpublish: "bg-slate-500/15 text-slate-400",
};

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

// ── Word-level diff (LCS) so long texts highlight only what changed ──────────

type DiffToken = { type: "same" | "del" | "add"; text: string };

function tokenize(s: string): string[] {
  return s.split(/(\s+)/).filter((t) => t !== "");
}

function diffWords(oldStr: string, newStr: string): DiffToken[] | null {
  const a = tokenize(oldStr);
  const b = tokenize(newStr);
  const n = a.length;
  const m = b.length;
  if (n * m > 400_000) return null; // too large, caller falls back to side-by-side

  const dp = new Uint32Array((n + 1) * (m + 1));
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] =
        a[i] === b[j]
          ? dp[idx(i + 1, j + 1)] + 1
          : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const tokens: DiffToken[] = [];
  const push = (type: DiffToken["type"], text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.text += text;
    else tokens.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      push("del", a[i]);
      i++;
    } else {
      push("add", b[j]);
      j++;
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  return tokens;
}

function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const tokens = diffWords(oldText, newText);
  if (!tokens) return null;
  return (
    <div className="bg-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
      {tokens.map((t, i) =>
        t.type === "same" ? (
          <span key={i}>{t.text}</span>
        ) : t.type === "del" ? (
          <span key={i} className="bg-red-500/20 text-red-300 line-through decoration-red-400/60 rounded-sm px-0.5">{t.text}</span>
        ) : (
          <span key={i} className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5">{t.text}</span>
        )
      )}
    </div>
  );
}

// Inline word diff is only clearer than side-by-side for actual prose.
function isProseDiff(oldV: unknown, newV: unknown): boolean {
  return (
    typeof oldV === "string" &&
    typeof newV === "string" &&
    (oldV.includes(" ") || newV.includes(" ")) &&
    diffWords(oldV, newV) !== null
  );
}

export default function ChangelogPage() {
  const { isAdminMode } = useAdminMode();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [parks, setParks] = useState<Park[]>([]);
  const [parkFilter, setParkFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(
    async (cursor: number | null, append: boolean) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (parkFilter) params.set("parkId", parkFilter);
      if (typeFilter) {
        const group = TYPE_GROUPS.find((g) => g.label === typeFilter);
        if (group) params.set("types", group.types.join(","));
      }
      if (cursor) params.set("before", String(cursor));
      try {
        const res = await fetch(`/api/changelog?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
        setNextCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [parkFilter, typeFilter]
  );

  useEffect(() => {
    if (!isAdminMode) return;
    load(null, false);
  }, [isAdminMode, load]);

  useEffect(() => {
    fetch("/api/parks")
      .then((r) => r.json())
      .then((d) =>
        setParks(
          (d.parks ?? []).sort((a: Park, b: Park) => a.name.localeCompare(b.name))
        )
      );
  }, []);

  if (!isAdminMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Enable admin mode to access this page.</p>
      </div>
    );
  }

  // Group entries by calendar day for the timeline.
  const groups: { day: string; items: Entry[] }[] = [];
  for (const entry of entries) {
    const day = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Changelog</h1>
          <p className="text-slate-400 text-sm mt-1">Every content change across the site</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <select
            value={parkFilter}
            onChange={(e) => setParkFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-400"
          >
            <option value="">All parks</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTypeFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                typeFilter === "" ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All
            </button>
            {TYPE_GROUPS.map((g) => (
              <button
                key={g.label}
                onClick={() => setTypeFilter(typeFilter === g.label ? "" : g.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === g.label ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {entries.length === 0 && !loading && (
          <p className="text-slate-400 text-sm">No changes logged yet.</p>
        )}

        {groups.map((group) => (
          <div key={group.day} className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{group.day}</h2>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 divide-y divide-slate-700/60 overflow-hidden">
              {group.items.map((entry) => {
                const hasDetails = entry.details && Object.keys(entry.details).length > 0;
                const isOpen = expanded === entry.id;
                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => hasDetails && setExpanded(isOpen ? null : entry.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left ${hasDetails ? "hover:bg-slate-700/40 cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="text-lg leading-6 shrink-0">{TYPE_ICONS[entry.entityType] ?? "•"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.parkName ? (
                            <Link
                              href={`/park/${entry.parkSlug ?? entry.parkId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-semibold text-orange-400 hover:text-orange-300"
                            >
                              {entry.parkName}
                            </Link>
                          ) : entry.entityLabel ? (
                            <span className="text-sm font-semibold text-slate-300">{entry.entityLabel}</span>
                          ) : null}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${ACTION_STYLES[entry.action] ?? "bg-slate-500/15 text-slate-400"}`}>
                            {entry.action}
                          </span>
                          <span className="text-xs text-slate-500">{timeLabel(entry.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-200 mt-0.5 break-words">{entry.summary}</p>
                      </div>
                      {hasDetails && (
                        <svg className={`w-4 h-4 mt-1 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {isOpen && hasDetails && (
                      <div className="px-4 pb-4 pt-1 bg-slate-900/40">
                        <div className="space-y-2">
                          {Object.entries(entry.details!).map(([field, value]) => {
                            const isDiff =
                              value !== null &&
                              typeof value === "object" &&
                              "old" in (value as object) &&
                              "new" in (value as object);
                            const oldV = isDiff ? (value as { old: unknown }).old : undefined;
                            const newV = isDiff ? (value as { new: unknown }).new : undefined;
                            return (
                              <div key={field} className="text-xs">
                                <p className="font-semibold text-slate-400 mb-0.5">{field}</p>
                                {isDiff && isProseDiff(oldV, newV) ? (
                                  <InlineDiff oldText={oldV as string} newText={newV as string} />
                                ) : isDiff ? (
                                  <div className="grid sm:grid-cols-2 gap-1.5">
                                    <pre className="bg-red-500/10 text-red-300 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words font-mono">{formatValue(oldV)}</pre>
                                    <pre className="bg-emerald-500/10 text-emerald-300 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words font-mono">{formatValue(newV)}</pre>
                                  </div>
                                ) : (
                                  <pre className="bg-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words font-mono">{formatValue(value)}</pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {loading && <p className="text-slate-500 text-sm">Loading…</p>}

        {nextCursor && !loading && (
          <button
            onClick={() => load(nextCursor, true)}
            className="w-full py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
