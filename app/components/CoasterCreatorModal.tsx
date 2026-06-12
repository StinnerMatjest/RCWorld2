import { useState } from "react";
import { getRatingColor } from "@/app/utils/design";
import { MAJOR_MANUFACTURERS, ALL_MANUFACTURERS } from "@/app/types";
import { useScrollLock } from "@/app/hooks/useScrollLock";

interface CoasterCreatorModalProps {
  parkId: number;
  coaster?: Coaster;
  onClose: () => void;
  onCoasterAdded: () => void;
  onDelete?: () => void;
}

interface Coaster {
  id: number;
  name: string;
  year: number;
  manufacturer: string;
  model: string;
  scale: string;
  haveridden: boolean;
  isbestcoaster: boolean;
  rcdbpath: string;
  rating?: number; // Optional
  rideCount?: number;
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
  const [manufacturer, setManufacturer] = useState(coaster?.manufacturer ?? "");
  const [model, setModel] = useState(coaster?.model ?? "");
  const [scale, setScale] = useState(coaster?.scale ?? "");
  const [haveridden, setHaveRidden] = useState(coaster?.haveridden ?? false);
  const [isbestcoaster, setIsBestCoaster] = useState(
    coaster?.isbestcoaster ?? false
  );
  const [rcdbpath, setRcdbPath] = useState(coaster?.rcdbpath ?? "");
  const [rating, setRating] = useState<number | "">(coaster?.rating ?? "");
  const [goldenCoaster, setGoldenCoaster] = useState(false);
  const [rideCount, setRideCount] = useState<number | "">(
    coaster?.rideCount ?? ""
  );

  const [showAllManufacturers, setShowAllManufacturers] = useState(false);
  const displayedManufacturers = showAllManufacturers ? ALL_MANUFACTURERS : MAJOR_MANUFACTURERS;

