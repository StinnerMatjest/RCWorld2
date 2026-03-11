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
}

const RankingsPage = () => {
    const [lists, setLists] = useState<RankingListSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isAdminMode } = useAdminMode();

    useEffect(() => {
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
    }, []);

    if (isLoading) return <LoadingSpinner />;
    if (error) return <div className="text-center py-20 text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] py-12 px-6">
            <div className="max-w-6xl mx-auto">

                {/* Page Header */}
                <div className="mb-12 text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4">
                        Parkrating's Curated Lists & Rankings
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        This is where we post rankings and lists of all types of themepark-related content such as best parks, coasters, waterrides, darkrides, flatrides or even in-park rankings of attractions.
                    </p>
                </div>

                {isAdminMode && (
                    <div className="flex justify-center mb-10">
                        <Link
                            href="/lists/create"
                            className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-md transition-colors"
                        >
                            + Create New List
                        </Link>
                    </div>
                )}

                {/* Grid of Lists */}
                {lists.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-10">
                        No lists available yet. Check back soon!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {lists.map((list) => (
                            <Link
                                key={list.id}
                                href={`/lists/${list.slug}`}
                                className="group flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="p-6 flex flex-col flex-grow">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {list.title}
                                    </h2>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed flex-grow line-clamp-3">
                                        {list.introText}
                                    </p>
                                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                                            Read List
                                        </span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RankingsPage;