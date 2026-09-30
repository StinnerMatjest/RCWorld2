"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Full-screen coaster review editor, laid out like the park review editor so
 * it feels like the same tool: sections down the left, the selected section's
 * headline, text and images in the middle, the whole review rendered on the
 * right and scrolled to the section being edited. Sections can be added,
 * reordered and removed here; Ctrl+S saves everything that changed.
 */

type Draft = {
  key: string;
  id: number | null;
  headline: string;
  text: string;
  isSpoiler: boolean;
  media: MediaDraft;
  deleted: boolean;
};

const fingerprint = (d: Draft) =>
  JSON.stringify([d.headline, d.text, d.isSpoiler, mediaStoredOf(d.media), d.media.images.length ? d.media.layout : null, d.deleted]);

const fromEntry = (e: CoasterTextEntry): Draft => ({
  key: `s-${e.id}`,
  id: e.id,
  headline: e.headline || "",
  text: e.text || "",
  isSpoiler: !!e.isSpoiler,
  media: mediaDraftFromStored(e.imageUrl, e.imageLayout),
  deleted: false,
});

let newCounter = 0;
const blank = (): Draft => ({
  key: `new-${++newCounter}`,
  id: null,
  headline: "",
  text: "",
  isSpoiler: false,
  media: { images: [], focuses: [], layout: null, imageCount: 1 },
  deleted: false,
});

const label = (d: Draft, i: number) => d.headline.trim() || `Section ${i + 1}`;

interface Props {
  coasterId: number;
  coasterName: string;
  sections: CoasterTextEntry[];
  galleryImages: CoasterGalleryImage[];
  onClose: () => void;
  /** Called after a successful save so the page can re-fetch the sections. */
  onSaved: () => void;
}

