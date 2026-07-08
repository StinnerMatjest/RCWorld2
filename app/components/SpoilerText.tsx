"use client";
import { useState, useEffect } from "react";

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

    // If this is wrapping a whole section of text
    if (block) {
        return (
            <div
                onClick={() => !forceReveal && setRevealed(true)}
                className={`relative group transition-all duration-300 rounded ${revealed
                        ? isAdminMode ? "bg-red-900/10 border border-red-900/30 p-4 -m-4" : ""
                        : "bg-slate-800/30 p-4 -m-4 border border-dashed border-slate-600 cursor-pointer select-none overflow-hidden"
                    } ${className}`}
            >
                <div className={`transition-all duration-300 ${revealed ? "" : "blur-[6px] group-hover:blur-[8px] opacity-70"}`}>
                    {children}
                </div>

                {!revealed && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="bg-slate-900 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 transform group-hover:scale-105 transition-transform duration-200">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            Show Spoilers for section
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // If this is wrapping inline text via ||spoiler||
    return (
        <span
            onClick={() => !forceReveal && setRevealed(true)}
            className={`cursor-pointer transition-all duration-300 rounded px-1 ${revealed
                    ? isAdminMode ? "bg-red-900/40 text-red-400 font-medium" : "bg-slate-800 text-inherit"
                    : "bg-slate-700 text-transparent blur-sm hover:blur-[2px] select-none"
                }`}
            title={revealed ? "" : "Click to reveal spoiler"}
        >
            {children}
        </span>
    );
}