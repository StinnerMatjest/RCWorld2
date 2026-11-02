"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Park, ChecklistItem } from "@/app/types";
import LoadingSpinner from "@/app/components/LoadingSpinner";

/**
 * Making a checklist: pick the park (one of ours, or any park on RCDB), its
 * coasters come in on their own (ours from the site, a new park's from RCDB),
 * and the park in the live waits is picked once (the best guess is already
 * chosen), so the Queues tab never has to guess by name.
 */

type RcdbPark = { id: string; name: string; where: string; country: string };
type LivePark = { key: string; name: string; where: string };
type Chosen =
  | { kind: "ours"; park: Park }
  | { kind: "rcdb"; park: RcdbPark }
  | { kind: "manual"; name: string };
type Draft = { key: string; name: string; year?: number | null; scale?: string | null; on: boolean };

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slugify = (s: string) => norm(s).replace(/ /g, "-");

const CHECK = (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function Tick({ on }: { on: boolean }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand bg-brand text-slate-900" : "border-slate-600 text-transparent"}`}>{CHECK}</span>
  );
}

/** Everything but the coasters, in the order the checklist shows them. */
function checklistItems(coasters: { id: number | string; name: string }[]): ChecklistItem[] {
  return [
    { id: "pic-entrance", label: "Park Entrance", checked: false, isPhotoTask: true },
    ...coasters.map((c) => ({ id: `pic-coaster-${c.id}`, label: `Take picture of ${c.name}`, checked: false, isPhotoTask: true, isCoaster: true, rideCount: 0 })),
    { id: "pic-waterrides", label: "All waterrides", checked: false, isPhotoTask: true },
    { id: "pic-flatrides", label: "All flatrides", checked: false, isPhotoTask: true },
    { id: "pic-darkrides", label: "All darkrides", checked: false, isPhotoTask: true },
    { id: "pic-food", label: "Food", checked: false, isPhotoTask: true },
    { id: "pic-drinks", label: "Snacks/Drinks", checked: false, isPhotoTask: true },
    { id: "pic-operations", label: "Ride Operations", checked: false, isPhotoTask: true },
    { id: "pic-park-1", label: "Park appearance 1", checked: false, isPhotoTask: true },
    { id: "pic-park-2", label: "Park appearance 2", checked: false, isPhotoTask: true },
    { id: "pic-park-3", label: "Park appearance 3", checked: false, isPhotoTask: true },
    { id: "buy-mug", label: "Buy a mug!", checked: false, isPhotoTask: false },
    { id: "remember-things", label: "Remember your things!", checked: false, isPhotoTask: false },
  ];
}

