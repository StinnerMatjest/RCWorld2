"use client";

import React, { useState, useEffect } from "react";
import type { RollerCoasterHighlights } from "@/app/types";
import { Trash2, Plus, ChevronDown } from "lucide-react";

interface CoasterHighlightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (highlights: RollerCoasterHighlights[]) => void;
    initialHighlights: RollerCoasterHighlights[];
    coasterId: number;
}

// 1. Config for Ranking & Colors
const SEVERITY_CONFIG: Record<string, { rank: number; color: string; bg: string; border: string }> = {
    "very positive": { 
        rank: 1,
        color: "text-blue-700 dark:text-blue-400", 
        bg: "bg-blue-50 dark:bg-blue-900/20",
        border: "border-blue-200 dark:border-blue-800"
    },
    "positive": { 
        rank: 2,
        color: "text-green-700 dark:text-green-400", 
        bg: "bg-green-50 dark:bg-green-900/20",
        border: "border-green-200 dark:border-green-800"
    },
    "neutral": { 
        rank: 3,
        color: "text-yellow-700 dark:text-yellow-400", 
        bg: "bg-yellow-50 dark:bg-yellow-900/20",
        border: "border-yellow-200 dark:border-yellow-800"
    },
    "negative": { 
        rank: 4,
        color: "text-orange-700 dark:text-orange-400", 
        bg: "bg-orange-50 dark:bg-orange-900/20",
        border: "border-orange-200 dark:border-orange-800"
    },
    "very negative": { 
        rank: 5,
        color: "text-red-700 dark:text-red-400", 
        bg: "bg-red-50 dark:bg-red-900/20",
        border: "border-red-200 dark:border-red-800"
    }
};

const SEVERITY_OPTIONS = [
    "very positive",
    "positive",
    "neutral",
    "negative",
    "very negative"
];

const CoasterHighlightsModal: React.FC<CoasterHighlightsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialHighlights,
    coasterId,
}) => {
    const [items, setItems] = useState<RollerCoasterHighlights[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // 1. Normalize (lowercase)
            let loadedItems = (initialHighlights || []).map(item => ({
                ...item,
                severity: item.severity.toLowerCase()
            }));

            // 2. SORT (Best -> Worst)
            // If you want Worst -> Best, swap to: return rankB - rankA
            loadedItems.sort((a, b) => {
                const rankA = SEVERITY_CONFIG[a.severity]?.rank || 99;
                const rankB = SEVERITY_CONFIG[b.severity]?.rank || 99;
                return rankA - rankB; // Rank 1 (Best) comes first
            });

            setItems(loadedItems);
        }
    }, [isOpen, initialHighlights]);

    const handleAddRow = () => {
        setItems([...items, { category: "", severity: "positive" } as any]);
    };

    const handleRemoveRow = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleChange = (index: number, field: keyof RollerCoasterHighlights, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/coasters/${coasterId}/highlights`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(items),
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.details || data.error || "Failed to save");
            }

            onSave(data.highlights);
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Strengths & Weaknesses</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {items.length === 0 && (
                        <p className="text-sm text-gray-400 italic text-center py-4">No items added yet.</p>
                    )}
                    
                    {items.map((item, index) => {
                        // Safe lookup for styling
                        const style = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG["neutral"];

                        return (
                            <div key={index} className="flex gap-2 items-center">
                                {/* Category Input */}
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="e.g. Airtime, Rattle..."
                                        className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                        value={item.category}
                                        onChange={(e) => handleChange(index, "category", e.target.value)}
                                    />
                                </div>

                                {/* Colored Dropdown */}
                                <div className="w-36 relative">
                                    <select
                                        className={`w-full appearance-none rounded border p-2 pl-3 pr-8 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer transition-colors
                                            ${style.bg} ${style.color} ${style.border}`}
                                        value={item.severity}
                                        onChange={(e) => handleChange(index, "severity", e.target.value)}
                                    >
                                        {SEVERITY_OPTIONS.map(opt => (
                                            <option key={opt} value={opt} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className={`absolute right-2 top-2.5 w-4 h-4 pointer-events-none opacity-50 ${style.color}`} />
                                </div>

                                {/* Delete */}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveRow(index)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer"
                                    title="Remove item"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={handleAddRow}
                        className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 mt-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                </div>

                <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoasterHighlightsModal;