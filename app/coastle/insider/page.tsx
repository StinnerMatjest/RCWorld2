"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import Fuse from "fuse.js";
import { getParkFlag } from "@/app/utils/design";

import { ApiCoaster, CoastleCoaster, GuessInsider, GameStats } from "@/app/types";
import {
  INITIAL_STATS,
  getDailyCoaster,
  getTodayString,
  getMatchStatus,
  mapApiToCoastle,
  legacyCopy
} from "@/app/utils/coastle";

import {
  XMarkIcon,
  PlayIcon,
  BookOpenIcon,
  ChartBarIcon,
  ArrowPathIcon
} from "@/app/components/coastle/Icons";
import { Countdown } from "@/app/components/coastle/Countdown";
import { GuessRow } from "@/app/components/coastle/GuessRow";
import { ResultModal } from "@/app/components/coastle/ResultModal";
import { HowTo } from "@/app/components/coastle/HowTo";
import { Leaderboard } from "@/app/components/coastle/Leaderboard";

export default function CoastlePage() {
  const [allCoasters, setAllCoasters] = useState<CoastleCoaster[]>([]);
  const [answer, setAnswer] = useState<CoastleCoaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<GuessInsider[]>([]);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [toast, setToast] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [activeTab, setActiveTab] = useState<"play" | "howto" | "leaderboard">("play");
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [gameMode, setGameMode] = useState<"daily" | "endless">("daily");

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isGameActive = guesses.length > 0 && gameState === "playing";
  const showMenu = !isGameActive && !isFocused;

  // Header Animation
  useEffect(() => {
    const shouldHideHeader = !showMenu;
    window.dispatchEvent(
      new CustomEvent("toggle-header", { detail: { visible: !shouldHideHeader } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("toggle-header", { detail: { visible: true } })
      );
    };
  }, [showMenu]);

  // Load Data
  useEffect(() => {
    async function fetchCoasters() {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();
        if (!data || !Array.isArray(data.coasters))
          throw new Error("Unexpected data format");

        const mapped: CoastleCoaster[] = (data.coasters as ApiCoaster[])
          .map(mapApiToCoastle)
          .filter((c): c is CoastleCoaster => !!c && c.rating > 0);

        // Sort by ID for consistency
        mapped.sort((a, b) => {
          const idA = parseInt(a.id, 10);
          const idB = parseInt(b.id, 10);
          if (isNaN(idA) || isNaN(idB)) return a.id.localeCompare(b.id);
          return idA - idB;
        });

        setAllCoasters(mapped);

        // Daily Mode Logic (Default)
        if (mapped.length > 0) {
          const today = getTodayString();
          const savedDaily = localStorage.getItem("coastle-insider-daily-state")
          let restored = false;

          if (savedDaily) {
            try {
              const parsed = JSON.parse(savedDaily);
              if (parsed.date === today) {
                setAnswer(getDailyCoaster(mapped, "insider"));
                setGuesses(parsed.guesses);
                setGameState(parsed.status);
                restored = true;
              }
            } catch (e) {}
          }

          if (!restored) {
            setAnswer(getDailyCoaster(mapped, "insider"));
            setGuesses([]);
            setGameState("playing");
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load coasters");
      } finally {
        setLoading(false);
      }
    }

    fetchCoasters();

    const saved = localStorage.getItem("coastle-insider-stats");
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // --- Game Logic ---

  function switchMode(mode: "daily" | "endless") {
    setGameMode(mode);
    setInput("");
    setToast(null);
    setShowModal(false);
    setIsFocused(false);
    setActiveIndex(-1);

    if (mode === "daily") {
      const today = getTodayString();
      const savedDaily = localStorage.getItem("coastle-insider-daily-state");
      let restored = false;

      if (savedDaily && allCoasters.length > 0) {
        const parsed = JSON.parse(savedDaily);
        if (parsed.date === today) {
          const dailyAnswer = getDailyCoaster(allCoasters, "insider");
          setAnswer(dailyAnswer);
          setGuesses(parsed.guesses);
          setGameState(parsed.status);
          restored = true;
        }
      }
      if (!restored && allCoasters.length > 0) {
        const dailyAnswer = getDailyCoaster(allCoasters, "insider");
        setAnswer(dailyAnswer);
        setGuesses([]);
        setGameState("playing");
      }
    } else {
      // Endless
      setGuesses([]);
      setGameState("playing");
      if (allCoasters.length > 0) {
        setAnswer(allCoasters[Math.floor(Math.random() * allCoasters.length)]);
      }
    }
  }

  // Fuzzy Search
  const fuse = useMemo(() => {
    const searchableCoasters = allCoasters.map((c) => ({
      ...c,
      cleanName: c.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
    }));

    return new Fuse(searchableCoasters, {
      keys: ["name", "cleanName", "park"],
      threshold: 0.3,
      ignoreDiacritics: true
    });
  }, [allCoasters]);

  const suggestions = useMemo(() => {
    if (!input.trim() || !allCoasters.length) return [];
    const results = fuse.search(input.trim());
    return results.map((r) => r.item).slice(0, 50);
  }, [input, fuse, allCoasters]);

  useEffect(() => setActiveIndex(-1), [input]);

  const MAX_GUESSES = 5;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  function resetGame() {
    setGuesses([]);
    setInput("");
    setGameState("playing");
    setToast(null);
    setShowModal(false);
    setIsFocused(false);
    setActiveIndex(-1);

    if (gameMode === "endless" && allCoasters.length > 0) {
      const random =
        allCoasters[Math.floor(Math.random() * allCoasters.length)];
      setAnswer(random);
    }
  }

  function handleExitOrReset() {
    setIsFocused(false);
    setInput("");
    inputRef.current?.blur();
    setGuesses([]);
    setGameState("playing");
    setActiveIndex(-1);
  }

  function handleGuess(coaster: CoastleCoaster) {
    if (gameState !== "playing" || !answer) return;

    if (guesses.some((g) => g.coaster.id === coaster.id)) {
      showToast("Already guessed that coaster!");
      return;
    }

    const guess: GuessInsider = {
      coaster,
      matches: {
        park: getMatchStatus(coaster.park, answer.park),
        manufacturer: getMatchStatus(coaster.manufacturer, answer.manufacturer),
        rating: getMatchStatus(coaster.rating, answer.rating),
        year: getMatchStatus(coaster.year, answer.year),
        country: getMatchStatus(coaster.countryName, answer.countryName),
        rideCount: getMatchStatus(coaster.rideCount, answer.rideCount)
      }
    };

    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setInput("");
    setActiveIndex(-1);

    inputRef.current?.focus();

    let newStatus: "playing" | "won" | "lost" = gameState;

    if (coaster.id === answer.id) newStatus = "won";
    else if (nextGuesses.length >= MAX_GUESSES) newStatus = "lost";

    if (newStatus !== "playing") {
      setGameState(newStatus);
      setIsFocused(false);
      inputRef.current?.blur();

      const nextStats = { ...stats };
      nextStats.played += 1;
      if (newStatus === "won") {
        nextStats.won += 1;
        nextStats.currentStreak += 1;
        nextStats.maxStreak = Math.max(
          nextStats.currentStreak,
          nextStats.maxStreak
        );
        nextStats.guessDistribution[nextGuesses.length - 1] += 1;
      } else {
        nextStats.currentStreak = 0;
      }

      setStats(nextStats);
      localStorage.setItem("coastle-insider-stats", JSON.stringify(nextStats));

      setTimeout(() => setShowModal(true), 1500);
    }

    if (gameMode === "daily") {
      const stateToSave = {
        date: getTodayString(),
        guesses: nextGuesses,
        status: newStatus
      };
      localStorage.setItem("coastle-insider-daily-state", JSON.stringify(stateToSave));
    }
  }

  // Build the formatted result text used by both share + copy
  function buildShareText() {
    // 1. ALIGNMENT & GRID
    const headers = "Rat\u2003Mfr\u2003Prk\u2003Cty\u2003Cnt\u2003Yr";

    const grid = guesses
      .map((g) => {
        const m = g.matches;
        const row = [
          m.rating,
          m.manufacturer,
          m.park,
          m.country,
          m.rideCount,
          m.year
        ];
        const emojiStr = row
          .map((status) => (status === "correct" ? "🟩" : "🟥"))
          .join("\u2003\u200A");

        const name = g.coaster.name;
        const targetVisualLen = 22;
        const needed = Math.max(
          0,
          Math.ceil((targetVisualLen - name.length) / 1.7)
        );
        const paddedName = name + "\u3000".repeat(needed);

        return `${emojiStr}\u2003||${paddedName}||`;
      })
      .join("\n");

    // 2. SIMPLIFIED TEXT
 const title =
  gameMode === "daily"
    ? "**Daily Insider Coastle**"
    : "**Endless Insider Coastle**";

    let status = "";
    if (gameState === "won") {
      status = `I completed it in ${guesses.length} guesses.`;
    } else {
      status = "I did not complete it.";
    }

    // 3. NO PREVIEW LINK
    let footer = "\n\nPlay at <https://parkrating.com/coastle>";

    if (gameState === "lost") {
      const ansName = answer?.name || "";
      const needed = Math.max(0, Math.ceil((22 - ansName.length) / 1.7));
      const paddedAns = ansName + "\u3000".repeat(needed);
      footer = `\nAnswer: ||${paddedAns}||${footer}`;
    }

    return `${title}\n${status}\n\n${headers}\n${grid}${footer}`;
  }

  async function handleShare() {
    const text = buildShareText();

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Coastle Results", text });
      } else {
        throw new Error("Web Share not supported");
      }
    } catch (err) {
      const success = await legacyCopy(text);
      if (success) showToast("Results copied to clipboard!");
      else showToast("Failed to copy");
    }
  }

  async function handleCopy() {
    const text = buildShareText();

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast("copied");
      } else {
        throw new Error("Clipboard API not supported");
      }
    } catch (err) {
      const success = await legacyCopy(text);
      if (success) showToast("copied");
      else showToast("Failed to copy");
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (gameState !== "playing") {
      if (gameMode === "endless") resetGame();
      return;
    }

    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      handleGuess(suggestions[activeIndex]);
      return;
    }

    if (!input.trim() || !allCoasters.length) return;

    const q = input.trim().toLowerCase();
    const exact =
      allCoasters.find((c) => c.name.toLowerCase() === q) ?? suggestions[0];

    if (!exact) {
      showToast("Coaster not found in your ratings");
      return;
    }
    handleGuess(exact);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleGuess(suggestions[activeIndex]);
        setActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setInput("");
      inputRef.current?.blur();
      setIsFocused(false);
      setActiveIndex(-1);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  if (!loading && (error || !answer)) {
    return (
      <div className="text-red-500 p-10 text-center font-bold">
        Failed to load game: {error || "No data"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-2 sm:p-6 flex flex-col items-center overflow-x-hidden">
      <style>{`
        @keyframes revealUp {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-reveal {
          animation: revealUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0; 
        }
        @keyframes smoothFlip {
          0% { transform: perspective(600px) rotateX(90deg); opacity: 0; }
          40% { transform: perspective(600px) rotateX(-10deg); opacity: 1; }
          70% { transform: perspective(600px) rotateX(5deg); }
          100% { transform: perspective(600px) rotateX(0deg); opacity: 1; }
        }
        .animate-flipInCell {
          animation: smoothFlip 0.5s ease-out backwards;
          backface-visibility: hidden;
        }
        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .bg-shine {
          background-size: 200% auto;
          animation: shine 4s linear infinite;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-full shadow-2xl whitespace-nowrap animate-bounce z-[200]">
          {toast}
        </div>
      )}

      {/* Header Container */}
      <div
        className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
          showMenu ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
        } md:max-h-none md:opacity-100`}
      >
        <header className="mb-2 text-center mt-2 space-y-2 px-4 animate-reveal">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6 pr-4">
            COASTLE
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-bold uppercase tracking-widest">
            {MAX_GUESSES} Chances • One Coaster
          </p>
        </header>

        {/* Tabs */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-4 mx-auto animate-reveal">
          {[
            { id: "play", label: "Play", icon: PlayIcon },
            { id: "howto", label: "How To", icon: BookOpenIcon },
            { id: "leaderboard", label: "Stats", icon: ChartBarIcon }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center justify-center py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm scale-100"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-neutral-700/50 hover:scale-95"
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "play" && (
        <div
          key="play-tab"
          className="w-full max-w-[1400px] flex flex-col items-center gap-4 sm:gap-6 animate-reveal"
        >
          {/* Mode Switcher */}
          <div
            className={`transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
              showMenu
                ? "max-h-[50px] opacity-100 mb-0"
                : "max-h-0 opacity-0 mb-0"
            } md:max-h-none md:opacity-100 md:mb-0`}
          >
            <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-full flex gap-1 relative z-10 items-center mx-auto w-fit">
              <button
                onClick={() => switchMode("daily")}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  gameMode === "daily"
                    ? "bg-white dark:bg-neutral-700 text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => switchMode("endless")}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  gameMode === "endless"
                    ? "bg-white dark:bg-neutral-700 text-fuchsia-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Endless
              </button>
            </div>
          </div>

          {/* Sticky Search Bar */}
          <div
            ref={containerRef}
            className={`w-full max-w-xl sticky top-0 z-40 py-2 px-2 sm:px-0 transition-all flex items-center gap-2 ${
              !showMenu ? "bg-white dark:bg-slate-900 md:bg-transparent" : ""
            }`}
          >
            {gameMode === "daily" && gameState !== "playing" ? (
              <div className="w-full">
                <Countdown />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative group w-full">
                <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500 opacity-40 blur-sm group-focus-within:opacity-70 transition duration-500" />
                <div className="relative rounded-2xl bg-white/80 dark:bg-neutral-900/70 backdrop-blur border border-gray-200 dark:border-neutral-700 shadow-sm transition-all duration-300">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={handleInputFocus}
                      disabled={gameState !== "playing"}
                      placeholder={
                        gameState === "playing" ? "Search coaster..." : "Game Over"
                      }
                      className="w-full bg-transparent outline-none text-base sm:text-lg font-medium placeholder:text-gray-400 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type={gameState === "playing" ? "submit" : "button"}
                      onClick={gameState !== "playing" ? resetGame : undefined}
                      disabled={gameState === "playing" && !input.trim()}
                      className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide transition border border-transparent shadow-sm flex items-center gap-2 cursor-pointer ${
                        gameState !== "playing"
                          ? "bg-blue-600 text-white hover:bg-blue-700 w-auto whitespace-nowrap"
                          : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-80 disabled:opacity-30"
                      }`}
                    >
                      {gameState === "playing" ? (
                        "Guess"
                      ) : (
                        <>
                          <ArrowPathIcon className="w-4 h-4" />
                          Play Again
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {!showMenu && (
              <button
                onClick={handleExitOrReset}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-neutral-800 dark:text-slate-400 dark:hover:bg-neutral-700 transition-all shadow-sm md:hidden"
                title="Exit Game / Show Menu"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}

            {suggestions.length > 0 && gameState === "playing" && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-neutral-800 overflow-hidden z-40 max-h-[300px] overflow-y-auto">
                {suggestions.map((s, index) => (
                  <button
                    key={s.id}
                    onClick={() => handleGuess(s)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-neutral-800 last:border-0 group cursor-pointer ${
                      index === activeIndex
                        ? "bg-slate-100 dark:bg-neutral-800"
                        : "hover:bg-slate-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {s.countryName && (
                      <div className="relative w-8 h-5 shadow-sm rounded-sm overflow-hidden shrink-0 group-hover:scale-110 transition">
                        <Image
                          src={getParkFlag(s.countryName)}
                          alt="flag"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        {s.park}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Table */}
          <div className="w-full flex justify-center pb-12 px-1">
            <table className="w-full table-fixed border-separate border-spacing-x-1 sm:border-spacing-x-2 sm:border-spacing-y-2">
              <thead>
                <tr className="text-[9px] sm:text-xs uppercase tracking-widest text-slate-400 font-bold">
                  <th className="hidden md:table-cell pb-2 text-center w-[200px]">
                    Coaster
                  </th>
                  <th className="pb-2 text-center">Rating</th>
                  <th className="pb-2 text-center">
                    <span className="md:hidden">Mfr</span>
                    <span className="hidden md:inline">Manufacturer</span>
                  </th>
                  <th className="pb-2 text-center">Park</th>
                  <th className="pb-2 text-center">Country</th>
                  <th className="pb-2 text-center">Count</th>
                  <th className="pb-2 text-center">Year</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                {guesses.map((g, idx) => (
                  <GuessRow key={idx} guess={g} answer={answer} />
                ))}
                {Array.from({
                  length: Math.max(0, MAX_GUESSES - guesses.length)
                }).map((_, i) => (
                  <tr key={`empty-${i}`} className="opacity-30">
                    <td className="hidden md:table-cell p-2 text-center align-middle">
                      <div className="h-16 w-full bg-slate-300 dark:bg-neutral-800 rounded-lg animate-pulse" />
                    </td>
                    {Array.from({ length: 6 }).map((_, cIdx) => (
                      <td key={cIdx} className="p-0.5 sm:p-2 align-middle">
                        <div className="h-12 sm:h-16 w-full rounded-lg border-2 border-dashed border-slate-300 dark:border-neutral-700" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="w-full px-4 mb-2 md:hidden flex flex-col items-center">
            {guesses.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 animate-reveal"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="text-slate-400 font-mono text-xs w-4">
                  {i + 1}.
                </span>
                <span className="font-bold truncate max-w-[250px]">
                  {g.coaster.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Content */}
      {activeTab === "howto" && <HowTo />}

      {activeTab === "leaderboard" && (
        <Leaderboard stats={stats} gameState={gameState} onShare={handleCopy} />
      )}

      {/* Result Modal */}
<ResultModal
  isOpen={showModal}
  gameState={gameState}
  answer={answer}
  gameMode={gameMode}
  guessesCount={guesses.length}
  maxGuesses={MAX_GUESSES}
  currentStreak={gameMode === "daily" ? stats.currentStreak : undefined}
  onClose={() => setShowModal(false)}
  onShare={handleCopy}   // ✅ Share = copy
  onReset={resetGame}
/>
    </div>
  );
}
