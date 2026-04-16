"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/app/components/coastle/Countdown";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { PlayIcon, BookOpenIcon, ChartBarIcon } from "@/app/components/coastle/Icons";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import Link from "next/link";
import {
  ResultModal,
  buildConnectionsShareText,
  ConnectionsColor,
  ConnectionsGuessHistoryEntry,
} from "@/app/components/connections/ResultModal";
import { fetchConnectionsData } from "@/app/components/connections/utils";
import { getUsableCategories } from "@/app/components/connections/categories";
import { buildDailyPuzzleGroups } from "@/app/components/connections/generator";
import { ConnectionsStatsView } from "@/app/components/connections/ConnectionsStats";
import { ConnectionsStats } from "@/app/components/connections/types";
import { getTodayString } from "@/app/utils/coastle";

type Group = {
  id: string;
  label: string;
  color: string;
  difficulty: ConnectionsColor;
  coasters: string[];
};

const MAX_MISTAKES = 4;
const TILE_ROW_HEIGHT = "h-16 md:h-24";
const TILE_TEXT = "text-[11px] md:text-[15px]";

const INITIAL_CONNECTIONS_STATS: ConnectionsStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0],
};

const GROUP_COLOR_CLASS_MAP: Record<ConnectionsColor, string> = {
  yellow: "bg-amber-300 text-slate-950",
  green: "bg-emerald-400 text-white",
  blue: "bg-sky-400 text-white",
  purple: "bg-violet-400 text-white",
};

const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

function getTodaySeed() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStorageKey() {
  if (process.env.NODE_ENV === "development") {
    return `connections-dev`;
  }

  return `connections-${getTodayString()}`;
}