  const [loading, setLoading] = useState(false);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (/^\d*$/.test(input) && input.length <= 4) {
      setYear(input);
    }
  };

  const handleSubmit = async () => {
    if (isbestcoaster) {
      const numRating = Number(rating);
      if (rating === "" || Number.isNaN(numRating) || numRating === 0) {
        alert("You must provide a rating if you mark this as your best coaster.");
        return;
      }
    }

    setLoading(true);
    try {
      const method = coaster ? "PUT" : "POST";
      const url = coaster
        ? `/api/park/${parkId}/coasters/${coaster.id}`
        : `/api/park/${parkId}/coasters`;

      const finalRating = rating ? rating + (goldenCoaster ? 1 : 0) : 0;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          year: parseInt(year),
          manufacturer,
          model,
          scale,
          haveridden,
          isbestcoaster,
          rcdbpath,
          rating: haveridden ? finalRating : 0,
          rideCount: haveridden ? rideCount ?? 0 : 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Save coaster failed:", response.status, errorData);
        throw new Error("Failed to save coaster");
      }

      onCoasterAdded();
      onClose();
    } catch (error) {
      console.error("Error saving coaster:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!coaster) return;

    const confirmDelete = confirm(
      `Are you sure you want to delete "${coaster.name}"?`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/park/${parkId}/coasters/${coaster.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete coaster");
      }

      if (onDelete) {
        onDelete(); // leaves page
      } else {
        onCoasterAdded(); // Refreshes the list (stays on page)
        onClose();
      }
    } catch (error) {
      console.error("Error deleting coaster:", error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-center">
      <div className="bg-slate-800 text-slate-100 border border-slate-700 p-6 rounded-lg shadow-lg w-full max-w-[400px] mx-4">
        <h2 className="text-2xl font-semibold mb-6 text-center text-white">
          {coaster ? "Edit Roller Coaster" : "Add New Roller Coaster"}
        </h2>

        <div className="space-y-4">
          {/* Name input */}
          <div>
            <input
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="Coaster Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Year input */}
          <div>
            <input
              type="text"
              name="year"
              id="year"
              placeholder="Year"
              value={year}
              onChange={handleInput}
              maxLength={4}
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>

          {/* Manufacturer dropdown */}
          <div>
            <select
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={manufacturer}
              onChange={(e) => {
                if (e.target.value === "SHOW_ALL") {
                  setShowAllManufacturers(true);
                  setManufacturer("");
                } else {
                  setManufacturer(e.target.value);
                }
              }}
            >
              <option value="" disabled>
                Select Manufacturer
              </option>
              {displayedManufacturers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {!showAllManufacturers && (
                <>
                  <option disabled>──────────</option>
                  <option value="SHOW_ALL">Show all manufacturers...</option>
                </>
              )}
            </select>
          </div>

          {/* Model input */}
          <div>
            <input
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              placeholder="Coaster Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          {/* Scale dropdown */}
          <div>
            <select
              className="w-full p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-100
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
            >
              <option value="" disabled>
                Select Scale
              </option>
              {scales.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Rating input */}
          <div>
            <select
              value={rating ?? ""}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                setRating(val);

                // Reset golden checkbox if rating is not 10
                if (val !== 10) setGoldenCoaster(false);
              }}
              disabled={!haveridden}
              className={`w-full p-2 rounded-md border bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-slate-700
      ${!haveridden ? "italic text-sm text-slate-500" : "text-slate-100"} `}
            >
              {haveridden ? (
                <>
                  <option value="">Rating</option>
                  {[...Array(20)].map((_, i) => {
                    const base = 10 - i * 0.5;
                    if (base < 0.5) return null;
                    return (
                      <option
                        key={i}
                        value={base.toFixed(1)}
                        className={getRatingColor(base)}
                      >
                        {base.toFixed(1)}
                      </option>
                    );
                  })}
                </>
              ) : (
                <option value="">Please mark as 'Have ridden' to enable</option>
              )}
            </select>

            {/* GOLDEN RATING checkbox */}
            {rating === 10 && haveridden && (
              <div className="flex items-center space-x-2 mt-2">
                <input
                  type="checkbox"
                  checked={goldenCoaster}
                  onChange={(e) => setGoldenCoaster(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-yellow-400 focus:ring-yellow-400 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-300">
                  GOLDEN RATING
                </span>
              </div>
            )}
          </div>

          {/* Ride Count input */}
          <div>
            <input
              type="number"
              min={0}
              placeholder="Ride Count"
              value={rideCount === "" ? "" : rideCount}
              onChange={(e) =>
                setRideCount(
                  e.target.value === "" ? "" : parseInt(e.target.value)
                )
              }
              disabled={!haveridden}
              className={`w-full p-2 rounded-md border 
                ${!haveridden ? "bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed" : "bg-slate-900 text-slate-100 border-slate-700"}
                placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`}
            />
          </div>

          {/* Have Ridden checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={haveridden}
              onChange={(e) => {
                const checked = e.target.checked;
                setHaveRidden(checked);
                if (!checked) {
                  setRating("");
                  setRideCount("");
                  setGoldenCoaster(false);
                  setIsBestCoaster(false);
                }
              }}
              className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-md text-slate-200">
              Have Ridden
            </span>
          </div>

          {/* Best Coaster checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isbestcoaster}
              onChange={() => setIsBestCoaster(!isbestcoaster)}
              className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-md text-slate-200">
              Best Coaster
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={onClose}
              className="h-9 w-20 text-lg font-semibold text-white rounded-lg transition duration-300 cursor-pointer
                         bg-blue-500 hover:bg-blue-400
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              Cancel
            </button>

            {coaster && (
              <button
                onClick={handleDelete}
                className="h-9 w-24 text-sm font-semibold text-white rounded-lg transition duration-300 cursor-pointer
                           bg-red-500 hover:bg-red-400
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
              >
                Delete
              </button>
            )}

            <button
              onClick={handleSubmit}
              className={`h-9 w-20 text-lg font-semibold text-white rounded-lg transition duration-300
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800
                          ${loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : !name ||
                    !isValidYear ||
                    !manufacturer ||
                    !model ||
                    !scale
                    ? "bg-slate-600 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-400 cursor-pointer"
                }`}
              disabled={
                loading ||
                !name ||
                !isValidYear ||
                !manufacturer ||
                !model ||
                !scale
              }
            >
              {coaster ? "Apply" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoasterCreatorModal;