"use client";

import { XMarkIcon, ShareIcon, ChartBarIcon, CopyIcon } from "./Icons";
import { CoastleCoaster } from "@/app/types";

interface ResultModalProps {
  isOpen: boolean;
  gameState: "won" | "lost" | "playing";
  answer: CoastleCoaster | null;
  gameMode: "daily" | "endless";
  onClose: () => void;
  onShare: () => void;
  onCopy: () => void;
  onReset: () => void;
  onShowStats: () => void;
}

export function ResultModal({
  isOpen,
  gameState,
  answer,
  gameMode,
  onClose,
  onShare,
  onCopy,
  onReset,
  onShowStats
}: ResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className={`
        relative rounded-3xl p-1 max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500
        ${gameState === "won" ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 bg-shine" : "bg-slate-700"}
      `}
      >
        <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-6 text-center relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-slate-100 dark:bg-neutral-800 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition z-10 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          <div className="mb-4 mt-2">
            {gameState === "won" ? (
              <div className="w-20 h-20 mx-auto bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center animate-bounce">
                <div className="text-5xl">🏆</div>
              </div>
            ) : (
              <div className="w-20 h-20 mx-auto bg-slate-100 text-slate-500 rounded-full flex items-center justify-center grayscale opacity-80">
                <div className="text-5xl">🎢</div>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">
            {gameState === "won" ? "Nailed It!" : "Track Incomplete"}
          </h2>

          <div className="relative my-6 group perspective">
            <div className="bg-slate-50 dark:bg-neutral-800 rounded-2xl p-4 border border-slate-200 dark:border-neutral-700 shadow-inner relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                The Answer Was
              </p>
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 leading-tight">
                {answer?.name}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Share + Copy row */}
            <div className="flex w-full gap-3">
              <button
                onClick={onShare}
                className="flex-1 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition hover:opacity-90 dark:hover:bg-slate-200 dark:hover:text-slate-900 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                <ShareIcon className="w-5 h-5" />
                <span>Share</span>
              </button>

              <button
                onClick={onCopy}
                className="flex-1 py-3 bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-2 transition hover:opacity-90 cursor-pointer"
              >
                <CopyIcon className="w-5 h-5" />
                <span>Copy</span>
              </button>
            </div>

            <div className="flex gap-3">
              {/* Hide Play Again if Daily */}
              {gameMode === "endless" && (
                <button
                  onClick={onReset}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 cursor-pointer"
                >
                  Play Again
                </button>
              )}
              <button
                onClick={() => {
                  onClose();
                  onShowStats();
                }}
                className={`${
                  gameMode === "endless" ? "flex-none px-4" : "flex-1 py-3.5"
                } rounded-xl font-bold text-slate-600 dark:text-slate-300 border-2 border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer`}
              >
                <ChartBarIcon className="w-6 h-6 mx-auto" />
                {gameMode === "daily" && <span className="ml-2">See Stats</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
