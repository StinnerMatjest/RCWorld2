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

const SEVERITY: Record<string, { rank: number; chip: string; icon: React.ReactNode }> = {
  "very positive": {
    rank: 1,
    chip: "bg-blue-500/15 text-blue-200 border-blue-500/40",
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" /></svg>,
  },
  positive: {
    rank: 2,
    chip: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" /></svg>,
  },
  neutral: {
    rank: 3,
    chip: "bg-yellow-500/10 text-yellow-200 border-yellow-500/40",
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 10h10" /></svg>,
  },
  negative: {
    rank: 4,
    chip: "bg-orange-500/15 text-orange-200 border-orange-500/40",
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" /></svg>,
  },
  "very negative": {
    rank: 5,
    chip: "bg-red-500/15 text-red-200 border-red-500/40",
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 6l5 5 5-5M5 11l5 5 5-5" /></svg>,
  },
};

/**
 * Strengths and weaknesses as chips, grouped into what we loved and what we
 * didn't, so the verdict is readable in one glance before the review.
 */
export default function CoasterVerdict({ highlights: initial, coasterId, isAdminMode, onSaved }: Props) {
  const [highlights, setHighlights] = useState<RollerCoasterHighlights[]>(initial || []);
  const [open, setOpen] = useState(false);
  useEffect(() => setHighlights(initial || []), [initial]);

  const sorted = [...highlights].sort((a, b) => (SEVERITY[a.severity.toLowerCase()]?.rank || 99) - (SEVERITY[b.severity.toLowerCase()]?.rank || 99));
  const loved = sorted.filter((h) => (SEVERITY[h.severity.toLowerCase()]?.rank || 3) <= 2);
  const mixed = sorted.filter((h) => (SEVERITY[h.severity.toLowerCase()]?.rank || 3) === 3);
  const disliked = sorted.filter((h) => (SEVERITY[h.severity.toLowerCase()]?.rank || 3) >= 4);

  if (highlights.length === 0 && !isAdminMode) return null;

  const group = (title: string, items: RollerCoasterHighlights[]) =>
    items.length > 0 && (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((h, i) => {
            const cfg = SEVERITY[h.severity.toLowerCase()] || SEVERITY.neutral;
            return (
              <span key={`${h.category}-${i}`} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${cfg.chip}`}>
                {cfg.icon}
                {h.category}
              </span>
            );
          })}
        </div>
      </div>
    );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">The verdict</h2>
        {isAdminMode && (
          <button onClick={() => setOpen(true)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer" title="Edit strengths and weaknesses">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
        )}
      </div>
      {highlights.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No strengths or weaknesses yet. Click the pencil to add some.</p>
      ) : (
        <div className="space-y-3">
          {group("What we loved", loved)}
          {group("Mixed", mixed)}
          {group("What held it back", disliked)}
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