export default function CreateChecklistModal({ parks }: { parks: Park[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: the park.
  const [query, setQuery] = useState("");
  const [rcdb, setRcdb] = useState<RcdbPark[] | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);

  // Step 2: coasters and the park in the live waits.
  const [coasters, setCoasters] = useState<Draft[] | null>(null);
  const [newCoaster, setNewCoaster] = useState("");
  const [live, setLive] = useState<LivePark[] | null>(null);
  const [livePick, setLivePick] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveQuery, setLiveQuery] = useState("");

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const chosenName = chosen ? (chosen.kind === "ours" ? chosen.park.name : chosen.kind === "rcdb" ? chosen.park.name : chosen.name) : "";

  // Our parks, as you type.
  const ours = useMemo(() => {
    const q = norm(query);
    if (q.length < 2) return [];
    return parks.filter((p) => norm(p.name).includes(q)).slice(0, 8);
  }, [query, parks]);

  // RCDB parks, a moment after typing stops; the ones already on the site are left out.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setRcdb(null); return; }
    let gone = false;
    const t = setTimeout(() => {
      fetch(`/api/rcdb?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { parks: [] }))
        .then((d) => { if (!gone) setRcdb(d.parks ?? []); })
        .catch(() => { if (!gone) setRcdb([]); });
    }, 350);
    return () => { gone = true; clearTimeout(t); };
  }, [query]);
  const ourNames = useMemo(() => new Set(parks.map((p) => norm(p.name))), [parks]);
  const rcdbNew = (rcdb ?? []).filter((p) => !ourNames.has(norm(p.name))).slice(0, 12);

  // Once a park is chosen: its coasters, and the live parks with the best guess picked.
  useEffect(() => {
    if (!chosen) return;
    let gone = false;
    setCoasters(null); setLive(null); setLivePick(null); setLiveOpen(false); setLiveQuery("");
    const coastersFrom: Promise<Draft[]> =
      chosen.kind === "ours"
        ? fetch(`/api/park/${chosen.park.id}/coasters`).then((r) => r.json()).then((list) => {
            const arr = Array.isArray(list) ? list : [];
            const unique = Array.from(new Map(arr.map((c: { id: number; name: string }) => [c.id, c])).values()) as { id: number; name: string; year?: number }[];
            return unique.map((c) => ({ key: String(c.id), name: c.name, year: c.year ?? null, on: true }));
          })
        : chosen.kind === "rcdb"
          ? fetch(`/api/rcdb?park=${chosen.park.id}`).then((r) => r.json()).then((d) =>
              (d.coasters ?? []).map((c: { id: string; name: string; year: number | null; scale: string | null }) => ({ key: `rcdb-${c.id}`, name: c.name, year: c.year, scale: c.scale, on: true })))
          : Promise.resolve([]);
    coastersFrom.then((c) => { if (!gone) setCoasters(c); }).catch(() => { if (!gone) setCoasters([]); });
    fetch(`/api/live-parks?name=${encodeURIComponent(chosenName)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { parks: [], guess: null }))
      .then((d) => { if (!gone) { setLive(d.parks ?? []); setLivePick(d.guess ?? ""); } })
      .catch(() => { if (!gone) { setLive([]); setLivePick(""); } });
    return () => { gone = true; };
    // chosenName follows chosen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  const pickedLive = live?.find((p) => p.key === livePick) ?? null;
  const liveList = useMemo(() => {
    const q = norm(liveQuery);
    const all = live ?? [];
    return (q ? all.filter((p) => norm(`${p.name} ${p.where}`).includes(q)) : all).slice(0, 60);
  }, [live, liveQuery]);

  function close() {
    setIsOpen(false);
    setTimeout(() => { setQuery(""); setRcdb(null); setChosen(null); setCoasters(null); setLive(null); setLivePick(null); setError(null); setNewCoaster(""); }, 300);
  }

  function addCoaster() {
    const name = newCoaster.trim();
    if (!name) return;
    setCoasters((c) => [...(c ?? []), { key: `new-${Date.now()}`, name, on: true }]);
    setNewCoaster("");
  }

  async function create() {
    if (!chosen || !coasters) return;
    setBusy(true);
    setError(null);
    try {
      const picked = coasters.filter((c) => c.on);
      let parkId: number | string;
      let parkSlug: string;
      let made: { id: number | string; name: string }[];

      if (chosen.kind === "ours") {
        parkId = chosen.park.id;
        parkSlug = chosen.park.slug;
        // Coasters added by hand to one of our parks are made on the site too.
        made = await Promise.all(picked.map(async (c) => (c.key.startsWith("new-") ? makeCoaster(parkId, c) : { id: c.key, name: c.name })))
          .then((r) => r.filter((x): x is { id: number | string; name: string } => !!x));
      } else {
        // A new park: a draft on the site, with its place from RCDB.
        const name = chosenName;
        const where = chosen.kind === "rcdb" ? chosen.park.where.split(", ") : [];
        const parkRes = await fetch("/api/parks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            continent: "Unknown",
            country: chosen.kind === "rcdb" ? chosen.park.country || "Unknown" : "Unknown",
            city: where[0] || "Unknown",
            imagepath: "/images/error.PNG",
            slug: slugify(name),
          }),
        });
        const parkData = await parkRes.json();
        if (!parkRes.ok) throw new Error(parkData.error || "The park could not be made");
        parkId = parkData.parkId;
        parkSlug = slugify(name);
        const results = await Promise.all(picked.map((c) => makeCoaster(parkId, c)));
        made = results.filter((x): x is { id: number | string; name: string } => !!x);
        const failed = picked.length - made.length;
        if (failed > 0) setError(`${failed} coaster${failed === 1 ? "" : "s"} could not be made; the checklist has the rest.`);
      }

      const year = new Date().getFullYear();
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${chosenName} ${year} Visit`,
          slug: `${parkSlug}-visit-${Date.now()}`,
          description: `The ultimate photo and ride checklist for ${chosenName}.`,
          items: checklistItems(made),
          parkId,
          livePark: livePick ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The checklist could not be made");
      close();
      router.push(`/checklists/${data.slug}`);
      router.refresh();
    } catch (err) {
      console.error("Making the checklist failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mb-8 h-12 w-full rounded-2xl bg-brand text-base font-bold text-slate-900 hover:bg-brand-light active:scale-[0.99] cursor-pointer"
      >
        New checklist
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0f172a] text-slate-50">
          {busy ? (
            <LoadingSpinner className="!bg-transparent dark:!bg-transparent" />
          ) : (
            <div className="mx-auto max-w-xl px-4 pt-5 pb-10">
              <div className="flex items-center justify-between">
                {chosen ? (
                  <button type="button" onClick={() => setChosen(null)} className="py-2 pr-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 cursor-pointer">‹ Parks</button>
                ) : <span />}
                <button type="button" onClick={close} className="py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 cursor-pointer">Cancel</button>
              </div>

              {!chosen && (
                <>
                  <h2 className="mt-3 text-[30px] font-bold leading-tight">Which park?</h2>
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search parks"
                    aria-label="Search parks"
                    className="mt-4 w-full rounded-xl border-[1.5px] border-[#2b3a57] bg-[#16223a] px-4 py-3 text-base text-slate-50 placeholder-slate-500 focus:border-brand focus:outline-none"
                  />
                  <div className="mt-3">
                    {ours.map((p) => (
                      <button key={`o${p.id}`} type="button" onClick={() => setChosen({ kind: "ours", park: p })}
                        className="flex w-full items-center gap-3 border-t border-slate-400/15 py-3 text-left cursor-pointer">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-tight">{p.name}</span>
                          <span className="block text-[12.5px] text-slate-400">{p.country}</span>
                        </span>
                      </button>
                    ))}
                    {rcdbNew.map((p) => (
                      <button key={`r${p.id}`} type="button" onClick={() => setChosen({ kind: "rcdb", park: p })}
                        className="flex w-full items-center gap-3 border-t border-slate-400/15 py-3 text-left cursor-pointer">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-tight">{p.name}</span>
                          <span className="block text-[12.5px] text-slate-400">{p.where}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">New</span>
                      </button>
                    ))}
                    {query.trim().length >= 2 && rcdb !== null && (
                      <button type="button" onClick={() => setChosen({ kind: "manual", name: query.trim() })}
                        className="flex w-full items-center border-t border-b border-slate-400/15 py-3 text-left text-[15px] text-slate-400 cursor-pointer">
                        Add “{query.trim()}” by hand
                      </button>
                    )}
                    {query.trim().length >= 2 && rcdb === null && <p className="py-3 text-sm text-slate-500">Searching RCDB…</p>}
                  </div>
                </>
              )}

              {chosen && (
                <>
                  <h2 className="mt-3 text-[30px] font-bold leading-tight [text-wrap:balance]">{chosenName}</h2>
                  {chosen.kind !== "manual" && (
                    <p className="mt-1.5 text-[13px] text-slate-400">{chosen.kind === "ours" ? chosen.park.country : chosen.park.where}</p>
                  )}

                  <h3 className="pt-6 pb-1 text-[22px] font-bold">Coasters</h3>
                  {coasters === null ? (
                    <p className="py-3 text-sm text-slate-500">Getting the coasters…</p>
                  ) : (
                    <>
                      {coasters.map((c) => (
                        <button key={c.key} type="button" aria-pressed={c.on}
                          onClick={() => setCoasters((list) => (list ?? []).map((x) => (x.key === c.key ? { ...x, on: !x.on } : x)))}
                          className="flex w-full items-center gap-3 border-t border-slate-400/15 py-3 text-left cursor-pointer">
                          <span className={`min-w-0 flex-1 text-[15px] font-semibold leading-tight ${c.on ? "text-slate-50" : "text-slate-500"}`}>{c.name}</span>
                          {c.year ? <span className="shrink-0 text-[13px] tabular-nums text-slate-500">{c.year}</span> : null}
                          <Tick on={c.on} />
                        </button>
                      ))}
                      <div className="flex items-center gap-3 border-t border-b border-slate-400/15 py-1.5">
                        <input
                          type="text"
                          value={newCoaster}
                          onChange={(e) => setNewCoaster(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") addCoaster(); }}
                          placeholder="Another coaster"
                          aria-label="Add a coaster"
                          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-slate-50 placeholder-slate-500 focus:outline-none"
                        />
                        <button type="button" onClick={addCoaster} disabled={!newCoaster.trim()}
                          className="shrink-0 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand disabled:text-slate-600 cursor-pointer">Add</button>
                      </div>
                    </>
                  )}

                  <h3 className="pt-6 pb-1 text-[22px] font-bold">Queue times</h3>
                  {live === null ? (
                    <p className="py-3 text-sm text-slate-500">Finding the park…</p>
                  ) : (
                    <>
                      <button type="button" onClick={() => setLiveOpen((o) => !o)} aria-expanded={liveOpen}
                        className="flex w-full items-center gap-3 border-t border-b border-slate-400/15 py-3 text-left cursor-pointer">
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold leading-tight ${pickedLive ? "text-slate-50" : "text-slate-400"}`}>{pickedLive ? pickedLive.name : "None for this park"}</span>
                          {pickedLive?.where && <span className="block text-[12.5px] text-slate-400">{pickedLive.where}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-brand">{liveOpen ? "Done" : "Change"}</span>
                      </button>
                      {liveOpen && (
                        <div className="pt-2">
                          <input
                            type="search"
                            value={liveQuery}
                            onChange={(e) => setLiveQuery(e.target.value)}
                            placeholder="Search the queue-time parks"
                            aria-label="Search the queue-time parks"
                            className="w-full rounded-xl border-[1.5px] border-[#2b3a57] bg-[#16223a] px-4 py-2.5 text-[15px] text-slate-50 placeholder-slate-500 focus:border-brand focus:outline-none"
                          />
                          <div className="mt-2">
                            <button type="button" onClick={() => { setLivePick(""); setLiveOpen(false); }}
                              className="flex w-full items-center gap-3 border-t border-slate-400/15 py-3 text-left cursor-pointer">
                              <span className="min-w-0 flex-1 text-[15px] text-slate-400">No queue times</span>
                              <Tick on={livePick === ""} />
                            </button>
                            {liveList.map((p) => (
                              <button key={p.key} type="button" onClick={() => { setLivePick(p.key); setLiveOpen(false); }}
                                className="flex w-full items-center gap-3 border-t border-slate-400/15 py-3 text-left cursor-pointer">
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[15px] font-semibold leading-tight">{p.name}</span>
                                  <span className="block text-[12.5px] text-slate-400">{p.where}</span>
                                </span>
                                <Tick on={livePick === p.key} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {error && <p className="mt-5 text-sm text-amber-300">{error}</p>}
                  <button type="button" onClick={create} disabled={coasters === null || live === null}
                    className="mt-7 h-[52px] w-full rounded-[14px] bg-brand text-[16.5px] font-bold text-slate-900 hover:bg-brand-light disabled:opacity-50 cursor-pointer">
                    Make the checklist
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** One coaster on the site for a park; null when it could not be made. */
async function makeCoaster(parkId: number | string, c: Draft): Promise<{ id: number | string; name: string } | null> {
  try {
    const res = await fetch(`/api/park/${parkId}/coasters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: c.name,
        slug: `${slugify(c.name)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        year: c.year ?? new Date().getFullYear(),
        model: "Unknown",
        scale: c.scale || "Unknown",
        haveridden: false,
        isbestcoaster: false,
        rating: 0,
        rideCount: 0,
      }),
    });
    const data = await res.json();
    if (!res.ok || data?.id === undefined || data?.id === null || !data?.name) {
      console.error(`Coaster "${c.name}" could not be made:`, data?.error ?? data);
      return null;
    }
    return { id: data.id, name: data.name };
  } catch (err) {
    console.error(`Coaster "${c.name}" could not be made:`, err);
    return null;
  }
}
