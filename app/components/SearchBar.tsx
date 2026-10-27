"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { getRatingColor } from "../utils/design";
import { slugify } from "../lib/slug";

export type SPark = { id: number; name: string; country: string; slug: string; overall?: number };
export type SCoaster = { id: number; name: string; parkName: string; slug: string; rating?: number };
export type SManufacturer = { id: number; name: string; coasters?: number };

// Lower-case and strip accents and special letters so plain typing matches
function fold(s: string): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/œ/g, "oe")
    .replace(/ß/g, "ss").replace(/ł/g, "l").replace(/đ/g, "d");
}

export type SearchIndex = { parks: SPark[]; coasters: SCoaster[]; manufacturers: SManufacturer[]; loaded: boolean };
const EMPTY: SearchIndex = { parks: [], coasters: [], manufacturers: [], loaded: false };
let indexPromise: Promise<Partial<SearchIndex>> | null = null;   // one download per page, shared by every search box

/** The site's search index (parks, coasters, manufacturers), fetched once. */
export function useSearchIndex(): SearchIndex {
  const [idx, setIdx] = useState<SearchIndex>(EMPTY);
  useEffect(() => {
    if (!indexPromise) indexPromise = fetch("/api/search-index").then(r => (r.ok ? r.json() : {})).catch(err => { console.error("Failed to load search index", err); return {}; });
    let alive = true;
    indexPromise.then(d => { if (alive) setIdx({ parks: d.parks || [], coasters: d.coasters || [], manufacturers: d.manufacturers || [], loaded: true }); });
    return () => { alive = false; };
  }, []);
  return idx;
}

/**
 * Every word of the query must appear in the name (plus country for parks, park for
 * coasters). A country query also lists the best coasters in that country's parks,
 * so "germany" gives the German parks and their top rides.
 */
export function matchSearch(q: string, idx: SearchIndex) {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return { parks: [] as SPark[], coasters: [] as SCoaster[], manufacturers: [] as SManufacturer[], country: null as string | null };
  const hits = (...fields: string[]) => { const hay = fold(fields.join(" ")); return words.every(w => hay.includes(w)); };
  const countryParks = idx.parks.filter(p => words.every(w => fold(p.country).includes(w)));
  const country = countryParks.length ? countryParks[0].country : null;
  const inCountry = new Set(countryParks.map(p => p.name));
  const parks = idx.parks.filter(p => hits(p.name, p.country)).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, country ? 6 : 4);
  const coasters = idx.coasters.filter(c => hits(c.name, c.parkName) || inCountry.has(c.parkName)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
  const manufacturers = idx.manufacturers.filter(m => hits(m.name)).slice(0, 3);
  return { parks, coasters, manufacturers, country };
}

/** A maker opens the coaster list filtered to that maker: /coasterLibrary?manufacturer=vekoma */
export function searchHref(type: "park" | "coaster" | "manufacturer", item: any): string {
  if (type === "park") return `/park/${item.slug}`;
  if (type === "coaster") return `/coasters/${item.slug}`;
  return `/coasterLibrary?manufacturer=${slugify(item.name)}`;
}

/** "30 coasters", the line under a maker's name */
export const coasterCount = (m: SManufacturer) =>
  m.coasters ? `${m.coasters} ${m.coasters === 1 ? "coaster" : "coasters"}` : undefined;

