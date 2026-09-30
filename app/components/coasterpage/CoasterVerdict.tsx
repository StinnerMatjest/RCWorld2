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

/** Each highlight carries a weight: big or small high, big or small low. */
const weightOf = (severity: string) =>
  ({ "very positive": 2, positive: 1, neutral: 0, negative: -1, "very negative": -2 } as Record<string, number>)[severity.toLowerCase()] ?? 0;

/** Strength as a mark: two chevrons for a big one, one for a small one. Orange up for highs, slate down for lows. */
function Mark({ w }: { w: number }) {
  const cls = "w-4 h-4 flex-shrink-0";
  if (w >= 2) return <svg className={`${cls} text-brand`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 9l5-5 5 5M5 15l5-5 5 5" /></svg>;
  if (w === 1) return <svg className={`${cls} text-brand`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" /></svg>;
  if (w === -1) return <svg className={`${cls} text-slate-400`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" /></svg>;
  if (w <= -2) return <svg className={`${cls} text-slate-400`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5l5 5 5-5M5 11l5 5 5-5" /></svg>;
  return <svg className={`${cls} text-slate-500`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" d="M5 10h10" /></svg>;
}

/**
 * The highs and lows behind the score, grouped and ordered by how much each
 * one mattered. The mark carries the weight (two chevrons beat one); the
 * words carry the reason.
 */
export default function CoasterVerdict({ highlights: initial, coasterId, isAdminMode, onSaved }: Props) {
  const [highlights, setHighlights] = useState<RollerCoasterHighlights[]>(initial || []);
  const [open, setOpen] = useState(false);
  useEffect(() => setHighlights(initial || []), [initial]);

  if (highlights.length === 0 && !isAdminMode) return null;

  const highs = highlights.filter((h) => weightOf(h.severity) > 0).sort((a, b) => weightOf(b.severity) - weightOf(a.severity));
  const lows = highlights.filter((h) => weightOf(h.severity) < 0).sort((a, b) => weightOf(a.severity) - weightOf(b.severity));
  const flat = highlights.filter((h) => weightOf(h.severity) === 0);

  const group = (title: string, items: RollerCoasterHighlights[]) =>
    items.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pt-3 pb-1">{title}</p>
        <ul className="divide-y divide-slate-800/80">
          {items.map((h, i) => (
            <li key={`${h.category}-${i}`} className="flex items-center gap-3 py-2">
              <Mark w={weightOf(h.severity)} />
              <span className="min-w-0 text-sm md:text-[15px] text-slate-200 leading-snug">{h.category}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400">Highs and lows</p>
        {isAdminMode && (
          <button onClick={() => setOpen(true)} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
        )}
      </div>
      {highlights.length === 0 ? (
        <p className="text-sm text-slate-500 border-t border-slate-800 pt-3">Nothing noted yet. Click Edit to add the highs and lows.</p>
      ) : (
        <div className="border-t border-slate-800">
          {group("Highs", highs)}
          {group("Lows", lows)}
          {group("Neither here nor there", flat)}
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