export default function CoasterReviewEditor({ coasterId, coasterName, sections, galleryImages, onClose, onSaved }: Props) {
  useScrollLock();
  const [drafts, setDrafts] = useState<Draft[]>(() => (sections.length ? sections.map(fromEntry) : [blank()]));
  const [saved, setSaved] = useState<Record<string, string>>(() => Object.fromEntries(sections.map(fromEntry).map((d) => [d.key, fingerprint(d)])));
  const [savedOrder, setSavedOrder] = useState<string>(() => sections.map((s) => s.id).join(","));
  const [selectedKey, setSelectedKey] = useState<string>(() => (sections.length ? `s-${sections[0].id}` : ""));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [mobileView, setMobileView] = useState<"write" | "preview">("write");
  const [previewAsVisitor, setPreviewAsVisitor] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A section created before any existed has no key yet; select the first live one.
  useEffect(() => {
    if (!drafts.some((d) => d.key === selectedKey && !d.deleted)) {
      const first = drafts.find((d) => !d.deleted);
      if (first) setSelectedKey(first.key);
    }
  }, [drafts, selectedKey]);

  // Pause page videos behind the editor while it is open.
  useEffect(() => {
    const root = rootRef.current;
    const paused: HTMLVideoElement[] = [];
    document.querySelectorAll("video").forEach((v) => {
      if (root?.contains(v) || v.paused) return;
      v.pause();
      paused.push(v);
    });
    return () => { paused.forEach((v) => { v.play().catch(() => {}); }); };
  }, []);

  const captions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);
  const live = useMemo(() => drafts.filter((d) => !d.deleted), [drafts]);
  const cur = drafts.find((d) => d.key === selectedKey) ?? live[0];
  const curIndex = cur ? live.indexOf(cur) : -1;

  const orderNow = live.map((d) => d.id ?? "new").join(",");
  const dirtyKeys = useMemo(
    () => drafts.filter((d) => fingerprint(d) !== (saved[d.key] ?? "")).map((d) => d.key),
    [drafts, saved]
  );
  const orderDirty = live.every((d) => d.id !== null) && orderNow !== savedOrder;
  const dirtyCount = dirtyKeys.length + (orderDirty && dirtyKeys.length === 0 ? 1 : 0);
  const dirtySet = useMemo(() => new Set(dirtyKeys), [dirtyKeys]);

  // Which gallery paths the other sections use, for the picker's "Used" badge.
  const usedIn = useMemo(() => {
    const map: Record<string, string[]> = {};
    live.forEach((d, i) => {
      if (d.key === cur?.key) return;
      for (const url of d.media.images) (map[url] ??= []).push(label(d, i));
    });
    return map;
  }, [live, cur]);

  // ── Draft mutations ─────────────────────────────────────────────────────────
  const patch = useCallback((key: string, fn: (d: Draft) => Draft) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? fn(d) : d))), []);

  const addSection = () => {
    const d = blank();
    setDrafts((ds) => [...ds, d]);
    setSelectedKey(d.key);
    setMobileView("write");
  };
  const removeSection = (key: string) => {
    const d = drafts.find((x) => x.key === key);
    if (!d) return;
    if ((d.headline || d.text || d.media.images.length) && !confirm(`Remove "${label(d, curIndex)}" from the review?`)) return;
    if (d.id === null) setDrafts((ds) => ds.filter((x) => x.key !== key));
    else patch(key, (x) => ({ ...x, deleted: true }));
  };
  const move = (key: string, dir: -1 | 1) => {
    setDrafts((ds) => {
      const liveKeys = ds.filter((d) => !d.deleted).map((d) => d.key);
      const i = liveKeys.indexOf(key);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= liveKeys.length) return ds;
      const a = ds.findIndex((d) => d.key === liveKeys[i]);
      const b = ds.findIndex((d) => d.key === liveKeys[j]);
      const next = [...ds];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const ds = draftsRef.current;
    const changed = ds.filter((d) => fingerprint(d) !== (savedRef.current[d.key] ?? ""));
    const liveNow = ds.filter((d) => !d.deleted);
    const orderChanged = liveNow.map((d) => d.id ?? "new").join(",") !== savedOrder;
    if (changed.length === 0 && !orderChanged) return;
    setIsSaving(true);
    setSaveMsg(null);

    const failed: string[] = [];
    let expired = false;
    const ids = new Map<string, number>(ds.filter((d) => d.id !== null).map((d) => [d.key, d.id as number]));
    const newSaved = { ...savedRef.current };

    for (const d of changed) {
      try {
        if (d.deleted) {
          if (d.id !== null) {
            const res = await fetch(`/api/coasters/${coasterId}/text`, {
              method: "DELETE", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ textId: d.id }),
            });
            if (!res.ok) { if (res.status === 401) expired = true; failed.push(label(d, 0)); continue; }
          }
          newSaved[d.key] = fingerprint(d);
          continue;
        }
        if (!d.headline.trim() && !d.text.trim()) { failed.push(`${label(d, 0)} (needs a headline or text)`); continue; }
        const layout = d.media.images.length ? (d.media.layout === "double" && d.media.images.length !== 2 ? "above" : d.media.layout) : null;
        const body: Record<string, unknown> = {
          headline: d.headline, text: d.text, isSpoiler: d.isSpoiler,
          imageUrl: mediaStoredOf(d.media), imageLayout: layout,
        };
        if (d.id !== null) body.id = d.id;
        const res = await fetch(`/api/coasters/${coasterId}/text`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) { if (res.status === 401) expired = true; failed.push(label(d, 0)); continue; }
        const data = await res.json().catch(() => ({}));
        const newId: number | undefined = d.id ?? data?.text?.id ?? data?.id;
        if (newId !== undefined) ids.set(d.key, newId);
        newSaved[d.key] = fingerprint({ ...d, media: { ...d.media, layout } });
      } catch {
        failed.push(label(d, 0));
      }
    }

    // Give new sections their ids, then persist the order in one call.
    const withIds = draftsRef.current.map((d) => (d.id === null && ids.has(d.key) ? { ...d, id: ids.get(d.key)! } : d));
    const ordered = withIds.filter((d) => !d.deleted && d.id !== null);
    let orderFailed = false;
    if (ordered.length > 0) {
      try {
        const res = await fetch(`/api/coasters/${coasterId}/text`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ordered.map((d, i) => ({ id: d.id, order: i }))),
        });
        if (!res.ok) orderFailed = true;
      } catch { orderFailed = true; }
    }

    setDrafts(withIds.filter((d) => !(d.deleted && newSaved[d.key] === fingerprint(d))));
    setSaved(Object.fromEntries(withIds.map((d) => [d.key, newSaved[d.key] ?? savedRef.current[d.key] ?? ""])));
    if (!orderFailed) setSavedOrder(ordered.map((d) => d.id).join(","));
    onSaved();

    if (failed.length > 0 || orderFailed) {
      setSaveMsg({
        kind: "err",
        text: expired ? "Not saved: session expired. Log in to admin mode again." : `Failed to save: ${[...failed, ...(orderFailed ? ["section order"] : [])].join(", ")}`,
      });
    } else {
      setSaveMsg({ kind: "ok", text: changed.length === 1 ? "Saved" : `Saved ${changed.length} sections` });
      setTimeout(() => setSaveMsg((m) => (m?.kind === "ok" ? null : m)), 2500);
    }
    setIsSaving(false);
  }, [isSaving, coasterId, savedOrder, onSaved]);

  const requestClose = useCallback(() => {
    if (dirtyCount > 0 && !confirm("Unsaved changes.\n\nClose and discard them?")) return;
    onClose();
  }, [dirtyCount, onClose]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); handleSaveRef.current(); return; }
      if (e.key === "Escape") requestCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the section being edited in view in the preview.
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const el = cur ? sectionRefs.current[cur.key] : null;
    if (!el) return;
    const id = requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [cur?.key, mobileView]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (key: string) => { setSelectedKey(key); setMobileView("write"); };

  const sectionButton = (d: Draft, i: number, compact: boolean) => {
    const filled = !!(d.text || d.headline || d.media.images.length);
    const dirty = dirtySet.has(d.key);
    const active = cur?.key === d.key;
    const dot = dirty ? "bg-amber-400" : filled ? "bg-green-500" : "bg-slate-600";
    if (compact) {
      return (
        <button key={d.key} onClick={() => select(d.key)}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer max-w-[12rem] ${active ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-white" : dot}`} />
          <span className="truncate">{label(d, i)}</span>
        </button>
      );
    }
    return (
      <button key={d.key} onClick={() => select(d.key)} title={dirty ? "Unsaved changes" : undefined}
        className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left w-full transition-colors cursor-pointer rounded-lg ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="flex-1 truncate">{label(d, i)}</span>
        {dirty && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">edited</span>}
      </button>
    );
  };

  const textStats = countTextStats(cur?.text ?? "");

  return (
    <div ref={rootRef} className="fixed inset-0 z-[1000] bg-slate-950 flex flex-col text-slate-200">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 border-b border-slate-800 flex-shrink-0 bg-slate-900/60">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <h2 className="font-bold text-white text-base truncate">Edit review</h2>
          <span className="hidden sm:inline text-sm text-slate-500 truncate">{coasterName}</span>
        </div>
        <div className="lg:hidden flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
          {(["write", "preview"] as const).map((v) => (
            <button key={v} onClick={() => setMobileView(v)}
              className={`px-3 py-1 rounded-md capitalize cursor-pointer transition-colors ${mobileView === v ? "bg-slate-700 text-white" : "text-slate-400"}`}>
              {v}
            </button>
          ))}
        </div>
        {saveMsg && (
          <span className={`hidden md:inline text-sm font-medium ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</span>
        )}
        <button onClick={handleSave} disabled={isSaving || dirtyCount === 0} title="Ctrl+S"
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-default text-white text-sm font-bold transition-colors cursor-pointer">
          {isSaving ? "Saving…" : dirtyCount > 0 ? `Save ${dirtyCount}` : "Saved"}
        </button>
        <button onClick={requestClose} aria-label="Close editor"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors cursor-pointer">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      {saveMsg && (
        <div className={`md:hidden px-4 py-1.5 text-xs font-medium border-b border-slate-800 ${saveMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sections sidebar (desktop) */}
        <nav className="hidden lg:flex flex-col w-52 border-r border-slate-800 overflow-y-auto flex-shrink-0 p-2 gap-0.5 bg-slate-900/40">
          {live.map((d, i) => sectionButton(d, i, false))}
          <button onClick={addSection}
            className="mt-1 flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-left w-full rounded-lg text-brand hover:bg-slate-800/50 transition-colors cursor-pointer">
            <span className="w-2 h-2 flex-shrink-0 text-center leading-none">+</span>
            Add section
          </button>
        </nav>

        {/* Editor column */}
        <div className={`${mobileView === "preview" ? "hidden lg:flex" : "flex"} flex-1 min-w-0 min-h-0 flex-col overflow-hidden`}>
          <div className="lg:hidden flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0 border-b border-slate-800 no-scrollbar">
            {live.map((d, i) => sectionButton(d, i, true))}
            <button onClick={addSection} className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border border-dashed border-slate-600 text-brand cursor-pointer">+ Add</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950">
            {cur ? (
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 min-w-0">
                    <span className="truncate">{label(cur, curIndex)}</span>
                    {cur.isSpoiler && <span className="text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50 px-2 py-0.5 rounded">Spoiler</span>}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => move(cur.key, -1)} disabled={curIndex <= 0} title="Move up"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-default cursor-pointer">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5-5 5 5" /></svg>
                    </button>
                    <button onClick={() => move(cur.key, 1)} disabled={curIndex >= live.length - 1} title="Move down"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-default cursor-pointer">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8l5 5 5-5" /></svg>
                    </button>
                    <button onClick={() => removeSection(cur.key)} title="Remove section"
                      className="ml-1 px-2.5 py-1.5 rounded-lg border border-red-900/50 text-red-400 text-xs font-medium hover:bg-red-900/20 transition-colors cursor-pointer">
                      Remove
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-300">Headline</label>
                  <input
                    type="text"
                    value={cur.headline}
                    onChange={(e) => patch(cur.key, (d) => ({ ...d, headline: e.target.value }))}
                    placeholder="Optional headline"
                    className="block w-full p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-base font-semibold"
                  />
                </div>

                <MarkdownEditor
                  key={cur.key}
                  value={cur.text}
                  onChange={(text) => patch(cur.key, (d) => ({ ...d, text }))}
                  placeholder="Write about the ride…"
                  toolbarEnd={
                    <span className="text-xs text-slate-500 font-medium tracking-wide">
                      {textStats.words} words · {textStats.paragraphs} paragraphs
                    </span>
                  }
                />

                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={cur.isSpoiler}
                    onChange={(e) => patch(cur.key, (d) => ({ ...d, isSpoiler: e.target.checked }))}
                    className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500/50"
                  />
                  <span className="text-sm font-medium text-slate-300">Mark whole section as spoiler</span>
                </label>

                <div className="pt-2 border-t border-slate-800">
                  <SectionMediaPanel
                    key={cur.key}
                    draft={cur.media}
                    onChange={(media) => patch(cur.key, (d) => ({ ...d, media }))}
                    galleryImages={galleryImages}
                    captions={captions}
                    usedIn={usedIn}
                    defaultLayout={curIndex % 2 === 0 ? "left" : "right"}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <button onClick={addSection} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-bold cursor-pointer">Add the first section</button>
              </div>
            )}
          </div>
        </div>

        {/* Preview column */}
        <div className={`${mobileView === "write" ? "hidden lg:flex" : "flex"} flex-col lg:w-[46%] xl:w-1/2 flex-1 lg:flex-none min-w-0 min-h-0 border-l border-slate-800 bg-[#0f172a]`}>
          <div className="flex items-center justify-between px-4 h-10 border-b border-slate-800/80 flex-shrink-0 text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-500">Preview</span>
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 font-bold">
              {([false, true] as const).map((v) => (
                <button key={String(v)} onClick={() => setPreviewAsVisitor(v)}
                  className={`px-2.5 py-0.5 rounded-md cursor-pointer transition-colors ${previewAsVisitor === v ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  {v ? "As visitor" : "As admin"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#0f172a]">
            <div className="max-w-[900px] px-5 sm:px-8 py-8 space-y-10">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Our review</h2>
                <div className="w-12 h-1 bg-brand rounded-full mt-3" />
              </div>
              {live.map((d, i) => {
                const active = cur?.key === d.key;
                const media = mediaEntriesOf(d.media);
                const empty = !d.text.trim() && media.length === 0;
                return (
                  <div
                    key={d.key}
                    ref={(el) => { sectionRefs.current[d.key] = el; }}
                    onClick={active ? undefined : () => setSelectedKey(d.key)}
                    title={active ? undefined : `Click to edit ${label(d, i)}`}
                    className={`relative rounded-2xl scroll-mt-6 -mx-3 px-3 py-3 transition-[box-shadow,background-color] space-y-3 ${active ? "ring-1 ring-blue-500/50 bg-blue-500/[0.05]" : "cursor-pointer hover:ring-1 hover:ring-slate-600/70"}`}
                  >
                    {active && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">Editing</span>
                    )}
                    {d.headline.trim() && (
                      <div className="flex items-baseline gap-3 border-l-4 border-brand pl-3">
                        <h3 className="text-xl font-semibold text-white">{d.headline}</h3>
                        {!previewAsVisitor && d.isSpoiler && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-900/40 text-red-400 border border-red-800/50">Spoiler</span>
                        )}
                      </div>
                    )}
                    {empty ? (
                      <p className="text-slate-600 italic">{active ? "Nothing to preview yet. Start writing on the left." : "Nothing written yet."}</p>
                    ) : (
                      <SectionBody
                        text={d.text}
                        media={media}
                        layout={d.media.layout}
                        fallbackRight={i % 2 !== 0}
                        isSpoiler={d.isSpoiler}
                        isAdminMode={!previewAsVisitor}
                        altLabel={label(d, i)}
                        textClassName="text-slate-300 leading-relaxed text-base"
                        captions={captions}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
