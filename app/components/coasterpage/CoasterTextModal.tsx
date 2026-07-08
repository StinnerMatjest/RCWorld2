"use client";

import React, { useState, useEffect, useRef } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";

export interface CoasterTextEntry {
  id: number;
  coaster_id?: number;
  headline: string | null;
  text: string | null;
  order?: number;
  isSpoiler?: boolean;
}

interface Props {
  coasterId: number;
  onClose: () => void;
  onSuccess?: () => void;
  textEntry?: CoasterTextEntry;
}

export default function CoasterTextModal({ coasterId, onClose, onSuccess, textEntry }: Props) {
  useScrollLock();
  const [headline, setHeadline] = useState(textEntry?.headline || "");
  const [text, setText] = useState(textEntry?.text || "");
  const [isSpoiler, setIsSpoiler] = useState(textEntry?.isSpoiler || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textEntry) {
      setHeadline(textEntry.headline || "");
      setText(textEntry.text || "");
      setIsSpoiler(textEntry.isSpoiler || false);
    }
  }, [textEntry]);

  const wrapSelection = (before: string, after = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const scroll = ta.scrollTop;

    const next = text.slice(0, s) + before + text.slice(s, e) + after + text.slice(e);
    setText(next);

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, e + before.length);
      ta.scrollTop = scroll;
    }, 0);
  };

  const insertBullet = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const scroll = ta.scrollTop;

    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    const next = text.slice(0, lineStart) + "- " + text.slice(lineStart);
    setText(next);

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + 2, s + 2);
      ta.scrollTop = scroll;
    }, 0);
  };

  const clearFormatting = () => {
    setText((prev) => prev.replace(/\*\*|\*|\|\|/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body: any = { headline, text, isSpoiler };
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
    <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center">
      <div className="bg-gray-800 dark:text-gray-100 rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">
          {textEntry ? "Edit Coaster Text" : "Add Coaster Text"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Optional headline"
              className="block w-full p-2 rounded-md border bg-gray-900 text-gray-100 border-white/10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              Text
            </label>

            {/* Toolbar */}
            <div className="flex items-center gap-1 mb-2">
              <button type="button" onClick={() => wrapSelection("**")} title="Bold"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-700 font-bold text-sm text-gray-300 cursor-pointer transition-colors">
                B
              </button>
              <button type="button" onClick={() => wrapSelection("*")} title="Italic"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-700 italic text-sm text-gray-300 cursor-pointer transition-colors">
                I
              </button>
              <button type="button" onClick={insertBullet} title="Bullet list"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-700 text-sm text-gray-300 cursor-pointer transition-colors">
                •—
              </button>
              <button type="button" onClick={() => wrapSelection("||")} title="Spoiler Inline"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-700 font-bold text-sm text-gray-300 cursor-pointer transition-colors font-mono">
                S
              </button>
              <div className="w-px h-5 bg-gray-700 mx-1"></div>
              <button type="button" onClick={clearFormatting} title="Clear Formatting"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-700 hover:bg-gray-700 font-bold text-sm text-gray-300 cursor-pointer transition-colors">
                🧹
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter coaster description"
              rows={5}
              className="block w-full p-3 rounded-md border bg-gray-900 text-gray-100 border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="spoiler-check"
              checked={isSpoiler}
              onChange={(e) => setIsSpoiler(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500/50"
            />
            <label htmlFor="spoiler-check" className="text-sm font-medium text-gray-300 cursor-pointer">
              Mark as spoiler section
            </label>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-between gap-3 pt-2">
            {textEntry && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white bg-red-500 hover:bg-red-600 cursor-pointer ${loading ? "cursor-not-allowed opacity-50" : ""
                  }`}
              >
                Delete
              </button>
            )}

            <div className="ml-auto flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white bg-blue-500 hover:bg-blue-400 cursor-pointer ${loading ? "cursor-not-allowed opacity-50" : ""
                  }`}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-white/10 text-gray-100 hover:bg-gray-700 cursor-pointer"
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