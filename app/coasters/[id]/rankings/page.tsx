"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trophy, MapPin, Factory, Calendar, Tag, ChevronRight, Hash } from "lucide-react";
import { RollerCoaster, ApiCoaster, Park } from "@/app/types";
import { StatBlock } from "@/app/components/coasterpage/CoasterRanking";
import { getCoasterRankInList, sortCoastersByRank } from "@/app/utils/ranking";
import Link from "next/link";

export default function DetailedRankingsPage() {
    const { id: coasterId } = useParams();
    const router = useRouter();
    const [coaster, setCoaster] = useState<RollerCoaster | null>(null);
    const [allCoasters, setAllCoasters] = useState<ApiCoaster[]>([]);
    const [park, setPark] = useState<Park | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewingCategory, setViewingCategory] = useState<{ label: string, list: ApiCoaster[] } | null>(null);

    const SIZE_THRESHOLD = 30;

    useEffect(() => {
        (async () => {
            try {
                const [cRes, allRes] = await Promise.all([
                    fetch(`/api/coasters/${coasterId}`),
                    fetch("/api/coasters")
                ]);
                const cData = await cRes.json();
                const allData = await allRes.json();

                setCoaster(cData.coaster);
                setAllCoasters(allData.coasters || []);

                if (cData.coaster?.parkId) {
                    const pRes = await fetch(`/api/park/${cData.coaster.parkId}`);
                    const pData = await pRes.json();
                    setPark(pData);
                }
            } catch (err) {
                console.error("Error fetching rankings data:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [coasterId]);

    const rankingResults = useMemo(() => {
        if (!coaster || !allCoasters.length || !coasterId) return [];

        const generateResult = (filterFn: (c: ApiCoaster) => boolean, label: string, icon: any, subLabel: string, queryValue?: string) => {
            const filteredList = allCoasters.filter(filterFn);
            const { rank, total } = getCoasterRankInList(filteredList, coasterId as string);

            if (rank === null) return null;

            return {
                label,
                rank,
                total,
                icon,
                subLabel,
                filteredList,
                isLarge: total > SIZE_THRESHOLD,
                queryValue: queryValue || subLabel
            };
        };

        // Core Rankings
        const baseResults = [
            generateResult(() => true, "Global Ranking", <Trophy />, "Worldwide", ""),
            generateResult(c => c.parkId === coaster.parkId, "Park Ranking", <MapPin />, park?.name || "This Park"),
            generateResult(c => c.manufacturer === coaster.manufacturer, "Manufacturer", <Factory />, coaster.manufacturer),
            generateResult(c => !!c.model && c.model === coaster.model, "Model Ranking", <Tag />, coaster.model || "Same Model"),
            generateResult(c => c.year === coaster.year, "Class of " + coaster.year, <Calendar />, String(coaster.year)),

            // Type Ranking
            coaster.specs?.type ? generateResult(
                (c) => (c as any).specs?.type === coaster.specs?.type,
                "Material Ranking",
                <Hash />,
                coaster.specs.type
            ) : null,
        ].filter(Boolean);

        // Tags Ranking
        const currentClassification = coaster.specs?.classification || "";
        const tags = currentClassification.split("|").map(t => t.trim()).filter(Boolean);

        const tagResults = tags.map(tag => {
            return generateResult(
                (c: any) => {
                    const targetClass = c.specs?.classification || "";
                    const targetTags = targetClass.split("|").map((t: string) => t.trim());
                    return targetTags.includes(tag);
                },
                "Tag Ranking",
                <Hash />,
                tag
            );
        }).filter(Boolean);

        return [...baseResults, ...tagResults];
    }, [coaster, allCoasters, coasterId, park]);

    const handleRankClick = (res: any) => {
        if (res.isLarge) {
            const path = res.label === "Global Ranking"
                ? "/coasterratings"
                : `/coasterratings?q=${encodeURIComponent(res.queryValue)}`;
            router.push(path);
        } else {
            setViewingCategory({
                label: `${res.label}: ${res.subLabel}`,
                list: sortCoastersByRank(res.filteredList) as ApiCoaster[]
            });
        }
    };

    if (loading || !coaster) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Analyzing Rankings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 font-sans">
            <div className="max-w-4xl mx-auto px-4 pt-12">
                <button
                    onClick={() => {
                        if (viewingCategory) {
                            setViewingCategory(null);
                        } else {
                            router.push(`/coasters/${coasterId}`);
                        }
                    }}
                    className="group flex items-center text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white mb-8 transition-colors uppercase tracking-widest"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    {viewingCategory ? "Back to Overview" : `Back to ${coaster.name}`}
                </button>

                {!viewingCategory ? (
                    <>
                        <header className="mb-12 border-b border-gray-200 dark:border-gray-800 pb-8">
                            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter mb-2 leading-none">
                                {coaster.name}
                            </h1>
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-bold uppercase tracking-[0.2em]">
                                Detailed Standings
                            </p>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {rankingResults.map((res: any, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => handleRankClick(res)}
                                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 md:p-8 rounded-[2rem] flex justify-between items-center shadow-sm hover:border-blue-500 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            {React.cloneElement(res.icon, { size: 24, strokeWidth: 2.5 })}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-400 text-[10px] uppercase tracking-widest mb-0.5">
                                                {res.label}
                                            </h3>
                                            <p className="text-sm md:text-base font-bold text-gray-700 dark:text-gray-300 line-clamp-1">
                                                {res.subLabel}
                                            </p>
                                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                                                {res.isLarge ? "Open in Library" : "View Local List"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <StatBlock
                                            mainValue={res.rank}
                                            subValue={res.total}
                                            colorClass={
                                                res.rank === 1 ? "text-yellow-500" :
                                                    res.rank === 2 ? "text-gray-400" :
                                                        res.rank === 3 ? "text-orange-500" :
                                                            "text-gray-900 dark:text-white"
                                            }
                                        />
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <header className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
                            <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-blue-600 dark:text-blue-400">
                                {viewingCategory.label}
                            </h2>
                            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">
                                Displaying {viewingCategory.list.length} Coasters
                            </p>
                        </header>
                        <div className="space-y-3">
                            {viewingCategory.list.map((c: ApiCoaster, i: number) => (
                                <Link
                                    href={`/coasters/${c.id}`}
                                    key={c.id}
                                    className={`flex items-center justify-between p-4 md:p-6 rounded-2xl border transition-all ${String(c.id) === String(coasterId)
                                        ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.02] z-10"
                                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-400"
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={`text-xl md:text-2xl font-black italic w-10 ${String(c.id) === String(coasterId) ? "text-blue-200" : "text-gray-300"
                                            }`}>
                                            #{i + 1}
                                        </span>
                                        <div>
                                            <p className="font-bold uppercase tracking-tight text-sm md:text-base">
                                                {c.name}
                                            </p>
                                            <p className={`text-[10px] md:text-xs uppercase font-bold tracking-widest ${String(c.id) === String(coasterId) ? "text-blue-100" : "text-gray-500"
                                                }`}>
                                                {c.manufacturer} • {c.year}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {String(c.id) === String(coasterId) && (
                                            <span className="bg-white text-blue-600 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                                                Current
                                            </span>
                                        )}
                                        <div className="font-black text-xl md:text-2xl italic">
                                            {c.rating ? Number(c.rating).toFixed(1) : "—"}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}