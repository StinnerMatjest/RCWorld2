"use client";

import { useState, useEffect } from "react";
import { getRatingColor } from "@/app/utils/design";
import { RollerCoaster, Manufacturer } from "@/app/types";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import CreatorModal from "@/app/components/manufacturerPage/CreatorModal";

interface CoasterCreatorModalProps {
  parkId: number;
  coaster?: RollerCoaster;
  onClose: () => void;
  onCoasterAdded: () => void;
  onDelete?: () => void;
}

const scales = [
  "High Thrill",
  "Thrill",
  "Family-Thrill",
  "Family",
  "Family-Chill",
  "Junior",
  "Kiddie",
];

const CoasterCreatorModal: React.FC<CoasterCreatorModalProps> = ({
  parkId,
  coaster,
  onClose,
  onCoasterAdded,
  onDelete,
}) => {
  useScrollLock();

  const [name, setName] = useState(coaster?.name ?? "");
  const [year, setYear] = useState(coaster ? String(coaster.year) : "");
  const isValidYear = /^\d{4}$/.test(year);

  const [manufacturerId, setManufacturerId] = useState<number | "">(coaster?.manufacturerId ?? "");
  const [dbManufacturers, setDbManufacturers] = useState<Manufacturer[]>([]);

  // NEW: Ride Models State
  const [rideModelId, setRideModelId] = useState<number | "">(coaster?.rideModelId ?? "");
  const [dbRideModels, setDbRideModels] = useState<any[]>([]);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const [model, setModel] = useState(coaster?.model ?? "");
  const [scale, setScale] = useState(coaster?.scale ?? "");
  const [haveridden, setHaveRidden] = useState(coaster?.haveridden ?? false);
  const [isbestcoaster, setIsBestCoaster] = useState(coaster?.isbestcoaster ?? false);
  const [rating, setRating] = useState<number | "">(coaster?.rating ?? "");
  const [goldenCoaster, setGoldenCoaster] = useState(false);

  const initialRideCount = (coaster as any)?.rideCount ?? coaster?.ridecount ?? "";
  const [rideCount, setRideCount] = useState<number | "">(initialRideCount);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch manufacturers AND ride models
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mfgRes, modelsRes] = await Promise.all([
          fetch("/api/manufacturers"),
          fetch("/api/rideModels")
        ]);

        if (mfgRes.ok) {
          const mData = await mfgRes.json();
          setDbManufacturers(mData.manufacturers);
        }
        if (modelsRes.ok) {
          const rData = await modelsRes.json();
          setDbRideModels(rData.rideModels || []);
        }
      } catch (error) {
        console.error("Failed to load DB data", error);
      }
    };
    fetchData();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (/^\d*$/.test(input) && input.length <= 4) {
      setYear(input);
    }
  };

  useEffect(() => {
    if (coaster) {
      setName(coaster.name || "");
      setYear(coaster.year ? String(coaster.year) : "");
      setManufacturerId(coaster.manufacturerId || "");
      setRideModelId(coaster.rideModelId || "");
      setModel(coaster.model || "");
      setScale(coaster.scale || "");
      setHaveRidden(coaster.haveridden ?? false);
      setIsBestCoaster(coaster.isbestcoaster ?? false);
      setRating(coaster.rating ?? "");

      const count = (coaster as any).rideCount ?? (coaster as any).ridecount ?? "";
      setRideCount(count);
    }
  }, [coaster]);

  const handleSubmit = async () => {
    if (isbestcoaster) {
      const numRating = Number(rating);
      if (rating === "" || Number.isNaN(numRating) || numRating === 0) {
        alert("You must provide a rating if you mark this as your best coaster.");
        return;
      }
    }

    const currentRideCount = Number((coaster as any)?.rideCount ?? coaster?.ridecount ?? 0);
    const newRideCount = rideCount === "" ? 0 : Number(rideCount);

    if (coaster && haveridden && newRideCount !== currentRideCount) {
      const diff = newRideCount - currentRideCount;
      const sign = diff > 0 ? "+" : "";
      const confirmed = confirm(
        `You have changed the ride count to ${newRideCount} (${sign}${diff} from the previous value). Are you sure?`
      );

      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);
    try {
      const method = coaster ? "PUT" : "POST";
      const url = coaster
        ? `/api/park/${parkId}/coasters/${coaster.id}`
        : `/api/park/${parkId}/coasters`;

      const finalRating = rating ? rating + (goldenCoaster ? 1 : 0) : 0;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          year: parseInt(year),
          manufacturerId: Number(manufacturerId),
          rideModelId: rideModelId === "" ? null : Number(rideModelId),
          model, // Keep fallback string updated
          scale,
          haveridden,
          isbestcoaster,
          rating: haveridden ? finalRating : 0,
          rideCount: haveridden ? newRideCount : 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(
          response.status === 401
            ? "Not saved: session expired. Log in to admin mode again."
            : errorData.error || "Failed to save coaster. Please try again."
        );
        return;
      }

      onCoasterAdded();
      onClose();
    } catch (error) {
      console.error("Error saving coaster:", error);
      setError("Save failed: network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!coaster) return;

    const confirmDelete = confirm(`Are you sure you want to delete "${coaster.name}"?`);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/park/${parkId}/coasters/${coaster.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete coaster");

      if (onDelete) onDelete();
      else {
        onCoasterAdded();
        onClose();
      }
    } catch (error) {
      console.error("Error deleting coaster:", error);
      setLoading(false);
    }
  };

  // Filter models so we only show the ones associated with the selected manufacturer
  const availableModels = dbRideModels.filter(m => !manufacturerId || m.manufacturer_id === Number(manufacturerId));

  const handleNewModelCreated = (newItem: any) => {
    // If it's a model (has a manufacturer_id attached), instantly select it
    if ('manufacturer_id' in newItem) {
      setDbRideModels(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      setRideModelId(newItem.id);
      setModel(newItem.name); // Keep fallback sync

      // Auto-set the manufacturer if they forgot to pick one initially
      if (newItem.manufacturer_id) setManufacturerId(newItem.manufacturer_id);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/80 flex justify-center items-center">
        <div className="bg-slate-800 text-slate-100 border border-slate-700 p-6 rounded-lg shadow-lg w-full max-w-[400px] mx-4">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            {coaster ? "Edit Roller Coaster" : "Add New Roller Coaster"}
          </h2>

          <div className="space-y-4">
            <input
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="Coaster Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Year"
              value={year}
              onChange={handleInput}
              maxLength={4}
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />

            <select
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={manufacturerId}
              onChange={(e) => setManufacturerId(Number(e.target.value))}
            >
              <option value="" disabled>Select Manufacturer</option>
              {dbManufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            {/* NEW: Ride Model Dropdown */}
            <select
              className={`w-full p-2 rounded-md border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${!manufacturerId ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-slate-100'}`}
              value={rideModelId === "" ? "default" : rideModelId}
              disabled={!manufacturerId}
              onChange={(e) => {
                if (e.target.value === "NEW") {
                  setIsCreatorOpen(true);
                } else {
                  const newId = Number(e.target.value);
                  setRideModelId(newId);

                  // Keep string model in sync for backward compatibility
                  const selected = dbRideModels.find(m => m.id === newId);
                  if (selected) setModel(selected.name);
                }
              }}
            >
              <option value="default" disabled>{manufacturerId ? "Select Ride Model" : "Select Manufacturer First"}</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="NEW" className="font-bold text-blue-400">+ Create New...</option>
            </select>

            <select
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
            >
              <option value="" disabled>Select Scale</option>
              {scales.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="haveridden"
                checked={haveridden}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHaveRidden(checked);
                  if (!checked) {
                    setRating("");
                    setRideCount("");
                  }
                }}
                className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="haveridden" className="text-md text-slate-200 cursor-pointer">Have Ridden</label>
            </div>

            <select
              value={rating === "" ? "" : Number(rating).toFixed(1)}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                setRating(val);
                if (val !== 10) setGoldenCoaster(false);
              }}
              disabled={!haveridden}
              className={`w-full p-2 rounded-md border bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-slate-700
      ${!haveridden ? "italic text-sm text-slate-500" : "text-slate-100"} `}
            >
              {haveridden ? (
                <>
                  <option value="">Rating</option>
                  {[...Array(22)].map((_, i) => {
                    const base = 11 - i * 0.5;
                    if (base < 0.5) return null;
                    return (
                      <option key={i} value={base.toFixed(1)} className={getRatingColor(base)}>
                        {base.toFixed(1)}
                      </option>
                    );
                  })}
                </>
              ) : (
                <option value="">Please mark as 'Have ridden' to enable</option>
              )}
            </select>

            <input
              type="number"
              min={0}
              placeholder="Ride Count"
              value={rideCount}
              onChange={(e) => setRideCount(e.target.value === "" ? "" : parseInt(e.target.value))}
              disabled={!haveridden}
              className={`w-full p-2 rounded-md border ${!haveridden ? "bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed" : "bg-slate-900 text-slate-100 border-slate-700"} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isbestcoaster}
                onChange={() => setIsBestCoaster(!isbestcoaster)}
                className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-md text-slate-200">Best Coaster</span>
            </div>

            {error && <p className="text-sm font-medium text-red-400 text-center">{error}</p>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={onClose} className="h-9 w-20 text-lg font-semibold text-white rounded-lg bg-blue-500 hover:bg-blue-400 cursor-pointer">Cancel</button>
              {coaster && <button onClick={handleDelete} className="h-9 w-24 text-sm font-semibold text-white rounded-lg bg-red-500 hover:bg-red-400 cursor-pointer">Delete</button>}
              <button
                onClick={handleSubmit}
                disabled={loading || !name || !isValidYear || !manufacturerId || !rideModelId || !scale}
                className={`h-9 w-20 text-lg font-semibold text-white rounded-lg transition ${loading || !name || !isValidYear || !manufacturerId || !rideModelId || !scale ? "bg-slate-600 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-400 cursor-pointer"}`}
              >
                {coaster ? "Apply" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RideModal/RideType Modal */}
      <CreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        manufacturers={dbManufacturers}
        onSuccess={handleNewModelCreated}
        defaultManufacturerId={manufacturerId}
        lockManufacturer={!!manufacturerId}
        lockToCoasterType={true}
      />
    </>
  );
};

export default CoasterCreatorModal;