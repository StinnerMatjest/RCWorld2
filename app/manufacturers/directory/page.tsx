"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronRight, Settings2, ShieldX } from "lucide-react";
import { getRatingColor, getParkFlag } from "@/app/utils/design";
import LoadingSpinner from "@/app/components/LoadingSpinner";

// --- Types ---
interface DirectoryRide {
    id: number;
    name: string;
    year: number;
    rating: number | null;
    slug: string;
    isDefunct: boolean;
    country: string | null; // <-- NEW
}

interface DirectoryModel {
    id: number;
    name: string;
    rideTypeName: string;
    year: string | null;
    inProduction: boolean;
    history: string | null;
    rides: DirectoryRide[];
}

interface DirectoryManufacturer {
    id: number;
    name: string;
    country: string;
    established: string | null;
    models: DirectoryModel[];
}

type SortOption = "alpha" | "count" | "year";

export default function ManufacturerDirectoryPage() {
    const [manufacturers, setManufacturers] = useState<DirectoryManufacturer[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filters & Sorting
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("count");
    const [showDefunctModels, setShowDefunctModels] = useState(true);
    const [showDefunctRides, setShowDefunctRides] = useState(true);

    // UI State
    const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/manufacturers", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setManufacturers(data.manufacturers);
                    if (data.manufacturers.length > 0) {
                        setSelectedId(data.manufacturers[0].id);
                    }
                }
            } catch (error) {
                console.error("Failed to load directory", error);
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const selectedMfg = manufacturers.find((m) => m.id === selectedId);

    // --- Filtering & Sorting Logic ---
    const processedModels = useMemo(() => {
        if (!selectedMfg) return [];

        let filtered = selectedMfg.models.map(model => {
            // Filter the individual rides inside the model
            const visibleRides = model.rides.filter(ride => {
                if (!showDefunctRides && ride.isDefunct) return false;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return ride.name.toLowerCase().includes(q) || model.name.toLowerCase().includes(q) || (ride.country && ride.country.toLowerCase().includes(q));
                }
                return true;
            });

            return { ...model, rides: visibleRides };
        });

        // Filter Models
        filtered = filtered.filter(model => {
            if (!showDefunctModels && !model.inProduction) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!model.name.toLowerCase().includes(q) && model.rides.length === 0) return false;
            }
            return true;
        });

        // Sort Models
        filtered.sort((a, b) => {
            if (sortBy === "alpha") return a.name.localeCompare(b.name);
            if (sortBy === "count") return b.rides.length - a.rides.length;
            if (sortBy === "year") {
                const yearA = a.year ? parseInt(a.year.substring(0, 4)) : 9999;
                const yearB = b.year ? parseInt(b.year.substring(0, 4)) : 9999;
                return yearA - yearB;
            }
            return 0;
        });

        return filtered;
    }, [selectedMfg, searchQuery, sortBy, showDefunctModels, showDefunctRides]);

    const toggleModel = (modelId: number) => {
        const newSet = new Set(expandedModels);
        if (newSet.has(modelId)) newSet.delete(modelId);
        else newSet.add(modelId);
        setExpandedModels(newSet);
    };

    if (isLoading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col md:flex-row max-w-[1600px] mx-auto pt-6 px-4 md:px-8 gap-8">

            {/* Sidebar: Manufacturers */}
            <aside className="w-full md:w-1/3 lg:w-1/4 flex flex-col h-[85vh]">
                <h1 className="text-2xl font-black text-white mb-6">Directory</h1>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {manufacturers.map((mfg) => (
                        <button
                            key={mfg.id}
                            onClick={() => {
                                setSelectedId(mfg.id);
                                setSearchQuery("");
                                setExpandedModels(new Set());
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${selectedId === mfg.id
                                ? "bg-slate-800 border-slate-600 shadow-md text-white"
                                : "bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                                }`}
                        >
                            <span className="font-semibold truncate block">{mfg.name}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="w-full md:w-2/3 lg:w-3/4 flex flex-col h-[85vh]">
                {selectedMfg ? (
                    <>
                        {/* Header */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm">
                            <div className="flex items-center gap-5">
                                <img
                                    src={`/images/manufacturers/${selectedMfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                                    alt={`${selectedMfg.name} logo`}
                                    className="w-16 h-16 object-contain bg-white rounded-xl p-1.5 shadow-sm"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                <div>
                                    <h2 className="text-3xl font-black text-white">{selectedMfg.name}</h2>
                                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-slate-400">
                                        {selectedMfg.country && (
                                            <span className="flex items-center gap-1.5">
                                                <img src={getParkFlag(selectedMfg.country)} alt="flag" className="w-5 h-auto rounded-[2px]" />
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

                        {/* Toolbar (Search & Sort) */}
                        <div className="flex flex-col xl:flex-row gap-4 mb-6 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">

                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search models, rides, or countries..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand transition-colors"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
                                    <Settings2 className="w-4 h-4 text-slate-400" />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="bg-transparent text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer"
                                    >
                                        <option value="count" className="bg-slate-900">Sort by Ride Count</option>
                                        <option value="year" className="bg-slate-900">Sort by Debut Year</option>
                                        <option value="alpha" className="bg-slate-900">Sort Alphabetically</option>
                                    </select>
                                </div>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
                                    <input type="checkbox" checked={showDefunctModels} onChange={(e) => setShowDefunctModels(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-brand" />
                                    Show Defunct Models
                                </label>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
                                    <input type="checkbox" checked={showDefunctRides} onChange={(e) => setShowDefunctRides(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-brand" />
                                    Show Defunct Rides
                                </label>
                            </div>
                        </div>

                        {/* Ride Models List */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-10">
                            {processedModels.length > 0 ? (
                                processedModels.map((model) => (
                                    <div key={model.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-700">

                                        {/* Model Accordion Header */}
                                        <button
                                            onClick={() => toggleModel(model.id)}
                                            className="w-full flex items-center justify-between p-5 cursor-pointer text-left"
                                        >
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-bold text-white">{model.name}</h3>
                                                    {!model.inProduction && (
                                                        <span className="px-2 py-0.5 bg-red-900/30 border border-red-900/50 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-md flex items-center gap-1">
                                                            <ShieldX className="w-3 h-3" /> Defunct
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                                    <span>{model.rideTypeName}</span>
                                                    <span>•</span>
                                                    <span>Debut: {model.year ? new Date(model.year).getFullYear() : "Unknown"}</span>
                                                    <span>•</span>
                                                    <span className="text-brand">{model.rides.length} Rides Logged</span>
                                                </div>
                                            </div>

                                            <div className={`p-2 rounded-full bg-slate-800 text-slate-400 transition-transform duration-300 ${expandedModels.has(model.id) ? "rotate-90" : ""}`}>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </button>

                                        {/* Expanded Rides List */}
                                        {expandedModels.has(model.id) && (
                                            <div className="border-t border-slate-800 bg-slate-950/50 p-4">
                                                {model.history && (
                                                    <p className="text-sm text-slate-400 mb-6 italic px-2 border-l-2 border-brand/50">"{model.history}"</p>
                                                )}

                                                {model.rides.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {model.rides.map(ride => {
                                                            const flagUrl = ride.country ? getParkFlag(ride.country) : null;
                                                            const hasValidFlag = flagUrl && !flagUrl.includes('error.PNG');

                                                            return (
                                                                <Link
                                                                    href={`/coasters/${ride.slug}`}
                                                                    key={ride.id}
                                                                    className="relative flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900 hover:border-brand/50 transition-colors group overflow-hidden"
                                                                >
                                                                    {/* CSS Masked Flag Background */}
                                                                    {hasValidFlag && (
                                                                        <div
                                                                            className="absolute inset-y-0 right-0 w-3/5 sm:w-1/2 max-w-[220px] z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300 pointer-events-none rounded-r-xl"
                                                                            style={{
                                                                                backgroundImage: `url(${flagUrl.replace('w40', 'w320')})`,
                                                                                // 'cover' now fills just this right-aligned div, creating a smooth ambient texture
                                                                                backgroundSize: 'cover',
                                                                                backgroundPosition: 'center',
                                                                                // The fade now perfectly matches the left edge of the container, eliminating the hard line
                                                                                maskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                                                                                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)'
                                                                            }}
                                                                        />
                                                                    )}

                                                                    {/* Content wrapper with z-index to stay above background */}
                                                                    <div className="relative z-10">
                                                                        <span className="font-semibold text-slate-200 group-hover:text-brand transition-colors flex items-center gap-2 drop-shadow-md">
                                                                            {ride.name}
                                                                            {ride.isDefunct && <span className="text-[9px] px-1.5 py-0.5 bg-red-950/80 text-red-500 rounded uppercase tracking-wider backdrop-blur-sm">Defunct</span>}
                                                                        </span>
                                                                        <span className="text-xs text-slate-400 font-medium block mt-0.5 drop-shadow-md">
                                                                            {ride.year || "Unknown Year"} {ride.country ? `• ${ride.country}` : ""}
                                                                        </span>
                                                                    </div>

                                                                    <div className={`relative z-10 font-black tabular-nums drop-shadow-md text-lg ${getRatingColor(ride.rating || 0)}`}>
                                                                        {ride.rating ? ride.rating.toFixed(1) : "—"}
                                                                    </div>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500 text-center py-4">No rides match your current filters.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl">
                                    <p className="text-slate-400 font-medium">No models found.</p>
                                    <p className="text-slate-600 text-sm mt-1">Try adjusting your search or filters.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Select a manufacturer to view their portfolio
                    </div>
                )}
            </main>
        </div>
    );
}