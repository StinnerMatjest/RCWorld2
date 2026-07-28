"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, Settings2, ShieldX, ArrowLeft, Plus } from "lucide-react";
import { getRatingColor, getParkFlag } from "@/app/utils/design";
import { DirectoryManufacturer, DirectoryRideType } from "@/app/types";
import CreatorModal from "@/app/components/manufacturerPage/CreatorModal";
import { useAdminMode } from "@/app/context/AdminModeContext";

type SortOption = "alpha" | "count" | "year";

export default function DirectoryClient() {
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
    const [isMobileDetailView, setIsMobileDetailView] = useState(false);
    const { isAdminMode } = useAdminMode();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<any>(null);
    const [editType, setEditType] = useState<"model" | "type" | "manufacturer" | undefined>(undefined);

    const handleOpenCreate = () => {
        setEditItem(null);
        setEditType(undefined);
        setIsCreateModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setEditItem(null);
        setEditType(undefined);
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/manufacturers", { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setManufacturers(data.manufacturers);

                    // Parse URL parameters
                    const params = new URLSearchParams(window.location.search);
                    const mfgParam = params.get("mfg");
                    const modelParam = params.get("model");

                    if (data.manufacturers.length > 0) {
                        if (mfgParam) {
                            setSelectedId(Number(mfgParam));
                            setIsMobileDetailView(true); // Open the detail view on mobile

                            if (modelParam) {
                                setExpandedModels(new Set([Number(modelParam)]));

                                // Auto-scroll to the model after React has a moment to render it
                                setTimeout(() => {
                                    const el = document.getElementById(`model-${modelParam}`);
                                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                                }, 150);
                            }
                        } else if (window.innerWidth >= 768) {
                            // Desktop default fallback
                            setSelectedId(data.manufacturers[0].id);
                        }
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

        filtered = filtered.filter(model => {
            if (!showDefunctModels && !model.inProduction) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!model.name.toLowerCase().includes(q) && model.rides.length === 0) return false;
            }
            return true;
        });

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

        // Sort the rides inside each model
        filtered = filtered.map(model => {
            const sortedRides = [...model.rides].sort((a, b) => {
                if (sortBy === "alpha") return a.name.localeCompare(b.name);
                if (sortBy === "count") return (b.rating || 0) - (a.rating || 0);
                if (sortBy === "year") return (a.year || 9999) - (b.year || 9999);
                return 0;
            });
            return { ...model, rides: sortedRides };
        });

        return filtered;
    }, [selectedMfg, searchQuery, sortBy, showDefunctModels, showDefunctRides]);

    const toggleModel = (modelId: number) => {
        const newSet = new Set(expandedModels);
        if (newSet.has(modelId)) newSet.delete(modelId);
        else newSet.add(modelId);
        setExpandedModels(newSet);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col md:flex-row max-w-[1600px] mx-auto pt-6 px-4 md:px-8 gap-8 relative">

            {/* SIDEBAR: Manufacturers */}
            <aside className={`w-full md:w-1/3 lg:w-1/4 flex-col h-[85vh] ${isMobileDetailView ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-black text-white">Directory</h1>
                    {isAdminMode && (
                        <button
                            onClick={handleOpenCreate}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors shadow-lg hover:scale-105 active:scale-95"
                            title="Create new"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar pb-10 md:pb-0">
                    {manufacturers.map((mfg) => (
                        <button
                            key={mfg.id}
                            onClick={() => {
                                setSelectedId(mfg.id);
                                setSearchQuery("");
                                setExpandedModels(new Set());
                                setIsMobileDetailView(true); // Trigger slide-over on mobile
                                window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for mobile convenience
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${selectedId === mfg.id
                                ? "bg-slate-800 border-slate-600 shadow-md text-white"
                                : "bg-slate-900/50 border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                                }`}
                        >
                            <span className="font-semibold truncate block">{mfg.name}</span>
                            {/* Chevron only shows on mobile to indicate tapping goes to a new screen */}
                            <ChevronRight className="w-4 h-4 opacity-50 md:hidden" />
                        </button>
                    ))}
                </div>
            </aside>

            {/* MAIN CONTENT: Ride Models */}
            <main className={`w-full md:w-2/3 lg:w-3/4 flex-col h-[85vh] ${isMobileDetailView ? 'flex' : 'hidden md:flex'}`}>

                {/* Mobile Back Button */}
                {isMobileDetailView && (
                    <button
                        onClick={() => setIsMobileDetailView(false)}
                        className="md:hidden flex items-center gap-2 text-brand font-bold text-sm uppercase tracking-widest mb-4 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Directory
                    </button>
                )}

                {selectedMfg ? (
                    <>
                        {/* Header */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shadow-sm relative">
                            {/* NEW: Edit Manufacturer Button */}
                            {isAdminMode && (
                                <button
                                    onClick={() => {
                                        setEditItem(selectedMfg);
                                        setEditType("manufacturer");
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-full hover:bg-slate-800"
                                >
                                    <Settings2 className="w-5 h-5" />
                                </button>
                            )}

                            <div className="flex items-center gap-5">
                                <img
                                    src={`/images/manufacturers/${selectedMfg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
                                    alt={`${selectedMfg.name} logo`}
                                    className="w-16 h-16 object-contain bg-white rounded-xl p-1.5 shadow-sm shrink-0"
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
                                <div className="flex items-center gap-2 border-r border-slate-700 pr-4 w-full sm:w-auto">
                                    <Settings2 className="w-4 h-4 text-slate-400 shrink-0" />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="bg-transparent text-sm font-semibold text-slate-200 focus:outline-none cursor-pointer w-full sm:w-auto"
                                    >
                                        <option value="count" className="bg-slate-900">Sort by Ride Count</option>
                                        <option value="year" className="bg-slate-900">Sort by Debut Year</option>
                                        <option value="alpha" className="bg-slate-900">Sort Alphabetically</option>
                                    </select>
                                </div>

                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
                                        <input type="checkbox" checked={showDefunctModels} onChange={(e) => setShowDefunctModels(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-brand" />
                                        Defunct Models
                                    </label>

                                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
                                        <input type="checkbox" checked={showDefunctRides} onChange={(e) => setShowDefunctRides(e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-brand" />
                                        Defunct Rides
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Ride Models List */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-10">
                            {processedModels.length > 0 ? (
                                processedModels.map((model) => (
                                    <div key={model.id} id={`model-${model.id}`} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-700">
                                        {/* Model Accordion Header */}
                                        <div
                                            onClick={() => toggleModel(model.id)}
                                            className="w-full flex items-center justify-between p-4 md:p-5 cursor-pointer text-left"
                                        >
                                            <div className="flex flex-col gap-1 pr-4">
                                                <div className="flex items-center flex-wrap gap-2 md:gap-3">
                                                    <h3 className="text-lg md:text-xl font-bold text-white">{model.name}</h3>
                                                    {isAdminMode && model.id !== 999999 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditItem({ ...model, manufacturer_id: selectedMfg.id });
                                                                setEditType("model");
                                                                setIsCreateModalOpen(true);
                                                            }}
                                                            className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                                                        >
                                                            <Settings2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!model.inProduction && model.id !== 999999 && (
                                                        <span className="px-2 py-0.5 bg-red-900/30 border border-red-900/50 text-red-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md flex items-center gap-1 shrink-0">
                                                            <ShieldX className="w-3 h-3" /> Defunct
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center flex-wrap gap-y-1 gap-x-2 md:gap-3 text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
                                                    <span>{model.rideTypeName}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span>Debut: {model.year ? new Date(model.year).getFullYear() : "Unknown"}</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span className="text-brand w-full sm:w-auto">{model.rides.length} Rides Logged</span>
                                                </div>
                                            </div>

                                            <div className={`p-2 rounded-full bg-slate-800 text-slate-400 transition-transform duration-300 shrink-0 ${expandedModels.has(model.id) ? "rotate-90" : ""}`}>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>

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
                                                                                backgroundSize: 'cover',
                                                                                backgroundPosition: 'center',
                                                                                maskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                                                                                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)'
                                                                            }}
                                                                        />
                                                                    )}

                                                                    {/* Content wrapper with z-index to stay above background */}
                                                                    <div className="relative z-10 pr-2">
                                                                        <span className="font-semibold text-slate-200 group-hover:text-brand transition-colors flex items-center flex-wrap gap-2 drop-shadow-md">
                                                                            {ride.name}
                                                                            {ride.isDefunct && <span className="text-[9px] px-1.5 py-0.5 bg-red-950/80 text-red-500 rounded uppercase tracking-wider backdrop-blur-sm shrink-0">Defunct</span>}
                                                                        </span>
                                                                        <span className="text-xs text-slate-400 font-medium block mt-0.5 drop-shadow-md">
                                                                            {ride.year || "Unknown Year"} {ride.country ? `• ${ride.country}` : ""}
                                                                        </span>
                                                                    </div>

                                                                    <div className={`relative z-10 font-black tabular-nums drop-shadow-md text-lg shrink-0 ${getRatingColor(ride.rating || 0)}`}>
                                                                        {ride.rating ? ride.rating.toFixed(1) : "—"}
                                                                    </div>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500 text-center py-4">No ride%s match your current filters.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 border border-dashed border-slate-800 rounded-3xl mx-4 md:mx-0">
                                    <p className="text-slate-400 font-medium">No models found.</p>
                                    <p className="text-slate-600 text-sm mt-1">Try adjusting your search or filters.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="hidden md:flex items-center justify-center h-full text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl m-8">
                        Select a manufacturer to view their portfolio
                    </div>
                )}
            </main>

            {/* Admin Create Modal Component */}
            {isAdminMode && (
                <CreatorModal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseModal}
                    manufacturers={manufacturers}
                    editItem={editItem}
                    editType={editType}
                />
            )}
        </div>
    );
}