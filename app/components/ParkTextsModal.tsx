"use client";

import React, { useState, useEffect } from "react";

interface ParkTextsModalProps {
  explanations: Record<string, string>;
  parkId: number;
  onClose: () => void;
  onSave?: (updated: Record<string, string>) => void;
}

const categories = [
  "description",
  "parkAppearance",
  "parkPracticality",
  "bestCoaster",
  "coasterDepth",
  "waterRides",
  "flatridesAndDarkrides",
  "food",
  "snacksAndDrinks",
  "rideOperations",
  "parkManagement",
];

const humanizeLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

const ParkTextsModal: React.FC<ParkTextsModalProps> = ({
  explanations,
  parkId,
  onClose,
  onSave,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [text, setText] = useState("");
  const [localExplanations, setLocalExplanations] =
    useState<Record<string, string>>(explanations);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setText(localExplanations[selectedCategory] || "");
  }, [selectedCategory, localExplanations]);

  const handleClose = () => {
    onSave?.(localExplanations);
    onClose();
    // ❌ window.location.reload() removed to keep admin mode + state
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const method = localExplanations[selectedCategory] ? "PUT" : "POST";

      const res = await fetch(`/api/park/${parkId}/parkTexts`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, text }),
      });

      if (!res.ok) {
        console.error(`Failed to ${method} text`);
        return;
      }

      const updatedText = await res.json();

      const updatedExplanations = {
        ...localExplanations,
        [selectedCategory]: updatedText.text,
      };

      setLocalExplanations(updatedExplanations);
      onSave?.(updatedExplanations);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Error submitting request:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = () => {
    handleSave();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="relative bg-white dark:bg-gray-800 dark:text-gray-100 border border-transparent dark:border-white/10 p-6 rounded-lg shadow-lg w-full max-w-xl">
        {/* Close button (visual only, same behavior) */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition duration-300 cursor-pointer"
        >
          ✕
        </button>

        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
          Edit Explanation
        </h2>

        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Category
        </label>
        <select
          className="w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                     dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:focus-visible:ring-offset-gray-800 mb-4"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {humanizeLabel(cat)}
            </option>
          ))}
        </select>

        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Text
        </label>
        <textarea
          className="w-full p-3 h-40 resize-none rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                     dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:placeholder-gray-500 dark:focus-visible:ring-offset-gray-800"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          {saveSuccess && (
            <div className="text-green-600 dark:text-green-400 text-sm font-medium mr-auto">
              Saved!
            </div>
          )}

          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 cursor-pointer
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800"
          >
            Close
          </button>

          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`px-4 py-2 rounded-md text-white cursor-pointer transition
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                        dark:focus-visible:ring-offset-gray-800
                        ${
                          isSaving
                            ? "bg-blue-300 dark:bg-blue-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                        }`}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkTextsModal;
