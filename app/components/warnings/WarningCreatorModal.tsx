"use client";

import React, { useState } from "react";
import { ratingCategories } from "@/app/utils/ratings";
import type { RatingWarningType, RollerCoaster } from "@/app/types";

interface WarningCreatorModalProps {
  ratingId: number;
  existingWarnings: RatingWarningType[];
  onClose: () => void;
  onSaved: () => void;
  coasters: RollerCoaster[];
}

export default function WarningCreatorModal({
  ratingId,
  existingWarnings,
  onClose,
  onSaved,
  coasters,
}: WarningCreatorModalProps) {
  const [warnings, setWarnings] = useState<RatingWarningType[]>(existingWarnings);
  const [loading, setLoading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [ride, setRide] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<RatingWarningType["severity"]>("Moderate");

  const resetForm = () => {
    setEditingId(null);
    setRide("");
    setNote("");
    setCategory("");
    setSeverity("Moderate");
  };

  const handleEditClick = (w: RatingWarningType) => {
    setEditingId(w.id);
    setRide(w.ride);
    setNote(w.note);
    setCategory(w.category);
    setSeverity(w.severity || "Moderate");
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm("Delete this warning permanently?");
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch("/api/warnings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete warning");

      setWarnings((prev) => prev.filter((w) => w.id !== id));
      onSaved();
    } catch (error) {
      console.error(error);
      alert("Error deleting warning");
    } finally {
      setLoading(false);
    }
  };

  const nonRideCategories = [
    "parkAppearance",
    "food",
    "snacksAndDrinks",
    "parkPracticality",
    "rideOperations",
    "parkManagement"
  ];
  const isNonRideCategory = nonRideCategories.includes(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const isEdit = editingId !== null;
    const method = isEdit ? "PUT" : "POST";

    const payload = {
      id: editingId,
      ratingId,
      ride: isNonRideCategory ? "N/A" : ride,
      note,
      category,
      severity,
    };

    try {
      const res = await fetch("/api/warnings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save warning");

      const data = await res.json();

      if (isEdit) {
        setWarnings((prev) => prev.map((w) => (w.id === editingId ? data.warning : w)));
      } else {
        setWarnings((prev) => [...prev, data.warning]);
      }

      resetForm();
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error saving warning");
    } finally {
      setLoading(false);
    }
  };

  const humanizeLabel = (key: string) => {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold dark:text-white">Manage Trip Warnings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">×</button>
        </div>

        {/* Existing Warnings */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Existing Warnings</h3>
          {warnings.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No warnings for this trip yet.</p>
          ) : (
            warnings.map((w) => (
              <div key={w.id} className="p-3 border rounded-lg dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm dark:text-white">
                    {w.ride} <span className="font-normal text-xs text-gray-500">({w.category})</span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{w.note}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-bold rounded-full ${w.severity === "Major" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" :
                    w.severity === "Minor" ? "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200" :
                      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400"
                    }`}>
                    {w.severity || "Moderate"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditClick(w)} className="text-blue-500 text-sm font-semibold hover:underline cursor-pointer">Edit</button>
                  <button onClick={() => handleDelete(w.id)} disabled={loading} className="text-red-500 text-sm font-semibold hover:underline disabled:opacity-50 cursor-pointer">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {editingId ? "Edit Warning" : "Add New Warning"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Category</label>
                <select
                  required
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setRide("");
                  }}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="" disabled>Select category...</option>
                  {ratingCategories
                    .filter((key) => key !== "description" && key !== "overall")
                    .map((key) => (
                      <option key={key} value={key}>
                        {humanizeLabel(key)}
                      </option>
                    ))}
                </select>
              </div>

              {!isNonRideCategory && (
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Attraction</label>
                  {category === "bestCoaster" || category === "coasterDepth" ? (
                    <select
                      required
                      value={ride}
                      onChange={(e) => setRide(e.target.value)}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="" disabled>Select coaster...</option>
                      {coasters.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      type="text"
                      value={ride}
                      onChange={(e) => setRide(e.target.value)}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Name of ride"
                    />
                  )}
                </div>
              )}

              <div className={`sm:col-span-${isNonRideCategory ? '2' : '1'}`}>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Severity</label>
                <select required value={severity} onChange={(e) => setSeverity(e.target.value as RatingWarningType["severity"])} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                  <option value="Minor">Minor</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Major">Major</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Note</label>
              <textarea required value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={2} placeholder="Explain what happened..." />
            </div>

            <div className="flex justify-end gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">Cancel Edit</button>
              )}
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {loading ? "Saving..." : editingId ? "Save Changes" : "Add Warning"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}