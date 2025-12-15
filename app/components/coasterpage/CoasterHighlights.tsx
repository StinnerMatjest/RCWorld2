// @/app/components/coasterpage/CoasterHighlightsPanel.tsx

import React from "react";
import { RollerCoasterHighlights } from "@/app/types"; 
import { ChevronUp, ChevronsUp, Minus,  ChevronDown, ChevronsDown} from 'lucide-react'; 

interface CoasterHighlightsPanelProps {
    highlights: RollerCoasterHighlights[]; 
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
        // Text: Elite Blue | Bg: Stronger Blue
        color: "text-[#1D4ED8] dark:text-[#60A5FA]", 
        bg: "bg-blue-100 dark:bg-blue-900/50",
        icon: <TripleArrowUp />
    },
    "positive": { 
        rank: 2, 
        // Text: Great Green | Bg: Stronger Green
        color: "text-[#16A34A] dark:text-[#4ADE80]", 
        bg: "bg-green-100 dark:bg-green-900/50",
        icon: <ChevronUp className="w-6 h-6" />
    },
    "neutral": { 
        rank: 3, 
        // Text: Decent Yellow | Bg: Stronger Yellow
        color: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-900/50",
        icon: <Minus className="w-6 h-6 font-bold" />
    },
    "negative": { 
        rank: 4, 
        // Text: Below Avg Orange | Bg: Stronger Orange
        color: "text-orange-700 dark:text-orange-400", 
        bg: "bg-orange-100 dark:bg-orange-900/50",
        icon: <ChevronDown className="w-6 h-6" />
    },
    "very negative": { 
        rank: 5, 
        // Text: Very Poor Red | Bg: Stronger Red
        color: "text-red-700 dark:text-red-400", 
        bg: "bg-red-100 dark:bg-red-900/50",
        icon: <TripleArrowDown />
    }
};

const CoasterHighlightsPanel: React.FC<CoasterHighlightsPanelProps> = ({ highlights }) => {
    if (!highlights || highlights.length === 0) {
        return (
            <div className="text-gray-500 dark:text-gray-500 text-sm italic py-2 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                No strengths or Weaknesses have been added for this coaster yet.
            </div>
        );
    }

    // Sort highlights: Best -> Worst
    const sortedHighlights = [...highlights].sort((a, b) => {
        const rankA = SEVERITY_CONFIG[a.severity.toLowerCase()]?.rank || 99;
        const rankB = SEVERITY_CONFIG[b.severity.toLowerCase()]?.rank || 99;
        return rankA - rankB;
    });

    return (
        <div className="overflow-hidden border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <table className="min-w-full">
                <tbody>
                    {sortedHighlights.map((h, index) => {
                        const config = SEVERITY_CONFIG[h.severity.toLowerCase()] || SEVERITY_CONFIG["neutral"];
                        
                        return (
                            <tr 
                                key={index} 
                                className={`transition-colors border-b-2 border-white dark:border-gray-950 last:border-0 ${config.bg}`}
                            > 
                                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100 w-full">
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
    );
};

export default CoasterHighlightsPanel;