"use client";

import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { DirectoryManufacturer, DirectoryRideType } from "@/app/types";

interface CreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    manufacturers: any[];
    onSuccess?: (newItem: any) => void;
    defaultManufacturerId?: number | "";
    lockManufacturer?: boolean;
    lockToCoasterType?: boolean;
    editItem?: any;
    editType?: "model" | "type" | "manufacturer";
}

export default function CreatorModal({
    isOpen,
    onClose,
    manufacturers,
    onSuccess,
    defaultManufacturerId,
    lockManufacturer,
    lockToCoasterType,
    editItem,
    editType
}: CreatorModalProps) {
    const [createTab, setCreateTab] = useState<"model" | "type" | "manufacturer">("model");
    const [fetchedRideTypes, setFetchedRideTypes] = useState<DirectoryRideType[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // NEW: Track if we are editing an existing Ride Type from the "Type" tab dropdown
    const [editTypeId, setEditTypeId] = useState<string>("");

    const defaultFormData = {
        name: "", history: "", note: "",
        ride_type_id: "", manufacturer_id: "", year: "", in_production: true,
        country: "", established: "", in_business: true,
    };

    const [formData, setFormData] = useState(defaultFormData);

    // Reset and sync form data when the modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setEditTypeId(""); // Reset type dropdown

            if (editItem && editType) {
                setCreateTab(editType);
                setFormData({
                    name: editItem.name || "",
                    history: editItem.history || "",
                    note: editItem.note || editItem.notes || "",
                    ride_type_id: editItem.ride_type_id || editItem.rideTypeId || "",
                    manufacturer_id: editItem.manufacturer_id || editItem.manufacturerId || "",
                    year: editItem.year ? String(editItem.year).substring(0, 4) : "",
                    in_production: editItem.in_production ?? editItem.inProduction ?? true,
                    country: editItem.country || "",
                    established: editItem.established ? String(editItem.established).substring(0, 4) : "",
                    in_business: editItem.in_business ?? editItem.inBusiness ?? true,
                });
            } else {
                setCreateTab(lockToCoasterType ? "model" : "manufacturer");
                setFormData({
                    ...defaultFormData,
                    manufacturer_id: defaultManufacturerId ? String(defaultManufacturerId) : "",
                });
            }

            (async () => {
                try {
                    const res = await fetch("/api/rideTypes");
                    if (res.ok) {
                        const data = await res.json();
                        const types = data.rideTypes || [];
                        setFetchedRideTypes(types);

                        if (lockToCoasterType && !editItem) {
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
    }, [isOpen, defaultManufacturerId, lockToCoasterType, editItem, editType]);

    // Handle auto-filling data when an admin selects an existing Ride Type to edit
    useEffect(() => {
        if (createTab === "type" && editTypeId) {
            const targetType = fetchedRideTypes.find(t => String(t.id) === editTypeId);
            if (targetType) {
                setFormData(prev => ({
                    ...prev,
                    name: targetType.name || "",
                    history: (targetType as any).history || "",
                    note: (targetType as any).note || ""
                }));
            }
        } else if (createTab === "type" && !editTypeId && !editItem) {
            setFormData(prev => ({ ...prev, name: "", history: "", note: "" }));
        }
    }, [editTypeId, createTab, fetchedRideTypes, editItem]);

    const selectedMfgObj = manufacturers.find(m => String(m.id) === String(formData.manufacturer_id));
    const isDefunctMfg = selectedMfgObj ? selectedMfgObj.inBusiness === false : false;

    const getEndpoint = () => {
        if (createTab === "model") return "/api/rideModels";
        if (createTab === "type") return "/api/rideTypes";
        return "/api/manufacturers";
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const endpoint = getEndpoint();

        const isEditingTypeDropdown = createTab === "type" && editTypeId !== "";
        const method = (editItem || isEditingTypeDropdown) ? "PUT" : "POST";
        const payloadId = editItem?.id || (isEditingTypeDropdown ? Number(editTypeId) : undefined);

        const payload = { ...formData, id: payloadId };

        if (createTab === "manufacturer") {
            (payload as any).notes = formData.note;
        }

        // Force defunct manufacturers to have discontinued models
        if (createTab === "model" && isDefunctMfg) {
            payload.in_production = false;
        }

        try {
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                onClose();
                if (onSuccess) {
                    onSuccess(data.rideModel || data.rideType || data.manufacturer);
                } else {
                    window.location.reload();
                }
            } else {
                alert("Failed to save entry. Check console.");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const isEditingTypeDropdown = createTab === "type" && editTypeId !== "";
        const itemToDeleteName = editItem?.name || (isEditingTypeDropdown ? fetchedRideTypes.find(t => String(t.id) === editTypeId)?.name : "");
        const payloadId = editItem?.id || (isEditingTypeDropdown ? Number(editTypeId) : undefined);

        if (!payloadId || !confirm(`Are you sure you want to delete ${itemToDeleteName}? This cannot be undone.`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(getEndpoint(), {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: payloadId })
            });

            if (res.ok) {
                onClose();
                window.location.reload();
            } else {
                alert("Failed to delete. It may be linked to existing rides.");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const isEditMode = !!editItem || (createTab === "type" && editTypeId !== "");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">
                        {editItem ? `Edit ${editItem.name}` : lockToCoasterType ? "Create Ride Model" : "Create Database Entry"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {!lockToCoasterType && !editItem && (
                    <div className="flex border-b border-slate-800">
                        {["manufacturer", "model", "type"].map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${createTab === tab ? 'text-blue-500 border-b-2 border-blue-500 bg-slate-800/50' : 'text-slate-500 hover:bg-slate-800/30'}`}
                                onClick={() => {
                                    setCreateTab(tab as any);
                                    setEditTypeId("");
                                    setFormData({ ...defaultFormData });
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                )}

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form onSubmit={handleCreateSubmit} className="space-y-4">

                        {createTab === "type" && !editItem && (
                            <div className="mb-4 pb-4 border-b border-slate-800">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Edit Existing Type (Optional)</label>
                                <select
                                    value={editTypeId}
                                    onChange={e => setEditTypeId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500 appearance-none"
                                >
                                    <option value="">-- Create New Ride Type --</option>
                                    {fetchedRideTypes.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name *</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="Name..." />
                        </div>

                        {createTab === "manufacturer" && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Country</label>
                                        <input type="text" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="e.g. Switzerland" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Year</label>
                                        <input type="number" min="1800" max="2100" value={formData.established} onChange={e => setFormData({ ...formData, established: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="YYYY" />
                                    </div>
                                </div>
                                <div className="flex items-center pt-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-300 cursor-pointer hover:text-white transition-colors">
                                        <input type="checkbox" checked={formData.in_business} onChange={e => setFormData({ ...formData, in_business: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800" />
                                        Currently in Business
                                    </label>
                                </div>
                            </>
                        )}

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
                                        <label className={`flex items-center gap-2 text-sm font-bold cursor-pointer transition-colors ${isDefunctMfg ? 'text-slate-500' : 'text-slate-300 hover:text-white'}`}>
                                            <input
                                                type="checkbox"
                                                checked={isDefunctMfg ? false : formData.in_production}
                                                onChange={e => setFormData({ ...formData, in_production: e.target.checked })}
                                                disabled={isDefunctMfg}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 disabled:opacity-50"
                                            />
                                            In Production {isDefunctMfg && "(Defunct Mfg)"}
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

                        <div className="pt-4 border-t border-slate-800 flex gap-3">
                            <button disabled={isSubmitting || (createTab === "model" && !formData.ride_type_id)} type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg disabled:opacity-50">
                                {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : `Create ${createTab}`}
                            </button>
                            {isEditMode && (
                                <button type="button" onClick={handleDelete} disabled={isDeleting} className="px-4 bg-red-900/40 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-colors disabled:opacity-50">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}