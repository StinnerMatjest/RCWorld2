"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { XMarkIcon, ShareIcon } from "@/app/components/coastle/Icons";
import { getTodayString } from "@/app/utils/coastle";

export type ConnectionsColor =
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "orange"
  | "red"
  | "brown";

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
  groups: ConnectionsSolvedGroup[];
  onClose: () => void;
  onShare: (text: string) => void;
  onReset: () => void;
  onNextBoard?: () => void;
}

/* ------------------ EMOJIS ------------------ */

function getEmoji(color: ConnectionsColor) {
  switch (color) {
    case "yellow": return "🟨";
    case "green":  return "🟩";
    case "blue":   return "🟦";
    case "purple": return "🟪";
    case "orange": return "🟧";
    case "red":    return "🟥";
    case "brown":  return "🟫";
  }
}

/* ------------------ COLOR MAP ------------------ */

function parseColor(colorClass: string): ConnectionsColor {
  if (colorClass.includes("amber")) return "yellow";
  if (colorClass.includes("emerald")) return "green";
  if (colorClass.includes("sky")) return "blue";
  if (colorClass.includes("violet")) return "purple";
  return "purple";
}

const COLOR_SUBSTITUTES: ConnectionsColor[] = ["orange", "red", "brown"];

function buildColorMap(groups: ConnectionsSolvedGroup[]) {
  const seen = new Map<ConnectionsColor, number>();
  const map = new Map<string, ConnectionsColor>();
  let substituteIdx = 0;

  for (const group of groups) {
    const base = parseColor(group.colorClass);
    const count = seen.get(base) ?? 0;

    const finalColor: ConnectionsColor =
      count === 0 ? base : (COLOR_SUBSTITUTES[substituteIdx++] ?? "brown");

    seen.set(base, count + 1);

    group.coasters.forEach((c) => map.set(c, finalColor));
  }

  return map;
}

/* ------------------ SHARE TEXT ------------------ */

export function buildConnectionsShareText({
  gameState,
  solvedCount,
  totalGroups,
  mistakes,
  maxMistakes,
  guessHistory,
  groups,
}: {
  gameState: "won" | "lost" | "playing";
  solvedCount: number;
  totalGroups: number;
  mistakes: number;
  maxMistakes: number;
  guessHistory: ConnectionsGuessHistoryEntry[];
  groups: ConnectionsSolvedGroup[];
}) {
  const isWon = gameState === "won";

  let status = "I did not complete it";

  if (isWon && mistakes === 0) {
    status = "⭐ I completed it with 0 mistakes ⭐";
  } else if (isWon) {
    status = "I completed it";
  }

  const map = buildColorMap(groups);

  const grid = guessHistory
    .map((guess) =>
      guess.tiles
        .map((tile, i) => getEmoji(map.get(tile) ?? guess.colors[i]))
        .join("  ")
    )
    .join("\n\u200A\n");

  return [
    "Daily Connections",
    status,
    `${solvedCount}/${totalGroups} categories${
  gameState === "won"
    ? ` with ${maxMistakes - mistakes} mistakes left`
    : ""
}`,
    "",
    grid,
    "",
    "Play at https://parkrating.com/games/connections",
  ].join("\n");
}

/* ------------------ UI ------------------ */

function GuessPreview({
  guess,
  groups,
}: {
  guess: ConnectionsGuessHistoryEntry;
  groups: ConnectionsSolvedGroup[];
}) {
  const map = buildColorMap(groups);

  return (
    <div className="grid grid-cols-4 gap-1.5 justify-center">
      {guess.tiles.map((tile, i) => {
        const color = map.get(tile) ?? guess.colors[i];

        const bg =
          color === "yellow" ? "bg-yellow-400" :
          color === "green"  ? "bg-emerald-500" :
          color === "blue"   ? "bg-sky-500" :
          color === "purple" ? "bg-violet-500" :
          color === "orange" ? "bg-orange-500" :
          color === "red"    ? "bg-red-500" :
          color === "brown"  ? "bg-amber-800" :
          "bg-orange-500";

        return <div key={i} className={`h-5 w-5 rounded-sm ${bg}`} />;
      })}
    </div>
  );
}

export function ResultModal({
  isOpen,
  gameState,
  solvedCount,
  totalGroups,
  mistakes,
  guessHistory,
  groups,
  onClose,
  onShare,
  onNextBoard,
}: ResultModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [coastleDailyAvailable, setCoastleDailyAvailable] = useState(true);
  const [countdown, setCountdown] = useState("");

  function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    // Check if coastle standard is already done today
    try {
      const raw = localStorage.getItem("coastle-standard-daily-state");
      if (raw) {
        const state = JSON.parse(raw);
        const today = getTodayString();
        if (state.date === today && state.status !== "playing") {
          setCoastleDailyAvailable(false);
          setCountdown(getTimeUntilMidnight());
        }
      }
    } catch {}

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || coastleDailyAvailable) return;
    const interval = setInterval(() => setCountdown(getTimeUntilMidnight()), 1_000);
    return () => clearInterval(interval);
  }, [isOpen, coastleDailyAvailable]);

  if (!isOpen) return null;

  const isWon = gameState === "won";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-md">
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
            className="absolute right-3 top-3 z-10 rounded-full bg-white/70 p-2"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {isWon ? "TRACK COMPLETE" : "TRACK INCOMPLETE"}
            </h2>
            <div className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
              {`Solved ${solvedCount}/${totalGroups} categories`}
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-slate-100/90 p-4 dark:bg-neutral-800/60">
            <div className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Your guesses
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              {guessHistory.map((guess, index) => (
              <GuessPreview key={index} guess={guess} groups={groups} />
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <button
           onClick={() => onShare("")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
            >
              <ShareIcon className="h-5 w-5" />
              Share Result
            </button>

            {onNextBoard ? (
              <button
                onClick={() => { onNextBoard(); onClose(); }}
                className="w-full rounded-2xl bg-violet-600 hover:bg-violet-500 py-3.5 text-center text-sm font-black text-white transition cursor-pointer"
              >
                Next Board →
              </button>
            ) : coastleDailyAvailable ? (
              <Link
                href="/games/coastle/standard"
                onClick={onClose}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-center text-sm font-black text-white transition hover:brightness-110"
              >
                Go to daily coastle
              </Link>
            ) : (
              <div className="w-full rounded-2xl bg-slate-100 dark:bg-neutral-800 py-3 text-center select-none">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Next puzzle in</div>
                <div className="mt-0.5 text-2xl font-black tabular-nums text-slate-700 dark:text-slate-200">{countdown}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}