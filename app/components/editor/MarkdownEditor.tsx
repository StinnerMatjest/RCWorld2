"use client";

import React, { useCallback, useLayoutEffect, useRef } from "react";

/**
 * The plain-markdown editor used for review sections and coaster texts.
 *
 * Supports the small markup set MarkdownText renders: **bold**, *italic*,
 * ||spoiler|| and "- " bullet lines. Edits go through the browser's own
 * insert-text path so Ctrl+Z / Ctrl+Y keep working after a toolbar action.
 */
export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  textareaClassName?: string;
  /** Rendered at the right end of the toolbar (e.g. a word count). */
  toolbarEnd?: React.ReactNode;
}

export function countTextStats(text: string) {
  if (!text) return { words: 0, paragraphs: 0 };
  const paragraphs = text.split("\n").filter(line => line.trim() !== "").length;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  return { words, paragraphs };
}

/** Replace [start, end) with `text`, keeping the native undo stack when the browser allows it. */
function replaceRange(ta: HTMLTextAreaElement, start: number, end: number, text: string) {
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok || ta.value.slice(start, start + text.length) !== text) {
    ta.setRangeText(text, start, end, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minRows = 12,
  autoFocus = false,
  textareaClassName = "",
  toolbarEnd,
}: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the content: the surrounding panel scrolls, the textarea never does.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [value]);

  const toggleWrap = useCallback((marker: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const m = marker.length;
    const selected = v.slice(s, e);

    if (selected.length >= 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
      const inner = selected.slice(m, selected.length - m);
      replaceRange(ta, s, e, inner);
      ta.setSelectionRange(s, s + inner.length);
    } else if (s >= m && v.slice(s - m, s) === marker && v.slice(e, e + m) === marker) {
      replaceRange(ta, s - m, e + m, selected);
      ta.setSelectionRange(s - m, e - m);
    } else {
      replaceRange(ta, s, e, marker + selected + marker);
      ta.setSelectionRange(s + m, e + m);
    }
  }, []);

  const toggleBullets = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const v = ta.value;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = v.indexOf("\n", Math.max(e - 1, s));
    if (lineEnd === -1) lineEnd = v.length;
    const block = v.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const allBulleted = lines.every(l => l.startsWith("- ") || l.trim() === "");
    const next = lines
      .map(l => (allBulleted ? l.replace(/^- /, "") : l.trim() === "" ? l : `- ${l}`))
      .join("\n");
    replaceRange(ta, lineStart, lineEnd, next);
    const delta = next.length - block.length;
    if (lines.length === 1) {
      const caret = Math.max(lineStart, s + delta);
      ta.setSelectionRange(caret, caret);
    } else {
      ta.setSelectionRange(lineStart, lineStart + next.length);
    }
  }, []);

  const clearFormatting = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;
    const stripped = ta.value.replace(/\*\*|\*|\|\|/g, "");
    if (stripped === ta.value) return;
    replaceRange(ta, 0, ta.value.length, stripped);
    ta.setSelectionRange(stripped.length, stripped.length);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b" && !e.shiftKey) { e.preventDefault(); toggleWrap("**"); return; }
      if (k === "i" && !e.shiftKey) { e.preventDefault(); toggleWrap("*"); return; }
      if (k === "s" && e.shiftKey) { e.preventDefault(); toggleWrap("||"); return; }
      if (k === "l" && e.shiftKey) { e.preventDefault(); toggleBullets(); return; }
    }

    // Enter inside a bullet continues the list; Enter on an empty bullet ends it.
    if (e.key === "Enter" && !e.shiftKey && !mod) {
      const ta = e.currentTarget;
      const s = ta.selectionStart;
      if (s !== ta.selectionEnd) return;
      const v = ta.value;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      const line = v.slice(lineStart, s);
      if (line.startsWith("- ")) {
        e.preventDefault();
        if (line.trim() === "-") {
          replaceRange(ta, lineStart, s, "");
          ta.setSelectionRange(lineStart, lineStart);
        } else {
          replaceRange(ta, s, s, "\n- ");
          ta.setSelectionRange(s + 3, s + 3);
        }
      }
    }
  };

  const btn = "w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:bg-slate-800 text-sm text-slate-200 cursor-pointer transition-colors";
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button type="button" onMouseDown={keepFocus} onClick={() => toggleWrap("**")} title="Bold (Ctrl+B)" className={`${btn} font-bold`}>B</button>
        <button type="button" onMouseDown={keepFocus} onClick={() => toggleWrap("*")} title="Italic (Ctrl+I)" className={`${btn} italic`}>I</button>
        <button type="button" onMouseDown={keepFocus} onClick={toggleBullets} title="Bullet list (Ctrl+Shift+L)" className={btn}>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="3" cy="5" r="1.5" /><circle cx="3" cy="10" r="1.5" /><circle cx="3" cy="15" r="1.5" /><rect x="7" y="4" width="11" height="2" rx="1" /><rect x="7" y="9" width="11" height="2" rx="1" /><rect x="7" y="14" width="11" height="2" rx="1" /></svg>
        </button>
        <button type="button" onMouseDown={keepFocus} onClick={() => toggleWrap("||")} title="Spoiler (Ctrl+Shift+S)" className={`${btn} font-bold font-mono`}>S</button>
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <button type="button" onMouseDown={keepFocus} onClick={clearFormatting} title="Clear formatting" className={btn}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5h12v2M8 5l-3 14M14 5l-1.5 7M3 21l6-6M9 21l-6-6" /></svg>
        </button>
        {toolbarEnd && <div className="ml-auto">{toolbarEnd}</div>}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={minRows}
        autoFocus={autoFocus}
        spellCheck
        className={`w-full p-4 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none overflow-hidden text-base md:text-lg leading-relaxed ${textareaClassName}`}
      />
    </div>
  );
}
