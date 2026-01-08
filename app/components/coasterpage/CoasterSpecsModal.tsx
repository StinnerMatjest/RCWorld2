"use client";

import React, { useState, useEffect } from "react";
import type { RollerCoasterSpecs } from "@/app/types";

interface CoasterSpecsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedSpecs: RollerCoasterSpecs) => void;
    initialSpecs: RollerCoasterSpecs | null | undefined;
    coasterId: number;
}

const CoasterSpecsModal: React.FC<CoasterSpecsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialSpecs,
    coasterId,
}) => {
    const [formData, setFormData] = useState<Partial<RollerCoasterSpecs>>({});
    const [loading, setLoading] = useState(false);

    // Load initial data when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(initialSpecs || {});
        }
    }, [isOpen, initialSpecs]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        let finalValue: string | number | null = value;

        if (type === "number") {
            finalValue = value === "" ? null : parseFloat(value);
        }

        setFormData((prev) => ({ ...prev, [name]: finalValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/coasters/${coasterId}/specs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Failed to save");

            const data = await res.json();
            onSave(data.specs); // Pass back the fresh data from DB
            onClose();
        } catch (error) {
            console.error(error);
            alert("Error saving specs");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-6">
                    <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white cursor-pointer">Edit Specifications</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Helper for inputs */}
                        <Input label="Type" name="type" value={formData.type} onChange={handleChange} />
                        <Input label="Classification" name="classification" value={formData.classification} onChange={handleChange} />
                        <Input label="Length (ft)" name="length" type="number" value={formData.length} onChange={handleChange} />
                        <Input label="Height (ft)" name="height" type="number" value={formData.height} onChange={handleChange} />
                        <Input label="Drop (ft)" name="drop" type="number" value={formData.drop} onChange={handleChange} />
                        <Input label="Speed (mph)" name="speed" type="number" value={formData.speed} onChange={handleChange} />
                        <Input label="Inversions" name="inversions" type="number" value={formData.inversions} onChange={handleChange} />
                        <Input label="Vertical Angle (°)" name="verticalAngle" type="number" value={formData.verticalAngle} onChange={handleChange} />
                        <Input label="G-Force" name="gforce" type="number" value={formData.gforce} onChange={handleChange} />
                        <Input label="Duration (sec)" name="duration" type="number" value={formData.duration} onChange={handleChange} />
                    </div>

                    <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
                        <textarea
                            name="notes"
                            rows={4}
                            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm"
                            value={formData.notes || ""}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Simple reusable input sub-component
const Input = ({ label, name, value, onChange, type = "text", step = "0.1" }: any) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{label}</label>
        <input
            type={type}
            step={step}
            name={name}
            value={value ?? ""}
            onChange={onChange}
            className="w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
    </div>
);

export default CoasterSpecsModal;