"use client";

import React, { useEffect, useRef, useState } from "react";
import { XMarkIcon, ShareIcon } from "@/app/components/coastle/Icons";

interface RankleResultModalProps {
  isOpen: boolean;
  bank: number;
  startBank: number;
  history: boolean[];
  rounds: number;
  streak: number;
  allGamesPlayed: boolean;
  onClose: () => void;
  onShare: () => void;
  onShareAll: () => void;
}

export function RankleResultModal({
  isOpen,
  bank,
  startBank,
  history,
  rounds,
  streak,
  allGamesPlayed,
  onClose,
  onShare,
  onShareAll,
}: RankleResultModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<null | "one" | "all">(null);
  const bust = bank <= 0;
  const won = bank > startBank;

  const copyFeedback = (which: "one" | "all", fn: () => void) => {
    fn();
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = bust ? "BUSTED" : won ? "IN THE MONEY!" : "BROKE EVEN-ISH";
  const correct = history.filter(Boolean).length;

  const primaryBtn = "hover:opacity-90 bg-slate-100 text-slate-900";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`
          relative w-full max-w-[420px] sm:max-w-md
          rounded-3xl p-1 shadow-2xl overflow-hidden
          animate-in zoom-in-95 duration-500
          ${won ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500" : "bg-slate-700"}
        `}
      >
        <div className="relative bg-neutral-900 rounded-[22px] p-4 sm:p-6 md:p-8 overflow-hidden">
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full text-slate-300 hover:text-white bg-neutral-800/70 transition z-10 cursor-pointer"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          <div className="text-center mt-1">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{title}</h2>
            <div className="mt-1 text-xs sm:text-sm font-bold text-slate-300">
              {correct}/{rounds} duels won
            </div>
            {streak > 0 && (
              <div className="mt-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
                🔥 Streak: {streak}
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-slate-300">
              Final bank
            </div>
            <div
              className={`mt-1 text-5xl sm:text-6xl font-black tracking-tight ${
                bust ? "text-red-400" : won ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400" : "text-slate-200"
              }`}
            >
              {Math.max(0, bank)}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-500">started with {startBank}</div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className={`w-4 h-4 rounded-full ${h ? "bg-green-400" : "bg-red-400"}`}
                title={`Round ${i + 1}: ${h ? "won" : "lost"}`}
              />
            ))}
          </div>

          <div className="mt-5 sm:mt-6 flex flex-col gap-2.5 sm:gap-3">
            <button
              onClick={() => copyFeedback("one", onShare)}
              className={`w-full py-2 sm:py-3 md:py-3.5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${primaryBtn}`}
            >
              <ShareIcon className="w-5 h-5" />
              {copied === "one" ? "Copied!" : "Share Result"}
            </button>
            <button
              onClick={() => copyFeedback("all", onShareAll)}
              title={allGamesPlayed ? "Copy today's results from all four games" : "Copies whichever games you've finished today"}
              className="w-full py-2 sm:py-3 md:py-3.5 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ShareIcon className="w-5 h-5" />
              {copied === "all" ? "Copied!" : "Copy all 4 results"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