export default function ConnectionsPage() {
  const { isAdminMode } = useAdminMode();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tiles, setTiles] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<string[]>([]);
  const [playerSolvedCount, setPlayerSolvedCount] = useState(0);
  const [stats, setStats] = useState<ConnectionsStats>(INITIAL_CONNECTIONS_STATS);
  const [mistakes, setMistakes] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [animState, setAnimState] = useState<"idle" | "bouncing" | "shaking" | "revealing">("idle");
  const [activeTab, setActiveTab] = useState<"play" | "howto" | "leaderboard">("play");
  const [failedGuesses, setFailedGuesses] = useState<string[][]>([]);
  const [guessHistory, setGuessHistory] = useState<ConnectionsGuessHistoryEntry[]>([]);
  const [showModal, setShowModal] = useState(false);

  const normalizedFailedGuesses = useMemo(
    () => new Set(failedGuesses.map((guess) => [...guess].sort().join("||"))),
    [failedGuesses]
  );

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resolvingRef = useRef(false);
  const modalOpenedRef = useRef(false);

  const solvedGroups = solved
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is Group => Boolean(group));

  const clearToastTimer = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  };

  const showToast = (message: string) => {
    clearToastTimer();
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const clearRevealTimers = () => {
    revealTimersRef.current.forEach((timer) => clearTimeout(timer));
    revealTimersRef.current = [];
  };

  useEffect(() => {
    async function loadDailyPuzzle() {
      try {
        const [allCoasters, disabledRes] = await Promise.all([
          fetchConnectionsData(),
          fetch("/api/connections/categories")
        ]);

        const disabledData = await disabledRes.json();
        const disabledCategories = new Set<string>(disabledData.disabledCategories || []);
        console.log("GAME DISABLED:", Array.from(disabledCategories).sort());
const usableCategories = getUsableCategories(allCoasters, disabledCategories, true);
const seed = getTodaySeed();
const result = buildDailyPuzzleGroups(usableCategories, seed);

const dailyGroups = isAdminMode
  ? result.best
  : result.bestStandard;

        if (dailyGroups.length !== 4) {
          setError(usableCategories.length < 4 ? "NOT_ENOUGH_CATEGORIES" : "GENERATION_FAILED");
          return;
        }

        const mappedGroups: Group[] = dailyGroups.map((group) => ({
          id: group.categoryId,
          label: group.label,
          difficulty: group.difficulty,
          color: GROUP_COLOR_CLASS_MAP[group.difficulty],
          coasters: group.coasters.map((coaster) => coaster.name),
        }));

        setGroups(mappedGroups);

        const saved =
          process.env.NODE_ENV === "development"
            ? null
            : localStorage.getItem(getStorageKey());

        if (saved) {
          try {
            const parsed = JSON.parse(saved);

            setSolved(parsed.solved || []);
            setPlayerSolvedCount(parsed.playerSolvedCount || 0);
            setMistakes(parsed.mistakes || 0);
            setFailedGuesses(parsed.failedGuesses || []);
            setGuessHistory(parsed.guessHistory || []);
            setTiles(parsed.tiles || shuffle(mappedGroups.flatMap((g) => g.coasters)));
            return;
          } catch {
          }
        }

        setTiles(shuffle(mappedGroups.flatMap((group) => group.coasters)));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load puzzle");
      } finally {
        setMounted(true);
      }
    }

    loadDailyPuzzle();

    return () => {
      clearToastTimer();
      clearRevealTimers();
    };
  }, [isAdminMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("connections-stats");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.played === "number" &&
        typeof parsed?.won === "number" &&
        typeof parsed?.currentStreak === "number" &&
        typeof parsed?.maxStreak === "number" &&
        Array.isArray(parsed?.guessDistribution)
      ) {
        setStats(parsed);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    if (!mounted || groups.length === 0) return;

    const data = {
      solved,
      playerSolvedCount,
      mistakes,
      failedGuesses,
      guessHistory,
      tiles,
    };

    if (process.env.NODE_ENV !== "development") {
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
    }
  }, [
    solved,
    playerSolvedCount,
    mistakes,
    failedGuesses,
    guessHistory,
    tiles,
    mounted,
    groups,
  ]);

  useEffect(() => {
    if (mistakes < MAX_MISTAKES || resolvingRef.current || groups.length === 0) return;

    resolvingRef.current = true;
    showToast("Better luck next time");
    setAnimState("revealing");
    setSelected([]);

    const remaining = groups.filter((group) => !solved.includes(group.id));

    remaining.forEach((group, groupIndex) => {
      const reorderTimer = setTimeout(() => {
        setTiles((prev) => {
          const next = [...prev];
          group.coasters.forEach((coaster, i) => {
            const currentIdx = next.indexOf(coaster);
            if (currentIdx !== -1 && currentIdx !== i) {
              [next[i], next[currentIdx]] = [next[currentIdx], next[i]];
            }
          });
          return next;
        });
      }, groupIndex * 1250);

      const solveTimer = setTimeout(() => {
        setSolved((prev) => [...prev, group.id]);
        setTiles((prev) => prev.filter((tile) => !group.coasters.includes(tile)));

        if (groupIndex === remaining.length - 1) {
          setTimeout(() => {
            setAnimState("idle");

            setStats((prev) => {
              const nextDistribution: [number, number, number, number, number] = [
                ...prev.guessDistribution,
              ] as [number, number, number, number, number];

              nextDistribution[4] += 1;

              const next = {
                played: prev.played + 1,
                won: prev.won,
                currentStreak: 0,
                maxStreak: prev.maxStreak,
                guessDistribution: nextDistribution,
              };

              localStorage.setItem("connections-stats", JSON.stringify(next));
              return next;
            });

            if (!modalOpenedRef.current) {
              modalOpenedRef.current = true;
              setTimeout(() => setShowModal(true), 900);
            }
          }, 350);
        }
      }, groupIndex * 1250 + 650);

      revealTimersRef.current.push(reorderTimer, solveTimer);
    });
  }, [mistakes, solved, groups]);

  const toggleTile = (tile: string) => {
    if (animState !== "idle") return;

    setSelected((prev) => {
      if (prev.includes(tile)) return prev.filter((item) => item !== tile);
      if (prev.length >= 4) return prev;
      return [...prev, tile];
    });
  };

  const submit = async () => {
    if (selected.length !== 4 || animState !== "idle" || groups.length === 0) return;

    setAnimState("bouncing");
    await new Promise((resolve) => setTimeout(resolve, 450));

    const selectionKey = [...selected].sort().join("||");
    if (normalizedFailedGuesses.has(selectionKey)) {
      showToast("Already guessed");
      setAnimState("shaking");
      window.setTimeout(() => setAnimState("idle"), 380);
      return;
    }

    const colors: ConnectionsColor[] = selected.map((tile) => {
      const group = groups.find((g) => g.coasters.includes(tile));
      return group ? group.difficulty : "yellow";
    });

    setGuessHistory((prev) => [...prev, { tiles: [...selected], colors }]);

    const match = groups.find((group) =>
      group.coasters.every((coaster) => selected.includes(coaster))
    );

    if (match) {
      showToast(match.label);
      navigator.vibrate?.(10);
      setAnimState("revealing");

      setTiles((prev) => {
        const next = [...prev];
        match.coasters.forEach((coaster, i) => {
          const currentIdx = next.indexOf(coaster);
          if (currentIdx !== -1 && currentIdx !== i) {
            [next[i], next[currentIdx]] = [next[currentIdx], next[i]];
          }
        });
        return next;
      });

      window.setTimeout(() => {
        const nextSolved = [...solved, match.id];
        setSolved(nextSolved);
        setPlayerSolvedCount((prev) => prev + 1);
        setTiles((prev) => prev.filter((tile) => !selected.includes(tile)));
        setSelected([]);
        setAnimState("idle");

        if (nextSolved.length === groups.length && !modalOpenedRef.current) {
          setStats((prev) => {
            const nextDistribution: [number, number, number, number, number] = [
              ...prev.guessDistribution,
            ] as [number, number, number, number, number];

            const guessIndex = Math.max(0, Math.min(3, mistakes));
            nextDistribution[guessIndex] += 1;

            const next = {
              played: prev.played + 1,
              won: prev.won + 1,
              currentStreak: prev.currentStreak + 1,
              maxStreak: Math.max(prev.maxStreak, prev.currentStreak + 1),
              guessDistribution: nextDistribution,
            };

            localStorage.setItem("connections-stats", JSON.stringify(next));
            return next;
          });

          modalOpenedRef.current = true;
          setTimeout(() => setShowModal(true), 900);
        }
      }, 650);
      return;
    }

    setAnimState("shaking");
    setMistakes((prev) => prev + 1);

    const isOneAway = groups.some(
      (group) => group.coasters.filter((coaster) => selected.includes(coaster)).length === 3
    );

    setFailedGuesses((prev) => [...prev, [...selected]]);
    showToast(isOneAway ? "One away..." : "Incorrect grouping");
    window.setTimeout(() => setAnimState("idle"), 380);
  };

  const handleShare = async () => {
    const text = buildConnectionsShareText({
      gameState: mistakes >= MAX_MISTAKES ? "lost" : "won",
      solvedCount: playerSolvedCount,
      totalGroups: groups.length,
      mistakes,
      maxMistakes: MAX_MISTAKES,
      guessHistory,
    });

    await navigator.clipboard.writeText(text);
    showToast("Results copied to clipboard");
  };

  const shuffleCurrentTiles = () => {
    if (animState !== "idle") return;
    setTiles((prev) => shuffle(prev));
  };

  const resetGame = () => {
    clearRevealTimers();
    resolvingRef.current = false;
    modalOpenedRef.current = false;
    setTiles(shuffle(groups.flatMap((group) => group.coasters)));
    setSelected([]);
    setSolved([]);
    setPlayerSolvedCount(0);
    setMistakes(0);
    setFailedGuesses([]);
    setGuessHistory([]);
    setShowModal(false);
    setToast(null);
    setAnimState("idle");
    setActiveTab("play");
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || groups.length !== 4) {
    // Translate the error code into the correct string based on real-time Admin status
    let displayError = error || "Failed to load today's puzzle.";

    if (error === "NOT_ENOUGH_CATEGORIES") {
      displayError = isAdminMode
        ? "Not enough categories. You have fewer than 4 usable categories enabled."
        : "Today's puzzle is currently under maintenance. Please check back shortly!";
    } else if (error === "GENERATION_FAILED") {
      displayError = isAdminMode
        ? "The algorithm couldn't find a valid, non-overlapping 4-group puzzle. Please enable a few more categories to give the generator more options."
        : "Today's puzzle is currently under maintenance. Please check back shortly!";
    }

    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-6 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 uppercase italic">
          Connections
        </h1>

        <div className="max-w-md w-full p-6 sm:p-8 bg-slate-100 dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {displayError}
          </p>

          {isAdminMode && (
            <div className="mt-8">
              <Link
                href="/ConnectionsData"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-widest rounded-full transition-all hover:scale-105 shadow-md"
              >
                ⚙️ Manage Categories
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-2 sm:p-6 flex flex-col items-center overflow-x-hidden text-slate-900 dark:text-white select-none">
      <style>{`
        @keyframes revealUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-reveal {
          animation: revealUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
        }
        @keyframes bounce-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shake-fast {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes toast-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-bounce-seq { animation: bounce-fast 0.22s ease-in-out; }
        .animate-shake-custom { animation: shake-fast 0.1s ease-in-out 2; }
        .animate-toast-in { animation: toast-in 0.18s ease-out forwards; }
      `}</style>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-full border border-white/20 bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.4)] animate-toast-in">
          {toast}
        </div>
      )}

      <div className="mb-2 mt-2 w-full space-y-2 px-4 text-center animate-reveal">
        <h1 className="pr-4 text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6">
          CONNECTIONS
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
          Find the four coaster groups
        </p>
      </div>

      <div className="w-full max-w-[280px] sm:max-w-xs grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg mb-3 mx-auto animate-reveal">
        {[
          { id: "play", label: "Play", icon: PlayIcon },
          { id: "howto", label: "How To", icon: BookOpenIcon },
          { id: "leaderboard", label: "Stats", icon: ChartBarIcon },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as "play" | "howto" | "leaderboard");
              }}
              className={`flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${isActive
                ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm scale-100"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-neutral-700/50 hover:scale-95"
                }`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "play" && (
        <div className="w-full max-w-3xl flex flex-col items-center animate-reveal">
          {(mistakes >= MAX_MISTAKES || solved.length === groups.length) && (
            <div className="w-full max-w-md mb-4">
              <Countdown />
            </div>
          )}

          <header className="mb-6 flex w-full flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 md:text-xs">
                Mistakes
              </span>
              <div className="flex gap-2.5">
                {[...Array(MAX_MISTAKES)].map((_, i) => {
                  const active = i < MAX_MISTAKES - mistakes;
                  return (
                    <div
                      key={i}
                      className={`h-3.5 w-3.5 rounded-full transition-all duration-500 md:h-4 md:w-4 ${active
                        ? "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                        : "bg-slate-300 dark:bg-slate-800"
                        }`}
                    />
                  );
                })}
              </div>
            </div>
          </header>

          <div className="w-full">
            <LayoutGroup>
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {solvedGroups.map((group) => (
                    <motion.div
                      layout
                      key={group.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      exit={{ opacity: 0 }}
                      className={`${TILE_ROW_HEIGHT} ${group.color} flex w-full items-center justify-center rounded-2xl border border-black/10 px-4 md:px-5 text-center shadow-sm shadow-inner`}
                    >
                      <div className="min-w-0 text-center">
                        <p
                          className={`text-base md:text-xl font-semibold tracking-tight ${group.difficulty === "yellow"
                            ? "text-slate-900"
                            : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                            }`}
                        >
                          {group.label}
                        </p>

                        <p
                          className={`mt-1 text-[12px] md:text-sm font-semibold leading-snug px-2 md:px-3 max-w-full break-words normal-case ${group.difficulty === "yellow"
                            ? "text-slate-800"
                            : "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                            }`}
                        >
                          {group.coasters.join(" • ")}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {tiles.map((tile) => {
                      const isSelected = selected.includes(tile);
                      const selectedIndex = selected.indexOf(tile);

                      return (
                        <motion.button
                          layout
                          key={tile}
                          type="button"
                          transition={{
                            layout: { type: "tween", ease: "easeInOut", duration: 0.42 },
                          }}
                          onClick={() => toggleTile(tile)}
                          style={{
                            animationDelay:
                              animState === "bouncing" && selectedIndex !== -1
                                ? `${selectedIndex * 70}ms`
                                : "0ms",
                          }}
                          className={`
                            ${TILE_ROW_HEIGHT} ${TILE_TEXT}
                            flex w-full items-center justify-center rounded-2xl border-2 px-2 text-center font-black leading-tight transition-colors duration-200
                            ${isSelected
                              ? `z-10 border-transparent bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 text-white shadow-[0_12px_30px_rgba(79,70,229,0.28)] ${animState === "bouncing"
                                ? "animate-bounce-seq"
                                : animState === "shaking"
                                  ? "animate-shake-custom"
                                  : ""
                              }`
                              : "border-slate-300 bg-white text-slate-800 shadow-md hover:border-slate-400 hover:bg-slate-50 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
                            }
                          `}
                        >
                          <span className="line-clamp-3 leading-tight px-1 whitespace-normal [overflow-wrap:anywhere]">
                            {tile}
                          </span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </LayoutGroup>
          </div>

          <div className="mt-8 md:mt-10 grid w-full max-w-3xl grid-cols-3 gap-3 md:gap-3">
            <button
              type="button"
              onClick={() => {
                setSelected([]);
              }}
              className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={shuffleCurrentTiles}
              className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.length !== 4 || animState !== "idle"}
              className={`rounded-3xl py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] shadow-xl transition-all duration-300 cursor-pointer ${selected.length === 4 && animState === "idle"
                ? "scale-[1.03] bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                : "bg-slate-200 dark:bg-slate-800 text-slate-500 opacity-60"
                }`}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {activeTab === "howto" && (
        <div className="w-full max-w-xl animate-reveal rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-black uppercase tracking-wide">How To Play</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-6">
            Select four coasters that belong together, then press submit. Find all four groups before you run out of mistakes.
          </p>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <ConnectionsStatsView
          stats={stats}
          gameState={
            mistakes >= MAX_MISTAKES
              ? "lost"
              : solved.length === groups.length
                ? "won"
                : "playing"
          }
          onShare={handleShare}
        />
      )}

      <ResultModal
        isOpen={showModal}
        gameState={mistakes >= MAX_MISTAKES ? "lost" : "won"}
        solvedCount={playerSolvedCount}
        totalGroups={groups.length}
        mistakes={mistakes}
        maxMistakes={MAX_MISTAKES}
        guessHistory={guessHistory}
        solvedGroups={solvedGroups.map((group) => ({
          id: group.id,
          label: group.label,
          colorClass: group.color,
          coasters: group.coasters,
        }))}
        onClose={() => setShowModal(false)}
        onShare={handleShare}
        onReset={resetGame}
      />
    </div>
  );
}