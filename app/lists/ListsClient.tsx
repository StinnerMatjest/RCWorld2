"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useAdminMode } from "@/app/context/AdminModeContext";

interface RankingListSummary {
    id: number;
    slug: string;
    title: string;
    introText: string;
    createdAt: string;
    imageUrl?: string;
    published: boolean;
    needsReview?: boolean;
    reviewReason?: string;
}

const RankingsPage = ({ initialLists }: { initialLists?: RankingListSummary[] }) => {
    const [lists, setLists] = useState<RankingListSummary[]>(initialLists ?? []);
    const [isLoading, setIsLoading] = useState(initialLists === undefined);
    const [error, setError] = useState<string | null>(null);
    const { isAdminMode } = useAdminMode();

    useEffect(() => {
        if (initialLists !== undefined) return;

        const fetchLists = async () => {
            try {
                const response = await fetch("/api/lists");
                if (!response.ok) throw new Error("Failed to fetch lists");
                const data = await response.json();
                setLists(data.rankingLists || []);
            } catch (err) {
                console.error(err);
                setError("Could not load the ranking lists.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLists();
    }, [initialLists]);

    // Filter lists: Admins see everything, normal users only see published lists
    const visibleLists = isAdminMode ? lists : lists.filter(list => list.published);

    if (isLoading) return <LoadingSpinner />;

    if (error && lists.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0f172a]">
                <span className="text-4xl">📋</span>
                <p className="text-slate-300 font-semibold">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden border-b border-slate-800 px-4 sm:px-8 py-12 md:py-20">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight tracking-tight">
                        <span className="text-brand">Parkrating</span> Lists
                    </h1>
                    <p className="text-slate-400 text-base sm:text-lg max-w-4xl leading-relaxed md:leading-loose">
                        This is where you will find our curated lists for rankings of rollercoasters, water rides, dark rides, flat rides, parks, countries and so much more! New lists will get created over time,
                        as we visit more countries and parks and try out more coasters and attractions. We will also make sure to update existing lists so that they always represent our current opinions as accurately
                        as possible!
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

                {/* Admin Actions */}
                {isAdminMode && (
                    <div className="flex justify-end mb-8">
                        <Link
                            href="/lists/create"
                            className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-white font-bold transition-colors shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Create New List
                        </Link>
                    </div>
                )}

                {/* Grid or Empty State */}
                {visibleLists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-slate-900/50 rounded-3xl border border-slate-800/60 relative overflow-hidden group shadow-2xl">
                        {/* Ambient Background Glows */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                            <div className="w-72 h-72 bg-brand rounded-full blur-[100px] group-hover:scale-110 transition-transform duration-1000 ease-out" />
                            <div className="w-72 h-72 bg-blue-600 rounded-full blur-[100px] -ml-20 group-hover:scale-110 transition-transform duration-1000 delay-150 ease-out" />
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                            {/* Animated Icon Container */}
                            <div className="w-20 h-20 mb-8 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 shadow-xl relative">
                                <span className="text-4xl animate-bounce" style={{ animationDuration: '3s' }}>🎢</span>
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-brand rounded-full animate-ping opacity-75" />
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-brand rounded-full" />
                            </div>

                            {/* Typography */}
                            <h3 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                                Epic Rankings are <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-blue-400">Brewing</span>
                            </h3>
                            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
                                We are busy debating, ranking, and writing up some theme park lists for you that will be dropping very soon!
                            </p>

                            {/* Teaser Pill */}
                            <div className="mt-8 px-5 py-2.5 rounded-full bg-slate-800/80 border border-slate-700 text-sm font-bold text-slate-300 flex items-center gap-2.5 backdrop-blur-sm">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                Check back soon
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {visibleLists.map((list) => (
                            <Link
                                key={list.id}
                                href={`/lists/${list.slug}`}
                                className="group relative flex flex-col bg-slate-900 rounded-2xl border border-slate-800 hover:border-brand/50 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(var(--brand-rgb),0.05)] min-h-[320px]"
                            >
                                {/* Admin Draft Badge */}
                                {!list.published && isAdminMode && (
                                    <div className="absolute top-4 right-4 z-20 bg-amber-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md shadow-lg">
                                        Draft
                                    </div>
                                )}

                                {/* Admin Needs Review Badge */}
                                {list.needsReview && isAdminMode && (
                                    <div className="absolute top-4 left-4 z-20 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md shadow-lg border border-red-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        Needs Review
                                    </div>
                                )}

                                {/* Image Header */}
                                {list.imageUrl ? (
                                    <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-800">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={list.imageUrl}
                                            alt={list.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                                    </div>
                                ) : (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-800 via-brand to-slate-800 opacity-50 group-hover:opacity-100 transition-opacity" />
                                )}

                                <div className="p-6 md:p-8 flex flex-col flex-grow relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                                            Ranking
                                        </span>
                                        {list.createdAt && (
                                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                                {new Date(list.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                                            </span>
                                        )}
                                    </div>

                                    <h2 className="text-2xl font-black text-white mb-3 group-hover:text-brand transition-colors leading-tight">
                                        {list.title}
                                    </h2>

                                    <p className="text-slate-400 text-sm leading-relaxed flex-grow line-clamp-3 mb-8">
                                        {list.introText}
                                    </p>

                                    <div className="mt-auto flex items-center gap-2 text-sm font-bold text-slate-300 group-hover:text-brand transition-colors">
                                        Read List
                                        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Ambient background glow on hover */}
                                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-brand/10 blur-[60px] group-hover:bg-brand/20 transition-colors pointer-events-none rounded-full" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RankingsPage;