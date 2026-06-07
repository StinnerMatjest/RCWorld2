"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRatingColor } from "../utils/design";

type SPark    = { id: number; name: string; country: string; slug: string; overall?: number };
type SCoaster = { id: number; name: string; parkName: string; slug: string; rating?: number };

const SearchBar = () => {
  const [open, setOpen]           = useState(false);
  const [val, setVal]             = useState("");
  const [parks, setParks]         = useState<SPark[]>([]);
  const [coasters, setCoasters]   = useState<SCoaster[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const router     = useRouter();
  const inputRef   = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (loaded) return;
    const [pr, cr] = await Promise.all([
      fetch("/api/parks/ranked"),
      fetch("/api/coasters"),
    ]);
    if (pr.ok) {
      const d = await pr.json();
      setParks((d.parks ?? []).map((p: any) => ({
        id: p.id, name: p.name, country: p.country, slug: p.slug, overall: p.overall,
      })));
    }
    if (cr.ok) {
      const d = await cr.json();
      setCoasters((d.coasters ?? [])
        .filter((c: any) => c.rating && c.slug)
        .map((c: any) => ({
          id: c.id, name: c.name, parkName: c.parkName, slug: c.slug,
          rating: typeof c.rating === "string" ? parseFloat(c.rating) : c.rating,
        })));
    }
    setLoaded(true);
  }, [loaded]);

  const q = val.trim().toLowerCase();

  const matchedParks = q.length < 1 ? [] : parks
    .filter(p => p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q))
    .slice(0, 5);

  const matchedCoasters = q.length < 1 ? [] : coasters
    .filter(c => c.name.toLowerCase().includes(q) || c.parkName.toLowerCase().includes(q))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const total      = matchedParks.length + matchedCoasters.length;
  const hasResults = total > 0;
  const showDrop   = open && q.length > 0;

  function navigate(type: "park" | "coaster", slug: string) {
    router.push(type === "park" ? `/park/${slug}` : `/coasters/${slug}`);
    setVal("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, total - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === "Escape")    { setOpen(false); inputRef.current?.blur(); }
    if (e.key === "Enter" && activeIdx >= 0) {
      if (activeIdx < matchedParks.length) navigate("park", matchedParks[activeIdx].slug);
      else navigate("coaster", matchedCoasters[activeIdx - matchedParks.length].slug);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVal(e.target.value);
    setActiveIdx(-1);
    if (!open) setOpen(true);
  }

  function clear() { setVal(""); inputRef.current?.focus(); }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const itemCls = (idx: number) =>
    `w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
      activeIdx === idx
        ? "bg-slate-100 dark:bg-slate-800"
        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
    }`;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Input */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
        <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={val}
          placeholder="Search parks & coasters…"
          className="bg-transparent w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800 dark:text-white min-w-0"
          onFocus={() => { setOpen(true); loadData(); }}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Search parks and coasters"
          aria-expanded={showDrop}
          aria-haspopup="listbox"
        />
        {val && (
          <button onClick={clear} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 flex-shrink-0 text-base leading-none">
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDrop && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[9999]"
        >
          {!loaded && (
            <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>
          )}

          {loaded && !hasResults && (
            <p className="px-4 py-3 text-sm text-slate-400">No results for &ldquo;{val}&rdquo;</p>
          )}

          {/* Parks */}
          {loaded && matchedParks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span className="text-base">🏔️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Theme Parks</span>
              </div>
              {matchedParks.map((park, i) => (
                <button key={park.id} role="option" className={itemCls(i)} onMouseEnter={() => setActiveIdx(i)} onClick={() => navigate("park", park.slug)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{park.name}</p>
                    <p className="text-xs text-slate-400">{park.country}</p>
                  </div>
                  {park.overall != null && (
                    <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${getRatingColor(park.overall)}`}>
                      {park.overall.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Coasters */}
          {loaded && matchedCoasters.length > 0 && (
            <div className={matchedParks.length > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""}>
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span className="text-base">🎢</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roller Coasters</span>
              </div>
              {matchedCoasters.map((c, i) => {
                const idx = matchedParks.length + i;
                return (
                  <button key={c.id} role="option" className={itemCls(idx)} onMouseEnter={() => setActiveIdx(idx)} onClick={() => navigate("coaster", c.slug)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate">{c.parkName}</p>
                    </div>
                    {c.rating != null && (
                      <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${getRatingColor(c.rating)}`}>
                        {c.rating.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
