"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Park, ChecklistItem } from "@/app/types";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function CreateChecklistModal({ parks }: { parks: Park[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();
    const [mode, setMode] = useState<"select" | "park-name" | "coasters">("select");
    const [selectedParkId, setSelectedParkId] = useState<string>("");
    const [newParkName, setNewParkName] = useState("");
    const [newCoasters, setNewCoasters] = useState<string[]>([""]);

    const resetModal = () => {
        setMode("select");
        setSelectedParkId("");
        setNewParkName("");
        setNewCoasters([""]);
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(resetModal, 300);
    };

    async function handleCreateExistingPark() {
        if (!selectedParkId) return;
        setIsGenerating(true);

        try {
            const park = parks.find((p) => p.id.toString() === selectedParkId);
            if (!park) return;

            // Fetch coasters for park
            const coasterRes = await fetch(`/api/park/${park.id}/coasters`);
            const fetchedCoasters = await coasterRes.json();
            let coasters = Array.isArray(fetchedCoasters) ? fetchedCoasters : [];
            coasters = Array.from(new Map(coasters.map((c) => [c.id, c])).values());

            // Build checklist items in order
            const newItems: ChecklistItem[] = [];

            // Always first: Park Entrance
            newItems.push({
                id: "pic-entrance", label: "Park Entrance", checked: false, isPhotoTask: true
            });

            // Next: All Coasters
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

            // Next: Other photo tasks
            newItems.push(
                { id: "pic-waterrides",  label: "All waterrides",    checked: false, isPhotoTask: true },
                { id: "pic-flatrides",   label: "All flatrides",     checked: false, isPhotoTask: true },
                { id: "pic-darkrides",   label: "All darkrides",     checked: false, isPhotoTask: true },
                { id: "pic-food",        label: "Food",              checked: false, isPhotoTask: true },
                { id: "pic-drinks",      label: "Snacks/Drinks",     checked: false, isPhotoTask: true },
                { id: "pic-operations",  label: "Ride Operations",   checked: false, isPhotoTask: true },
                { id: "pic-park-1",      label: "Park appearance 1", checked: false, isPhotoTask: true },
                { id: "pic-park-2",      label: "Park appearance 2", checked: false, isPhotoTask: true },
                { id: "pic-park-3",      label: "Park appearance 3", checked: false, isPhotoTask: true }
            );

            // Always last: Buy a mug
            newItems.push({
                id: "buy-mug", label: "Buy a mug!", checked: false, isPhotoTask: false
            });

            // Construct checklist payload with unique timestamp
            const timestamp = Date.now();
            const currentYear = new Date().getFullYear();
            const payload = {
                title: `${park.name} ${currentYear} Visit`,
                slug: `${park.slug}-visit-${timestamp}`,
                description: `The ultimate photo and ride checklist for ${park.name}.`,
                items: newItems,
                parkId: park.id,
            };

            // Send to database
            const res = await fetch("/api/checklists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                handleClose();
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

    async function handleCreateNewPark() {
        if (!newParkName.trim()) return;
        setIsGenerating(true);

        try {
            const timestamp = Date.now();
            const slugBase = newParkName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            const uniqueParkSlug = `${slugBase}-${timestamp}`;

            // Create Barebones Park
            const parkPayload = {
                name: newParkName,
                continent: "Unknown",
                country: "Unknown",
                city: "Unknown",
                imagepath: "/images/error.PNG",
                slug: uniqueParkSlug
            };

            const parkRes = await fetch("/api/parks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parkPayload),
            });

            const parkData = await parkRes.json();
            if (!parkRes.ok) throw new Error(parkData.error || "Failed to create park");
            const newParkId = parkData.parkId;

            // Create Barebones Coasters
            const validCoasters = newCoasters.filter(name => name.trim() !== "");
            const createdCoasters = [];

            if (validCoasters.length > 0) {
                // Execute all coaster POST requests concurrently
                const coasterPromises = validCoasters.map(coasterName => {
                    return fetch(`/api/park/${newParkId}/coasters`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: coasterName,
                            year: new Date().getFullYear(),
                            manufacturer: "Unknown",
                            model: "Unknown",
                            scale: "Unknown",
                            haveridden: false,
                            isbestcoaster: false,
                            rcdbpath: "Unknown",
                            rating: 0,
                            rideCount: 0
                        })
                    }).then(res => res.json());
                });

                const results = await Promise.all(coasterPromises);
                createdCoasters.push(...results);
            }

            // Build Checklist payload
            const newItems: ChecklistItem[] = [];
            newItems.push({ id: "pic-entrance", label: "Take Picture of park entrance", checked: false, isPhotoTask: true });

            createdCoasters.forEach((coaster: any) => {
                newItems.push({
                    id: `pic-coaster-${coaster.id}`,
                    label: `Take picture of ${coaster.name}`,
                    checked: false,
                    isPhotoTask: true,
                    isCoaster: true,
                    rideCount: 0,
                });
            });

            newItems.push(
                { id: "pic-waterrides",  label: "All waterrides",    checked: false, isPhotoTask: true },
                { id: "pic-flatrides",   label: "All flatrides",     checked: false, isPhotoTask: true },
                { id: "pic-darkrides",   label: "All darkrides",     checked: false, isPhotoTask: true },
                { id: "pic-food",        label: "Food",              checked: false, isPhotoTask: true },
                { id: "pic-drinks",      label: "Snacks/Drinks",     checked: false, isPhotoTask: true },
                { id: "pic-operations",  label: "Ride Operations",   checked: false, isPhotoTask: true },
                { id: "pic-park-1",      label: "Park appearance 1", checked: false, isPhotoTask: true },
                { id: "pic-park-2",      label: "Park appearance 2", checked: false, isPhotoTask: true },
                { id: "pic-park-3",      label: "Park appearance 3", checked: false, isPhotoTask: true },
                { id: "buy-mug", label: "Buy a mug!", checked: false, isPhotoTask: false }
            );

            const currentYear = new Date().getFullYear();
            const checklistPayload = {
                title: `${newParkName} ${currentYear} Visit`,
                slug: `${uniqueParkSlug}-visit-${Date.now()}`,
                description: `The ultimate photo and ride checklist for ${newParkName}.`,
                items: newItems,
                parkId: newParkId,
            };

            const clRes = await fetch("/api/checklists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(checklistPayload),
            });

            const clData = await clRes.json();

            if (clRes.ok) {
                handleClose();
                router.push(`/checklists/${clData.slug}`);
                router.refresh();
            } else {
                throw new Error(clData.error || "Failed to create checklist");
            }
        } catch (err) {
            console.error("Error in new park wizard:", err);
            alert("An error occurred while creating the new park. Please check the console.");
        } finally {
            setIsGenerating(false);
        }
    }

    const updateCoaster = (index: number, val: string) => {
        const arr = [...newCoasters];
        arr[index] = val;
        setNewCoasters(arr);
    };

    const addCoasterField = () => {
        setNewCoasters([...newCoasters, ""]);
    };

    const removeCoasterField = (index: number) => {
        const arr = newCoasters.filter((_, i) => i !== index);
        setNewCoasters(arr.length ? arr : [""]);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="mb-8 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-transform hover:bg-emerald-400 active:scale-[0.98] cursor-pointer"
            >
                + Generate New Park Checklist
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    {isGenerating ? (
                        <LoadingSpinner className="!min-h-0 !pt-0 !bg-transparent dark:!bg-transparent" />
                    ) : (
                        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">

                            {/* --- MODE: SELECT --- */}
                            {mode === "select" && (
                                <>
                                    <h2 className="mb-4 text-xl font-bold text-slate-50">Select a Park</h2>
                                    <div className="mb-6 grid max-h-[50vh] grid-cols-2 gap-4 overflow-y-auto pr-2 sm:grid-cols-3 cursor-pointer">
                                        {/* New Barebones Park Option */}
                                        <button
                                            type="button"
                                            onClick={() => setMode("park-name")}
                                            className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10 text-left transition-all"
                                        >
                                            <div className="flex h-full w-full flex-col items-center justify-center p-4 min-h-[120px]">
                                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </div>
                                                <p className="text-center text-sm font-semibold text-emerald-400">
                                                    Create Draft Park
                                                </p>
                                            </div>
                                        </button>

                                        {/* Existing Parks */}
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
                                            onClick={handleClose}
                                            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateExistingPark}
                                            disabled={!selectedParkId}
                                            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                                        >
                                            Generate Checklist
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* --- MODE: NEW PARK NAME --- */}
                            {mode === "park-name" && (
                                <>
                                    <h2 className="mb-2 text-xl font-bold text-slate-50">Create Draft Park</h2>
                                    <p className="mb-6 text-sm text-slate-400">What is the name of the new park?</p>

                                    <div className="mb-8">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newParkName}
                                            onChange={(e) => setNewParkName(e.target.value)}
                                            placeholder="e.g. Cedar Point"
                                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newParkName.trim()) setMode("coasters");
                                            }}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setMode("select")}
                                            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => setMode("coasters")}
                                            disabled={!newParkName.trim()}
                                            className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                                        >
                                            Next Step
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* --- MODE: COASTERS --- */}
                            {mode === "coasters" && (
                                <>
                                    <h2 className="mb-2 text-xl font-bold text-slate-50">{newParkName} Coasters</h2>
                                    <p className="mb-6 text-sm text-slate-400">Add the names of the roller coasters to include them in your checklist. Leave blank if the park has none.</p>

                                    <div className="mb-6 max-h-[40vh] overflow-y-auto pr-2 space-y-3">
                                        {newCoasters.map((coaster, index) => (
                                            <div key={index} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={coaster}
                                                    onChange={(e) => updateCoaster(index, e.target.value)}
                                                    placeholder={`Coaster ${index + 1}`}
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') addCoasterField();
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCoasterField(index)}
                                                    className="flex w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={addCoasterField}
                                            className="w-full rounded-xl border border-dashed border-slate-600 bg-transparent py-2.5 text-sm font-medium text-slate-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors cursor-pointer"
                                        >
                                            + Add another coaster
                                        </button>
                                    </div>

                                    <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
                                        <button
                                            onClick={() => setMode("park-name")}
                                            className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleCreateNewPark}
                                            className="flex-[2] rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                                        >
                                            Create Park & Checklist
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}