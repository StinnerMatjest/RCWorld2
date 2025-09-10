import { useState, useEffect } from "react";
import { getRatingColor } from "@/app/utils/design";
import AuthenticationModal from "./AuthenticationModal";

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

interface AddCoasterModalProps {
  parkId: number;
  coaster?: Coaster; // For edit mode
  onClose: () => void;
  onCoasterAdded: () => void;
}

const manufacturers = [
  "abc rides",
  "Allan Herschell Company",
  "Arrow Dynamics",
  "ART Engineering",
  "Barbisan",
  "Beijing Shibaolai",
  "BHS",
  "Bolliger & Mabillard",
  "Chance Rides",
  "CCI",
  "Dinn Corporation",
  "Dynamic Attractions",
  "E&F Miler",
  "EOS Rides",
  "Extreme Engineering",
  "Fabbri",
  "Gerstlauer",
  "Giovanola",
  "Gravity Group",
  "GCI",
  "Hopkins",
  "I.E. Park",
  "Intamin",
  "Interpark",
  "Jinma Rides",
  "L.A. Thompson",
  "L&T Systems",
  "Mack Rides",
  "Martin & Vleminckx",
  "Maurer",
  "Meisho",
  "Morgan",
  "Pax Company",
  "Pinfari",
  "Premier Rides",
  "Preston & Barbieri",
  "PTC",
  "RCCA",
  "Reverchon",
  "RES Rides AG",
  "RMC",
  "S&S Worldwide",
  "SBF Visa",
  "S.D.C.",
  "Schwarzkopf",
  "Skyline Attractions",
  "Soquet",
  "Technical Park",
  "Togo",
  "Vekoma",
  "Walther Queenland",
  "Zamperla",
  "Zhipao",
  "Zierer",
];

const scales = [
  "High Thrill",
  "Thrill",
  "Family-Thrill",
  "Family",
  "Family-Chill",
  "Junior",
  "Kiddie",
];

