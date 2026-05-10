"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Countdown } from "@/app/components/coastle/Countdown";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { PlayIcon, BookOpenIcon, ChartBarIcon } from "@/app/components/coastle/Icons";
import {
  ResultModal,
  buildConnectionsShareText,
  type ConnectionsColor,
  type ConnectionsGuessHistoryEntry,
} from "@/app/components/connections/ResultModal";
import { ConnectionsStatsView } from "@/app/components/connections/ConnectionsStats";
import type { ConnectionsStats } from "@/app/components/connections/types";

// ─── Shared types & constants ─────────────────────────────────────────────────

export type Group = {
  id: string;
  label: string;
  color: string;
  difficulty: ConnectionsColor;
  coasters: string[];
};

export const MAX_MISTAKES = 4;
export const TILE_ROW_HEIGHT = "h-16 md:h-24";
export const TILE_TEXT = "text-[11px] md:text-[15px]";

export const GROUP_COLOR_CLASS_MAP: Record<ConnectionsColor, string> = {
  yellow: "bg-amber-300 text-slate-950",
  green:  "bg-emerald-400 text-white",
  blue:   "bg-sky-400 text-white",
  purple: "bg-violet-400 text-white",
  orange: "bg-orange-400 text-white",
  red:    "bg-red-500 text-white",
  brown:  "bg-amber-800 text-white",
};

