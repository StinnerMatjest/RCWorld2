"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { RollerCoasterSpecs } from "@/app/types";
import CoasterSpecsModal from "./CoasterSpecsModal";

interface Props {
  specs: RollerCoasterSpecs | null | undefined;
  coasterId: number;
  slug?: string;
  isAdminMode: boolean;
  onSaved?: (specs: RollerCoasterSpecs) => void;
  scale?: string | null;
}

const fmt = (v: number, d = 0) => v.toLocaleString("en-GB", { maximumFractionDigits: d });
const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} min` : `${Math.round(s)} sec`);

export default function CoasterFacts({ specs: initialSpecs, coasterId, slug, isAdminMode, onSaved, scale }: Props) {
  const [specs, setSpecs] = useState<RollerCoasterSpecs | null | undefined>(initialSpecs);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setSpecs(initialSpecs), [initialSpecs]);
  const s = specs || ({} as RollerCoasterSpecs);

  const main: { label: string; value: string; unit?: string }[] = [];
  if (s.speed) main.push({ label: "Top speed", value: fmt(s.speed, 1), unit: "mph" });
  if (s.height) main.push({ label: "Height", value: fmt(s.height, 1), unit: "ft" });
  if (s.length) main.push({ label: "Length", value: fmt(s.length), unit: "ft" });
  if (s.inversions !== null && s.inversions !== undefined) main.push({ label: "Inversions", value: String(s.inversions) });

  const extra: { label: string; value: string }[] = [];
  if (s.duration) extra.push({ label: "Ride time", value: duration(s.duration) });
  if (s.drop) extra.push({ label: "Drop", value: `${fmt(s.drop, 1)} ft` });
  if (s.gforce) extra.push({ label: "Max G-force", value: `${fmt(s.gforce, 1)} G` });
  if (s.verticalAngle) extra.push({ label: "Steepest drop", value: `${fmt(s.verticalAngle)}°` });
  if (scale && scale !== "Unknown") extra.push({ label: "Scale", value: scale });

  const kind = [s.type, ...(s.classification || "").split("|").map((t) => t.trim()).filter(Boolean)].filter(Boolean).join(" · ");
  const empty = main.length === 0 && extra.length === 0 && !kind;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400">The numbers</p>
        {isAdminMode && (
          <button onClick={() => setOpen(true)} className="text-xs font-semibold text-slate-500 hover:text-white transition-colors cursor-pointer">Edit</button>
        )}
      </div>

      {empty ? (
        <p className="text-sm text-slate-500">{isAdminMode ? "No specs yet. Click Edit to add them." : "Specs coming soon."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-6 gap-y-5">
            {main.map((f) => (
              <div key={f.label} className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black text-white tabular-nums leading-none">{f.value}</span>
                  {f.unit && <span className="text-xs text-slate-400">{f.unit}</span>}
                </div>
                <div className="mt-1 text-xs text-slate-400 uppercase tracking-wider">{f.label}</div>
              </div>
            ))}
          </div>

          {kind && showAll && <p className="mt-4 text-sm text-slate-400 leading-relaxed">{kind}</p>}

          {(extra.length > 0 || s.notes || kind) && (
            <>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors cursor-pointer"
              >
                {showAll ? "Fewer specs" : "More specs"}
              </button>
              {showAll && (
                <div className="mt-3 divide-y divide-slate-800 border-t border-slate-800 space-y-3">
                  <dl className="divide-y divide-slate-800">
                    {extra.map((e) => (
                      <div key={e.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                        <dt className="text-slate-400">{e.label}</dt>
                        <dd className="text-slate-200 font-medium tabular-nums">{e.value}</dd>
                      </div>
                    ))}
                    {s.notes && <p className="py-2 text-sm text-slate-400 leading-relaxed">{s.notes}</p>}
                  </dl>

                  {/* Detailed Standings Link - Mobile Only inside More Specs */}
                  {slug && (
                    <Link
                      href={`/coasters/${slug}/rankings`}
                      className="lg:hidden flex items-center justify-between w-full pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-brand hover:text-brand-light transition-colors group"
                    >
                      <span>Detailed Standings</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </div>
              )}
            </>
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