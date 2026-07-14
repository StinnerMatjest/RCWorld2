"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Manufacturer } from "@/app/types";
import { getRatingColor, getParkFlag } from "@/app/utils/design";

export default function ManufacturerDirectoryPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hideUnridden, setHideUnridden] = useState(true);

    useEffect(() => {
        async function fetchManufacturers() {
            try {
                const response = await fetch("/api/manufacturers");
                if (response.ok) {
                    const data = await response.json();
                    setManufacturers(data.manufacturers);
                    if (data.manufacturers.length > 0) {
                        setSelectedId(data.manufacturers[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch manufacturers", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchManufacturers();
    }, []);

    const visibleManufacturers = manufacturers.filter((mfg) => {
        if (!hideUnridden) return true;
        // Keep manufacturer if they have at least one coaster with a rating > 0
        return mfg.rollercoasters && mfg.rollercoasters.some((c) => (c.rating || 0) > 0);
    });

    const selectedMfg = manufacturers.find((m) => m.id === selectedId);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <p className="text-lg text-slate-400 animate-pulse">Loading directory...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">

            {/* Navigation Toggle */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center bg-slate-800 p-2 rounded-xl border border-slate-700 w-fit">
                    <Link
                        href="/manufacturers"
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                        Hall of Fame
                    </Link>
                    <div className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white shadow-sm">
                        Database Directory
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:px-8 pb-16 flex flex-col md:flex-row gap-8">

                {/* Sidebar: Manufacturer List */}
                <aside className="w-full md:w-1/3 lg:w-1/4 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-black text-white">Directory</h1>

                        {/* NEW: The Toggle UI */}
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
                            <input
                                type="checkbox"
                                checked={hideUnridden}
                                onChange={(e) => {
                                    setHideUnridden(e.target.checked);
                                    // Optional: Reset selection to top of new list so we don't get stuck on a hidden manufacturer
                                    if (e.target.checked) setSelectedId(null);
                                }}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand focus:ring-offset-slate-900"
                            />
                            Hide unridden
                        </label>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[75vh] pr-2 custom-scrollbar">
                        {/* UPDATED: Map over visibleManufacturers instead of manufacturers */}
                        {visibleManufacturers.map((mfg) => (
                            <button
                                key={mfg.id}
                                onClick={() => setSelectedId(mfg.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${selectedId === mfg.id
                                    ? "bg-slate-800 border-slate-600 shadow-md text-white"
                                    : "bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                                    }`}
                            >
                                <div className="flex justify-between items-center gap-2">
                                    <span className="font-semibold truncate">{mfg.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${selectedId === mfg.id ? "bg-brand text-white" : "bg-slate-800 text-slate-500"
                                        }`}>
                                        {mfg.rollercoasters?.length || 0}
                                    </span>
                                </div>
                            </button>
                        ))}

                        {visibleManufacturers.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">No ridden manufacturers found.</p>
                        )}
                    </div>
                </aside>

                {/* Main Panel: Manufacturer Details */}
                <main className="w-full md:w-2/3 lg:w-3/4">
                    {selectedMfg ? (
                        <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col h-full max-h-[85vh]">

                            {/* Header Section */}
                            <div className="p-6 md:p-8 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-5">

                                            {/* Logo Image */}
                                            <img
                                                src={`/images/manufacturers/${selectedMfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                                                alt={`${selectedMfg.name} logo`}
                                                className="w-16 h-16 object-contain bg-white rounded-xl p-1.5 shadow-sm"
                                            // Temporarily comment this out!
                                            // onError={(e) => (e.currentTarget.style.display = 'none')} 
                                            />

                                            <div>
                                                <h2 className="text-3xl font-black text-white">{selectedMfg.name}</h2>
                                                <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-slate-400">
                                                    {selectedMfg.country && (
                                                        <span className="flex items-center gap-1.5">
                                                            <img
                                                                src={getParkFlag(selectedMfg.country)}
                                                                alt={`${selectedMfg.country} flag`}
                                                                className="w-5 h-auto rounded-[2px]"
                                                                loading="lazy"
                                                            />
                                                            {selectedMfg.country}
                                                        </span>
                                                    )}
                                                    {selectedMfg.established && (
                                                        <span className="flex items-center gap-1.5">
                                                            🏢 Est. {new Date(selectedMfg.established).getFullYear()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex-shrink-0 w-fit ${selectedMfg.inBusiness
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                            }`}
                                    >
                                        {selectedMfg.inBusiness ? "Active" : "Defunct"}
                                    </span>
                                </div>

                                {(selectedMfg.history || selectedMfg.notes) && (
                                    <div className="mt-6 space-y-5">
                                        {selectedMfg.history && (
                                            <div>
                                                <h3 className="text-[11px] font-bold text-brand uppercase tracking-widest mb-1.5">History</h3>
                                                <p className="text-slate-300 text-sm leading-relaxed">{selectedMfg.history}</p>
                                            </div>
                                        )}
                                        {selectedMfg.notes && (
                                            <div>
                                                <h3 className="text-[11px] font-bold text-brand uppercase tracking-widest mb-1.5">Notes</h3>
                                                <p className="text-slate-300 text-sm leading-relaxed">{selectedMfg.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Rollercoasters Table */}
                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-700 text-sm">
                                    <thead className="bg-slate-900/40 sticky top-0 backdrop-blur-sm">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                                                Coaster Name
                                            </th>
                                            <th scope="col" className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                                                Rating
                                            </th>
                                            <th scope="col" className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                                                Model
                                            </th>
                                            <th scope="col" className="px-6 py-4 text-left font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                                                Year
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50 bg-transparent">
                                        {selectedMfg.rollercoasters && selectedMfg.rollercoasters.length > 0 ? (
                                            selectedMfg.rollercoasters
                                                // Optional: Sort by rating highest to lowest by default
                                                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                                                .map((coaster) => (
                                                    <tr key={coaster.id} className="hover:bg-slate-700/30 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <Link
                                                                href={`/coasters/${coaster.slug}`}
                                                                className="text-slate-200 group-hover:text-brand font-semibold transition-colors"
                                                            >
                                                                {coaster.name}
                                                            </Link>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {coaster.rating > 0 ? (
                                                                <span className={`tabular-nums font-black ${getRatingColor(coaster.rating)}`}>
                                                                    {coaster.rating.toFixed(1)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-600 font-medium">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                                                            {coaster.model || "—"}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-slate-400 tabular-nums">
                                                            {coaster.year || "—"}
                                                        </td>
                                                    </tr>
                                                ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                    No rollercoasters logged for this manufacturer yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[500px] items-center justify-center border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/30 p-12">
                            <p className="text-slate-500 text-lg font-medium">Select a manufacturer to view details</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}