const SearchBar = ({ collapsible = false }: { collapsible?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const [val, setVal] = useState("");

  const idx = useSearchIndex();
  const loaded = idx.loaded;
  const [activeIdx, setActiveIdx] = useState(-1);
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const q = val.trim().toLowerCase();
  const { parks: matchedParks, coasters: matchedCoasters, manufacturers: matchedManufacturers } = matchSearch(val, idx);

  const pLen = matchedParks.length;
  const cLen = matchedCoasters.length;
  const mLen = matchedManufacturers.length;
  const total = pLen + cLen + mLen;

  const hasResults = total > 0;
  const showDrop = open && q.length > 0;

  function navigate(type: "park" | "coaster" | "manufacturer", item: any) {
    router.push(searchHref(type, item));

    setVal("");
    setOpen(false);
    if (collapsible) setExpanded(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      if (collapsible) setExpanded(false);
      inputRef.current?.blur();
      return;
    }
    if (!showDrop) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, total - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    }
    // Enter opens the highlighted result, or the top one when nothing is highlighted
    if (e.key === "Enter" && total > 0) {
      e.preventDefault();
      const i = activeIdx >= 0 ? activeIdx : 0;
      if (i < pLen) {
        navigate("park", matchedParks[i]);
      } else if (i < pLen + cLen) {
        navigate("coaster", matchedCoasters[i - pLen]);
      } else {
        navigate("manufacturer", matchedManufacturers[i - pLen - cLen]);
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVal(e.target.value);
    setActiveIdx(-1);
    if (!open) setOpen(true);
  }

  function clear() {
    setVal("");
    inputRef.current?.focus();
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (collapsible) setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collapsible]);

  function expand() {
    setExpanded(true);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const itemCls = (idx: number) =>
    `w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${activeIdx === idx
      ? "bg-slate-800"
      : "hover:bg-slate-800/60"
    }`;

  return (
    <div ref={wrapperRef} className={`relative ${collapsible ? "" : "w-full"}`}>
      <div
        role={collapsible && !expanded ? "button" : undefined}
        tabIndex={collapsible && !expanded ? 0 : undefined}
        aria-label={collapsible && !expanded ? "Open search" : undefined}
        onClick={() => { if (collapsible && !expanded) expand(); }}
        onKeyDown={(e) => { if (collapsible && !expanded && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); expand(); } }}
        className={`flex items-center h-10 rounded-full transition-all duration-300 ${expanded
          ? `${collapsible ? "w-64 lg:w-80" : "w-full"} bg-slate-900 border border-slate-700 px-4 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand shadow-inner`
          : "w-10 justify-center cursor-pointer text-slate-300 hover:text-white"
          }`}
      >
        <svg className={`flex-shrink-0 ${expanded ? "w-4 h-4 mr-2 text-brand" : "w-5 h-5"}`} fill="none" stroke="currentColor" strokeWidth={expanded ? 2.5 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={val}
          placeholder="Search parks, coasters, brands..."
          className={`bg-transparent text-sm font-medium focus:outline-none placeholder-slate-500 text-white min-w-0 transition-opacity duration-200 ${expanded ? "w-full opacity-100" : "w-0 opacity-0 pointer-events-none"}`}
          tabIndex={expanded ? 0 : -1}
          onFocus={() => setOpen(true)}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={showDrop}
          aria-haspopup="listbox"
          aria-controls={showDrop ? listId : undefined}
        />
        {expanded && val && (
          <button onClick={clear} className="text-slate-500 hover:text-white ml-2 flex-shrink-0 transition-colors p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {showDrop && (
        <div
          id={listId}
          role="listbox"
          className={`absolute top-[calc(100%+8px)] left-0 ${collapsible ? "w-80 max-w-[calc(100vw-2rem)]" : "w-full"} max-h-[60vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[9999]`}
        >
          {!loaded && (
            <div className="px-4 py-6 flex items-center justify-center gap-3 text-sm text-slate-400">
              <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {loaded && !hasResults && (
            <p className="px-4 py-6 text-center text-sm font-medium text-slate-400">No results found for &ldquo;<span className="text-white">{val}</span>&rdquo;</p>
          )}

          {/* Parks */}
          {loaded && matchedParks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <span className="text-sm">🎢</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">Theme Parks</span>
              </div>
              {matchedParks.map((park, i) => (
                <button key={`park-${park.id}`} role="option" className={itemCls(i)} onMouseEnter={() => setActiveIdx(i)} onClick={() => navigate("park", park)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{park.name}</p>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{park.country}</p>
                  </div>
                  {park.overall != null && (
                    <span className={`text-sm font-black tabular-nums flex-shrink-0 ${getRatingColor(park.overall)}`}>
                      {park.overall.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Coasters */}
          {loaded && matchedCoasters.length > 0 && (
            <div className={matchedParks.length > 0 ? "border-t border-slate-800/60 mt-1 pt-1" : ""}>
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <span className="text-sm">🌪️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">Roller Coasters</span>
              </div>
              {matchedCoasters.map((c, i) => {
                const idx = pLen + i;
                return (
                  <button key={`coaster-${c.id}`} role="option" className={itemCls(idx)} onMouseEnter={() => setActiveIdx(idx)} onClick={() => navigate("coaster", c)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{c.parkName}</p>
                    </div>
                    {c.rating != null && (
                      <span className={`text-sm font-black tabular-nums flex-shrink-0 ${getRatingColor(c.rating)}`}>
                        {c.rating.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Manufacturers */}
          {loaded && matchedManufacturers.length > 0 && (
            <div className={(matchedParks.length > 0 || matchedCoasters.length > 0) ? "border-t border-slate-800/60 mt-1 pt-1" : ""}>
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <span className="text-sm">🏭</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">Manufacturers</span>
              </div>
              {matchedManufacturers.map((m, i) => {
                const idx = pLen + cLen + i;
                return (
                  <button key={`manuf-${m.id}`} role="option" className={itemCls(idx)} onMouseEnter={() => setActiveIdx(idx)} onClick={() => navigate("manufacturer", m)}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{m.name}</p>
                      {m.coasters ? (
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{coasterCount(m)}</p>
                      ) : null}
                    </div>
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