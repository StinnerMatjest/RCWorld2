"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DirectoryManufacturer, DirectoryRideType } from "@/app/types";

interface CreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    manufacturers: any[];
    onSuccess?: (newItem: any) => void;
    // NEW: Context locks
    defaultManufacturerId?: number | "";
    lockManufacturer?: boolean;
    lockToCoasterType?: boolean;
}

export default function CreatorModal({
    isOpen,
    onClose,
    manufacturers,
    onSuccess,
    defaultManufacturerId,
    lockManufacturer,
    lockToCoasterType
}: CreatorModalProps) {
    const [createTab, setCreateTab] = useState<"model" | "type">("model");
    const [fetchedRideTypes, setFetchedRideTypes] = useState<DirectoryRideType[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        history: "",
        note: "",
        ride_type_id: "",
        manufacturer_id: "",
        year: "",
        in_production: true
    });

    // Reset and sync form data when the modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setCreateTab("model"); // Always default to model
            setFormData(prev => ({
                ...prev,
                manufacturer_id: defaultManufacturerId ? String(defaultManufacturerId) : "",
                ride_type_id: "", // Will be set momentarily if locked
                name: "",
                history: "",
                note: "",
                year: "",
                in_production: true
            }));

            (async () => {
                try {
                    const res = await fetch("/api/rideTypes");
                    if (res.ok) {
                        const data = await res.json();
                        const types = data.rideTypes || [];
                        setFetchedRideTypes(types);

                        // If locked to coasters, automatically find and select the Roller Coaster type
                        if (lockToCoasterType) {
                            const coasterType = types.find((t: DirectoryRideType) => t.name.toLowerCase() === "roller coaster");
                            if (coasterType) {
                                setFormData(prev => ({ ...prev, ride_type_id: String(coasterType.id) }));
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch ride types", e);
                }
            })();
        }
    }, [isOpen, defaultManufacturerId, lockToCoasterType]);

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const endpoint = createTab === "model" ? "/api/rideModels" : "/api/rideTypes";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const data = await res.json();
                onClose();

                if (onSuccess) {
                    onSuccess(data.rideModel || data.rideType);
                } else {
                    window.location.reload();
                }
            } else {
                alert("Failed to create entry. Check console.");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">
                        {lockToCoasterType ? "Create Ride Model" : "Create Database Entry"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Hide the tabs entirely if we are locked into a coaster model creation */}
                {!lockToCoasterType && (
                    <div className="flex border-b border-slate-800">
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${createTab === 'model' ? 'text-blue-500 border-b-2 border-blue-500 bg-slate-800/50' : 'text-slate-500 hover:bg-slate-800/30'}`}
                            onClick={() => setCreateTab('model')}
                        >
                            Ride Model
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${createTab === 'type' ? 'text-blue-500 border-b-2 border-blue-500 bg-slate-800/50' : 'text-slate-500 hover:bg-slate-800/30'}`}
                            onClick={() => setCreateTab('type')}
                        >
                            Ride Type
                        </button>
                    </div>
                )}

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form onSubmit={handleCreateSubmit} className="space-y-4">

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name *</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" placeholder={createTab === "model" ? "e.g. Hyper Coaster" : "e.g. Log Flume"} />
                        </div>

                        {createTab === "model" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Manufacturer *</label>
                                        <select
                                            required
                                            value={formData.manufacturer_id}
                                            onChange={e => setFormData({ ...formData, manufacturer_id: e.target.value })}
                                            disabled={lockManufacturer}
                                            className={`w-full rounded-xl px-4 py-2 outline-none appearance-none ${lockManufacturer ? 'bg-slate-800 border border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-950 border border-slate-800 text-white focus:border-blue-500'}`}
                                        >
                                            <option value="">Select...</option>
                                            {manufacturers.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ride Type *</label>
                                        <select
                                            required
                                            value={formData.ride_type_id}
                                            onChange={e => setFormData({ ...formData, ride_type_id: e.target.value })}
                                            disabled={lockToCoasterType}
                                            className={`w-full rounded-xl px-4 py-2 outline-none appearance-none ${lockToCoasterType ? 'bg-slate-800 border border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-950 border border-slate-800 text-white focus:border-blue-500'}`}
                                        >
                                            <option value="">Select...</option>
                                            {fetchedRideTypes.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Debut Year</label>
                                        <input type="number" min="1800" max="2100" placeholder="YYYY" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 cursor-text" />
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300 cursor-pointer hover:text-white transition-colors">
                                            <input type="checkbox" checked={formData.in_production} onChange={e => setFormData({ ...formData, in_production: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800" />
                                            Currently in Production
                                        </label>
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">History / Description</label>
                            <textarea rows={3} value={formData.history} onChange={e => setFormData({ ...formData, history: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 custom-scrollbar" placeholder="Brief history or description..."></textarea>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Admin Notes</label>
                            <input type="text" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="Internal notes..." />
                        </div>

                        <div className="pt-4 border-t border-slate-800">
                            <button disabled={isSubmitting || (createTab === "model" && !formData.ride_type_id)} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? "Saving..." : `Create ${createTab === "model" ? "Ride Model" : "Ride Type"}`}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}