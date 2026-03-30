"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ListItem from "@/app/components/listpage/ListItem";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import MainPageButton from "@/app/components/buttons/MainPageButton";
import { useAdminMode } from "@/app/context/AdminModeContext";
import type { RankingList } from "@/app/types";

const RankingArticlePage: React.FC = () => {
    const { slug } = useParams();
    const [rankingList, setRankingList] = useState<RankingList | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { isAdminMode } = useAdminMode();

    useEffect(() => {
        window.scrollTo(0, 0);

        const fetchRankingList = async () => {
            try {
                const res = await fetch(`/api/lists/${slug}`);
                if (!res.ok) throw new Error("Failed to fetch ranking list");
                const data = await res.json();
                setRankingList(data.rankingList);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        if (slug) fetchRankingList();
    }, [slug]);

    if (isLoading) return <LoadingSpinner />;
    if (!rankingList) return <div className="text-center py-20">List not found.</div>;

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f172a] font-sans pb-20">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">

                {/* Article Header */}
                <div className="mb-16 text-center border-b border-gray-200 dark:border-gray-800 pb-10 relative">

                    {/* Edit Button */}
                    {isAdminMode && (
                        <div className="fixed bottom-15 right-8 z-50">
                            <Link
                                href={`/lists/create?edit=${rankingList.slug}`}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit List
                            </Link>
                        </div>
                    )}
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6 mt-8 md:mt-0">
                        {rankingList.title}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl mx-auto">
                        {rankingList.introText}
                    </p>
                </div>

                {/* The Ranking Items */}
                <div className="space-y-4">
                    {rankingList.items
                        // Display Order
                        .sort((a, b) => a.rank - b.rank)
                        .map((item) => (
                            <ListItem key={item.id} item={item} />
                        ))}
                </div>

                {/* Back Button */}
                <div className="flex justify-center mt-12 pt-8">
                    <MainPageButton />
                </div>
            </div>
        </div>
    );
};

export default RankingArticlePage;