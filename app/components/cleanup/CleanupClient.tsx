"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getParkFlag, getRatingHex } from "@/app/utils/design";
import { coverPosition, hasCustomFocus } from "@/app/lib/coverPlacement";
import TaskRunner, { type SavedItem } from "./TaskRunner";
import {
  api, CATEGORIES, categoryStats, fmtDate, groupOf, openPoints, PEOPLE, PERSON_KEY, PILLARS, randomQueue, SECTIONS, sortQueue,
  photoSources, taskName, taskTitle,
  type Category, type CleanupData, type CleanupPerson, type CleanupTask, type DoneTask,
} from "./shared";

type Tab = "categories" | "parks" | "done";
type View =
  | { name: "overview" }
  | { name: "park"; parkId: number }
  | { name: "list"; cat: string; parkId?: number }
  | { name: "run"; cat?: string; parkId?: number; startKey?: string; random?: boolean; done?: boolean; from?: View };
type Look = "a" | "b" | "c";
const LOOK_KEY = "parkrating_cleanup_look";

const pct = (d: number, t: number) => (t ? Math.floor((100 * d) / t) : 100);
const fmtScore = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
const nf = new Intl.NumberFormat("en-GB");

function Bar({ value, className = "" }: { value: number; className?: string }) {
  return <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/10 ${className}`}><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

/**
 * A photo cover-cropped into its box, from the stored size that is sharp at
 * `sizes` on this screen. With a focus point it sits where the page frames it
 * (the front page card's framing), stopping at the box's edges.
 */
function Photo({ src, className = "", sizes = "120px", focus }: { src: string | null | undefined; className?: string; sizes?: string; focus?: string | null }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img || !focus || !hasCustomFocus(focus)) return;
    const place = () => { if (img.naturalWidth && img.clientWidth) img.style.objectPosition = coverPosition(img.clientWidth, img.clientHeight, img.naturalWidth, img.naturalHeight, focus); };
    place();
    img.addEventListener("load", place);
    const ro = new ResizeObserver(place); ro.observe(img);
    return () => { img.removeEventListener("load", place); ro.disconnect(); };
  }, [focus, src]);
  if (!src) return <div className={`bg-slate-800 ${className}`} />;
  const s = photoSources(src);
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={s.src} srcSet={s.srcSet} sizes={sizes} alt="" loading="lazy" decoding="async" className={`object-cover ${className}`} />;
}

export default function CleanupClient() {
  const [data, setData] = useState<CleanupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<CleanupPerson | null>(null);
  const [askPerson, setAskPerson] = useState(false);
  const [view, setView] = useState<View>({ name: "overview" });
  const [tab, setTab] = useState<Tab>("categories");
  const [look, setLook] = useState<Look>("a");

  const load = useCallback(async (quiet = false): Promise<CleanupData | null> => {
    try {
      const res = await fetch("/api/cleanup", { cache: "no-store" });
      if (res.status === 401) { setError("login"); return null; }
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const d: CleanupData = await res.json();
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Failed to load");
      return null;
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try {
      const p = localStorage.getItem(PERSON_KEY); if (p && (PEOPLE as string[]).includes(p)) setPerson(p as CleanupPerson);
      const l = new URLSearchParams(window.location.search).get("look") ?? localStorage.getItem(LOOK_KEY);
      if (l === "a" || l === "b" || l === "c") setLook(l);
    } catch {}
  }, []);
  const choose = (p: CleanupPerson) => { setPerson(p); setAskPerson(false); try { localStorage.setItem(PERSON_KEY, p); } catch {} };
  const pickLook = (l: Look) => { setLook(l); try { localStorage.setItem(LOOK_KEY, l); } catch {} };

  // After a save the page updates itself at once and syncs with the server a little later.
  const syncTimer = useRef<number | undefined>(undefined);
  const onDone = (finished: CleanupTask[], credits: number, items?: SavedItem[]) => {
    setData((d) => {
      if (!d) return d;
      const before = new Map([...d.tasks, ...d.done].map((t) => [t.key, openPoints(t)]));
      const patch = <T extends CleanupTask>(t: T): T => {
        const mine = items?.filter((i) => i.task === t.key);
        if (!t.place || !mine?.length) return t;
        return { ...t, place: { ...t.place, slots: t.place.slots.map((s) => { const i = mine.find((x) => x.slot === s.id); return i ? { ...s, done: true, ...(i.value ? { value: i.value, fresh: false } : {}) } : s; }) } };
      };
      const fin = new Set(finished.map((t) => t.key));
      let tasks = d.tasks.map(patch);
      const moving = tasks.filter((t) => fin.has(t.key));
      tasks = tasks.filter((t) => !fin.has(t.key));
      const now = new Date().toISOString();
      const done: DoneTask[] = [...moving.map((t) => ({ ...t, doneAt: now, doneBy: person ?? "" })), ...d.done.map(patch)];
      // Points newly done, per group and per park.
      const totals = { ...d.totals };
      const parkDelta = new Map<number, Record<string, number>>();
      for (const t of [...moving, ...tasks]) {
        const was = before.get(t.key) ?? 0, now2 = fin.has(t.key) ? 0 : openPoints(t);
        const gain = was - now2;
        if (gain <= 0) continue;
        const g = groupOf(t);
        totals[g] = { total: totals[g]?.total ?? gain, done: (totals[g]?.done ?? 0) + gain };
        if (t.parkId != null) { const m = parkDelta.get(t.parkId) ?? {}; m[g] = (m[g] ?? 0) + gain; parkDelta.set(t.parkId, m); }
      }
      const parks = d.parks.map((p) => {
        const m = parkDelta.get(p.id); if (!m) return p;
        const open = { ...p.open };
        let gain = 0;
        for (const [g, n] of Object.entries(m)) { open[g] = Math.max(0, (open[g] ?? 0) - n); gain += n; }
        return { ...p, done: p.done + gain, open };
      });
      const scores = person && credits ? { ...d.scores, [person]: { total: d.scores[person].total + credits, week: d.scores[person].week + credits } } : d.scores;
      return { ...d, tasks, done, totals, parks, scores };
    });
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => { void load(true); }, 4000);
  };

  const quick = useMemo(() => (data?.tasks ?? []).filter((t) => t.quick), [data]);
  // Random fixes: one shuffled queue per start.
  const [randomSeed, setRandomSeed] = useState(0);
  const randomList = useMemo(() => (randomSeed ? randomQueue(quick) : []), [randomSeed]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const openCat = (c: Category, parkId?: number) => setView(c.list ? { name: "list", cat: c.id, parkId } : { name: "run", cat: c.id, parkId });

  // ─── runner ───
  if (view.name === "run") {
    const cat = catById(view.cat);
    const doneTask = view.done ? data.done.find((t) => t.key === view.startKey) : undefined;
    const queue = view.done ? (doneTask ? [doneTask] : [])
      : view.random ? randomList.filter((t) => data.tasks.some((x) => x.key === t.key) || t.key === view.startKey)
      : sortQueue(quick.filter((t) => (!cat || cat.groups.includes(groupOf(t))) && (view.parkId == null || t.parkId === view.parkId)));
    const title = view.done ? "Done" : view.random ? "Random fixes" : cat ? cat.title : view.parkId != null ? parksById.get(view.parkId)?.name ?? "Park" : "All";
    return (
      <>
        <TaskRunner
          key={`${view.cat ?? "all"}-${view.parkId ?? ""}-${view.random ? `r${randomSeed}` : ""}-${view.done ? view.startKey : ""}`}
          queue={queue}
          startKey={view.startKey ?? queue[0]?.key}
          title={title}
          person={person}
          data={data}
          onDone={onDone}
          onReload={() => load(true)}
          onExit={() => setView(view.from ?? (view.parkId != null ? { name: "park", parkId: view.parkId } : { name: "overview" }))}
          needPerson={() => setAskPerson(true)}
        />
        {who}
      </>
    );
  }

  const people = (
    <div className="flex items-center gap-2">
      {PEOPLE.map((p) => (
        <button key={p} type="button" onClick={() => choose(p)} title={`${data.scores[p].week} this week`}
          className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors cursor-pointer ${person === p ? "border-brand bg-brand/10 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"} ${askPerson && !person ? "animate-pulse" : ""}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${person === p ? "bg-brand text-white" : "bg-slate-700 text-slate-200"}`}>{p[0]}</span>
          <span className="font-semibold">{p}</span>
          <span className="tabular-nums text-slate-400">{data.scores[p].total}</span>
        </button>
      ))}
    </div>
  );
  const back = (to: View = { name: "overview" }) => <button onClick={() => setView(to)} className="text-sm text-slate-400 hover:text-white cursor-pointer">‹ Clean-up</button>;

  // ─── lists: fixed on the page, not in the tool ───
  if (view.name === "list") {
    const cat = catById(view.cat)!;
    const rows = data.tasks.filter((t) => cat.groups.includes(groupOf(t)) && (view.parkId == null || t.parkId === view.parkId))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.parkName.localeCompare(b.parkName) || (a.coasterName ?? "").localeCompare(b.coasterName ?? ""));
    const section = SECTIONS.find((s) => s.rows.includes(cat))!;
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 md:px-8">
        {back(view.parkId != null ? { name: "park", parkId: view.parkId } : { name: "overview" })}
        <div className="mb-6 mt-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{cat.title}</h1>
            <p className="mt-1 text-sm text-slate-400">{cat.id === "review-photos" ? "Fewer than half of the written sections have a photo. Add some on the page, or check it off if it is fine." : cat.id === "park-review" ? "Visits not published yet, and published visits without review text." : section.blurb}</p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-white">{rows.length}</span>
        </div>
        <div className="divide-y divide-white/5 border-t border-white/10">
          {rows.map((t) => <ListRow key={t.key} t={t} person={person} needPerson={() => setAskPerson(true)} onDone={() => onDone([t], 1)} />)}
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
    const left = park.total - park.done;
    return (
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 md:px-8">
        {back()}
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-slate-900">
          <Photo src={park.card} focus={park.cardFocus} sizes="(min-width: 1100px) 1100px, 100vw" className="absolute inset-0 h-full w-full opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent" />
          <div className="relative flex min-h-[260px] flex-col justify-end gap-4 p-6 md:min-h-[300px] md:flex-row md:items-end md:justify-between md:p-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <Image src={getParkFlag(park.country)} alt="" width={24} height={16} className="rounded-sm" unoptimized />
                <h1 className="truncate text-3xl font-bold text-white md:text-4xl">{park.name}</h1>
              </div>
              <div className="mt-3 flex items-end gap-4">
                <span className="text-6xl font-bold leading-none tracking-tight text-white">{pct(park.done, park.total)}<span className="text-brand">%</span></span>
                <span className="pb-1 text-sm text-slate-300">{left ? `${left} point${left === 1 ? "" : "s"} to go` : "Finished"}</span>
              </div>
              <Bar value={pct(park.done, park.total)} className="mt-4 max-w-sm" />
            </div>
            <div className="flex gap-2.5">
              <Link href={`/park/${park.slug}`} target="_blank" className="rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-sm font-bold text-white backdrop-blur hover:border-white/40">Open page ↗</Link>
              <button type="button" disabled={!open} onClick={() => setView({ name: "run", parkId: park.id })} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-40 cursor-pointer">Start this park</button>
            </div>
          </div>
        </div>
        <div className="mt-10">
          <CategoryRows data={data} parkId={park.id} onOpen={(c) => openCat(c, park.id)} />
        </div>
        {who}
      </div>
    );
  }

  // ─── overview ───
  const totalDone = Object.values(data.totals).reduce((n, t) => n + (t?.done ?? 0), 0);
  const total = Object.values(data.totals).reduce((n, t) => n + (t?.total ?? 0), 0);
  const pillars = PILLARS.map((p) => {
    const cats = p.cats.map((id) => catById(id)!);
    const st = cats.map((c) => categoryStats(c, data.tasks, data.totals));
    const done = st.reduce((n, s) => n + s.done, 0), tot = st.reduce((n, s) => n + s.total, 0);
    const photos = sortQueue(st.flatMap((s) => s.tasks)).map((t) => t.image).filter((x): x is string => !!x);
    return { ...p, done, total: tot, left: tot - done, photos: [...new Set(photos)].slice(0, 4) };
  });
  const startRandom = () => { setRandomSeed((n) => n + 1); setView({ name: "run", random: true }); };
  const openDone = (t: DoneTask) => setView({ name: "run", done: true, startKey: t.key, from: { name: "overview" } });
  const reopen = async (t: DoneTask) => {
    if (!person) { setAskPerson(true); return; }
    await api("reopen", t.key, person);
    await load(true);
  };
  const tabs = (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
      {([["categories", "Categories"], ["parks", "Parks"], ["done", `Done${data.done.length ? ` · ${data.done.length}` : ""}`]] as [Tab, string][]).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${tab === id ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>{label}</button>
      ))}
    </div>
  );
  const random = <button type="button" disabled={!quick.length} onClick={startRandom} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-light disabled:opacity-40 cursor-pointer">Random fix ›</button>;
  const body = tab === "done"
    ? <DoneList done={data.done} onOpen={openDone} onReopen={reopen} />
    : tab === "parks"
      ? (look === "b" ? <ParkRows data={data} onOpen={(id) => setView({ name: "park", parkId: id })} /> : <ParkCards data={data} onOpen={(id) => setView({ name: "park", parkId: id })} />)
      : (look === "c" ? <CategoryCards data={data} onOpen={(c) => openCat(c)} /> : <CategoryRows data={data} onOpen={(c) => openCat(c)} thumbs={look === "a"} />);
  const lookSwitch = (
    <div className="flex items-center gap-1 text-xs text-slate-500">
      <span className="mr-1">Look</span>
      {(["a", "b", "c"] as Look[]).map((l) => (
        <button key={l} type="button" onClick={() => pickLook(l)} className={`h-7 w-7 rounded-lg font-bold uppercase cursor-pointer ${look === l ? "bg-white text-slate-900" : "border border-slate-700 text-slate-300 hover:border-slate-500"}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-4 md:px-8">
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Clean-up</h1>
        <div className="flex flex-wrap items-center gap-4">{lookSwitch}{people}</div>
      </div>

      {look === "a" && <HeroPoster data={data} done={totalDone} total={total} pillars={pillars} onPillar={() => setTab("categories")} />}
      {look === "b" && <HeroScoreboard done={totalDone} total={total} pillars={pillars} />}
      {look === "c" && <HeroCompact done={totalDone} total={total} pillars={pillars} />}

      <div className="mb-8 mt-10 flex flex-wrap items-center justify-between gap-4">{tabs}{random}</div>
      {body}
      {who}
    </div>
  );
}

// ─── overview heads ──────────────────────────────────────────────────────────

type Pillar = { id: string; title: string; done: number; total: number; left: number; photos: string[] };

/** A: the parks' own photos as a wide poster, the figure big over it, the three parts below with what is next. */
function HeroPoster({ data, done, total, pillars, onPillar }: { data: CleanupData; done: number; total: number; pillars: Pillar[]; onPillar: () => void }) {
  const photos = [...data.parks].filter((p) => p.card).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, 6);
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-slate-900">
        <div className="grid grid-cols-3 md:grid-cols-6">
          {photos.map((p, i) => <Photo key={p.id} src={p.card} focus={p.cardFocus} sizes="(min-width: 768px) 200px, 34vw" className={`aspect-[3/4] w-full ${i >= 3 ? "hidden md:block" : ""}`} />)}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-[#0f172a]/20" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <p className="text-base text-slate-200 md:text-lg">How complete is ParkRating</p>
          <p className="mt-1 text-[88px] font-bold leading-[0.9] tracking-tight text-white md:text-[136px]">{pct(done, total)}<span className="text-brand">%</span></p>
          <p className="mt-3 text-sm text-slate-300 md:text-base">{nf.format(done)} of {nf.format(total)} points · {nf.format(total - done)} to go</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {pillars.map((p) => (
          <button key={p.id} type="button" onClick={onPillar} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:border-white/20 cursor-pointer">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-lg font-bold text-white">{p.title}</span>
              <span className="text-3xl font-bold tabular-nums text-white">{pct(p.done, p.total)}<span className="text-lg text-brand">%</span></span>
            </div>
            <Bar value={pct(p.done, p.total)} className="mt-3" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">{p.left ? `${nf.format(p.left)} to go` : "All done"}</span>
              <span className="flex -space-x-2">
                {p.photos.map((src) => <Photo key={src} src={src} sizes="32px" className="h-10 w-8 rounded-md ring-2 ring-[#0f172a]" />)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/** B: the figure as a plain big number, one bar split into the three parts. */
function HeroScoreboard({ done, total, pillars }: { done: number; total: number; pillars: Pillar[] }) {
  return (
    <div className="border-y border-white/10 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-base text-slate-400">How complete is ParkRating</p>
          <p className="mt-1 text-[96px] font-bold leading-[0.85] tracking-tight text-white md:text-[120px]">{pct(done, total)}<span className="text-brand">%</span></p>
        </div>
        <p className="text-sm text-slate-400 md:pb-2">{nf.format(done)} of {nf.format(total)} points · <span className="text-white">{nf.format(total - done)} to go</span></p>
      </div>
      <div className="mt-8 flex gap-1.5">
        {pillars.map((p) => (
          <div key={p.id} className="min-w-0" style={{ flex: `${Math.max(p.total, total * 0.22, 1)} 1 0` }}>
            <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand" style={{ width: `${pct(p.done, p.total)}%` }} /></div>
            <div className="mt-2.5 truncate text-sm"><span className="font-bold text-white">{p.title}</span> <span className="tabular-nums text-slate-400">{pct(p.done, p.total)}% · {p.left} to go</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** C: the figure and the three parts in one compact band (the cards below carry the photos). */
function HeroCompact({ done, total, pillars }: { done: number; total: number; pillars: Pillar[] }) {
  return (
    <div className="grid gap-8 rounded-3xl bg-white/[0.03] p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-14 md:p-8">
      <div>
        <p className="text-sm text-slate-400">How complete is ParkRating</p>
        <p className="mt-1 text-[80px] font-bold leading-[0.9] tracking-tight text-white md:text-[104px]">{pct(done, total)}<span className="text-brand">%</span></p>
        <p className="mt-2 text-sm text-slate-400">{nf.format(total - done)} points to go</p>
      </div>
      <div className="space-y-5">
        {pillars.map((p) => (
          <div key={p.id}>
            <div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="font-bold text-white">{p.title}</span><span className="tabular-nums text-slate-400">{pct(p.done, p.total)}% · {p.left} to go</span></div>
            <Bar value={pct(p.done, p.total)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── categories ──────────────────────────────────────────────────────────────

/** Each group with its line, then a row per category: the next photo, what is left, how far along. */
/** The photo of the next task in each category, a different one per category where there is one. */
function nextPhotos(rows: { c: Category; s: ReturnType<typeof categoryStats> }[]): Map<string, string | undefined> {
  const used = new Set<string>(), out = new Map<string, string | undefined>();
  for (const { c, s } of rows) {
    const imgs = sortQueue(s.tasks).map((t) => t.image).filter((x): x is string => !!x);
    const pick = imgs.find((i) => !used.has(i)) ?? imgs[0];
    if (pick) used.add(pick);
    out.set(c.id, pick);
  }
  return out;
}

function CategoryRows({ data, parkId, onOpen, thumbs = true }: { data: CleanupData; parkId?: number; onOpen: (c: Category) => void; thumbs?: boolean }) {
  const tasks = parkId == null ? data.tasks : data.tasks.filter((t) => t.parkId === parkId);
  return (
    <div className="space-y-12">
      {SECTIONS.map((sec) => {
        const rows = sec.rows.map((c) => ({ c, s: categoryStats(c, tasks, data.totals) })).filter((r) => parkId == null || r.s.open > 0);
        if (!rows.length) return null;
        const photos = nextPhotos(rows);
        return (
          <section key={sec.id}>
            <h2 className="text-xl font-bold text-white">{sec.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{sec.blurb}</p>
            <div className="mt-4 divide-y divide-white/5 border-y border-white/10">
              {rows.map(({ c, s }) => {
                const next = photos.get(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => onOpen(c)} disabled={!s.open}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-default disabled:hover:bg-transparent cursor-pointer md:grid-cols-[minmax(0,1fr)_220px_72px_16px]">
                    <span className="flex min-w-0 items-center gap-4">
                      {thumbs && (s.open ? <Photo src={next} sizes="44px" className="h-14 w-11 flex-none rounded-lg" /> : <span className="flex h-14 w-11 flex-none items-center justify-center rounded-lg bg-green-500/10 text-green-300">✓</span>)}
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-white">{c.title}</span>
                        <span className="block truncate text-xs text-slate-500">{s.open ? `${s.open} to go` : "All done"}{parkId == null && s.total ? ` · ${pct(s.done, s.total)}% done` : ""}</span>
                      </span>
                    </span>
                    <span className="hidden items-center gap-3 md:flex">{parkId == null && s.total > 0 && <><Bar value={pct(s.done, s.total)} /><span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">{s.done}/{s.total}</span></>}</span>
                    <span className={`text-right text-xl font-bold tabular-nums ${s.open ? "text-white" : "text-slate-600"}`}>{s.open || "–"}</span>
                    <span className="text-right text-slate-500">{s.open ? "›" : ""}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** C: categories as front page cards: the next photo, the name on it, what is left where a card has its score. */
function CategoryCards({ data, onOpen }: { data: CleanupData; onOpen: (c: Category) => void }) {
  return (
    <div className="space-y-12">
      {SECTIONS.map((sec) => {
        const rows = sec.rows.map((c) => ({ c, s: categoryStats(c, data.tasks, data.totals) }));
        const photos = nextPhotos(rows);
        return (
        <section key={sec.id}>
          <h2 className="text-xl font-bold text-white">{sec.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{sec.blurb}</p>
          <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-5">
            {rows.map(({ c, s }) => {
              const next = photos.get(c.id);
              return (
                <button key={c.id} type="button" onClick={() => onOpen(c)} disabled={!s.open}
                  className="group relative aspect-[4/5] w-[200px] flex-none overflow-hidden rounded-2xl bg-slate-900 text-left shadow-md transition-transform duration-300 [@media(hover:hover)]:hover:scale-[1.03] disabled:cursor-default md:w-auto cursor-pointer">
                  {s.open ? <Photo src={next} sizes="(min-width: 1024px) 220px, (min-width: 768px) 33vw, 200px" className="absolute inset-0 h-full w-full opacity-90" /> : null}
                  <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-4"><span className="text-lg font-bold leading-tight text-white drop-shadow-md">{c.title}</span></div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12">
                    {s.open
                      ? <><span className="block text-5xl font-bold leading-none text-white drop-shadow-md">{s.open}</span><span className="mt-1 block text-xs text-slate-300">to go{s.total ? ` · ${pct(s.done, s.total)}% done` : ""}</span></>
                      : <span className="text-2xl font-bold text-green-300">✓ All done</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        );
      })}
    </div>
  );
}

// ─── parks ───────────────────────────────────────────────────────────────────

const parkOrder = (data: CleanupData) => [...data.parks].sort((a, b) => (a.total - a.done) - (b.total - b.done) || pct(b.done, b.total) - pct(a.done, a.total) || a.name.localeCompare(b.name));

/** A and C: every park as a front page card, closest to finished first. */
function ParkCards({ data, onOpen }: { data: CleanupData; onOpen: (id: number) => void }) {
  return (
    <>
      <p className="-mt-3 mb-5 text-sm text-slate-400">Points each park is missing, closest to finished first.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {parkOrder(data).map((p) => {
          const left = p.total - p.done;
          return (
            <button key={p.id} type="button" onClick={() => onOpen(p.id)}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-900 text-left shadow-md transition-transform duration-300 [@media(hover:hover)]:hover:scale-[1.03] cursor-pointer">
              <Photo src={p.card} focus={p.cardFocus} sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw" className="absolute inset-0 h-full w-full opacity-90" />
              <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3.5 pb-10 pt-3.5">
                <span className="flex items-center gap-2"><Image src={getParkFlag(p.country)} alt="" width={18} height={12} className="shrink-0 rounded-sm" unoptimized /><span className="truncate text-[15px] font-bold leading-tight text-white drop-shadow-md">{p.name}</span></span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3.5 pb-3.5 pt-14">
                <span className="block text-4xl font-bold leading-none text-white drop-shadow-md md:text-5xl">{pct(p.done, p.total)}<span className="text-xl text-brand md:text-2xl">%</span></span>
                <span className="mt-1.5 block text-xs text-slate-300">{left ? `${left} point${left === 1 ? "" : "s"} to go` : "✓ Finished"}</span>
                <Bar value={pct(p.done, p.total)} className="mt-2.5 !h-1" />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** B: every park as a line: flag, name, bar, points to go. */
function ParkRows({ data, onOpen }: { data: CleanupData; onOpen: (id: number) => void }) {
  return (
    <div className="divide-y divide-white/5 border-y border-white/10">
      {parkOrder(data).map((p) => {
        const left = p.total - p.done;
        return (
          <button key={p.id} type="button" onClick={() => onOpen(p.id)}
            className="grid w-full grid-cols-[minmax(0,1fr)_64px_16px] items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-white/[0.03] cursor-pointer md:grid-cols-[minmax(0,1fr)_260px_64px_16px]">
            <span className="flex min-w-0 items-center gap-3">
              <Photo src={p.card} focus={p.cardFocus} sizes="44px" className="h-11 w-11 flex-none rounded-lg" />
              <Image src={getParkFlag(p.country)} alt="" width={18} height={12} className="shrink-0 rounded-sm" unoptimized />
              <span className="truncate text-[15px] font-semibold text-white">{p.name}</span>
            </span>
            <span className="hidden items-center gap-3 md:flex"><Bar value={pct(p.done, p.total)} /><span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">{pct(p.done, p.total)}%</span></span>
            <span className={`text-right text-xl font-bold tabular-nums ${left ? "text-white" : "text-green-300"}`}>{left || "✓"}</span>
            <span className="text-right text-slate-500">›</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── done ────────────────────────────────────────────────────────────────────

/** Finished in the tool, newest first, by day: open one to look again, or put it back on the list. */
function DoneList({ done, onOpen, onReopen }: { done: DoneTask[]; onOpen: (t: DoneTask) => void; onReopen: (t: DoneTask) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!done.length) return <p className="py-16 text-center text-slate-500">Nothing finished in the tool yet. What you fix shows up here.</p>;
  const day = (iso: string) => {
    const d = new Date(iso), today = new Date();
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  };
  const groups: { label: string; items: DoneTask[] }[] = [];
  for (const t of done) { const l = day(t.doneAt); const g = groups.at(-1); if (g?.label === l) g.items.push(t); else groups.push({ label: l, items: [t] }); }
  const canOpen = (t: DoneTask) => !!t.place || t.kind === "caption";
  const canReopen = (t: DoneTask) => !!t.place || ["caption", "review-photos", "park-review"].includes(t.kind);
  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 text-sm font-bold text-slate-300">{g.label}</h2>
          <div className="divide-y divide-white/5 border-y border-white/10">
            {g.items.map((t) => (
              <div key={t.key} className="flex items-center gap-4 px-2 py-3">
                <Photo src={t.image} sizes="44px" className="h-14 w-11 flex-none rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-white">{taskName(t)}</div>
                  <div className="truncate text-xs text-slate-500">{taskTitle(t)}{t.place?.subtitle ? ` · ${t.place.subtitle}` : ""}{t.kind === "caption" && t.caption?.current ? ` · “${t.caption.current}”` : ""}</div>
                </div>
                <span className="hidden text-xs text-slate-500 sm:block">{t.doneBy} · {new Date(t.doneAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <div className="flex items-center gap-3 text-sm">
                  {canReopen(t) && (
                    <button type="button" disabled={busy === t.key} onClick={async () => { setBusy(t.key); try { await onReopen(t); } finally { setBusy(null); } }}
                      className="text-slate-500 hover:text-white disabled:opacity-40 cursor-pointer" title="Put it back on the list">Reopen</button>
                  )}
                  {canOpen(t)
                    ? <button type="button" onClick={() => onOpen(t)} className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-200 hover:border-slate-500 cursor-pointer">Open</button>
                    : <Link href={t.pageUrl} target="_blank" className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-200 hover:border-slate-500">Page ↗</Link>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── lists ───────────────────────────────────────────────────────────────────

/** A review to write, a review short on photos or a coaster without photos: where it is, and a link there. */
function ListRow({ t, person, needPerson, onDone }: { t: CleanupTask; person: CleanupPerson | null; needPerson: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const check = async () => {
    if (!person) { needPerson(); return; }
    setBusy(true); setErr(null);
    try { await api("ok", t.key, person); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  };
  const detail = t.kind === "review-photos" && t.sections ? `${t.sections.withPhoto} of ${t.sections.total} sections have a photo`
    : t.kind === "park-review" ? `${t.draft ? "Not published" : "Published without text"}${t.visitDate ? ` · visit of ${fmtDate(t.visitDate)}` : ""}`
    : t.coasterName ? t.parkName : "";
  return (
    <div className="flex items-center gap-4 px-2 py-3">
      {t.image ? <Photo src={t.image} sizes="48px" className="h-12 w-12 flex-none rounded-lg" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 truncate text-[15px]">
          <span className="font-semibold text-white">{t.coasterName ?? t.parkName}</span>
          {t.rating != null && <span className="font-bold tabular-nums" style={{ color: getRatingHex(t.rating) }}>{fmtScore(t.rating)}</span>}
        </div>
        {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {t.kind === "review-photos" && <button type="button" onClick={check} disabled={busy} className="text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer">Good as it is</button>}
        {t.kind === "park-review" && <button type="button" onClick={check} disabled={busy} className="text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer">Not needed</button>}
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
