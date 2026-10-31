"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Checklist, ChecklistItem, ChecklistQueue } from "@/app/types";
import AuthenticationModal from "@/app/components/admin/AuthenticationModal";
import { clockTime, coasterName, noteLines } from "@/app/lib/checklistOps";
import { likeness } from "@/app/lib/parkLive";
import { useChecklistSync, type SyncStatus } from "./useChecklistSync";

// Note keys must match RatingModal's CATEGORIES so the review modal can show them
const NOTE_CATEGORIES = [
  { key: "parkAppearance", label: "Park appearance" },
  { key: "bestCoaster", label: "Best coaster" },
  { key: "coasterDepth", label: "Coaster depth" },
  { key: "waterRides", label: "Water rides" },
  { key: "flatridesAndDarkrides", label: "Flats & darkrides" },
  { key: "food", label: "Food" },
  { key: "snacksAndDrinks", label: "Snacks & drinks" },
  { key: "parkPracticality", label: "Park practicality" },
  { key: "rideOperations", label: "Ride operations" },
  { key: "parkManagement", label: "Park management" },
] as const;

type Tab = "coasters" | "notes" | "queues" | "checklist";
const TABS: { id: Tab; label: string }[] = [
  { id: "coasters", label: "Coasters" },
  { id: "notes", label: "Notes" },
  { id: "queues", label: "Queues" },
  { id: "checklist", label: "Checklist" },
];

type LiveRide = { name: string; wait: number | null; status: "open" | "down" | "closed" | "refurb" };
type Live = {
  waits: "queue-times" | "themeparks.wiki" | null;
  status: "themeparks.wiki" | "queue-times" | null;
  tz: string | null;
  rides: LiveRide[];
  coasters: Record<string, { ride: string | null; wait: number | null; status: LiveRide["status"] | null }>;
};

type Sheet =
  | { kind: "join"; item: string; posted: number | null; board: number }
  | { kind: "board"; qid: string; board: number }
  | { kind: "log"; qid: string; item: string; timer: number; real: number; board: number | null }
  | { kind: "link"; item: string }
  | { kind: "complete" }
  | { kind: "done" };

