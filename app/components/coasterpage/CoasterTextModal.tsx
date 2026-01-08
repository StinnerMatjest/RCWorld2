"use client";

import React, { useState, useEffect } from "react";

interface CoasterTextEntry {
  id: number;
  headline: string | null;
  text: string | null;
}

interface Props {
  coasterId: number;
  onClose: () => void;
  onSuccess?: () => void;
  textEntry?: CoasterTextEntry;
}

export default function CoasterTextModal({ coasterId, onClose, onSuccess, textEntry }: Props) {
  const [headline, setHeadline] = useState(textEntry?.headline || "");
  const [text, setText] = useState(textEntry?.text || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (textEntry) {
      setHeadline(textEntry.headline || "");
      setText(textEntry.text || "");
    }
  }, [textEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body: any = { headline, text };
      if (textEntry?.id) body.id = textEntry.id;

      const res = await fetch(`/api/coasters/${coasterId}/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to save coaster text");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!textEntry) return;

    if (!confirm("Are you sure you want to delete this text entry?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/coasters/${coasterId}/text`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textId: textEntry.id }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to delete coaster text");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          {textEntry ? "Edit Coaster Text" : "Add Coaster Text"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Optional headline"
              className="block w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-white/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter coaster description"
              rows={5}
              className="block w-full p-3 rounded-md border border-gray-300 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 dark:border-white/10"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-between gap-3 pt-2">
            {textEntry && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white bg-red-500 hover:bg-red-600 cursor-pointer ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                Delete
              </button>
            )}

            <div className="ml-auto flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer ${
                  loading ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
