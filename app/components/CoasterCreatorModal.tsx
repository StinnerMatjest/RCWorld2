import { useState } from "react";

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
}

interface AddCoasterModalProps {
  parkId: number;
  coaster?: Coaster; // Optional for edit mode
  onClose: () => void;
  onCoasterAdded: () => void;
}

const manufacturers = [
  "Arrow Dynamics",
  "ART Engineering",
  "Bolliger & Mabillard",
  "Gerstlauer",
  "Giovanola",
  "Gravity Group",
  "Great Coasters International",
  "Intamin",
  "Jinma Rides",
  "Mack Rides",
  "Maurer",
  "Pinfari",
  "Premier Rides",
  "Reverchon",
  "Ride Engineers Switzerland",
  "Rocky Mountain Construction",
  "S&S Worldwide",
  "SBF Visa",
  "Schwarzkopf",
  "Soquet",
  "Technical Park",
  "Togo",
  "Vekoma",
  "Zamperla",
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
  const isValidYear = /^\d{4}$/.test(year); // Check if the input only contains digits and has exactly 4 digits
  const [manufacturer, setManufacturer] = useState(coaster?.manufacturer ?? "");
  const [model, setModel] = useState(coaster?.model ?? "");
  const [scale, setScale] = useState(coaster?.scale ?? "");
  const [haveridden, setHaveRidden] = useState(coaster?.haveridden ?? false);
  const [isbestcoaster, setIsBestCoaster] = useState(
    coaster?.isbestcoaster ?? false
  );
  const [rcdbpath, setRcdbPath] = useState(coaster?.rcdbpath ?? "");
  const [loading, setLoading] = useState(false);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Only set the value if it's a number and has less than or equal to 4 digits
    if (/^\d*$/.test(input) && input.length <= 4) {
      setYear(input);
    }
  };

  const handleSubmit = async () => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
        <h2 className="text-2xl font-semibold mb-4">Add New Roller Coaster</h2>
        <div className="space-y-2">
          <input
            className="input input-bordered w-full"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            name="year"
            id="year"
            placeholder="Year"
            value={year}
            onChange={handleInput}
            maxLength={4}
          />

          <select
            className="select select-bordered w-full "
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
          <input
            className="input input-bordered w-full"
            placeholder="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <select
            className="select select-bordered w-full"
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
          <input
            className="input input-bordered w-full"
            placeholder="RCDB URL"
            value={rcdbpath}
            onChange={(e) => setRcdbPath(e.target.value)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={haveridden}
              onChange={() => setHaveRidden(!haveridden)}
              className="checkbox"
            />
            Have ridden
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isbestcoaster}
              onChange={() => setIsBestCoaster(!isbestcoaster)}
              className="checkbox"
            />
            Best Coaster
          </label>
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            disabled={loading || !isValidYear}
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCoasterModal;
