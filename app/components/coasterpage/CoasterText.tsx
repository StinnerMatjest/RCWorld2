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
          texts.map((t, i) => ({ id: t.id, order: i }))
        ),
      });
    } catch (err) {
      console.error("Failed to update text order:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 pt-4 animate-pulse">
        <div className="space-y-3">
            <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Admin Add Button */}
      {isAdminMode && (
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            + Add Section
          </button>
        </div>
      )}

      {!texts.length ? (
        <p className="text-gray-500 italic dark:text-gray-400">
          No experience description available yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {texts.map((entry, index) => (
            <div
              key={entry.id}
              draggable={isAdminMode}
              onDragStart={() => onDragStart(entry.id)}
              onDragOver={(e) => onDragOver(e, entry.id)}
              onDragEnd={onDragEnd}
              className={`
                relative group transition-all duration-200
                ${isAdminMode 
                  ? "p-4 mb-4 border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-move rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800" 
                  : "mb-8 last:mb-0"
                }
              `}
            >
              {/* Admin Controls */}
              {isAdminMode && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Edit"
                    className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600"
                    onClick={() => setEditingText(entry)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Content */}
              <div>
                {entry.headline && (
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {entry.headline}
                  </h3>
                )}
                {entry.text && (
                  <p className="whitespace-pre-wrap leading-relaxed text-base text-gray-700 dark:text-gray-300">
                    {entry.text}
                  </p>
                )}
              </div>

              {/* Separator Line (Visible only in public mode, and not on the last item) */}
              {!isAdminMode && index !== texts.length - 1 && (
                  <div className="mt-8 border-b border-gray-200 dark:border-gray-800 w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
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