export const shuffle = <T,>(items: T[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const INITIAL_STATS: ConnectionsStats = {
  played: 0, won: 0, currentStreak: 0, maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ConnectionsGameProps {
  initialGroups: Group[];
  /** If provided, game state is persisted to localStorage under this key and stats are updated. Omit for practice mode. */
  persistKey?: string;
  /** Practice mode: called when user clicks "Next Board" in the result modal. */
  onNextBoard?: () => void;
  /** Called when the game ends (won or lost). Second arg is mistake count. */
  onComplete?: (won: boolean, mistakes: number) => void;
}

export default function ConnectionsGame({ initialGroups, persistKey, onNextBoard, onComplete }: ConnectionsGameProps) {
  const isPractice = !persistKey;

  const [groups]    = useState<Group[]>(initialGroups);
  const [tiles,     setTiles]     = useState<string[]>(() => {
    if (!isPractice && persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.tiles?.length) return parsed.tiles;
        }
      } catch {}
    }
    return shuffle(initialGroups.flatMap((g) => g.coasters));
  });

  const [selected,          setSelected]          = useState<string[]>([]);
  const [solved,            setSolved]            = useState<string[]>(() => {
    if (!isPractice && persistKey) {
      try { return JSON.parse(localStorage.getItem(persistKey) || "{}").solved || []; } catch {}
    }
    return [];
  });
  const [playerSolvedCount, setPlayerSolvedCount] = useState<number>(() => {
    if (!isPractice && persistKey) {
      try { return JSON.parse(localStorage.getItem(persistKey) || "{}").playerSolvedCount || 0; } catch {}
    }
    return 0;
  });
  const [mistakes,          setMistakes]          = useState<number>(() => {
    if (!isPractice && persistKey) {
      try { return JSON.parse(localStorage.getItem(persistKey) || "{}").mistakes || 0; } catch {}
    }
    return 0;
  });
  const [failedGuesses,     setFailedGuesses]     = useState<string[][]>(() => {
    if (!isPractice && persistKey) {
      try { return JSON.parse(localStorage.getItem(persistKey) || "{}").failedGuesses || []; } catch {}
    }
    return [];
  });
  const [guessHistory,      setGuessHistory]      = useState<ConnectionsGuessHistoryEntry[]>(() => {
    if (!isPractice && persistKey) {
      try { return JSON.parse(localStorage.getItem(persistKey) || "{}").guessHistory || []; } catch {}
    }
    return [];
  });
  const [stats,             setStats]             = useState<ConnectionsStats>(INITIAL_STATS);
  const [toast,             setToast]             = useState<string | null>(null);
  const [animState,         setAnimState]         = useState<"idle" | "bouncing" | "shaking" | "revealing">("idle");
  const [activeTab,         setActiveTab]         = useState<"play" | "howto" | "leaderboard">("play");
  const [showModal,         setShowModal]         = useState(false);

  const toastTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resolvingRef   = useRef(false);
  const modalOpenedRef = useRef(false);

  const normalizedFailedGuesses = useMemo(
    () => new Set(failedGuesses.map((g) => [...g].sort().join("||"))),
    [failedGuesses]
  );

  const solvedGroups = solved
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearToastTimer = () => {
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
  };
  const showToast = (msg: string) => {
    clearToastTimer();
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };
  const clearRevealTimers = () => {
    revealTimersRef.current.forEach(clearTimeout);
    revealTimersRef.current = [];
  };

  // ── Load stats ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isPractice) return;
    try {
      const raw = localStorage.getItem("connections-stats");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.played === "number") setStats(parsed);
    } catch {}
  }, []);

  // ── Persist state ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isPractice || !persistKey) return;
    const data = { solved, playerSolvedCount, mistakes, failedGuesses, guessHistory, tiles };
    if (process.env.NODE_ENV !== "development") {
      localStorage.setItem(persistKey, JSON.stringify(data));
    }
  }, [solved, playerSolvedCount, mistakes, failedGuesses, guessHistory, tiles]);

  // ── Loss reveal ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (mistakes < MAX_MISTAKES || resolvingRef.current || groups.length === 0) return;
    resolvingRef.current = true;
    showToast("Better luck next time");
    setAnimState("revealing");
    setSelected([]);

    const remaining = groups.filter((g) => !solved.includes(g.id));
    remaining.forEach((group, gi) => {
      const reorderTimer = setTimeout(() => {
        setTiles((prev) => {
          const next = [...prev];
          group.coasters.forEach((c, i) => {
            const ci = next.indexOf(c);
            if (ci !== -1 && ci !== i) [next[i], next[ci]] = [next[ci], next[i]];
          });
          return next;
        });
      }, gi * 1250);

      const solveTimer = setTimeout(() => {
        setSolved((prev) => [...prev, group.id]);
        setTiles((prev) => prev.filter((t) => !group.coasters.includes(t)));

        if (gi === remaining.length - 1) {
          setTimeout(() => {
            setAnimState("idle");
            if (!isPractice) {
              setStats((prev) => {
                const dist = [...prev.guessDistribution] as [number, number, number, number, number];
                dist[4] += 1;
                const next = { ...prev, played: prev.played + 1, currentStreak: 0, guessDistribution: dist };
                localStorage.setItem("connections-stats", JSON.stringify(next));
                return next;
              });
            }
            if (!modalOpenedRef.current) { modalOpenedRef.current = true; onComplete?.(false, mistakes); setTimeout(() => setShowModal(true), 900); }
          }, 350);
        }
      }, gi * 1250 + 650);

      revealTimersRef.current.push(reorderTimer, solveTimer);
    });
  }, [mistakes, solved, groups]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => () => { clearToastTimer(); clearRevealTimers(); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const toggleTile = (tile: string) => {
    if (animState !== "idle") return;
    setSelected((prev) => {
      if (prev.includes(tile)) return prev.filter((t) => t !== tile);
      if (prev.length >= 4) return prev;
      return [...prev, tile];
    });
  };

  const submit = async () => {
    if (selected.length !== 4 || animState !== "idle" || groups.length === 0) return;
    setAnimState("bouncing");
    await new Promise((r) => setTimeout(r, 450));

    const key = [...selected].sort().join("||");
    if (normalizedFailedGuesses.has(key)) {
      showToast("Already guessed");
      setAnimState("shaking");
      setTimeout(() => setAnimState("idle"), 380);
      return;
    }

    const colors: ConnectionsColor[] = selected.map((tile) => {
      const g = groups.find((g) => g.coasters.includes(tile));
      return g ? g.difficulty : "yellow";
    });
    setGuessHistory((prev) => [...prev, { tiles: [...selected], colors }]);

    const match = groups.find((g) => g.coasters.every((c) => selected.includes(c)));

    if (match) {
      showToast(match.label);
      navigator.vibrate?.(10);
      setAnimState("revealing");
      setTiles((prev) => {
        const next = [...prev];
        match.coasters.forEach((c, i) => {
          const ci = next.indexOf(c);
          if (ci !== -1 && ci !== i) [next[i], next[ci]] = [next[ci], next[i]];
        });
        return next;
      });

      setTimeout(() => {
        const nextSolved = [...solved, match.id];
        setSolved(nextSolved);
        setPlayerSolvedCount((p) => p + 1);
        setTiles((prev) => prev.filter((t) => !selected.includes(t)));
        setSelected([]);
        setAnimState("idle");

        if (nextSolved.length === groups.length && !modalOpenedRef.current) {
          if (!isPractice) {
            setStats((prev) => {
              const dist = [...prev.guessDistribution] as [number, number, number, number, number];
              dist[Math.max(0, Math.min(3, mistakes))] += 1;
              const next = {
                played: prev.played + 1, won: prev.won + 1,
                currentStreak: prev.currentStreak + 1,
                maxStreak: Math.max(prev.maxStreak, prev.currentStreak + 1),
                guessDistribution: dist,
              };
              localStorage.setItem("connections-stats", JSON.stringify(next));
              return next;
            });
          }
          modalOpenedRef.current = true;
          onComplete?.(true, mistakes);
          setTimeout(() => setShowModal(true), 900);
        }
      }, 650);
      return;
    }

    setAnimState("shaking");
    setMistakes((p) => p + 1);
    const isOneAway = groups.some((g) => g.coasters.filter((c) => selected.includes(c)).length === 3);
    setFailedGuesses((prev) => [...prev, [...selected]]);
    showToast(isOneAway ? "One away..." : "Incorrect grouping");
    setTimeout(() => setAnimState("idle"), 380);
  };

  const handleShare = async () => {
    const text = buildConnectionsShareText({
      gameState: mistakes >= MAX_MISTAKES ? "lost" : "won",
      solvedCount: playerSolvedCount,
      totalGroups: groups.length,
      mistakes,
      maxMistakes: MAX_MISTAKES,
      guessHistory,
      groups: groups.map((g) => ({ id: g.id, label: g.label, colorClass: g.color, coasters: g.coasters })),
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
    setTiles(shuffle(groups.flatMap((g) => g.coasters)));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-2 sm:p-6 flex flex-col items-center overflow-x-hidden text-slate-900 dark:text-white select-none">
      <style>{`
        @keyframes revealUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-reveal { animation: revealUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; opacity: 0; }
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
          {isPractice ? "Practice mode" : "Find the four coaster groups"}
        </p>
      </div>

      {!isPractice && <div className="w-full max-w-[280px] sm:max-w-xs grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg mb-3 mx-auto animate-reveal">
        {([
          { id: "play", label: "Play", icon: PlayIcon },
          { id: "howto", label: "How To", icon: BookOpenIcon },
          ...(!isPractice ? [{ id: "leaderboard", label: "Stats", icon: ChartBarIcon }] : []),
        ] as { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[]).map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "play" | "howto" | "leaderboard")}
              className={`flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${isActive ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm scale-100" : "text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-neutral-700/50 hover:scale-95"}`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {tab.label}
            </button>
          );
        })}
      </div>}

      {(isPractice || activeTab === "play") && (
        <div className="w-full max-w-3xl flex flex-col items-center animate-reveal">
          {!isPractice && (mistakes >= MAX_MISTAKES || solved.length === groups.length) && (
            <div className="w-full max-w-md mb-4"><Countdown /></div>
          )}

          <header className="mb-6 flex w-full flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400 md:text-xs">Mistakes</span>
              <div className="flex gap-2.5">
                {[...Array(MAX_MISTAKES)].map((_, i) => (
                  <div key={i} className={`h-3.5 w-3.5 rounded-full transition-all duration-500 md:h-4 md:w-4 ${i < MAX_MISTAKES - mistakes ? "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]" : "bg-slate-300 dark:bg-slate-800"}`} />
                ))}
              </div>
            </div>
          </header>

          <div className="w-full">
            <LayoutGroup>
              <div className="flex flex-col gap-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {solvedGroups.map((group) => (
                    <motion.div
                      layout key={group.id}
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      exit={{ opacity: 0 }}
                      className={`${TILE_ROW_HEIGHT} ${group.color} flex w-full items-center justify-center rounded-2xl border border-black/10 px-4 md:px-5 text-center shadow-sm shadow-inner`}
                    >
                      <div className="min-w-0 text-center">
                        <p className={`text-base md:text-xl font-semibold tracking-tight ${group.difficulty === "yellow" ? "text-slate-900" : "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"}`}>
                          {group.label}
                        </p>
                        <p className={`mt-1 text-[12px] md:text-sm font-semibold leading-snug px-2 md:px-3 max-w-full break-words normal-case ${group.difficulty === "yellow" ? "text-slate-800" : "text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"}`}>
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
                          layout key={tile} type="button"
                          transition={{ layout: { type: "tween", ease: "easeInOut", duration: 0.42 } }}
                          onClick={() => toggleTile(tile)}
                          style={{ animationDelay: animState === "bouncing" && selectedIndex !== -1 ? `${selectedIndex * 70}ms` : "0ms" }}
                          className={`${TILE_ROW_HEIGHT} ${TILE_TEXT} flex w-full items-center justify-center rounded-2xl border-2 px-2 text-center font-black leading-tight transition-colors duration-200 ${isSelected
                            ? `z-10 border-transparent bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 text-white shadow-[0_12px_30px_rgba(79,70,229,0.28)] ${animState === "bouncing" ? "animate-bounce-seq" : animState === "shaking" ? "animate-shake-custom" : ""}`
                            : "border-slate-300 bg-white text-slate-800 shadow-md hover:border-slate-400 hover:bg-slate-50 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-white"
                          }`}
                        >
                          <span className="line-clamp-3 leading-tight px-1 whitespace-normal [overflow-wrap:anywhere]">{tile}</span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </LayoutGroup>
          </div>

          <div className="mt-8 md:mt-10 grid w-full max-w-3xl grid-cols-3 gap-3 md:gap-3">
            <button type="button" onClick={() => setSelected([])}
              className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Clear
            </button>
            <button type="button" onClick={shuffleCurrentTiles}
              className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Shuffle
            </button>
            <button type="button" onClick={submit} disabled={selected.length !== 4 || animState !== "idle"}
              className={`rounded-3xl py-4 md:py-5 text-[12px] md:text-[11px] font-black uppercase tracking-[0.18em] shadow-xl transition-all duration-300 cursor-pointer ${selected.length === 4 && animState === "idle" ? "scale-[1.03] bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-200 dark:bg-slate-800 text-slate-500 opacity-60"}`}>
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

      {activeTab === "leaderboard" && !isPractice && (
        <ConnectionsStatsView
          stats={stats}
          gameState={mistakes >= MAX_MISTAKES ? "lost" : solved.length === groups.length ? "won" : "playing"}
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
        groups={groups.map((g) => ({ id: g.id, label: g.label, colorClass: g.color, coasters: g.coasters }))}
        onClose={() => setShowModal(false)}
        onShare={handleShare}
        onReset={resetGame}
        onNextBoard={onNextBoard}
      />
    </div>
  );
}
