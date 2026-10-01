"use client";

import React, { useState, useEffect } from "react";
import type { RollerCoasterHighlights } from "@/app/types";
import { Trash2, Plus, ChevronDown } from "lucide-react";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface CoasterHighlightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (highlights: RollerCoasterHighlights[]) => void;
    initialHighlights: RollerCoasterHighlights[];
    coasterId: number;
}

type LocalHighlight = RollerCoasterHighlights & { _localId: string };

// Config for Ranking & Colors
const SEVERITY_CONFIG: Record<string, { rank: number; color: string; bg: string; border: string }> = {
    "very positive": { rank: 1, color: " text-blue-400", bg: " bg-blue-900/20", border: " border-blue-800" },
    "positive": { rank: 2, color: " text-green-400", bg: " bg-green-900/20", border: " border-green-800" },
    "neutral": { rank: 3, color: " text-yellow-400", bg: " bg-yellow-900/20", border: " border-yellow-800" },
    "negative": { rank: 4, color: " text-orange-400", bg: " bg-orange-900/20", border: " border-orange-800" },
    "very negative": { rank: 5, color: " text-red-400", bg: " bg-red-900/20", border: " border-red-800" }
};

const SEVERITY_OPTIONS = ["very positive", "positive", "neutral", "negative", "very negative"];

const CoasterHighlightsModal: React.FC<CoasterHighlightsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialHighlights,
    coasterId,
}) => {
    useScrollLock(isOpen);
    const [items, setItems] = useState<LocalHighlight[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            let loadedItems = (initialHighlights || []).map(item => ({
                ...item,
                severity: item.severity.toLowerCase(),
                _localId: Math.random().toString(36).substr(2, 9) // Stable key generation
            }));

            loadedItems.sort((a, b) => {
                const rankA = SEVERITY_CONFIG[a.severity]?.rank || 99;
                const rankB = SEVERITY_CONFIG[b.severity]?.rank || 99;
                return rankA - rankB;
            });

            setItems(loadedItems);
        }
    }, [isOpen, initialHighlights]);

    const handleAddRow = () => {
        setItems([...items, { category: "", severity: "positive", _localId: Math.random().toString(36).substr(2, 9) } as any]);
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
            // Strip the _localId before sending to the backend
            const cleanItems = items.map(({ _localId, ...rest }) => rest);

            const res = await fetch(`/api/coasters/${coasterId}/highlights`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cleanItems),
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
        // Performance Fix: bg-black/90 instead of backdrop-blur
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h2 className="text-xl font-black text-white uppercase tracking-wide">Edit Highs & Lows</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950">
                    {items.length === 0 && (
                        <p className="text-sm text-slate-500 font-medium text-center py-10">No items added yet. Click below to add one.</p>
                    )}

                    {items.map((item, index) => {
                        const style = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG["neutral"];

                        return (
                            // Using the stable _localId completely eliminates input lag
                            <div key={item._localId} className="flex flex-col sm:flex-row gap-3 items-center bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
                                {/* Category Input */}
                                <div className="flex-1 w-full">
                                    <input
                                        type="text"
                                        placeholder="e.g. Airtime, Rattle..."
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-sm font-medium focus:ring-1 focus:ring-brand focus:border-brand outline-none text-white placeholder-slate-500 transition-colors"
                                        value={item.category}
                                        onChange={(e) => handleChange(index, "category", e.target.value)}
                                    />
                                </div>

                                {/* Colored Dropdown */}
                                <div className="w-full sm:w-44 relative flex-shrink-0">
                                    <select
                                        className={`w-full appearance-none rounded-lg border p-2.5 pl-3 pr-8 text-sm font-bold focus:ring-1 focus:ring-brand focus:border-brand outline-none cursor-pointer transition-colors shadow-inner
                                            ${style.bg} ${style.color} ${style.border}`}
                                        value={item.severity}
                                        onChange={(e) => handleChange(index, "severity", e.target.value)}
                                    >
                                        {SEVERITY_OPTIONS.map(opt => (
                                            <option key={opt} value={opt} className="bg-slate-800 text-white font-medium">
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className={`absolute right-3 top-3 w-4 h-4 pointer-events-none opacity-75 ${style.color}`} />
                                </div>

                                {/* Delete */}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveRow(index)}
                                    className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer w-full sm:w-auto flex justify-center"
                                    title="Remove item"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={handleAddRow}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-slate-700 text-sm text-slate-400 font-bold hover:text-brand hover:border-brand/50 hover:bg-brand/5 mt-4 transition-colors cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                </div>

                <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-black text-white bg-brand hover:bg-brand-light shadow-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer uppercase tracking-wider"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoasterHighlightsModal;