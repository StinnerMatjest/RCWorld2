"use client";

import React, { useEffect, useState } from "react";
import type { RollerCoasterHighlights } from "@/app/types";
import CoasterHighlightsModal from "./CoasterHighlightsModal";

interface Props {
  highlights: RollerCoasterHighlights[];
  coasterId: number;
  isAdminMode: boolean;
  /** The page keeps the coaster; it is rendered in two places (phone/desktop) so saves go up. */
  onSaved?: (highlights: RollerCoasterHighlights[]) => void;
}

const rankOf = (severity: string) =>
  ({ "very positive": 1, positive: 2, neutral: 3, negative: 4, "very negative": 5 } as Record<string, number>)[severity.toLowerCase()] ?? 3;

/** One glyph per severity: orange chevrons up for the good, slate chevrons down for the rest. */
function Mark({ rank }: { rank: number }) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (rank === 1) return <svg className={`${cls} text-brand`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 9l5-5 5 5M5 15l5-5 5 5" /></svg>;
  if (rank === 2) return <svg className={`${cls} text-brand`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" /></svg>;
  if (rank === 4) return <svg className={`${cls} text-slate-500`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" /></svg>;
  if (rank === 5) return <svg className={`${cls} text-slate-500`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5l5 5 5-5M5 11l5 5 5-5" /></svg>;
  return <svg className={`${cls} text-slate-500`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" d="M5 10h10" /></svg>;
}

/**
 * Strengths and weaknesses as a plain list, the way the park page lists a
 * visit's breakdown: a mark, the words, a thin rule. Loved things first.
 */
export default function CoasterVerdict({ highlights: initial, coasterId, isAdminMode, onSaved }: Props) {
  const [highlights, setHighlights] = useState<RollerCoasterHighlights[]>(initial || []);
  const [open, setOpen] = useState(false);
  useEffect(() => setHighlights(initial || []), [initial]);

  if (highlights.length === 0 && !isAdminMode) return null;

  const sorted = [...highlights].sort((a, b) => rankOf(a.severity) - rankOf(b.severity));
  const loved = sorted.filter((h) => rankOf(h.severity) <= 2);
  const rest = sorted.filter((h) => rankOf(h.severity) > 2);

  const list = (items: RollerCoasterHighlights[]) => (
    <ul className="divide-y divide-slate-800">
      {items.map((h, i) => (
        <li key={`${h.category}-${i}`} className="flex items-center gap-3 py-2.5">
          <Mark rank={rankOf(h.severity)} />
          <span className="text-sm md:text-[15px] text-slate-200 leading-snug">{h.category}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400">Verdict</p>
        {isAdminMode && (
          <button onClick={() => setOpen(true)} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
        )}
      </div>
      {highlights.length === 0 ? (
        <p className="text-sm text-slate-500">No strengths or weaknesses yet. Click Edit to add some.</p>
      ) : (
        <div className="border-t border-slate-800">
          {list(loved)}
          {rest.length > 0 && loved.length > 0 && <div className="border-t border-slate-800" />}
          {list(rest)}
        </div>
      )}
      <CoasterHighlightsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSave={(next) => { setHighlights(next); onSaved?.(next); }}
        initialHighlights={highlights}
        coasterId={coasterId}
      />
    </section>
  );
}
