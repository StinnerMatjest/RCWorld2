"use client";

import React, { useEffect, useState } from "react";
import { useAdminMode } from "../../context/AdminModeContext";
import CoasterTextModal from "./CoasterTextModal";

interface CoasterTextEntry {
  id: number;
  coaster_id: number;
  headline: string | null;
  text: string | null;
  order: number;
}

interface Props {
  coasterId: number;
}

const CoasterText: React.FC<Props> = ({ coasterId }) => {
  const { isAdminMode } = useAdminMode();
  const [texts, setTexts] = useState<CoasterTextEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingText, setEditingText] = useState<CoasterTextEntry | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const fetchTexts = async () => {
    try {
      const res = await fetch(`/api/coasters/${coasterId}/text`);
      const data = await res.json();
      const sortedTexts = (data.texts || []).sort((a: CoasterTextEntry, b: CoasterTextEntry) => a.order - b.order);
      setTexts(sortedTexts);
    } catch (err) {
      console.error("Failed to fetch coaster text:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coasterId) fetchTexts();
  }, [coasterId]);

  const onDragStart = (id: number) => {
    setDraggingId(id);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>, overId: number) => {
    e.preventDefault();
    if (draggingId === null || draggingId === overId) return;

    const draggingIndex = texts.findIndex(t => t.id === draggingId);
    const overIndex = texts.findIndex(t => t.id === overId);
    const updated = [...texts];
    const [dragged] = updated.splice(draggingIndex, 1);
    updated.splice(overIndex, 0, dragged);
    setTexts(updated);
  };

  const onDragEnd = async () => {
    setDraggingId(null);
    try {
      await fetch(`/api/coasters/${coasterId}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          texts.map((t, i) => ({ id: t.id, order: i })) // send id + new order
        ),
      });
    } catch (err) {
      console.error("Failed to update text order:", err);
    }
  };

  return (
    <div className="space-y-6 pt-6 w-full">
      {isAdminMode && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer"
          >
            Add Text
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-500 dark:text-gray-400">
          Loading coaster information...
        </p>
      ) : !texts.length ? (
        <p className="text-center text-gray-600 dark:text-gray-400">
          No coaster description available yet.
        </p>
      ) : (
        texts.map((entry) => (
          <div
            key={entry.id}
            draggable={isAdminMode}
            onDragStart={() => onDragStart(entry.id)}
            onDragOver={(e) => onDragOver(e, entry.id)}
            onDragEnd={onDragEnd}
            className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-300 dark:border-white/10 mb-4 w-full relative cursor-${isAdminMode ? "grab" : "auto"}`}
          >
            {isAdminMode && (
              <div className="absolute top-4 right-4 flex space-x-2">
                <button
                  title="Edit"
                  className="text-blue-500 hover:text-blue-700 cursor-pointer"
                  onClick={() => setEditingText(entry)}
                >
                  🔧
                </button>
              </div>
            )}

            {isAdminMode && (
              <span className="text-gray-400 dark:text-gray-500 mb-2 block text-sm">
                Drag to reorder
              </span>
            )}

            <h3 className="text-2xl font-semibold dark:text-white mb-4 break-words">
              {entry.headline || "Coaster Information"}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">
              {entry.text || ""}
            </p>
          </div>

        ))
      )}

      {modalOpen || editingText ? (
        <CoasterTextModal
          coasterId={coasterId}
          textEntry={editingText || undefined}
          onClose={() => {
            setModalOpen(false);
            setEditingText(null);
          }}
          onSuccess={fetchTexts}
        />
      ) : null}


    </div>
  );
};

export default CoasterText;
