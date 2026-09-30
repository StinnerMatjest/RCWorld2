"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/app/hooks/useScrollLock";
import { MarkdownEditor, countTextStats } from "../editor/MarkdownEditor";
import { SectionBody, mediaCaptions } from "../parkpage/SectionBody";
import {
  SectionMediaPanel,
  mediaDraftFromStored,
  mediaEntriesOf,
  mediaStoredOf,
  type MediaDraft,
} from "../editor/SectionMediaEditor";
import type { CoasterTextEntry, CoasterGalleryImage } from "./coasterPageTypes";

export type { CoasterTextEntry } from "./coasterPageTypes";

interface Props {
  coasterId: number;
  onClose: () => void;
  onSuccess?: () => void;
  textEntry?: CoasterTextEntry;
  /** The coaster's gallery, for the section image picker. */
  galleryImages?: CoasterGalleryImage[];
  /** Gallery paths already placed in other sections (path -> section names). */
  usedIn?: Record<string, string[]>;
}

/**
 * Coaster review section editor: headline, markdown text, up to three gallery
 * images with a layout, and a live preview of the section as the page shows
 * it. Ctrl+S saves.
 */
export default function CoasterTextModal({ coasterId, onClose, onSuccess, textEntry, galleryImages = [], usedIn = {} }: Props) {
  useScrollLock();
  const [headline, setHeadline] = useState(textEntry?.headline || "");
  const [text, setText] = useState(textEntry?.text || "");
  const [isSpoiler, setIsSpoiler] = useState(textEntry?.isSpoiler || false);
  const [media, setMedia] = useState<MediaDraft>(() => mediaDraftFromStored(textEntry?.imageUrl, textEntry?.imageLayout));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  const [mobileView, setMobileView] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (textEntry) {
      setHeadline(textEntry.headline || "");
      setText(textEntry.text || "");
      setIsSpoiler(textEntry.isSpoiler || false);
      setMedia(mediaDraftFromStored(textEntry.imageUrl, textEntry.imageLayout));
    }
  }, [textEntry]);

  const captions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);
  const storedMedia = mediaStoredOf(media);
  const storedLayout = media.images.length ? media.layout : null;

  const dirty =
    headline !== (textEntry?.headline || "") ||
    text !== (textEntry?.text || "") ||
    isSpoiler !== (textEntry?.isSpoiler || false) ||
    storedMedia !== (textEntry?.imageUrl || null) ||
    storedLayout !== (textEntry?.imageLayout || null);

  const save = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { headline, text, isSpoiler, imageUrl: storedMedia, imageLayout: storedLayout };
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
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save();
  };

  const requestClose = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline, text, isSpoiler, media, loading, dirty]);

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
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const stats = countTextStats(text);
  const isAdminView = !previewAsVisitor;
  const mediaEntries = mediaEntriesOf(media);

  const preview = (
    <div className="space-y-3">
      {headline.trim() && (
        <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
          <h3 className="text-xl font-semibold text-white">{headline}</h3>
          {isAdminView && isSpoiler && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50">
              Spoiler
            </span>
          )}
        </div>
      )}
      {text.trim() || mediaEntries.length ? (
        <SectionBody
          text={text}
          media={mediaEntries}
          layout={media.layout}
          isSpoiler={isSpoiler}
          isAdminMode={isAdminView}
          altLabel={headline || "Section image"}
          textClassName="text-slate-300 leading-relaxed text-base"
          captions={captions}
        />
      ) : (
        <p className="text-slate-600 italic">Nothing to preview yet.</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-2 sm:p-4" onClick={requestClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden text-slate-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-800 flex-shrink-0">
          <h2 className="font-bold text-white text-base flex-1 truncate">
            {textEntry ? "Edit review section" : "Add review section"}
          </h2>
          <div className="md:hidden flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
            {(["write", "preview"] as const).map(v => (
              <button key={v} type="button" onClick={() => setMobileView(v)}
                className={`px-3 py-1 rounded-md capitalize cursor-pointer transition-colors ${mobileView === v ? "bg-slate-700 text-white" : "text-slate-400"}`}>
                {v}
              </button>
            ))}
          </div>
          {error && <span className="hidden md:inline text-sm text-red-400 font-medium truncate max-w-xs">{error}</span>}
          {textEntry && (
            <button type="button" onClick={handleDelete} disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 text-sm font-medium hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50">
              Delete
            </button>
          )}
          <button type="button" onClick={save} disabled={loading || !dirty} title="Ctrl+S"
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-default text-white text-sm font-bold transition-colors cursor-pointer">
            {loading ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={requestClose} aria-label="Close"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        {error && <div className="md:hidden px-4 py-1.5 text-xs text-red-400 border-b border-slate-800">{error}</div>}

        {/* Body */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <form onSubmit={handleSubmit}
            className={`${mobileView === "preview" ? "hidden md:flex" : "flex"} flex-1 min-w-0 min-h-0 flex-col overflow-y-auto`}>
            <div className="p-4 sm:p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Optional headline"
                  className="block w-full p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-base font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-300">Text</label>
                <MarkdownEditor
                  value={text}
                  onChange={setText}
                  placeholder="Describe the experience…"
                  minRows={8}
                  autoFocus={!textEntry}
                  toolbarEnd={
                    <span className="text-xs text-slate-500 font-medium tracking-wide">
                      {stats.words} words · {stats.paragraphs} paragraphs
                    </span>
                  }
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(e) => setIsSpoiler(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-sm font-medium text-slate-300">Mark whole section as spoiler</span>
              </label>

              <div className="pt-4 border-t border-slate-800">
                <SectionMediaPanel
                  draft={media}
                  onChange={setMedia}
                  galleryImages={galleryImages}
                  captions={captions}
                  usedIn={usedIn}
                />
              </div>
            </div>
          </form>

          <div className={`${mobileView === "write" ? "hidden md:flex" : "flex"} flex-col flex-1 md:w-[42%] md:flex-none min-w-0 min-h-0 border-l border-slate-800 bg-[#0f172a]`}>
            <div className="flex items-center justify-between px-4 h-10 border-b border-slate-800/80 flex-shrink-0 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">Preview</span>
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 font-bold">
                {([false, true] as const).map(v => (
                  <button key={String(v)} type="button" onClick={() => setPreviewAsVisitor(v)}
                    className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-colors ${previewAsVisitor === v ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {v ? "As visitor" : "As admin"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">{preview}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