const LIVE_EVERY_MS = 120000;
const CHECK = (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function formatDuration(s: number): string {
  if (s <= 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}
function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/** "Take picture of park entrance" -> "Park entrance". */
function taskLabel(label: string): string {
  const s = label.replace(/^take (a )?picture of /i, "").replace(/!$/, "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const isOpenQueue = (q: ChecklistQueue) => !q.cancelled && q.real == null;

/** Live waits and ride status for the visit's park, refreshed every two minutes while the page is visible. */
function useLive(slug: string) {
  const [live, setLive] = useState<Live | null>(null);
  const load = useCallback(() => {
    fetch(`/api/checklists/${slug}/live`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setLive(d); })
      .catch(() => {});
  }, [slug]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, LIVE_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  return { live, reload: load };
}

export default function ChecklistClient({ checklist }: { checklist: Checklist }) {
  const { view, status, pending, actions } = useChecklistSync(checklist);
  const { items, notes, sessions, queues, downtime } = view;
  const finished = view.is_finished;
  const { live, reload } = useLive(checklist.slug);

  const [tab, setTab] = useState<Tab>("coasters");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ key: string; line: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // One clock for the time in the park and the queue timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const running = sessions.length > 0 && !sessions[sessions.length - 1].end && !finished;
  const paused = sessions.length > 0 && !running && !finished;
  const elapsed = finished
    ? view.duration
    : sessions.reduce((sum, s) => sum + Math.max(0, Math.floor(((s.end ? Date.parse(s.end) : now) - Date.parse(s.start)) / 1000)), 0);
  const days = new Set(sessions.map(s => new Date(s.start).toDateString())).size;
  const parkName = checklist.title.replace(/\s+\d{4}\s+visit$/i, "").trim();

  const coasters = useMemo(() => items.filter(i => i.isCoaster && !i.isExtra), [items]);
  const photoTasks = useMemo(() => items.filter(i => i.isPhotoTask && !i.isCoaster && !i.isExtra), [items]);
  const otherTasks = useMemo(() => items.filter(i => !i.isPhotoTask && !i.isCoaster && !i.isExtra), [items]);
  const openQueue = queues.find(isOpenQueue) ?? null;
  const loggedQueues = queues.filter(q => !q.cancelled && q.real != null);

  // What is still open before the visit is complete.
  const missingPhotos = coasters.filter(c => !c.skipped).reduce((n, c) => n + (c.checked ? 0 : 1) + (c.photoV ? 0 : 1), 0);
  const openTasks = [...photoTasks, ...otherTasks].filter(t => !t.checked && !t.skipped);
  const allDone = missingPhotos === 0 && openTasks.length === 0;

  const nameOf = (id: string) => coasterName(items.find(i => i.id === id)?.label ?? "");
  const rideLine = (c: ChecklistItem) => live?.coasters[c.id];
  const time = (iso: string) => clockTime(iso, live?.tz ?? undefined);

  // ─── actions ───
  function plusRide(c: ChecklistItem) {
    actions.ride(c.id, 1);
    const n = (c.rideCount || 0) + 1;
    setToast({ text: `${coasterName(c.label)} · ride ${n}`, undo: () => actions.ride(c.id, -1) });
  }
  function saveLine() {
    if (!openCat) return;
    if (editing) actions.editLine(editing.key, editing.line, draft);
    else actions.addLine(openCat, draft);
    setAdding(false); setEditing(null); setDraft("");
  }
  function complete() {
    actions.timer("complete");
    setSheet({ kind: "done" });
  }

  const meta = finished
    ? `Completed · ${formatDuration(elapsed)} in the park`
    : running
      ? `Day ${Math.max(1, days)} · ${formatDuration(elapsed)} in the park`
      : paused
        ? `Paused · ${formatDuration(elapsed)} in the park`
        : "Not started";

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col pb-28">
        {/* ── Park and time ── */}
        <header className="px-4 pt-5 pb-4">
          <Link href="/checklists" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300">‹ Checklists</Link>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[30px] font-bold leading-[1.05] tracking-tight [text-wrap:balance]">{parkName}</h1>
              <p className={`mt-2 text-[13px] ${paused ? "text-amber-400" : "text-slate-400"}`}>{meta}</p>
            </div>
            {!finished && sessions.length > 0 && (
              <button type="button" onClick={() => actions.timer(running ? "pause" : "resume")}
                className="shrink-0 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand cursor-pointer">
                {running ? "Pause" : "Resume"}
              </button>
            )}
          </div>
          {!finished && sessions.length === 0 && (
            <button type="button" onClick={() => actions.timer("start")}
              className="mt-4 h-12 w-full rounded-2xl bg-brand text-base font-bold text-slate-900 hover:bg-brand-light active:scale-[0.99] cursor-pointer">
              Start the visit
            </button>
          )}
          <div className="mt-3"><SyncNotice status={status} pending={pending} onLogin={() => setShowLogin(true)} /></div>
        </header>

        {/* ── Tabs ── */}
        <nav className="sticky top-0 z-20 flex border-b border-slate-400/15 bg-[#0f172a]" role="tablist">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setAdding(false); setEditing(null); }}
              className={`flex-1 border-b-2 py-3.5 text-[11.5px] font-bold uppercase tracking-[0.14em] cursor-pointer ${tab === t.id ? "border-brand text-slate-50" : "border-transparent text-slate-500"}`}>
              {t.label}
              {t.id === "queues" && openQueue && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-[2px]" aria-label="In a queue" />}
            </button>
          ))}
        </nav>

        <div className="px-4">
          {tab === "coasters" && (
            <div className="pt-1.5">
              {coasters.map(c => {
                const both = c.checked && c.photoV;
                const name = coasterName(c.label);
                const n = c.rideCount || 0;
                return (
                  <div key={c.id} className={`flex items-center gap-3 border-t border-slate-400/15 py-3 last:border-b ${c.skipped ? "opacity-40" : ""}`}>
                    <div className="flex shrink-0 gap-1.5">
                      <PhotoCheck letter="H" on={!!c.checked} label={`Horizontal photo of ${name}`} onClick={() => actions.setPhoto(c.id, "h", !c.checked)} />
                      <PhotoCheck letter="V" on={!!c.photoV} label={`Vertical or 50 MP photo of ${name}`} onClick={() => actions.setPhoto(c.id, "v", !c.photoV)} />
                    </div>
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">{name}</p>
                    {!both && (
                      <button type="button" onClick={() => actions.setItem(c.id, { skipped: !c.skipped })}
                        aria-label={c.skipped ? `Undo skip of ${name}` : `Skip ${name}`}
                        className="shrink-0 px-1 py-2 text-[13px] font-bold text-slate-700 hover:text-rose-400 cursor-pointer">
                        {c.skipped ? "Undo" : "×"}
                      </button>
                    )}
                    {!c.skipped && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => actions.ride(c.id, -1)} disabled={n === 0} aria-label={`One ride less on ${name}`}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-slate-800 text-[19px] font-bold leading-none text-slate-300 disabled:bg-transparent disabled:text-slate-700 cursor-pointer disabled:cursor-default">−</button>
                        <span className={`w-[30px] text-center text-base font-bold tabular-nums ${n ? "text-slate-50" : "text-slate-600"}`}>{n}</span>
                        <button type="button" onClick={() => plusRide(c)} aria-label={`One more ride on ${name}`}
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-brand text-[19px] font-bold leading-none text-slate-900 active:bg-brand-light cursor-pointer">+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "notes" && (
            <div className="pt-1.5">
              {NOTE_CATEGORIES.map(cat => {
                const lines = noteLines(notes[cat.key]);
                const open = openCat === cat.key;
                return (
                  <div key={cat.key} className="border-t border-slate-400/15 last:border-b">
                    <button type="button" aria-expanded={open}
                      onClick={() => { setOpenCat(open ? null : cat.key); setAdding(false); setEditing(null); setDraft(""); }}
                      className="flex w-full items-center gap-3 py-2.5 text-left cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16.5px] font-bold">{cat.label}</span>
                        {!open && (
                          <span className={`mt-0.5 block truncate text-[12.5px] ${lines.length ? "text-slate-500" : "text-brand"}`}>
                            {lines.length ? lines[lines.length - 1] : "Nothing yet"}
                          </span>
                        )}
                      </span>
                      <svg className={`h-[18px] w-[18px] shrink-0 transition-transform ${open ? "rotate-90 text-brand" : "text-slate-500"}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    {open && (
                      <div className="pb-3">
                        {lines.map((line, i) =>
                          editing?.line === line && editing.key === cat.key ? (
                            <LineEditor key={i} value={draft} onChange={setDraft} label={`Edit a line of ${cat.label}`}
                              onSave={saveLine} onCancel={() => { setEditing(null); setDraft(""); }}
                              onDelete={() => { actions.editLine(cat.key, line, ""); setEditing(null); setDraft(""); }} />
                          ) : (
                            <button key={i} type="button" onClick={() => { setEditing({ key: cat.key, line }); setAdding(false); setDraft(line); }}
                              className="relative block w-full py-1.5 pl-4 text-left text-[14.5px] leading-snug text-slate-300 before:absolute before:left-[3px] before:top-[13px] before:h-[5px] before:w-[5px] before:rounded-full before:bg-slate-600 cursor-text">
                              {line}
                            </button>
                          )
                        )}
                        {adding ? (
                          <LineEditor value={draft} onChange={setDraft} label={`New line for ${cat.label}`}
                            placeholder={`A line about ${cat.label.toLowerCase()}…`}
                            onSave={saveLine} onCancel={() => { setAdding(false); setDraft(""); }} />
                        ) : !editing && (
                          <button type="button" onClick={() => { setAdding(true); setDraft(""); }}
                            className="mt-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand cursor-pointer">+ Add a line</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "queues" && (
            <div>
              {openQueue && (
                <div className="mt-4 rounded-[18px] bg-[#16223a] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">In the queue</p>
                  <h2 className="mt-2 text-[28px] font-bold leading-tight">{nameOf(openQueue.item)}</h2>
                  <p className="mt-3 flex items-baseline gap-2.5">
                    <span className="text-[40px] font-bold tabular-nums leading-none">{clock(now - Date.parse(openQueue.start))}</span>
                    <span className="text-[13px] text-slate-400">since {time(openQueue.start)}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-400/15 pt-3 text-sm text-slate-300">
                    <span>Board said <b className="tabular-nums">{openQueue.board ?? 0} min</b></span>
                    <button type="button" onClick={() => setSheet({ kind: "board", qid: openQueue.id, board: openQueue.board ?? 0 })}
                      className="py-1.5 pl-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand cursor-pointer">Change</button>
                  </div>
                  <button type="button" onClick={() => {
                    const m = Math.max(1, Math.round((now - Date.parse(openQueue.start)) / 60000));
                    setSheet({ kind: "log", qid: openQueue.id, item: openQueue.item, timer: m, real: m, board: openQueue.board });
                  }} className="mt-3.5 h-[52px] w-full rounded-[14px] bg-brand text-[16.5px] font-bold text-slate-900 hover:bg-brand-light cursor-pointer">We&apos;re on</button>
                  <button type="button" onClick={() => {
                    const q = openQueue;
                    actions.queueCancel(q.id);
                    setToast({ text: `Left the ${nameOf(q.item)} queue` });
                  }} className="mt-2 h-[46px] w-full rounded-[13px] border border-[#2b3a57] text-sm font-bold text-slate-300 cursor-pointer">We left the queue</button>
                </div>
              )}

              <h3 className="pt-5 pb-1 text-[22px] font-bold">Posted now</h3>
              {coasters.filter(c => !c.skipped).map(c => {
                const r = rideLine(c);
                const mine = openQueue?.item === c.id;
                const label = r?.status === "down" ? "Down" : r?.status === "closed" || r?.status === "refurb" ? "Closed" : r?.wait != null ? `${r.wait} min` : "–";
                return (
                  <div key={c.id} className="flex items-center gap-3 border-t border-slate-400/15 py-2">
                    <button type="button" disabled={!live?.rides.length} onClick={() => setSheet({ kind: "link", item: c.id })}
                      className="min-w-0 flex-1 py-1.5 text-left cursor-pointer disabled:cursor-default">
                      <span className="block text-base font-bold leading-tight">{coasterName(c.label)}</span>
                      {live?.rides.length && !r?.ride ? <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Link to the live waits</span> : null}
                    </button>
                    <span className={`w-[70px] text-right text-[15px] tabular-nums ${r?.status === "down" ? "font-bold text-amber-400" : label === "Closed" || label === "–" ? "text-slate-500" : "font-bold text-slate-50"}`}>{label}</span>
                    <button type="button" disabled={mine}
                      onClick={() => setSheet({ kind: "join", item: c.id, posted: r?.wait ?? null, board: r?.wait ?? 0 })}
                      className="h-9 w-[62px] shrink-0 rounded-[11px] border border-[#2b3a57] text-[13.5px] font-bold text-slate-300 disabled:border-slate-400/15 disabled:text-slate-600 cursor-pointer disabled:cursor-default">
                      {mine ? "In it" : "Join"}
                    </button>
                  </div>
                );
              })}

              {downtime.length > 0 && (
                <>
                  <h3 className="pt-6 pb-1 text-[22px] font-bold">Downtime</h3>
                  {downtime.map(d => (
                    <div key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-slate-400/15 py-2.5">
                      <div>
                        <p className="text-[15px] font-bold">{d.ride}</p>
                        <p className={`text-[11.5px] ${d.to ? "text-slate-500" : "text-amber-400"}`}>{d.to ? `${time(d.from)}–${time(d.to)}` : `Down since ${time(d.from)}`}</p>
                      </div>
                      <span className="text-[15px] font-bold tabular-nums">{Math.max(1, Math.round(((d.to ? Date.parse(d.to) : now) - Date.parse(d.from)) / 60000))} min</span>
                    </div>
                  ))}
                </>
              )}

              {loggedQueues.length > 0 && (() => {
                const timed = loggedQueues.filter(q => q.board != null && q.board > 0);
                const P = timed.reduce((a, q) => a + (q.board ?? 0), 0), R = timed.reduce((a, q) => a + (q.real ?? 0), 0);
                const pct = P ? Math.round((R / P - 1) * 100) : 0;
                return (
                  <>
                    <h3 className="pt-6 pb-1 text-[22px] font-bold">Today</h3>
                    {P > 0 && (
                      <p className="pb-2 text-sm leading-snug text-slate-300">
                        Real waits were <b className="text-slate-50">{Math.abs(pct)}% {pct > 0 ? "longer" : "shorter"}</b> than the boards said.
                      </p>
                    )}
                    <div className="grid grid-cols-[1fr_58px_52px] py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      <span>Ride</span><span className="text-right">Board</span><span className="text-right">Real</span>
                    </div>
                    {[...loggedQueues].reverse().map(q => (
                      <div key={q.id} className="grid grid-cols-[1fr_58px_52px] items-center border-t border-slate-400/15 py-2">
                        <div><p className="text-[15px] font-bold">{nameOf(q.item)}</p><p className="text-[11.5px] text-slate-500">{time(q.start)}</p></div>
                        <span className="text-right text-[15px] tabular-nums text-slate-400">{q.board ?? "–"}</span>
                        <span className="text-right text-[15px] font-bold tabular-nums">{q.real}</span>
                      </div>
                    ))}
                  </>
                );
              })()}

              {live && (live.waits || live.status) && (
                <p className="mt-5 text-center text-xs text-slate-500">
                  {live.waits === "queue-times" && <a href="https://queue-times.com/" target="_blank" rel="noopener" className="text-slate-300 underline">Powered by Queue-Times.com</a>}
                  {live.waits === "queue-times" && live.status === "themeparks.wiki" && " · "}
                  {(live.status === "themeparks.wiki" || live.waits === "themeparks.wiki") && <>ride status from <a href="https://themeparks.wiki/" target="_blank" rel="noopener" className="text-slate-300 underline">ThemeParks.wiki</a></>}
                </p>
              )}
            </div>
          )}

          {tab === "checklist" && (
            <div>
              {[{ title: "Photos", list: photoTasks }, { title: "Before you leave", list: otherTasks }].filter(g => g.list.length).map(g => (
                <div key={g.title}>
                  <p className="flex items-center gap-2.5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 after:h-px after:flex-1 after:bg-slate-400/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />{g.title}
                  </p>
                  {g.list.map(t => {
                    const done = !!t.checked || !!t.skipped;
                    return (
                      <button key={t.id} type="button" aria-pressed={done}
                        onClick={() => actions.setItem(t.id, t.skipped ? { skipped: false, checked: true } : { checked: !t.checked })}
                        className={`flex w-full items-center gap-3 border-t border-slate-400/15 py-2.5 text-left text-[15.5px] cursor-pointer ${done ? "text-slate-500" : "text-slate-300"}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] ${done ? "border-brand bg-brand text-slate-900" : "border-slate-700 text-transparent"}`}>{CHECK}</span>
                        <span className="flex-1">{taskLabel(t.label)}</span>
                        {t.skipped && <span className="text-[11px] uppercase tracking-[0.14em] text-slate-600">Skipped</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="mt-6">
                {finished ? (
                  <Link href={`/?modal=true&importChecklist=${checklist.slug}`}
                    className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-brand text-[16.5px] font-bold text-slate-900 hover:bg-brand-light">Write the review</Link>
                ) : (
                  <button type="button" onClick={() => (allDone ? complete() : setSheet({ kind: "complete" }))}
                    className={`h-[52px] w-full rounded-[14px] text-[16.5px] font-bold cursor-pointer ${allDone ? "bg-brand text-slate-900 hover:bg-brand-light" : "bg-slate-800 text-slate-100"}`}>
                    Complete visit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Everything ticked off: complete from any tab. */}
      {allDone && !finished && tab !== "checklist" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2b3a57] bg-[#16223a] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <span className="flex-1 text-sm text-slate-300">Everything is ticked off</span>
            <button type="button" onClick={complete} className="h-[42px] rounded-xl bg-brand px-4 text-[14.5px] font-bold text-slate-900 cursor-pointer">Complete visit</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-3 bottom-[calc(14px+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-[14px] bg-slate-800 px-4 py-3 text-sm shadow-2xl">
          <span className="flex-1">{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={() => { toast.undo?.(); setToast(null); }}
              className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand cursor-pointer">Undo</button>
          )}
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70" onClick={(e) => { if (e.target === e.currentTarget && sheet.kind !== "done") setSheet(null); }}>
          <div role="dialog" aria-modal="true" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border-t border-[#2b3a57] bg-[#0f172a] px-4 pt-2.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-slate-700" />
            {sheet.kind === "join" && (
              <>
                <h4 className="text-[22px] font-bold">{nameOf(sheet.item)}</h4>
                <p className="mt-1.5 text-[13.5px] leading-snug text-slate-400">
                  {sheet.posted != null ? `The live wait is ${sheet.posted} min. Change it if the board says something else.` : "No live wait here. Enter what the board says, or leave it at 0."}
                  {openQueue ? ` Your ${nameOf(openQueue.item)} queue ends without being logged.` : ""}
                </p>
                <Adjust label="The board says" value={sheet.board} step={5} onChange={(v) => setSheet({ ...sheet, board: v })} />
                <SheetButtons primary="Start the queue timer" onPrimary={() => { actions.queueStart(sheet.item, sheet.board); setSheet(null); }} secondary="Cancel" onSecondary={() => setSheet(null)} />
              </>
            )}
            {sheet.kind === "board" && (
              <>
                <h4 className="text-[22px] font-bold">Board time</h4>
                <p className="mt-1.5 text-[13.5px] text-slate-400">What the board at the entrance said when you joined.</p>
                <Adjust label="The board said" value={sheet.board} step={5} onChange={(v) => setSheet({ ...sheet, board: v })} />
                <SheetButtons primary="Save" onPrimary={() => { actions.queueBoard(sheet.qid, sheet.board); setSheet(null); }} secondary="Cancel" onSecondary={() => setSheet(null)} />
              </>
            )}
            {sheet.kind === "log" && (
              <>
                <h4 className="text-[22px] font-bold">{nameOf(sheet.item)}</h4>
                <p className="mt-1.5 text-[13.5px] leading-snug text-slate-400">Forgot to stop the timer? Set your real wait before it&apos;s logged.</p>
                <Adjust label="Your wait" sub={`Timer says ${sheet.timer} min`} value={sheet.real} step={1} onChange={(v) => setSheet({ ...sheet, real: v })} />
                <SheetButtons primary="Log the queue and the ride" onPrimary={() => {
                  actions.queueLog(sheet.qid, sheet.item, sheet.real, sheet.board);
                  const c = items.find(i => i.id === sheet.item);
                  setToast({ text: `${nameOf(sheet.item)} · ${sheet.real} min logged, ride ${(c?.rideCount || 0) + 1} counted` });
                  setSheet(null);
                }} secondary="Back to the queue" onSecondary={() => setSheet(null)} />
              </>
            )}
            {sheet.kind === "link" && (() => {
              const name = nameOf(sheet.item);
              const current = live?.coasters[sheet.item]?.ride ?? null;
              const rides = [...(live?.rides ?? [])].sort((a, b) => likeness(name, b.name) - likeness(name, a.name));
              const pick = (ride: string) => { actions.link(sheet.item, ride); setSheet(null); setTimeout(reload, 800); };
              return (
                <>
                  <h4 className="text-[22px] font-bold">{name}</h4>
                  <p className="mt-1.5 text-[13.5px] text-slate-400">Which ride is it in the live waits?</p>
                  <div className="mt-2">
                    {rides.map(r => (
                      <button key={r.name} type="button" onClick={() => pick(r.name)}
                        className={`flex w-full items-center justify-between border-b border-slate-400/15 py-3 text-left text-[15px] cursor-pointer ${r.name === current ? "font-bold text-brand" : "text-slate-200"}`}>
                        <span>{r.name}</span>
                        <span className="text-[13px] tabular-nums text-slate-500">{r.status === "open" && r.wait != null ? `${r.wait} min` : r.status === "down" ? "Down" : "Closed"}</span>
                      </button>
                    ))}
                    <button type="button" onClick={() => pick("")} className="w-full py-3 text-left text-[15px] text-slate-400 cursor-pointer">Not in the list</button>
                  </div>
                </>
              );
            })()}
            {sheet.kind === "complete" && (
              <>
                <h4 className="text-[22px] font-bold">Complete the visit?</h4>
                <p className="mt-1.5 text-[13.5px] text-slate-400">These are still open:</p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                  {missingPhotos > 0 && <li className="before:mr-2.5 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand before:align-[2px]">{missingPhotos} coaster photo{missingPhotos === 1 ? "" : "s"}</li>}
                  {openTasks.map(t => <li key={t.id} className="before:mr-2.5 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand before:align-[2px]">{taskLabel(t.label)}</li>)}
                </ul>
                <SheetButtons primary="Complete anyway" onPrimary={complete} secondary="Not yet" onSecondary={() => setSheet(null)} />
              </>
            )}
            {sheet.kind === "done" && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Visit complete</p>
                <h4 className="mt-2 text-[30px] font-bold leading-tight">{parkName}</h4>
                <div className="mt-3 h-1 w-12 bg-brand" />
                <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4">
                  <Stat value={formatDuration(elapsed)} label="in the park" />
                  <Stat value={String(coasters.reduce((a, c) => a + (c.rideCount || 0), 0))} label={`rides on ${coasters.filter(c => (c.rideCount || 0) > 0).length} coasters`} />
                  <Stat value={String(NOTE_CATEGORIES.reduce((a, c) => a + noteLines(notes[c.key]).length, 0))} label="lines of notes" />
                  <Stat value={String(loggedQueues.length)} label="queues timed" />
                </div>
                <Link href={`/?modal=true&importChecklist=${checklist.slug}`}
                  className="mt-6 flex h-[52px] w-full items-center justify-center rounded-[14px] bg-brand text-[16.5px] font-bold text-slate-900 hover:bg-brand-light">Write the review</Link>
                <button type="button" onClick={() => setSheet(null)} className="mt-2 h-[46px] w-full rounded-[13px] border border-[#2b3a57] text-sm font-bold text-slate-300 cursor-pointer">Back to the checklist</button>
              </>
            )}
          </div>
        </div>
      )}

      {showLogin && (
        <AuthenticationModal
          onClose={() => setShowLogin(false)}
          onAuthenticated={() => {
            setShowLogin(false);
            actions.retryAfterLogin();
          }}
        />
      )}
    </div>
  );
}

function PhotoCheck({ letter, on, label, onClick }: { letter: string; on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label}
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold cursor-pointer ${on ? "border-brand bg-brand text-slate-900" : "border-slate-600 text-slate-500"}`}>
      {on ? CHECK : letter}
    </button>
  );
}

function LineEditor({ value, onChange, onSave, onCancel, onDelete, label, placeholder }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; onDelete?: () => void; label: string; placeholder?: string;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} rows={3}
        className="w-full resize-y rounded-xl border-[1.5px] border-brand bg-[#16223a] px-3 py-2.5 text-[15px] leading-snug text-slate-50 placeholder-slate-500 focus:outline-none" />
      <div className="flex justify-end gap-5">
        {onDelete && <button type="button" onClick={onDelete} className="mr-auto py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-400 cursor-pointer">Delete</button>}
        <button type="button" onClick={onCancel} className="py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 cursor-pointer">Cancel</button>
        <button type="button" onClick={onSave} disabled={!value.trim()} className="py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand disabled:text-slate-600 cursor-pointer">Save line</button>
      </div>
    </div>
  );
}

function Adjust({ label, sub, value, step, onChange }: { label: string; sub?: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-400/15 py-3.5">
      <span className="text-[15px] text-slate-300">{label}{sub && <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>}</span>
      <div className="flex items-center">
        <button type="button" onClick={() => onChange(Math.max(0, value - step))} disabled={value <= 0} aria-label={`${step} min less`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2b3a57] text-[22px] text-slate-400 disabled:border-slate-400/15 disabled:text-slate-700 cursor-pointer">−</button>
        <span className="w-[76px] text-center text-[19px] font-bold tabular-nums">{value} min</span>
        <button type="button" onClick={() => onChange(Math.min(600, value + step))} aria-label={`${step} min more`}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-[22px] text-slate-50 cursor-pointer">+</button>
      </div>
    </div>
  );
}

function SheetButtons({ primary, onPrimary, secondary, onSecondary }: { primary: string; onPrimary: () => void; secondary: string; onSecondary: () => void }) {
  return (
    <>
      <button type="button" onClick={onPrimary} className="mt-4 h-[52px] w-full rounded-[14px] bg-brand text-[16.5px] font-bold text-slate-900 hover:bg-brand-light cursor-pointer">{primary}</button>
      <button type="button" onClick={onSecondary} className="mt-2 h-[46px] w-full rounded-[13px] border border-[#2b3a57] text-sm font-bold text-slate-300 cursor-pointer">{secondary}</button>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b className="block text-[28px] tabular-nums leading-tight">{value}</b>
      <span className="text-[12.5px] text-slate-400">{label}</span>
    </div>
  );
}

/**
 * Quiet while everything is saved. Says so plainly when changes are only on
 * this phone: no connection (they sync on their own) or not logged in (they
 * wait for a login and are never dropped).
 */
function SyncNotice({ status, pending, onLogin }: { status: SyncStatus; pending: number; onLogin: () => void }) {
  const [showSaving, setShowSaving] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // A save normally takes a fraction of a second; only mention it if it lingers.
  useEffect(() => {
    if (status !== "saving") { setShowSaving(false); return; }
    const t = setTimeout(() => setShowSaving(true), 1500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status === "offline" || status === "unauthorized") { setWasOffline(true); return; }
    if (status === "saved" && wasOffline) {
      setWasOffline(false);
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status, wasOffline]);

  const changes = `${pending} change${pending === 1 ? "" : "s"}`;

  if (status === "unauthorized") {
    return (
      <div className="mb-2 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-2.5 text-xs text-amber-200 shadow-lg">
        <span className="flex-1 leading-snug">
          This phone isn&apos;t logged in, so nothing reaches the site.
          {pending > 0 ? ` ${changes} kept on this phone.` : ""}
        </span>
        <button
          onClick={onLogin}
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
        >
          Log in
        </button>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-slate-900/95 px-3 py-2.5 text-xs leading-snug text-amber-200 shadow-lg">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
        <span>No connection. {changes} kept on this phone, sent as soon as you&apos;re back online.</span>
      </div>
    );
  }

  let line: ReactNode = null;
  if (showSaving) {
    line = <span className="text-slate-400">Saving…</span>;
  } else if (justSynced) {
    line = <span className="text-emerald-400">All changes synced</span>;
  }

  if (!line) return null;
  return <p className="mb-2 text-center text-[11px] font-medium">{line}</p>;
}
