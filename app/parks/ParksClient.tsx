"use client";
import { useState } from "react";
import Link from "next/link";

export type RankedPark = {
  id: number;
  name: string;
  country: string;
  continent: string;
  slug: string;
  imagepath?: string;
  overall: number;
  bestCoaster: number;
  parkAppearance: number;
  coasterDepth: number;
  waterRides: number;
  flatRidesAndDarkRides: number;
  food: number;
  snacksAndDrinks: number;
  parkPracticality: number;
  rideOperations: number;
  parkManagement: number;
};

type SortKey = keyof RankedPark;

const CRITERIA: { key: SortKey; label: string; short: string }[] = [
  { key: "bestCoaster", label: "Best Coaster", short: "Best Coaster" },
  { key: "coasterDepth", label: "Coaster Depth", short: "Depth" },
  { key: "waterRides", label: "Water Rides", short: "Water" },
  { key: "flatRidesAndDarkRides", label: "Flat Rides & Dark Rides", short: "Flat & Dark" },
  { key: "parkAppearance", label: "Park Appearance", short: "Appearance" },
  { key: "food", label: "Food", short: "Food" },
  { key: "snacksAndDrinks", label: "Snacks & Drinks", short: "Snacks" },
  { key: "parkPracticality", label: "Park Practicality", short: "Practicality" },
  { key: "rideOperations", label: "Ride Operations", short: "Operations" },
  { key: "parkManagement", label: "Park Management", short: "Management" },
];

const MEDALS: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

function scoreColor(value: number): { bg: string; text: string } {
  if (value >= 11) return { bg: "bg-[#FCD34D]/20", text: "text-[#FCD34D]" };
  if (value >= 10) return { bg: "bg-[#F472B6]/20", text: "text-[#F472B6]" };
  if (value >= 9) return { bg: "bg-[#C4B5FD]/20", text: "text-[#C4B5FD]" };
  if (value >= 8) return { bg: "bg-[#60A5FA]/20", text: "text-[#60A5FA]" };
  if (value >= 7) return { bg: "bg-[#4ADE80]/20", text: "text-[#4ADE80]" };
  if (value >= 6) return { bg: "bg-[#BEF264]/20", text: "text-[#BEF264]" };
  if (value >= 5) return { bg: "bg-[#FDE047]/20", text: "text-[#FDE047]" };
  if (value >= 4) return { bg: "bg-[#FB923C]/20", text: "text-[#FB923C]" };
  if (value >= 3) return { bg: "bg-[#F87171]/20", text: "text-[#F87171]" };
  if (value >= 1.5) return { bg: "bg-[#E64558]/20", text: "text-[#E64558]" };
  return { bg: "bg-[#9B7E83]/20", text: "text-[#9B7E83]" };
}

function SortTh({ label, short, sortKey, activeKey, dir, onSort, className = "" }: {
  label: string;
  short: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      title={label}
      // Notice whitespace-normal allows long text to wrap instead of stretching the box
      className={`px-1 py-2 text-center text-[11px] leading-tight cursor-pointer select-none transition-colors ${className}
        ${active ? "text-brand" : "text-slate-300 hover:text-white"}`}
    >
      <div className="flex items-center justify-center gap-0.5 h-full">
        <span className="whitespace-normal">{short}</span>
        <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
          {dir === "desc" ? "↓" : "↑"}
        </span>
      </div>
    </th>
  );
}

export default function ParksClient({ parks }: { parks: RankedPark[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...parks].sort((a, b) => {
    const av = Number(a[sortKey] ?? 0);
    const bv = Number(b[sortKey] ?? 0);
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const overallRank = Object.fromEntries(
    [...parks].sort((a, b) => Number(b.overall) - Number(a.overall)).map((p, i) => [p.id, i])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-800">
        {/* ADDED: table-fixed and min-w-[1000px] */}
        <table className="w-full text-sm border-collapse table-fixed min-w-[1000px]">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700">
              {/* ADDED: Strict widths to headers */}
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 w-12">#</th>
              <th
                onClick={() => handleSort("name")}
                className={`text-left px-4 py-3 text-xs font-semibold cursor-pointer select-none transition-colors w-48
                  ${sortKey === "name" ? "text-brand" : "text-slate-300 hover:text-white"}`}>
                <span className="inline-flex items-center gap-0.5">
                  Park
                  <span className={`transition-opacity ${sortKey === "name" ? "opacity-100" : "opacity-0"}`}>
                    {sortDir === "desc" ? "↓" : "↑"}
                  </span>
                </span>
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 w-26">Country</th>

              <SortTh label="Overall" short="Overall" sortKey="overall" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-20" />
              {CRITERIA.map(c => (
                <SortTh key={String(c.key)} label={c.label} short={c.short} sortKey={c.key} activeKey={sortKey} dir={sortDir} onSort={handleSort} className="w-[76px]" />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((park, i) => {
              const pos = overallRank[park.id];
              const medal = MEDALS[pos];
              return (
                <tr key={park.id} className="border-b border-slate-800/60 hover:bg-brand/5 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {medal ?? <span className="text-slate-600 font-mono text-xs">#{i + 1}</span>}
                  </td>
                  <td className="px-4 py-3 truncate">
                    <Link href={`/park/${park.slug}`} className="font-bold text-base text-slate-100 hover:text-brand transition-colors">
                      {park.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs truncate">{park.country}</td>

                  {/* REVERTED: Background colors are back on the <td> elements */}
                  <td className={`px-3 py-3 text-center align-middle ${scoreColor(Number(park.overall)).bg}`}>
                    <span className={`font-black text-xl tabular-nums ${scoreColor(Number(park.overall)).text}`}>{park.overall}</span>
                  </td>

                  {CRITERIA.map(c => {
                    const val = Number(park[c.key]);
                    if (isNaN(val)) {
                      return <td key={String(c.key)} className="px-2 py-3 text-center text-slate-700">—</td>;
                    }
                    const { bg, text } = scoreColor(val);
                    return (
                      <td key={String(c.key)} className={`px-2 py-3 text-center align-middle font-bold tabular-nums ${bg} ${text}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden flex flex-col gap-3">
        {sorted.map((park, i) => {
          const pos = overallRank[park.id];
          const medal = MEDALS[pos];
          return (
            <Link key={park.id} href={`/park/${park.slug}`}
              className="block bg-slate-800/40 border border-slate-700 hover:border-brand/50 rounded-2xl p-4 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="mr-1 text-sm">{medal ?? <span className="text-slate-600 font-mono text-xs">#{i + 1}</span>}</span>
                  <span className="font-bold text-white">{park.name}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{park.country} · {park.continent}</p>
                </div>
                <span className={`text-2xl font-black tabular-nums ${scoreColor(Number(park.overall)).text}`}>{park.overall}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CRITERIA.map(c => {
                  const val = Number(park[c.key]);
                  const { text } = scoreColor(val);
                  return (
                    <div key={String(c.key)} className="flex justify-between items-center bg-slate-800/60 rounded-lg px-2.5 py-1.5">
                      <span className="text-slate-400 text-[10px]">{c.label}</span>
                      {!isNaN(val)
                        ? <span className={`text-sm font-bold tabular-nums ${text}`}>{val}</span>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </div>
                  );
                })}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="text-center text-slate-500 text-xs mt-8 pb-2">
        Click any column header to sort · Scores from most recent visit
      </p>
    </div>
  );
}