"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getParkFlag, getRatingHex } from "@/app/utils/design";
import TaskRunner from "./TaskRunner";
import {
  api, CATEGORIES, categoryStats, FRAMING, groupOf, ON_PAGE, PEOPLE, PERSON_KEY, QUICK, randomTask, sortQueue,
  type Category, type CleanupData, type CleanupPerson, type CleanupTask,
} from "./shared";

type View =
  | { name: "overview" }
  | { name: "park"; parkId: number }
  | { name: "list"; cat: string; parkId?: number }
  | { name: "run"; cat?: string; parkId?: number; startKey?: string; random?: boolean };

const pct = (d: number, t: number) => (t ? Math.round((100 * d) / t) : 100);
const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

function Bar({ value }: { value: number }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

/** One aligned table: a name, how many are left, how far along, a chevron. */
function Table({ title, cols = ["Left", "Done"], children }: { title: string; cols?: [string, string] | string[]; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="grid grid-cols-[minmax(0,1fr)_56px_20px] items-end gap-4 border-b border-white/10 px-3 pb-2 md:grid-cols-[minmax(0,1fr)_64px_200px_20px]">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-slate-300">{title}</h2>
        <span className="text-right text-[11px] uppercase tracking-widest text-slate-500">{cols[0]}</span>
        <span className="hidden text-[11px] uppercase tracking-widest text-slate-500 md:block">{cols[1]}</span>
        <span />
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </section>
  );
}
function Row({ label, sub, left, done, total, onClick, disabled }: { label: React.ReactNode; sub?: React.ReactNode; left: number; done?: number; total?: number; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="grid w-full grid-cols-[minmax(0,1fr)_56px_20px] items-center gap-4 px-3 py-3 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent cursor-pointer md:grid-cols-[minmax(0,1fr)_64px_200px_20px]">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-white">{label}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
      <span className={`text-right text-[17px] font-bold tabular-nums ${left ? "text-white" : "text-slate-600"}`}>{left || "–"}</span>
      <span className="hidden items-center gap-3 md:flex">
        {total != null && total > 0 ? <><Bar value={pct(done ?? 0, total)} /><span className="w-[72px] shrink-0 text-right text-xs tabular-nums text-slate-500">{done} / {total}</span></> : <span />}
      </span>
      <span className="text-right text-slate-500">{disabled ? "" : "›"}</span>
    </button>
  );
}

export default function CleanupClient() {
  const [data, setData] = useState<CleanupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<CleanupPerson | null>(null);
  const [askPerson, setAskPerson] = useState(false);
  const [view, setView] = useState<View>({ name: "overview" });

  const load = useCallback(async (quiet = false): Promise<CleanupTask[]> => {
    try {
      const res = await fetch("/api/cleanup", { cache: "no-store" });
      if (res.status === 401) { setError("login"); return []; }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const d: CleanupData = await res.json();
      setData(d);
      setError(null);
      return d.tasks;
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load");
      return [];
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { try { const p = localStorage.getItem(PERSON_KEY); if (p && (PEOPLE as string[]).includes(p)) setPerson(p as CleanupPerson); } catch {} }, []);
  const choose = (p: CleanupPerson) => { setPerson(p); setAskPerson(false); try { localStorage.setItem(PERSON_KEY, p); } catch {} };

  // After a fix the page updates itself at once and syncs with the server a little later.
  const syncTimer = useRef<number | undefined>(undefined);
  const onDone = (t: CleanupTask, credits: number) => {
    setData((d) => {
      if (!d) return d;
      const g = groupOf(t);
      const totals = { ...d.totals, [g]: { total: d.totals[g]?.total ?? 1, done: (d.totals[g]?.done ?? 0) + 1 } };
      const parks = d.parks.map((p) => (p.id !== t.parkId || !t.quick ? p : { ...p, done: p.done + 1, open: { ...p.open, [g]: Math.max(0, (p.open[g] ?? 1) - 1) } }));
      const scores = person && credits ? { ...d.scores, [person]: { total: d.scores[person].total + credits, week: d.scores[person].week + credits } } : d.scores;
      return { ...d, tasks: d.tasks.filter((x) => x.key !== t.key), totals, parks, scores };
    });
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => { void load(true); }, 4000);
  };

  const quick = useMemo(() => (data?.tasks ?? []).filter((t) => t.quick), [data]);
  // Every view opens at its top.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  if (error === "login") {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-white">Clean-up</h1>
        <p className="mt-3 text-slate-400">This tool is for admins. Log in to admin mode, then come back here.</p>
      </div>
    );
  }
  if (!data) return <div className="mx-auto max-w-[1100px] px-4 py-24 text-center text-slate-400">{error ?? "Finding everything that needs a fix…"}</div>;

  const parksById = new Map(data.parks.map((p) => [p.id, p]));
  const catById = (id?: string) => CATEGORIES.find((c) => c.id === id);
  const who = askPerson && <WhoModal onPick={choose} onClose={() => setAskPerson(false)} />;

  // ─── runner ───
  if (view.name === "run") {
    const cat = catById(view.cat);
    const queue = sortQueue(quick.filter((t) => (!cat || cat.groups.includes(groupOf(t))) && (view.parkId == null || t.parkId === view.parkId)));
    const title = view.random ? "Random fixes" : cat ? cat.title : view.parkId != null ? parksById.get(view.parkId)?.name ?? "Park" : "All";
    return (
      <>
        <TaskRunner
          key={`${view.cat ?? "all"}-${view.parkId ?? ""}-${view.random ? "r" : ""}`}
          queue={view.random ? quick : queue}
          startKey={view.startKey ?? (view.random ? randomTask(quick, new Set())?.key : undefined)}
          random={view.random}
          title={title}
          person={person}
          onDone={onDone}
          onReload={() => load(true)}
          onExit={() => setView(view.parkId != null ? { name: "park", parkId: view.parkId } : { name: "overview" })}
          pickRandom={(not) => randomTask(quick, not)}
          needPerson={() => setAskPerson(true)}
        />
        {who}
      </>
    );
  }

  const people = (
    <div className="flex items-center gap-2">
      <span className="mr-1 hidden text-xs text-slate-500 sm:inline">Working:</span>
      {PEOPLE.map((p) => (
        <button key={p} type="button" onClick={() => choose(p)}
          className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors cursor-pointer ${person === p ? "border-brand bg-brand/10 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"} ${askPerson && !person ? "animate-pulse" : ""}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${person === p ? "bg-brand text-white" : "bg-slate-700 text-slate-200"}`}>{p[0]}</span>
          <span className="font-semibold">{p}</span>
          <span className="tabular-nums text-slate-400">{data.scores[p].total}</span>
        </button>
      ))}
    </div>
  );
  const back = (to: View = { name: "overview" }) => <button onClick={() => setView(to)} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>;

  const catRows = (cats: Category[], parkId?: number) => cats.map((c) => {
    const tasks = parkId == null ? data.tasks : data.tasks.filter((t) => t.parkId === parkId);
    const s = categoryStats(c, tasks, data.totals);
    if (parkId != null && !s.open) return null;
    return (
      <Row key={c.id} label={c.title} left={s.open} done={parkId == null && !c.list ? s.done : undefined} total={parkId == null && !c.list ? s.total : undefined} disabled={!s.open}
        onClick={() => setView(c.list ? { name: "list", cat: c.id, parkId } : { name: "run", cat: c.id, parkId })} />
    );
  });

  // ─── lists: fixed on the page, not in the tool ───
  if (view.name === "list") {
    const cat = catById(view.cat)!;
    const rows = data.tasks.filter((t) => cat.groups.includes(groupOf(t)) && (view.parkId == null || t.parkId === view.parkId))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.parkName.localeCompare(b.parkName) || (a.coasterName ?? "").localeCompare(b.coasterName ?? ""));
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 md:px-8">
        {back(view.parkId != null ? { name: "park", parkId: view.parkId } : { name: "overview" })}
        <div className="mb-6 mt-4 flex items-end justify-between gap-4">
          <h1 className="text-2xl font-bold text-white md:text-3xl">{cat.title}</h1>
          <span className="text-sm tabular-nums text-slate-400">{rows.length}</span>
        </div>
        {cat.id === "section-needs-photo" && <p className="-mt-3 mb-5 text-sm text-slate-500">Add the photo in the page&apos;s own section editor. Open takes you to the section.</p>}
        <div className="divide-y divide-white/5 border-t border-white/10">
          {rows.map((t) => <ListRow key={t.key} t={t} person={person} needPerson={() => setAskPerson(true)} onDone={() => onDone(t, 1)} />)}
          {!rows.length && <p className="py-10 text-center text-slate-500">Nothing left here.</p>}
        </div>
        {who}
      </div>
    );
  }

  // ─── one park ───
  if (view.name === "park") {
    const park = parksById.get(view.parkId);
    if (!park) return <div className="mx-auto max-w-[1100px] px-4 py-10">{back()}<p className="mt-10 text-slate-400">This park has nothing left.</p></div>;
    const open = quick.filter((t) => t.parkId === park.id).length;
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 md:px-8">
        {back()}
        <div className="mb-8 mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Image src={getParkFlag(park.country)} alt="" width={22} height={15} className="rounded-sm" unoptimized />
              <h1 className="truncate text-2xl font-bold text-white md:text-3xl">{park.name}</h1>
            </div>
            <div className="mt-3 flex items-center gap-3"><div className="w-48"><Bar value={pct(park.done, park.total)} /></div><span className="text-sm tabular-nums text-slate-400">{pct(park.done, park.total)}% · {open} left</span></div>
          </div>
          <div className="flex gap-2.5">
            <Link href={`/park/${park.slug}`} target="_blank" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-slate-500">Open page ↗</Link>
            <button type="button" disabled={!open} onClick={() => setView({ name: "run", parkId: park.id })} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-40 cursor-pointer">Start this park</button>
          </div>
        </div>
        <Table title="Framing" cols={["Left", ""]}>{catRows(FRAMING, park.id)}</Table>
        <Table title="Quick fixes" cols={["Left", ""]}>{catRows(QUICK, park.id)}</Table>
        <Table title="On the page" cols={["Left", ""]}>{catRows(ON_PAGE, park.id)}</Table>
        {who}
      </div>
    );
  }

  // ─── overview ───
  const left = quick.length;
  const parks = [...data.parks].sort((a, b) => a.done / (a.total || 1) - b.done / (b.total || 1) || a.name.localeCompare(b.name));
  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 md:px-8">
      <div className="mb-8 mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Clean-up</h1>
        {people}
      </div>

      <div className="mb-10 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <div>
          <div className="text-2xl font-bold tabular-nums text-white">{left}</div>
          <div className="text-xs text-slate-400">quick fixes left</div>
        </div>
        <button type="button" disabled={!left} onClick={() => setView({ name: "run", random: true })} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-40 cursor-pointer">Random fix ›</button>
      </div>

      <Table title="Framing">{catRows(FRAMING)}</Table>
      <Table title="Quick fixes">{catRows(QUICK)}</Table>
      <Table title="On the page" cols={["Left", ""]}>{catRows(ON_PAGE)}</Table>
      <Table title="Parks" cols={["Left", "Ready"]}>
        {parks.map((p) => (
          <Row key={p.id} label={<span className="inline-flex items-center gap-2"><Image src={getParkFlag(p.country)} alt="" width={18} height={12} className="rounded-sm" unoptimized />{p.name}</span>}
            left={p.total - p.done} done={p.done} total={p.total} onClick={() => setView({ name: "park", parkId: p.id })} />
        ))}
      </Table>
      {who}
    </div>
  );
}

/** A review section without a photo, a review to write or a coaster without photos: where it is, and a link there. */
function ListRow({ t, person, needPerson, onDone }: { t: CleanupTask; person: CleanupPerson | null; needPerson: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const where = t.coasterName ? `${t.coasterName} · ${t.parkName}` : t.parkName;
  const notNeeded = async () => {
    if (!person) { needPerson(); return; }
    setBusy(true); setErr(null);
    try { await api("ok", t.key, person); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-3">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 truncate text-[15px]">
          <span className="font-semibold text-white">{t.section ? t.section.heading : where}</span>
          {t.section && <span className="truncate text-slate-400">{where}</span>}
          {t.rating != null && <span className="font-bold tabular-nums" style={{ color: getRatingHex(t.rating) }}>{fmtScore(t.rating)}</span>}
        </div>
        {t.section?.excerpt && <p className="truncate text-xs text-slate-500">{t.section.excerpt}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {t.kind === "section-needs-photo" && <button type="button" onClick={notNeeded} disabled={busy} className="text-slate-500 hover:text-white disabled:opacity-40 cursor-pointer">Not needed</button>}
        <Link href={t.pageUrl} target="_blank" className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-200 hover:border-slate-500">Open ↗</Link>
      </div>
    </div>
  );
}

function WhoModal({ onPick, onClose }: { onPick: (p: CleanupPerson) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-bold text-white">Who&apos;s working?</p>
        <p className="mt-1 text-sm text-slate-400">The credit goes to whoever is picked. Remembered on this device.</p>
        <div className="mt-5 flex gap-3">
          {PEOPLE.map((p) => <button key={p} type="button" onClick={() => onPick(p)} className="flex-1 rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-light cursor-pointer">{p}</button>)}
        </div>
      </div>
    </div>
  );
}

