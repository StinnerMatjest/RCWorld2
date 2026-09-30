"use client";

import React, { useEffect, useState } from "react";
import type { RollerCoasterSpecs } from "@/app/types";
import CoasterSpecsModal from "./CoasterSpecsModal";

interface Props {
  specs: RollerCoasterSpecs | null | undefined;
  coasterId: number;
  isAdminMode: boolean;
  /** The page keeps the coaster; it is rendered in two places (phone/desktop) so saves go up. */
  onSaved?: (specs: RollerCoasterSpecs) => void;
}

const TAG_ORDER = ["Sit Down", "Inverted", "Flying", "Wing", "Dive", "Stand Up", "Bobsled", "Wild Mouse", "Spinning", "Family", "Kiddie", "Mega", "Giga", "Strata", "Hyper", "Launched", "LSM", "LIM", "Hydraulic", "Swing Launch", "Switch Track", "Custom", "Beyond Vertical", "Station Drop"];

const ft = (v: number) => v;
const toM = (v: number) => v * 0.3048;
const toKmh = (v: number) => v * 1.609344;
const fmt = (v: number, d = 0) => v.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)}`);

type Fact = { key: string; label: string; value: string; unit: string; alt?: string };

/**
 * The numbers a rider wants at a glance, metric first (our readers are in
 * Europe) with the imperial figure the data is stored in as the small print.
 * Only facts we have are shown; the rest of the sheet sits behind "All specs".
 */
export default function CoasterFacts({ specs: initialSpecs, coasterId, isAdminMode, onSaved }: Props) {
  const [specs, setSpecs] = useState<RollerCoasterSpecs | null | undefined>(initialSpecs);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setSpecs(initialSpecs), [initialSpecs]);
  const s = specs || ({} as RollerCoasterSpecs);

  const facts: Fact[] = [];
  if (s.speed) facts.push({ key: "speed", label: "Top speed", value: fmt(toKmh(s.speed)), unit: "km/h", alt: `${fmt(ft(s.speed), 1)} mph` });
  if (s.height) facts.push({ key: "height", label: "Height", value: fmt(toM(s.height)), unit: "m", alt: `${fmt(s.height, 1)} ft` });
  if (s.length) facts.push({ key: "length", label: "Track length", value: fmt(toM(s.length)), unit: "m", alt: `${fmt(s.length)} ft` });
  if (s.inversions !== null && s.inversions !== undefined) facts.push({ key: "inversions", label: "Inversions", value: String(s.inversions), unit: "" });
  if (s.duration) facts.push({ key: "duration", label: "Ride time", value: duration(s.duration), unit: s.duration >= 60 ? "min" : "sec" });
  if (s.drop) facts.push({ key: "drop", label: "Drop", value: fmt(toM(s.drop)), unit: "m", alt: `${fmt(s.drop, 1)} ft` });
  if (s.gforce) facts.push({ key: "gforce", label: "Max G-force", value: fmt(s.gforce, 1), unit: "G" });
  if (s.verticalAngle) facts.push({ key: "angle", label: "Steepest drop", value: fmt(s.verticalAngle), unit: "°" });

  const primary = facts.slice(0, 6);
  const extra = facts.slice(6);

  const tags = (s.classification || "").split("|").map((t) => t.trim()).filter(Boolean)
    .sort((a, b) => (TAG_ORDER.indexOf(a) === -1 ? 999 : TAG_ORDER.indexOf(a)) - (TAG_ORDER.indexOf(b) === -1 ? 999 : TAG_ORDER.indexOf(b)));

  const empty = facts.length === 0 && tags.length === 0 && !s.type;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white">The numbers</h2>
        {isAdminMode && (
          <button onClick={() => setOpen(true)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer" title="Edit specs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
        )}
      </div>

      {empty ? (
        <p className="text-sm text-slate-500 italic">{isAdminMode ? "No specs yet. Click the pencil to add them." : "Specs coming soon."}</p>
      ) : (
        <>
          {(tags.length > 0 || s.type) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {s.type && (
                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 text-[11px] font-bold uppercase tracking-wider border border-slate-700">{s.type}</span>
              )}
              {tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-blue-900/20 text-blue-300 text-[11px] font-bold uppercase tracking-wider border border-blue-800/50">{tag}</span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(showAll ? facts : primary).map((f) => (
              <div key={f.key} className="rounded-2xl bg-slate-900/70 border border-slate-800 px-3.5 py-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-none">{f.value}</span>
                  {f.unit && <span className="text-xs font-bold text-slate-400">{f.unit}</span>}
                </div>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{f.label}</p>
                {f.alt && <p className="text-[11px] text-slate-600 mt-0.5">{f.alt}</p>}
              </div>
            ))}
          </div>

          {(extra.length > 0 || s.notes) && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors cursor-pointer"
            >
              {showAll ? "Fewer numbers" : "All specs"}
            </button>
          )}
          {showAll && s.notes && (
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.notes}</p>
          )}
        </>
      )}

      <CoasterSpecsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSave={(updated) => { setSpecs(updated); onSaved?.(updated); }}
        initialSpecs={specs}
        coasterId={coasterId}
      />
    </section>
  );
}
