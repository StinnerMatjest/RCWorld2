"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getRatingHex } from "@/app/utils/design";
import TaskRunner from "./TaskRunner";
import { CATEGORIES, isFraming, KIND_LABEL, PEOPLE, PERSON_KEY, randomTask, sortQueue, taskTitle, taskWhere, thumb, type CleanupData, type CleanupKind, type CleanupPerson, type CleanupTask } from "./shared";

type View =
  | { name: "overview" }
  | { name: "park"; parkId: number }
  | { name: "run"; kinds?: CleanupKind[]; parkId?: number; startKey?: string; random?: boolean };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
const pct = (d: number, t: number) => (t ? Math.round((100 * d) / t) : 100);

function Bar({ value, className = "" }: { value: number; className?: string }) {
  return <div className={`h-1 overflow-hidden rounded bg-white/15 ${className}`}><i className="block h-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export default function CleanupClient() {
  const [data, setData] = useState<CleanupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<CleanupPerson | null>(null);
  const [askPerson, setAskPerson] = useState(false);
  const [view, setView] = useState<View>({ name: "overview" });
  const [nextKey, setNextKey] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    try {
      const res = await fetch("/api/cleanup", { cache: "no-store" });
      if (res.status === 401) { setError("login"); return; }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { const p = localStorage.getItem(PERSON_KEY); if (p && (PEOPLE as string[]).includes(p)) setPerson(p as CleanupPerson); } catch {} }, []);
  const choose = (p: CleanupPerson) => { setPerson(p); setAskPerson(false); try { localStorage.setItem(PERSON_KEY, p); } catch {} };

  // After a fix the page updates itself at once and syncs with the server a little later.
  const syncTimer = useRef<number | undefined>(undefined);
  const onDone = (t: CleanupTask) => {
    setData((d) => {
      if (!d) return d;
      const totals = { ...d.totals, [t.kind]: { ...(d.totals[t.kind] ?? { done: 0, total: 1 }), done: (d.totals[t.kind]?.done ?? 0) + 1 } };
      const parks = d.parks.map((p) => (p.id !== t.parkId || !t.quick ? p : { ...p, done: p.done + 1, open: { ...p.open, [t.kind]: Math.max(0, (p.open[t.kind] ?? 1) - 1) } }));
      const scores = person ? { ...d.scores, [person]: { total: d.scores[person].total + 1, week: d.scores[person].week + 1 } } : d.scores;
      return { ...d, tasks: d.tasks.filter((x) => x.key !== t.key), totals, parks, scores };
    });
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => load(true), 4000);
  };

  const quick = useMemo(() => (data?.tasks ?? []).filter((t) => t.quick), [data]);
  const next = useMemo(() => (nextKey ? quick.find((t) => t.key === nextKey) : undefined) ?? null, [quick, nextKey]);
  useEffect(() => { if (data && !next) setNextKey(randomTask(quick, new Set())?.key ?? null); }, [data, next, quick]);

  if (error === "login") {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-white">Clean-up</h1>
        <p className="mt-3 text-slate-400">This tool is for admins. Log in to admin mode, then come back here.</p>
      </div>
    );
  }
  if (!data) {
    return <div className="mx-auto max-w-[1560px] px-4 py-24 text-center text-slate-400 md:px-12">{error ?? "Finding everything that needs a fix…"}</div>;
  }

  const parksById = new Map(data.parks.map((p) => [p.id, p]));
  const openQuick = quick.length;
  const quickTotal = data.parks.reduce((s, p) => s + p.total, 0);

  if (view.name === "run") {
    const queue = sortQueue(quick.filter((t) => (!view.kinds || view.kinds.includes(t.kind)) && (view.parkId == null || t.parkId === view.parkId)));
    return (
      <>
        <TaskRunner
          key={`${view.kinds?.join() ?? "all"}-${view.parkId ?? ""}-${view.random ? "r" : ""}`}
          queue={view.random ? quick : queue}
          startKey={view.startKey}
          random={view.random}
          person={person}
          openCount={openQuick}
          onDone={onDone}
          onExit={() => setView(view.parkId != null ? { name: "park", parkId: view.parkId } : { name: "overview" })}
          pickRandom={(not) => randomTask(quick, not)}
          needPerson={() => setAskPerson(true)}
        />
        {askPerson && <WhoModal onPick={choose} onClose={() => setAskPerson(false)} />}
      </>
    );
  }

  const people = (
    <div className="flex gap-2.5">
      {PEOPLE.map((p) => (
        <button key={p} type="button" onClick={() => choose(p)}
          className={`flex flex-1 items-center gap-3 rounded-full border py-2 pl-2 pr-4 text-left transition-colors cursor-pointer md:min-w-[180px] md:flex-none ${person === p ? "border-brand bg-brand/10" : "border-slate-700 hover:border-slate-500"} ${askPerson && !person ? "animate-pulse" : ""}`}>
          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-[15px] font-bold ${person === p ? "bg-brand text-white" : "bg-slate-300 text-slate-900"}`}>{p[0]}</span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-white">{p}</span>
            <span className="block whitespace-nowrap text-xs text-slate-400"><b className="text-white">{data.scores[p].total}</b> · {data.scores[p].week} this week</span>
          </span>
        </button>
      ))}
    </div>
  );

  if (view.name === "park") {
    const park = parksById.get(view.parkId);
    const tasks = sortQueue(data.tasks.filter((t) => t.parkId === view.parkId));
    if (!park) { setView({ name: "overview" }); return null; }
    return (
      <div className="mx-auto max-w-[1560px] px-4 pb-16 pt-4 md:px-12">
        <button onClick={() => setView({ name: "overview" })} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>
        <div className="relative mt-4 overflow-hidden rounded-[22px] bg-slate-950" style={{ aspectRatio: "21 / 6", minHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {park.card && <img src={thumb(park.card, 1920)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-4 md:bottom-8 md:left-10 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">{park.country}</p>
              <h1 className="mt-1 text-3xl font-bold text-white md:text-5xl">{park.name}</h1>
              <p className="mt-2 text-sm text-slate-300">{pct(park.done, park.total)}% ready · {park.total - park.done} quick fixes open</p>
              <Bar value={pct(park.done, park.total)} className="mt-3 w-56" />
            </div>
            <button type="button" onClick={() => setView({ name: "run", parkId: park.id })} disabled={park.total === park.done}
              className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-50 cursor-pointer">Start this park</button>
          </div>
        </div>
        {CATEGORIES.map((c) => {
          const list = tasks.filter((t) => c.kinds.includes(t.kind));
          if (!list.length) return null;
          return (
            <section key={c.id} className="mt-9">
              <div className="mb-3 flex items-baseline justify-between"><h2 className="text-xl font-bold text-white">{c.title} <span className="text-slate-500">· {list.length}</span></h2>
                <button type="button" onClick={() => setView({ name: "run", parkId: park.id, kinds: c.kinds })} className="text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light cursor-pointer">Do these</button></div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8 2xl:grid-cols-10">
                {list.map((t) => (
                  <button key={t.key} type="button" onClick={() => setView({ name: "run", parkId: park.id, kinds: c.kinds, startKey: t.key })} className="text-left cursor-pointer">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.image ? <img src={thumb(t.image)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">{t.section?.heading ?? "No photo"}</span>}
                      {isFraming(t.kind) && <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${t.state === "never" ? "bg-brand text-white" : "bg-slate-950/70 text-slate-200"}`}>{t.state === "never" ? "New" : "Check"}</span>}
                    </div>
                    <div className="mt-1.5 truncate text-xs text-slate-300">{t.coasterName ?? t.label ?? KIND_LABEL[t.kind]}</div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        <div className="mt-12"><ManualStrips tasks={data.tasks.filter((t) => t.parkId === park.id)} /></div>
      </div>
    );
  }

  // ─── overview ───
  const nextImg = next?.image ?? (next ? parksById.get(next.parkId)?.card : null);
  return (
    <div className="mx-auto max-w-[1560px] px-4 pb-16 pt-2 md:px-12">
      <div className="mb-6 mt-2 flex flex-col gap-4 md:mb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-white md:text-[44px]">Clean-up</h1>
          <div className="mt-3 h-1 w-14 rounded bg-brand" />
          <p className="mt-3 text-[15px] text-slate-400">Quick fixes that make every page look finished.</p>
        </div>
        {people}
      </div>

      {next && (
        <div className="relative mb-9 overflow-hidden rounded-[22px] bg-slate-950 aspect-[4/5] md:aspect-[21/7] md:min-h-[300px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {nextImg && <img src={thumb(nextImg, 1920)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "50% 40%" }} />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/10 md:bg-gradient-to-r md:from-slate-950/90 md:via-slate-950/55 md:to-transparent" />
          <div className="absolute inset-x-5 bottom-5 flex flex-col gap-4 md:inset-x-11 md:bottom-10 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand">Next quick fix · {KIND_LABEL[next.kind]}</p>
              <h2 className="mt-2.5 max-w-[640px] text-[30px] font-bold leading-[1.02] tracking-tight text-white md:text-[46px]">{taskTitle(next)}</h2>
              <p className="mt-2 text-[15px] text-slate-300">{taskWhere(next)}{isFraming(next.kind) ? (next.state === "never" ? " · never framed" : " · framed before, check it") : ""}</p>
              <div className="mt-5 flex gap-2.5">
                <button type="button" onClick={() => setView({ name: "run", random: true, startKey: next.key })} className="flex-1 rounded-xl bg-brand px-7 py-3.5 text-[15px] font-bold text-white hover:bg-brand-light md:flex-none cursor-pointer">Start</button>
                <button type="button" onClick={() => setNextKey(randomTask(quick, new Set([next.key]))?.key ?? null)} className="flex-1 whitespace-nowrap rounded-xl border border-white/25 bg-slate-950/50 px-5 py-3.5 text-[15px] font-bold text-white hover:border-white/50 md:flex-none cursor-pointer">⤨ Shuffle</button>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <div className="text-[64px] font-bold leading-none tracking-tight text-white">{openQuick}</div>
              <div className="mt-1.5 text-sm text-slate-300">quick fixes left</div>
              <Bar value={pct(quickTotal - openQuick, quickTotal)} className="ml-auto mt-3 w-60" />
            </div>
          </div>
        </div>
      )}

      <div className="mb-3.5 flex items-baseline justify-between"><h2 className="text-[22px] font-bold text-white">Quick fixes</h2><span className="text-xs text-slate-500">Random picks only come from these</span></div>
      <div className="mb-10 grid auto-cols-[44%] grid-flow-col gap-3 overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-7 md:overflow-visible">
        {CATEGORIES.map((c) => {
          const open = quick.filter((t) => c.kinds.includes(t.kind));
          const done = c.kinds.reduce((s, k) => s + (data.totals[k]?.done ?? 0), 0);
          const total = c.kinds.reduce((s, k) => s + (data.totals[k]?.total ?? 0), 0);
          const img = (open.find((t) => t.image && t.state === "never") ?? open.find((t) => t.image))?.image ?? (open[0] ? parksById.get(open[0].parkId)?.card ?? null : null);
          const fresh = open.filter((t) => isFraming(t.kind) && t.state === "never").length;
          return (
            <button key={c.id} type="button" onClick={() => setView({ name: "run", kinds: c.kinds })} disabled={!open.length}
              className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-slate-950 text-left cursor-pointer disabled:cursor-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img && <img src={thumb(img)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-slate-950/15" />
              <span className="absolute left-3.5 top-3.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white drop-shadow">{c.title}</span>
              <span className="absolute inset-x-3.5 bottom-3.5">
                <span className="block text-[40px] font-bold leading-none tracking-tight text-white">{open.length}</span>
                <span className="mt-1 block text-[13px] text-slate-300">{c.verb}</span>
                <Bar value={pct(done, total)} className="mt-2.5" />
                <span className="mt-1.5 block text-[11px] text-slate-400">{fresh ? `${fresh} never framed · ` : ""}{done} of {total} done</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3.5 flex items-baseline justify-between"><h2 className="text-[22px] font-bold text-white">Parks</h2><span className="text-xs text-slate-500">Least finished first</span></div>
      <div className="mb-11 grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] md:gap-4">
        {[...data.parks].sort((a, b) => a.done / (a.total || 1) - b.done / (b.total || 1)).map((p) => {
          const chips = CATEGORIES.map((c) => ({ c, n: c.kinds.reduce((s, k) => s + (p.open[k] ?? 0), 0) })).filter((x) => x.n);
          return (
            <button key={p.id} type="button" onClick={() => setView({ name: "park", parkId: p.id })} className="overflow-hidden rounded-2xl border border-white/5 bg-[#111a2e] text-left hover:border-white/15 cursor-pointer">
              <div className="relative aspect-video bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.card && <img src={thumb(p.card)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute right-2.5 top-2.5 rounded-full bg-slate-950/75 px-2 py-0.5 text-xs font-bold text-white">{pct(p.done, p.total)}%</span>
              </div>
              <div className="p-2.5 md:px-3.5 md:pb-3.5 md:pt-3">
                <div className="flex items-baseline justify-between gap-2"><b className="truncate text-sm text-white md:text-base">{p.name}</b>{p.overall != null && <span className="text-sm font-bold md:text-base" style={{ color: getRatingHex(p.overall) }}>{fmt(p.overall)}</span>}</div>
                <div className="mt-0.5 text-xs text-slate-500">{p.country} · {p.total - p.done} open</div>
                <Bar value={pct(p.done, p.total)} className="my-2.5" />
                <div className="hidden flex-wrap gap-1.5 md:flex">
                  {chips.map(({ c, n }) => <span key={c.id} className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-orange-300">{n} {c.title.toLowerCase()}</span>)}
                  {!chips.length && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-bold text-green-300">✓ All quick fixes done</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <ManualStrips tasks={data.tasks} />
      {askPerson && <WhoModal onPick={choose} onClose={() => setAskPerson(false)} />}
    </div>
  );
}

/** Reviews to write and coasters without photos: visible, never handed out at random. */
function ManualStrips({ tasks }: { tasks: CleanupTask[] }) {
  const reviews = tasks.filter((t) => t.kind === "coaster-review").sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const photos = tasks.filter((t) => t.kind === "coaster-photos").sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const strip = (list: CleanupTask[]) => (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {list.map((t) => (
        <Link key={t.key} href={`/coasters/${t.coasterSlug}`} target="_blank" className="w-[132px] flex-none md:w-[168px]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-gradient-to-br from-slate-800 to-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.image ? <img src={thumb(t.image)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-widest text-slate-500">No photo</span>}
            {t.rating != null && <span className="absolute left-2 top-2 rounded-lg bg-slate-950/75 px-2 py-0.5 text-[15px] font-bold" style={{ color: getRatingHex(t.rating) }}>{fmt(t.rating)}</span>}
          </div>
          <div className="mt-2 truncate text-sm text-white">{t.coasterName}</div>
          <div className="truncate text-xs text-slate-500">{t.parkName}</div>
        </Link>
      ))}
    </div>
  );
  return (
    <>
      {reviews.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex items-baseline justify-between"><h2 className="text-[22px] font-bold text-white">Reviews to write · {reviews.length}</h2><span className="text-xs text-slate-500">Never handed out at random</span></div>
          <p className="mb-3.5 text-sm text-slate-400">Ridden coasters without a review, best rated first. Opens the coaster page.</p>
          {strip(reviews)}
        </section>
      )}
      {photos.length > 0 && (
        <section>
          <div className="mb-3.5 flex items-baseline justify-between"><h2 className="text-[22px] font-bold text-white">Coasters without photos · {photos.length}</h2><span className="text-xs text-slate-500">Needs a visit, not a fix</span></div>
          {strip(photos)}
        </section>
      )}
    </>
  );
}

function WhoModal({ onPick, onClose }: { onPick: (p: CleanupPerson) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-xl font-bold text-white">Who&apos;s working?</p>
        <p className="mt-1 text-sm text-slate-400">The credit goes to whoever is picked. Remembered on this device.</p>
        <div className="mt-5 flex gap-3">
          {PEOPLE.map((p) => <button key={p} type="button" onClick={() => onPick(p)} className="flex-1 rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-light cursor-pointer">{p}</button>)}
        </div>
      </div>
    </div>
  );
}
