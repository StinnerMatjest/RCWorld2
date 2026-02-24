"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { RollerCoasterSpecs } from "@/app/types";

interface CoasterSpecsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedSpecs: RollerCoasterSpecs) => void;
    initialSpecs: RollerCoasterSpecs | null | undefined;
    coasterId: number;
}

const TAG_CATEGORIES = {
    "Seating": {
        tags: ["Sit Down", "Inverted", "Wing", "Floorless", "Flying", "Suspended"],
        isSingleChoice: true 
    },
        "Type": {
        tags: ["Spinning", "Shuttle", "Racing", "Powered", "Bobsled"],
        isSingleChoice: false
    },
        "Height Class": {
        tags: ["Mega", "Hyper", "Giga", "Strata", "Exa"],
        isSingleChoice: true
    },
    "Launch System": {
        tags: ["Launched", "Multi-Launched", "Swing Launch"],
        isSingleChoice: false
    },
        "Misc & Layout": {
        tags: ["Enclosed", "Zyklon", "Wild Mouse", "Jungle Mouse", "Möbius"],
        isSingleChoice: false
    },
};

const MATERIAL_OPTIONS = ["Steel", "Wood", "Hybrid"];

const CoasterSpecsModal: React.FC<CoasterSpecsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialSpecs,
    coasterId,
}) => {
    const [formData, setFormData] = useState<Partial<RollerCoasterSpecs>>({});
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Block scrolling on body when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        // Cleanup on unmount
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialSpecs || {});
            const existingTags = initialSpecs?.classification 
                ? initialSpecs.classification.split("|").map(t => t.trim()).filter(Boolean)
                : [];
            setSelectedTags(existingTags);
        }
    }, [isOpen, initialSpecs]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: string | number | null = value;
        if (type === "number") {
            finalValue = value === "" ? null : parseFloat(value);
        }
        setFormData((prev) => ({ ...prev, [name]: finalValue }));
    };

    const toggleTag = useCallback((tag: string, categoryKey: string) => {
        const category = TAG_CATEGORIES[categoryKey as keyof typeof TAG_CATEGORIES];
        
        setSelectedTags(prev => {
            const isAlreadySelected = prev.includes(tag);

            if (category.isSingleChoice) {
                const filtered = prev.filter(t => !category.tags.includes(t));
                return isAlreadySelected ? filtered : [...filtered, tag];
            } else {
                return isAlreadySelected ? prev.filter(t => t !== tag) : [...prev, tag];
            }
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const finalData = {
            ...formData,
            classification: selectedTags.join(" | ")
        };

        try {
            const res = await fetch(`/api/coasters/${coasterId}/specs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalData),
            });

            if (!res.ok) throw new Error("Failed to save");

            const data = await res.json();
            onSave(data.specs);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-white dark:bg-gray-950 rounded-none w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-8 md:p-10 overflow-y-auto flex-1 custom-scrollbar">
                        <header className="mb-10">
                            <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase italic tracking-tighter leading-none">
                                Edit Specs
                            </h2>
                            <p className="text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                                Data Configuration
                            </p>
                        </header>

                        {/* TAGS SECTION */}
                        <div className="mb-12 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                                {Object.entries(TAG_CATEGORIES).map(([categoryName, data]) => (
                                    <div key={categoryName} className="flex flex-col">
                                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-gray-800 pb-1 mb-2">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                                                {categoryName}
                                            </h4>
                                            {data.isSingleChoice && (
                                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter leading-none">
                                                    Single Selection
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {data.tags.map(tag => {
                                                const isSelected = selectedTags.includes(tag);
                                                return (
                                                  <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => toggleTag(tag, categoryName)}
                                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-2 ${
                                                      isSelected 
                                                      ? "bg-blue-600 border-blue-600 text-white" 
                                                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-500"
                                                    }`}
                                                  >
                                                    {tag}
                                                  </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* INPUT FIELDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            <div className="flex flex-col">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Type</label>
                                <div className="relative">
                                    <select
                                        name="type"
                                        value={formData.type || ""}
                                        onChange={handleChange}
                                        className="w-full rounded-none border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-xs font-bold focus:border-blue-600 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Type</option>
                                        {MATERIAL_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 7.343 8.172 5.929 9.586l3.364 3.364z"/></svg>
                                    </div>
                                </div>
                            </div>

                            <Input label="Length (ft)" name="length" value={formData.length} onChange={handleChange} />
                            <Input label="Height (ft)" name="height" value={formData.height} onChange={handleChange} />
                            <Input label="Drop (ft)" name="drop" value={formData.drop} onChange={handleChange} />
                            <Input label="Speed (mph)" name="speed" value={formData.speed} onChange={handleChange} />
                            <Input label="Inversions" name="inversions" value={formData.inversions} onChange={handleChange} />
                            <Input label="Angle of descent (°)" name="verticalAngle" value={formData.verticalAngle} onChange={handleChange} />
                            <Input label="G-Force" name="gforce" value={formData.gforce} onChange={handleChange} />
                            <Input label="Duration (s)" name="duration" value={formData.duration} onChange={handleChange} />
                        </div>

                        <div className="mt-10">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Notes</label>
                            <textarea
                                name="notes"
                                rows={3}
                                className="w-full rounded-none border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 text-sm font-medium focus:border-blue-600 outline-none transition-all resize-none"
                                value={formData.notes || ""}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="p-8 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-xs font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-[0.2em] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-10 py-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all uppercase tracking-[0.2em] rounded-none cursor-pointer"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Input = ({ label, name, value, onChange, type = "number", step = "0.1" }: any) => (
    <div className="flex flex-col">
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
        <input
            type={type}
            step={step}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            className="w-full rounded-none border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 text-xs font-bold focus:border-blue-600 outline-none transition-all"
        />
    </div>
);

export default CoasterSpecsModal;