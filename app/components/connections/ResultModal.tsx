"use client";

import { useEffect, useRef } from "react";
import { XMarkIcon, ShareIcon } from "@/app/components/coastle/Icons";

export type ConnectionsColor = "yellow" | "green" | "blue" | "purple";

export type ConnectionsGuessHistoryEntry = {
  tiles: string[];
  colors: ConnectionsColor[];
};

export type ConnectionsSolvedGroup = {
  id: string;
  label: string;
  colorClass: string;
  coasters: string[];
};

interface ResultModalProps {
  isOpen: boolean;
  gameState: "won" | "lost" | "playing";
  solvedCount: number;
  totalGroups: number;
  mistakes: number;
  maxMistakes: number;
  guessHistory: ConnectionsGuessHistoryEntry[];
  solvedGroups: ConnectionsSolvedGroup[];
  onClose: () => void;
  onShare: () => void;
  onReset: () => void;
}

function colorToEmoji(color: ConnectionsColor) {
  switch (color) {
    case "yellow":
      return "🟨";
    case "green":
      return "🟩";
    case "blue":
      return "🟦";
    case "purple":
      return "🟪";
    default:
      return "⬛";
  }
}

function GuessPreview({ guess }: { guess: ConnectionsGuessHistoryEntry }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {guess.colors.map((color, index) => {
        const bg =
          color === "yellow"
            ? "bg-yellow-400"
            : color === "green"
              ? "bg-emerald-500"
              : color === "blue"
                ? "bg-sky-500"
                : "bg-violet-500";

        return <div key={index} className={`h-4 w-4 rounded-[4px] ${bg}`} />;
      })}
    </div>
  );
}

export function buildConnectionsShareText({
  gameState,
  solvedCount,
  totalGroups,
  guessHistory,
}: {
  gameState: "won" | "lost" | "playing";
  solvedCount: number;
  totalGroups: number;
  mistakes: number;
  maxMistakes: number;
  guessHistory: ConnectionsGuessHistoryEntry[];
}) {
  const guessCount = guessHistory.length;

  const status =
    gameState === "won"
      ? `I completed it in ${solvedCount} out of ${guessCount} guesses`
      : "I did not complete it.";

  const grid = guessHistory
    .map((guess) => guess.colors.map(colorToEmoji).join(" "))
    .join("\n");

  return [
    "**Daily Connections**",
    status,
    "",
    grid,
    "",
    "Play at <https://parkrating.com/connections>",
  ].join("\n");
}

export function ResultModal({
  isOpen,
  gameState,
  solvedCount,
  totalGroups,
  guessHistory,
  onClose,
  onShare,
  onReset,
}: ResultModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

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

  const isWon = gameState === "won";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-3xl p-1 shadow-2xl ${
          isWon
            ? "bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600"
            : "bg-slate-700"
        }`}
      >
        <div className="rounded-[22px] bg-white p-5 dark:bg-neutral-900 sm:p-6">
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/70 p-2 text-slate-500 transition hover:text-slate-900 dark:bg-neutral-800/70 dark:text-slate-300 dark:hover:text-white"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {isWon ? "NAILED IT!" : "TRACK INCOMPLETE"}
            </h2>
            <div className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
              {`Solved ${solvedCount}/${totalGroups} groups`}
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-slate-100/90 p-4 dark:bg-neutral-800/60">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Your guesses
            </div>

            <div className="mt-3 flex flex-col items-center gap-2">
              {guessHistory.length > 0 ? (
                guessHistory.map((guess, index) => (
                  <GuessPreview key={`${guess.tiles.join("-")}-${index}`} guess={guess} />
                ))
              ) : (
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  No guesses recorded.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button
              onClick={onShare}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            >
              <ShareIcon className="h-5 w-5" />
              Share Result
            </button>

            <button
              onClick={onReset}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-black text-white transition hover:brightness-110"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}