const AddCoasterModal: React.FC<AddCoasterModalProps> = ({
  parkId,
  coaster,
  onClose,
  onCoasterAdded,
}) => {
  const [name, setName] = useState(coaster?.name ?? "");
  const [year, setYear] = useState(coaster?.year.toString() ?? "");
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
  const [rideCount, setRideCount] = useState<number | "">(
    coaster?.rideCount ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [postAuthAction, setPostAuthAction] = useState<
    "submit" | "delete" | null
  >(null);

  useEffect(() => {
    if (isAuthenticated && postAuthAction) {
      const runAction = async () => {
        if (postAuthAction === "submit") {
          await handleSubmit();
        } else if (postAuthAction === "delete") {
          await handleDelete();
        }
        setPostAuthAction(null);
      };
      runAction();
    }
  }, [isAuthenticated, postAuthAction]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only set the value if it's a number and has less than or equal to 4 digits
    if (/^\d*$/.test(input) && input.length <= 4) {
      setYear(input);
    }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    // --- Validation rules ---
    if (!haveridden && rating !== "") {
      alert("You can only rate a coaster if you have ridden it.");
      return;
    }

    if (isbestcoaster) {
      if (rating === "" || typeof rating !== "number" || Number.isNaN(rating)) {
        alert(
          "You must provide a rating if you mark this as your best coaster."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const method = coaster ? "PUT" : "POST";
      const url = coaster
        ? `/api/park/${parkId}/coasters/${coaster.id}`
        : `/api/park/${parkId}/coasters`;

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
          rating,
          rideCount,
        }),
      });

      if (!response.ok) throw new Error("Failed to save coaster");

      onCoasterAdded();
      onClose();
    } catch (error) {
      console.error("Error saving coaster:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!coaster) return;
    const confirmDelete = confirm(
      `Are you sure you want to delete"${coaster.name}" ?`
    );
    if (!confirmDelete) return;

    console.log(`${parkId} ${coaster.id}`);

    setLoading(true);
    try {
      const response = await fetch(
        `/api/park/${parkId}/coasters/${coaster.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete coaster");

      onCoasterAdded(); // refreshes the coasterlist
      onClose();
    } catch (error) {
      console.error("Error deleting coaster:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
        <h2 className="text-2xl font-semibold mb-6 text-center">
          {coaster ? "Edit Roller Coaster" : "Add New Roller Coaster"}
        </h2>
        <div className="space-y-4">
          {/* Name input */}
          <div>
            <input
              className="input input-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
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
              className="input input-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
            />
          </div>

          {/* Manufacturer dropdown */}
          <div>
            <select
              className="select select-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            >
              <option value="" disabled>
                Select Manufacturer
              </option>
              {manufacturers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Model input */}
          <div>
            <input
              className="input input-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
              placeholder="Coaster Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          {/* Scale dropdown */}
          <div>
            <select
              className="select select-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
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

          {/* RCDB Path input */}
          <div>
            <input
              className="input input-bordered w-full p-1 text-mg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
              placeholder="RCDB URL"
              value={rcdbpath}
              onChange={(e) => setRcdbPath(e.target.value)}
            />
          </div>

          {/* Rating input */}
          <div>
            <select
              value={
                rating === "" || rating === null || rating === undefined
                  ? ""
                  : Number(rating).toFixed(1)
              }
              onChange={(e) =>
                setRating(
                  e.target.value === "" ? "" : parseFloat(e.target.value)
                )
              }
              disabled={!haveridden}
              className={`w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900
  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
  dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:focus-visible:ring-offset-gray-800 ${getRatingColor(
    rating ?? ""
  )}`}
            >
              <option value="">Rating</option>
              {[...Array(20)].map((_, i) => {
                const base = 10 - i * 0.5;
                if (base < 0.5) return null;
                const formattedValue = base.toFixed(1);
                const colorClass = getRatingColor(base);

                return (
                  <option
                    key={`rating-${formattedValue}`}
                    value={formattedValue}
                    className={colorClass}
                  >
                    {formattedValue}
                  </option>
                );
              })}
            </select>
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
              className="input input-bordered w-full p-1 text-mg border-2 border-gray-300 
               focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-md"
            />
          </div>

          {/* Have Ridden checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={haveridden}
              onChange={() => setHaveRidden(!haveridden)}
              className="checkbox"
            />
            <span className="text-mg">Have Ridden</span>
          </div>

          {/* Best Coaster checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isbestcoaster}
              onChange={() => setIsBestCoaster(!isbestcoaster)}
              className="checkbox"
            />
            <span className="text-mg">Best Coaster</span>
          </div>

          {/* Cancel button */}
          <div className="flex justify-between mt-4">
            <button
              onClick={onClose}
              className="h-9 w-20 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-800 transition duration-300 cursor-pointer"
            >
              Cancel
            </button>

            {/* Delete button */}
            {coaster && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => handleDelete()}
                  className="h-8 w-24 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-800 transition duration-300 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              className={`h-9 w-20 text-lg font-semibold text-white rounded-lg transition duration-300 ${
                loading
                  ? "bg-blue-600 cursor-pointer"
                  : `bg-blue-600 ${
                      loading ||
                      !name ||
                      !isValidYear ||
                      !manufacturer ||
                      !model ||
                      !scale ||
                      !rcdbpath
                        ? "bg-gray-400 cursor-not-allowed"
                        : "hover:bg-blue-800 cursor-pointer"
                    }`
              }`}
              disabled={
                loading ||
                !name ||
                !isValidYear ||
                !manufacturer ||
                !model ||
                !scale ||
                !rcdbpath
              }
            >
              {coaster ? "Apply" : "Add"}
            </button>
          </div>
        </div>
        {showAuthModal && (
          <AuthenticationModal
            onClose={() => setShowAuthModal(false)}
            onAuthenticated={() => {
              setIsAuthenticated(true);
              setShowAuthModal(false);

              if (coaster) {
                setPostAuthAction("delete");
              } else {
                setPostAuthAction("submit");
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AddCoasterModal;
