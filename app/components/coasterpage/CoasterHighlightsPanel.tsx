"use client";

import React, { useState, useEffect } from "react";
import { RollerCoasterHighlights } from "@/app/types";
import { ChevronUp, ChevronsUp, Minus, ChevronDown, ChevronsDown } from 'lucide-react';
import CoasterHighlightsModal from "./CoasterHighlightsModal";
import { useAdminMode } from "@/app/context/AdminModeContext";

interface CoasterHighlightsPanelProps {
    highlights: RollerCoasterHighlights[];
    coasterId: number;
}

const TripleArrowUp = () => (
    <div className="flex flex-col items-center -space-y-3">
        <ChevronUp className="w-5 h-5" />
        <ChevronsUp className="w-5 h-5" />
    </div>
);

const TripleArrowDown = () => (
    <div className="flex flex-col items-center -space-y-3">
        <ChevronsDown className="w-5 h-5" />
        <ChevronDown className="w-5 h-5" />
    </div>
);

const SEVERITY_CONFIG: Record<string, { rank: number; color: string; bg: string; icon: React.ReactNode }> = {
    "very positive": {
        rank: 1,
        color: "text-[#60A5FA]",
        bg: "bg-blue-900/50",
        icon: <TripleArrowUp />
    },
    "positive": {
        rank: 2,
        color: "text-[#4ADE80]",
        bg: "bg-green-900/50",
        icon: <ChevronUp className="w-6 h-6" />
    },
    "neutral": {
        rank: 3,
        color: "text-yellow-400",
        bg: "bg-yellow-900/50",
        icon: <Minus className="w-6 h-6 font-bold" />
    },
    "negative": {
        rank: 4,
        color: "text-orange-400",
        bg: "bg-orange-900/50",
        icon: <ChevronDown className="w-6 h-6" />
    },
    "very negative": {
        rank: 5,
        color: "text-red-400",
        bg: "bg-red-900/50",
        icon: <TripleArrowDown />
    }
};

const CoasterHighlightsPanel: React.FC<CoasterHighlightsPanelProps> = ({ highlights: initialHighlights, coasterId }) => {
    const [highlights, setHighlights] = useState<RollerCoasterHighlights[]>(initialHighlights || []);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isAdminMode } = useAdminMode();

    useEffect(() => {
        setHighlights(initialHighlights || []);
    }, [initialHighlights]);

    const handleSave = (newHighlights: RollerCoasterHighlights[]) => {
        setHighlights(newHighlights);
    };

    const sortedHighlights = [...highlights].sort((a, b) => {
        const rankA = SEVERITY_CONFIG[a.severity.toLowerCase()]?.rank || 99;
        const rankB = SEVERITY_CONFIG[b.severity.toLowerCase()]?.rank || 99;
        return rankA - rankB;
    });

    const isEmpty = highlights.length === 0;

    return (
        <div className="relative group">
            {/* Admin Edit Button */}
            {isAdminMode && (
                <div className="absolute -top-10 right-0">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                        title="Edit Highlights"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Empty State */}
            {isEmpty ? (
                <div className="text-slate-500 text-sm italic py-2 border rounded-lg p-4 bg-slate-900 border-slate-800">
                    {isAdminMode
                        ? "No highlights yet. Click the edit icon to add some!"
                        : "No strengths or weaknesses have been added for this coaster yet."}
                </div>
            ) : (
                <div className="overflow-hidden border border-slate-800 rounded-xl shadow-sm">
                    <table className="min-w-full">
                        <tbody>
                            {sortedHighlights.map((h, index) => {
                                const config = SEVERITY_CONFIG[h.severity.toLowerCase()] || SEVERITY_CONFIG["neutral"];

                                return (
                                    <tr
                                        key={index}
                                        className={`transition-colors border-b-2 border-[#0f172a] last:border-0 ${config.bg}`}
                                    >
                                        <td className="px-4 py-3 text-sm font-bold text-slate-100 w-full">
                                            {h.category}
                                        </td>

                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 ${config.color}`}>
                                                {config.icon}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Injection */}
            <CoasterHighlightsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialHighlights={highlights}
                coasterId={coasterId}
            />
        </div>
    );
};

export default CoasterHighlightsPanel;