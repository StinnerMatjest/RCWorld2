"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Park, ChecklistItem } from "@/app/types";

export default function CreateChecklistModal({ parks }: { parks: Park[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedParkId, setSelectedParkId] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    async function handleCreate() {
        if (!selectedParkId) return;
        setIsGenerating(true);

        try {
            const park = parks.find((p) => p.id.toString() === selectedParkId);
            if (!park) return;

            // 1. Fetch the coasters for this specific park
            const coasterRes = await fetch(`/api/park/${park.id}/coasters`);
            const fetchedCoasters = await coasterRes.json();
            let coasters = Array.isArray(fetchedCoasters) ? fetchedCoasters : [];
            coasters = Array.from(new Map(coasters.map((c) => [c.id, c])).values());

            // 2. Build the checklist items in the correct order
            const newItems: ChecklistItem[] = [];

            // A. Always first: Park Entrance
            newItems.push({
                id: "pic-entrance", label: "Take Picture of park entrance", checked: false, isPhotoTask: true
            });

            // B. Next: All Coasters
            coasters.forEach((coaster: any) => {
                newItems.push({
                    id: `pic-coaster-${coaster.id}`,
                    label: `Take picture of ${coaster.name}`,
                    checked: false,
                    isPhotoTask: true,
                    isCoaster: true,
                    rideCount: 0,
                });
            });

            // C. Next: Other photo tasks
            newItems.push(
                { id: "pic-log-flume", label: "Take picture of log flume", checked: false, isPhotoTask: true },
                { id: "pic-rapids", label: "Take picture of rapids ride", checked: false, isPhotoTask: true },
                { id: "pic-darkrides", label: "Take picture of all darkrides", checked: false, isPhotoTask: true },
                { id: "pic-flatrides", label: "Take picture of all major flatrides", checked: false, isPhotoTask: true },
                { id: "pic-food", label: "Take picture of food", checked: false, isPhotoTask: true },
                { id: "pic-drinks", label: "Take picture of drinks/snacks", checked: false, isPhotoTask: true },
                { id: "pic-inside-1", label: "Take inside park picture 1", checked: false, isPhotoTask: true },
                { id: "pic-inside-2", label: "Take inside park picture 2", checked: false, isPhotoTask: true },
                { id: "pic-inside-3", label: "Take inside park picture 3", checked: false, isPhotoTask: true }
            );

            // D. Always last: Buy a mug
            newItems.push({
                id: "buy-mug", label: "Buy a mug!", checked: false, isPhotoTask: false
            });

            // 4. Construct checklist payload with unique timestamp
            const timestamp = Date.now();
            const currentYear = new Date().getFullYear();
            const payload = {
                title: `${park.name} ${currentYear} Visit`,
                slug: `${park.slug}-visit-${timestamp}`,
                description: `The ultimate photo and ride checklist for ${park.name}.`,
                items: newItems,
                parkId: park.id,
            };

            // 5. Send to database
            const res = await fetch("/api/checklists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                setIsOpen(false);
                router.push(`/checklists/${data.slug}`);
                router.refresh();
            } else {
                console.error("Failed to create:", data.error);
            }
        } catch (err) {
            console.error("Error generating checklist:", err);
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="mb-8 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-transform hover:bg-emerald-400 active:scale-[0.98]"
            >
                + Generate New Park Checklist
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <h2 className="mb-4 text-xl font-bold text-slate-50">Select a Park</h2>

                        {/* Gallery Grid */}
                        <div className="mb-6 grid max-h-[50vh] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-3">
                            {parks.map((park) => {
                                const isSelected = selectedParkId === park.id.toString();
                                return (
                                    <button
                                        key={park.id}
                                        type="button"
                                        onClick={() => setSelectedParkId(park.id.toString())}
                                        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 text-left transition-all ${isSelected
                                            ? "border-emerald-500 ring-2 ring-emerald-500/50"
                                            : "border-slate-800 hover:border-slate-600"
                                            }`}
                                    >
                                        <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-slate-800">
                                            <img
                                                src={park.imagepath}
                                                alt={park.name}
                                                className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 ${isSelected ? "scale-105" : "group-hover:scale-105"
                                                    }`}
                                            />
                                            {isSelected && (
                                                <div className="absolute inset-0 z-10 bg-emerald-500/20" />
                                            )}
                                        </div>
                                        <div className="flex-1 bg-slate-950 p-3">
                                            <p className="truncate text-sm font-semibold text-slate-200">
                                                {park.name}
                                            </p>
                                            <p className="truncate text-[11px] text-slate-400">
                                                {park.country}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                                disabled={isGenerating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!selectedParkId || isGenerating}
                                className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                            >
                                {isGenerating ? "Generating..." : "Generate Checklist"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}