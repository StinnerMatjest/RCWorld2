"use client";

import React, { useState, useEffect } from "react";
import AuthenticationModal from "./AuthenticationModal";

interface ParkTextsModalProps {
  explanations: Record<string, string>;
  parkId: number;
  onClose: () => void;
  onSave?: (updated: Record<string, string>) => void;
}

const categories = [
  "description",
  "parkAppearance",
  "bestCoaster",
  "waterRides",
  "rideLineup",
  "food",
  "snacksAndDrinks",
  "parkPracticality",
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [postAuthAction, setPostAuthAction] = useState<"submit" | null>(null);

  useEffect(() => {
    setText(localExplanations[selectedCategory] || "");
  }, [selectedCategory, localExplanations]);

  const handleClose = () => {
    onSave?.(localExplanations);
    onClose();
    window.location.reload();
  };

const handleSave = async () => {
  setIsSaving(true);
  setSaveSuccess(false);

  try {
    const method = localExplanations[selectedCategory]
      ? "PUT"
      : "POST";

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

    // Update local state with the new/updated text
    const updatedExplanations = {
      ...localExplanations,
      [selectedCategory]: updatedText.text, // use returned text in case it was sanitized/modified by backend
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
    if (!isAuthenticated) {
      setPostAuthAction("submit");
      setShowAuthModal(true);
      return;
    }
    handleSave();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xl">
        <h2 className="text-2xl font-semibold mb-4">Edit Explanation</h2>

        <label className="block mb-2 font-medium text-gray-700">Category</label>
        <select
          className="w-full border border-gray-300 rounded-lg p-2 mb-4"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {humanizeLabel(cat)}
            </option>
          ))}
        </select>

        <label className="block mb-2 font-medium text-gray-700">Text</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 h-40 resize-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg text-white cursor-pointer transition ${
              isSaving
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          {saveSuccess && (
            <div className="text-green-600 mt-2 text-sm font-medium">Saved!</div>
          )}
        </div>
      </div>
      {showAuthModal && (
        <AuthenticationModal
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={() => {
            setIsAuthenticated(true);
            setShowAuthModal(false);
            if (postAuthAction === "submit") {
              handleSave();
              setPostAuthAction(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default ParkTextsModal;
