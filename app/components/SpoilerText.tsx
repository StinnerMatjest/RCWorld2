"use client";
import { useState, useEffect } from "react";

/**
 * Spoiler cover for review text. A whole section (`block`) is blurred behind
 * a plain "Show spoilers" button that is always visible (the old hover-only
 * button never appeared on a phone), and can be hidden again. Inline
 * ||spoilers|| are a solid bar in the running text, the convention readers
 * know from chat apps, and become ordinary text once tapped.
 */
export default function SpoilerText({
    children,
    forceReveal = false,
    block = false,
    isAdminMode = false,
    className = ""
}: {
    children: React.ReactNode,
    forceReveal?: boolean,
    block?: boolean,
    isAdminMode?: boolean,
    className?: string
}) {
    const [revealed, setRevealed] = useState(forceReveal);

    // Sync precisely with prop changes
    useEffect(() => {
        setRevealed(forceReveal);
    }, [forceReveal]);

    if (block) {
        return (
            <div className={`relative ${revealed && isAdminMode ? "rounded-xl bg-red-900/10 ring-1 ring-red-900/30 p-4 -m-4" : ""} ${className}`}>
                {revealed && !forceReveal && (
                    <button
                        type="button"
                        onClick={() => setRevealed(false)}
                        className="float-right ml-4 mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                        Hide spoilers
                    </button>
                )}
                <div
                    aria-hidden={!revealed}
                    className={`transition-[filter,opacity] duration-300 ${revealed ? "" : "blur-[7px] opacity-60 select-none pointer-events-none"}`}
                >
                    {children}
                </div>

                {!revealed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#0f172a]/10 via-transparent to-[#0f172a]/10">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Contains ride spoilers</p>
                        <button
                            type="button"
                            onClick={() => setRevealed(true)}
                            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold py-2 px-4 rounded-lg border border-slate-700 hover:border-slate-500 shadow-xl transition-colors cursor-pointer"
                        >
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            Show spoilers
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Inline ||spoiler||
    if (revealed) {
        return (
            <span className={`rounded-sm px-1 ${isAdminMode ? "bg-red-900/40 text-red-300" : "bg-slate-800/70 text-slate-100"}`}>
                {children}
            </span>
        );
    }
    return (
        <span
            role="button"
            tabIndex={0}
            onClick={() => setRevealed(true)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRevealed(true); } }}
            title="Spoiler. Tap to reveal"
            aria-label="Spoiler, tap to reveal"
            className="inline rounded-sm px-1 bg-slate-600 text-transparent select-none cursor-pointer hover:bg-slate-500 transition-colors"
        >
            {children}
        </span>
    );
}
