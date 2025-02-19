import { useState } from "react";

interface AddCoasterModalProps {
  parkId: number;
  onClose: () => void;
  onCoasterAdded: () => void;
}

const AddCoasterModal: React.FC<AddCoasterModalProps> = ({ parkId, onClose, onCoasterAdded }) => {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [scale, setScale] = useState("");
  const [haveridden, setHaveRidden] = useState(false);
  const [rcdbpath, setRcdbPath] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/park/${parkId}/coasters`, {
        method: "POST",
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
          rcdbpath,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to add coaster");
      }

      onCoasterAdded(); // Refresh coaster list
      onClose(); // Close modal
    } catch (error) {
      console.error("Error adding coaster:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
        <h2 className="text-2xl font-semibold mb-4">Add New Roller Coaster</h2>
        <div className="space-y-2">
          <input className="input input-bordered w-full" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input input-bordered w-full" placeholder="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          <input className="input input-bordered w-full" placeholder="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          <input className="input input-bordered w-full" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
          <input className="input input-bordered w-full" placeholder="Scale" value={scale} onChange={(e) => setScale(e.target.value)} />
          <input className="input input-bordered w-full" placeholder="RCDB URL" value={rcdbpath} onChange={(e) => setRcdbPath(e.target.value)} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={haveridden} onChange={() => setHaveRidden(!haveridden)} className="checkbox" />
            Have ridden
          </label>
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSubmit} className={`btn btn-primary ${loading ? "loading" : ""}`} disabled={loading}>
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCoasterModal;
