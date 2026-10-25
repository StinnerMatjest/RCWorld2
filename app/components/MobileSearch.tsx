"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getRatingColor } from "../utils/design";
import { coasterCount, matchSearch, searchHref, useSearchIndex } from "./SearchBar";

/**
 * The phone search: a full-width field that drops in under the header with the
 * page dimmed behind it, results grouped under small labels, no boxes. Same
 * index and matching as the desktop bar (SearchBar), so a country query lists
 * that country's parks and the best coasters in them.
 */
export default function MobileSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const idx = useSearchIndex();
  const q = val.trim();
  const r = matchSearch(q, idx);
  const total = r.parks.length + r.coasters.length + r.manufacturers.length;

  // focus on open, clear on close, Escape closes, no page scroll behind
  useEffect(() => {
    if (!open) { setVal(""); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const go = (href: string) => { onClose(); router.push(href); };
  const label = "px-1 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const Row = ({ title, sub, score, decimals, href }: { title: string; sub?: string; score?: number | null; decimals: number; href: string }) => (
    <button type="button" onClick={() => go(href)} className="w-full flex items-center gap-3 px-1 py-3 border-t border-slate-800 text-left cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-bold text-white truncate">{title}</span>
        {sub && <span className="block text-xs text-slate-400 truncate">{sub}</span>}
      </span>
      {score != null && <span className={`text-lg font-black tabular-nums flex-shrink-0 ${getRatingColor(score)}`}>{score.toFixed(decimals).replace(/\.0$/, "")}</span>}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[10000] md:hidden" role="dialog" aria-label="Search">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm cursor-default" />
      <div className="relative bg-[#0f172a] border-b border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="flex items-center gap-3 px-4 pt-3 pb-3">
          <label className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl bg-slate-900 border border-slate-700 focus-within:border-brand transition-colors">
            <svg className="w-5 h-5 text-brand flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
            <input
              ref={inputRef}
              type="search"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="Park, coaster or country"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent text-base text-white placeholder-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              aria-label="Search"
            />
            {val && (
              <button type="button" onClick={() => { setVal(""); inputRef.current?.focus(); }} aria-label="Clear" className="text-slate-500 hover:text-white p-1 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </label>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-white cursor-pointer">Cancel</button>
        </div>

        {q.length > 0 && (
          <div className="px-4 pb-4 max-h-[68vh] overflow-y-auto overscroll-contain">
            {!idx.loaded && <p className="py-6 text-center text-sm text-slate-400">Loading…</p>}
            {idx.loaded && total === 0 && <p className="py-6 text-center text-sm text-slate-400">Nothing for &ldquo;<span className="text-white">{q}</span>&rdquo;</p>}
            {r.parks.length > 0 && (
              <div>
                <p className={label}>Parks</p>
                {r.parks.map((p) => <Row key={`p${p.id}`} title={p.name} sub={p.country} score={p.overall ?? null} decimals={2} href={searchHref("park", p)} />)}
              </div>
            )}
            {r.coasters.length > 0 && (
              <div>
                <p className={label}>{r.country ? `Coasters in ${r.country}` : "Coasters"}</p>
                {r.coasters.map((c) => <Row key={`c${c.id}`} title={c.name} sub={c.parkName} score={c.rating ?? null} decimals={1} href={searchHref("coaster", c)} />)}
              </div>
            )}
            {r.manufacturers.length > 0 && (
              <div>
                <p className={label}>Manufacturers</p>
                {r.manufacturers.map((m) => <Row key={`m${m.id}`} title={m.name} sub={coasterCount(m)} decimals={0} href={searchHref("manufacturer", m)} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
