"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { getParkFlag } from "@/app/utils/design";

// --- Icons ---
function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    );
}

function BookOpenIcon({ className }: { className?: string }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    );
}

function ChartBarIcon({ className }: { className?: string }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    );
}

function ArrowPathIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    )
}

function StopIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
}

// ---- Types ----
type ApiCoaster = {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  scale: string;
  haveRidden: boolean;
  isBestCoaster: boolean;
  rcdbPath: string;
  rideCount: number;
  rating: number | string | null;
  parkId: number;
  parkName: string;
  year: number | null;
  lastVisitDate: string | null;
};

type CoastleCoaster = {
  id: string;
  name: string;
  rating: number;
  manufacturer: string;
  park: string;
  rideCount: number;
  lastRidden: string | null;
  year: number;
  parkId: number;
  rcdbPath: string;
  countryName?: string;
};

type MatchStatus = "correct" | "wrong";

type Guess = {
  coaster: CoastleCoaster;
  matches: {
    park: MatchStatus;
    manufacturer: MatchStatus;
    rating: MatchStatus;
    year: MatchStatus;
    country: MatchStatus;
    rideCount: MatchStatus;
  };
};

type Cell = {
  key: string;
  content: ReactNode;
  status: MatchStatus;
  noColor?: boolean;
  isArrow?: boolean;
  diff?: number;
  hiddenOnMobile?: boolean;
};

type GameStats = {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
};

const PARK_COUNTRY_MAP: Record<string, string> = {
  "Liseberg": "Sweden",
  "Europa-Park": "Germany",
  "Tivoli Gardens": "Denmark",
  "Phantasialand": "Germany",
  "Energylandia": "Poland",
  "Toverland": "Netherlands",
  "Walibi Belgium": "Belgium",
  "Djurs Sommerland": "Denmark",
  "Fårup Sommerland": "Denmark",
  "Tusenfryd": "Norway",
  "Bakken": "Denmark",
  "BonBon-Land": "Denmark",
  "Legendia": "Poland",
  "Tivoli Friheden": "Denmark",
  "Holiday Park": "Germany",
  "PortAventura Park": "Spain",
  "Alton Towers": "UnitedKingdom",
  "Efteling": "Netherlands",
  "Cedar Point": "UnitedStates",
};

const INITIAL_STATS: GameStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0],
};

// ---- Helpers (Deterministic Random) ----

function getUTCTodaySeed() {
    const d = new Date();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return year * 10000 + month * 100 + day;
}

function seededRandom(seed: number) {
    const a = 1664525;
    const c = 1013904223;
    const m = 4294967296; 
    return (a * seed + c) % m;
}

function getDailyCoaster(coasters: CoastleCoaster[]): CoastleCoaster | null {
    if (coasters.length === 0) return null;
    const seed = getUTCTodaySeed();
    const randomInt = seededRandom(seed);
    const index = Math.abs(randomInt) % coasters.length;
    return coasters[index];
}

function getTodayString() {
    const seed = getUTCTodaySeed();
    return String(seed); 
}

function formatLastRidden(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function getMatchStatus(
  guess: number | string | undefined | null,
  answer: number | string | undefined | null
): MatchStatus {
  if (guess === answer) return "correct";
  return "wrong";
}

function getStatusStyles(status: MatchStatus) {
  switch (status) {
    case "correct":
      return "bg-emerald-500 text-white border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    case "wrong":
    default:
      return "bg-red-800 text-white border-red-900 dark:bg-red-900 dark:border-red-950";
  }
}

function mapApiToCoastle(c: ApiCoaster): CoastleCoaster | null {
  const rawRating = c.rating;
  const rating =
    rawRating === null || rawRating === undefined
      ? null
      : typeof rawRating === "string"
      ? parseFloat(rawRating)
      : rawRating;

  if (rating === null || Number.isNaN(rating)) return null;

  const parkName = c.parkName;
  const countryName = PARK_COUNTRY_MAP[parkName];

  return {
    id: String(c.id),
    name: c.name,
    rating,
    manufacturer: c.manufacturer,
    park: parkName,
    rideCount: c.rideCount ?? 0,
    lastRidden: c.lastVisitDate,
    year: c.year ?? 0,
    parkId: c.parkId,
    rcdbPath: c.rcdbPath,
    countryName,
  };
}

// Fallback copy function for insecure contexts
async function legacyCopy(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.left = "-9999px"; 
    textArea.style.top = "0"; 
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        return true;
    } catch (err) {
        console.error('Fallback copy failed', err);
        return false;
    } finally {
        document.body.removeChild(textArea);
    }
}

// ---- Sub-components ----

function Countdown() {
    const [timeLeft, setTimeLeft] = useState("");
    
    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setUTCHours(24, 0, 0, 0); 
            const diff = tomorrow.getTime() - now.getTime();
            
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60)) % 60);
            const s = Math.floor((diff / 1000) % 60);
            
            return `${h}h ${m}m ${s}s`;
        };
        
        setTimeLeft(calculate());
        const interval = setInterval(() => setTimeLeft(calculate()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-[42px] sm:h-[46px] flex items-center justify-center gap-2 bg-slate-100 dark:bg-neutral-800 rounded-2xl text-slate-500 dark:text-slate-400 font-bold text-sm sm:text-base animate-reveal shadow-inner border border-slate-200 dark:border-neutral-700">
            <ClockIcon className="w-5 h-5" />
            <span>Next Coastle: {timeLeft}</span>
        </div>
    );
}

function GuessRow({
  guess,
  answer,
}: {
  guess: Guess;
  answer: CoastleCoaster | null;
}) {
  if (!answer) return null;

  const isCorrect = guess.coaster.id === answer.id;

  const cells: Cell[] = [
    {
      key: "rating",
      content: guess.coaster.rating.toFixed(1),
      status: guess.matches.rating,
      isArrow: true,
      diff: guess.coaster.rating - answer.rating,
      noColor: false,
    },
    {
      key: "manufacturer",
      content: guess.coaster.manufacturer,
      status: guess.matches.manufacturer,
      noColor: false,
    },
    {
      key: "park",
      content: guess.coaster.park,
      status: guess.matches.park,
      noColor: false,
    },
    {
      key: "country",
      content: guess.coaster.countryName ? (
        <div className="flex flex-col items-center justify-center gap-1.5 w-full">
          <div className="relative shadow-md rounded-sm overflow-hidden border border-black/20">
            <Image
              src={getParkFlag(guess.coaster.countryName)}
              alt={`${guess.coaster.countryName} flag`}
              width={42}
              height={28}
              className="object-cover"
              unoptimized
            />
          </div>
          {/* HIDE country name on mobile */}
          <span className="text-[10px] uppercase tracking-wide opacity-90 font-bold hidden md:block">
            {guess.coaster.countryName.substring(0, 3)}
          </span>
        </div>
      ) : (
        "—"
      ),
      status: guess.matches.country,
      noColor: false,
    },
    {
      key: "rideCount",
      content: guess.coaster.rideCount,
      status: guess.matches.rideCount,
      isArrow: true,
      diff: guess.coaster.rideCount - answer.rideCount,
      noColor: false,
    },
    {
      key: "lastRidden",
      content: formatLastRidden(guess.coaster.lastRidden),
      status: "wrong",
      noColor: true,
      hiddenOnMobile: true,
    },
    {
      key: "year",
      content: guess.coaster.year || "—",
      status: guess.matches.year,
      isArrow: true,
      diff: guess.coaster.year - answer.year,
      noColor: false,
    },
  ];

  return (
    <tr className="border-b border-transparent">
      {/* Desktop Only: Coaster Name */}
      <td className="hidden md:table-cell p-2 align-middle text-center overflow-hidden bg-slate-50 dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800">
        <div className={`
          text-lg font-black leading-tight mx-auto max-w-[200px] whitespace-normal break-words
          ${isCorrect ? "text-emerald-500 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}
          animate-flipInCell
        `}>
          <a
            href={guess.coaster.rcdbPath}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-2 underline-offset-2 block"
            title={guess.coaster.name}
          >
            {guess.coaster.name}
          </a>
        </div>
      </td>
      
      {/* Attributes */}
      {cells.map((cell, i) => (
        <td 
          key={cell.key} 
          // Tight padding on mobile
          className={`p-0.5 sm:p-2 align-middle ${cell.hiddenOnMobile ? 'hidden md:table-cell' : ''}`}
        >
          <div
            className={`
              relative flex flex-col items-center justify-center
              h-12 sm:h-16 w-full rounded-lg border text-[10px] sm:text-base font-bold
              shadow-md transition-all overflow-hidden shrink-0
              ${
                cell.noColor
                  ? "bg-white border-slate-200 text-slate-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-slate-200"
                  : getStatusStyles(cell.status)
              }
              opacity-0 animate-flipInCell
            `}
            style={{
              animationDelay: `${(i + 1) * 80}ms`,
              animationFillMode: "forwards",
            }}
          >
            {/* Fix: Manufacturer AND Park allow 2 lines */}
            <span className={`px-0.5 sm:px-1 text-center w-full z-10 relative drop-shadow-sm ${cell.key === 'park' || cell.key === 'manufacturer' ? 'whitespace-normal leading-[1.1] line-clamp-2 break-words' : 'truncate leading-tight'}`}>
              {cell.content}
            </span>
            {cell.isArrow && typeof cell.diff === "number" && cell.diff !== 0 && (
              <span className="z-10 text-[7px] sm:text-[10px] uppercase opacity-90 font-bold leading-none mt-0.5 sm:mt-1 flex items-center gap-0.5 bg-black/25 px-1 py-0.5 rounded-full backdrop-blur-sm tracking-tighter">
                {cell.diff > 0 ? "Lower ▼" : "Higher ▲"}
              </span>
            )}
          </div>
        </td>
      ))}
    </tr>
  );
}

// ---- Main Coastle page ----

export default function CoastlePage() {
  const [allCoasters, setAllCoasters] = useState<CoastleCoaster[]>([]);
  const [answer, setAnswer] = useState<CoastleCoaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [toast, setToast] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"play" | "howto" | "leaderboard">("play");
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);

  // Toggle state - DEFAULT TO DAILY
  const [gameMode, setGameMode] = useState<"daily" | "endless">("daily");

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Logic: Hide HEADER if user is interacting with input (focused) OR if game is actively being played (guesses exist & not over)
  // IMPORTANT: We use `showMenu` to trigger the Header Slide Up animation.
  const isGameActive = guesses.length > 0 && gameState === 'playing';
  const showMenu = !isGameActive && !isFocused;

  // Signal to Header to hide/show - Smooth Transition Logic
  useEffect(() => {
    // On Desktop (md+), we ALWAYS want the header visible regardless of game state.
    const shouldHideHeader = !showMenu;
    window.dispatchEvent(new CustomEvent('toggle-header', { detail: { visible: !shouldHideHeader } }));
    
    // Cleanup on unmount (show header)
    return () => {
        window.dispatchEvent(new CustomEvent('toggle-header', { detail: { visible: true } }));
    };
  }, [showMenu]);

  // Fetch coasters
  useEffect(() => {
    async function fetchCoasters() {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();
        if (!data || !Array.isArray(data.coasters)) {
          throw new Error("Unexpected data format");
        }

        const mapped: CoastleCoaster[] = (data.coasters as ApiCoaster[])
          .map(mapApiToCoastle)
          .filter((c): c is CoastleCoaster => !!c && c.rating > 0);
        
        mapped.sort((a, b) => {
            const idA = parseInt(a.id, 10);
            const idB = parseInt(b.id, 10);
            if (isNaN(idA) || isNaN(idB)) return a.id.localeCompare(b.id);
            return idA - idB;
        });

        setAllCoasters(mapped);

        // INITIAL LOAD: Check for Daily state
        if (mapped.length > 0) {
            const today = getTodayString();
            const savedDaily = localStorage.getItem('coastle-daily-state');
            let restored = false;

            if (savedDaily) {
                try {
                    const parsed = JSON.parse(savedDaily);
                    if (parsed.date === today) {
                        setAnswer(getDailyCoaster(mapped));
                        setGuesses(parsed.guesses);
                        setGameState(parsed.status);
                        restored = true;
                    }
                } catch (e) {}
            }

            if (!restored) {
                setAnswer(getDailyCoaster(mapped));
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

    const saved = localStorage.getItem("coastle-stats");
    if (saved) {
      try { setStats(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  function switchMode(mode: "daily" | "endless") {
      setGameMode(mode);
      setInput("");
      setToast(null);
      setShowModal(false);
      setIsFocused(false);

      if (mode === 'daily') {
          const today = getTodayString();
          const savedDaily = localStorage.getItem('coastle-daily-state');
          let restored = false;

          if (savedDaily && allCoasters.length > 0) {
              const parsed = JSON.parse(savedDaily);
              if (parsed.date === today) {
                  const dailyAnswer = getDailyCoaster(allCoasters);
                  setAnswer(dailyAnswer);
                  setGuesses(parsed.guesses);
                  setGameState(parsed.status);
                  restored = true;
              }
          }

          if (!restored && allCoasters.length > 0) {
              const dailyAnswer = getDailyCoaster(allCoasters);
              setAnswer(dailyAnswer);
              setGuesses([]);
              setGameState("playing");
          }
      } else {
          setGuesses([]);
          setGameState("playing");
          if (allCoasters.length > 0) {
              setAnswer(allCoasters[Math.floor(Math.random() * allCoasters.length)]);
          }
      }
  }

  const suggestions = useMemo(() => {
    if (!input.trim() || !allCoasters.length) return [];
    const q = input.toLowerCase().trim();
    return allCoasters.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [input, allCoasters]);

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
    
    if (gameMode === 'endless' && allCoasters.length > 0) {
      const random = allCoasters[Math.floor(Math.random() * allCoasters.length)];
      setAnswer(random);
    } 
  }

  // Handle the "X" button which cancels focus or resets game
  function handleExitOrReset() {
      setIsFocused(false);
      setInput("");
      inputRef.current?.blur();
      setGuesses([]); // Reset board
      setGameState("playing"); 
  }

  function handleGuess(coaster: CoastleCoaster) {
    if (gameState !== "playing" || !answer) return;

    if (guesses.some((g) => g.coaster.id === coaster.id)) {
      showToast("Already guessed that coaster!");
      return;
    }

    const guess: Guess = {
      coaster,
      matches: {
        park: getMatchStatus(coaster.park, answer.park),
        manufacturer: getMatchStatus(coaster.manufacturer, answer.manufacturer),
        rating: getMatchStatus(coaster.rating, answer.rating),
        year: getMatchStatus(coaster.year, answer.year),
        country: getMatchStatus(coaster.countryName, answer.countryName),
        rideCount: getMatchStatus(coaster.rideCount, answer.rideCount),
      },
    };

    const nextGuesses = [...guesses, guess];
    setGuesses(nextGuesses);
    setInput("");
    
    inputRef.current?.focus();

    // Game End Logic
    // FIX: Explicitly type newStatus as the union type to avoid inference errors
    let newStatus: "playing" | "won" | "lost" = gameState;
    
    if (coaster.id === answer.id) newStatus = "won";
    else if (nextGuesses.length >= MAX_GUESSES) newStatus = "lost";

    // Update Game State
    if (newStatus !== "playing") {
        setGameState(newStatus);
        
        setIsFocused(false);
        inputRef.current?.blur();
        
        const nextStats = { ...stats };
        nextStats.played += 1;
        if (newStatus === "won") {
            nextStats.won += 1;
            nextStats.currentStreak += 1;
            nextStats.maxStreak = Math.max(nextStats.currentStreak, nextStats.maxStreak);
            nextStats.guessDistribution[nextGuesses.length - 1] += 1;
        } else {
            nextStats.currentStreak = 0;
        }
        
        setStats(nextStats);
        localStorage.setItem("coastle-stats", JSON.stringify(nextStats));
        
        setTimeout(() => setShowModal(true), 1500);
    }

    if (gameMode === 'daily') {
        const stateToSave = {
            date: getTodayString(),
            guesses: nextGuesses,
            status: newStatus 
        };
        localStorage.setItem('coastle-daily-state', JSON.stringify(stateToSave));
    }
  }

  async function handleShare() {
      const grid = guesses.map(g => {
        const m = g.matches;
        const row = [m.rating, m.manufacturer, m.park, m.country, m.rideCount, m.year];
        return row.map(status => status === 'correct' ? '🟩' : '🟥').join('');
      }).join('\n');
 
      let intro = "";
      if (gameMode === 'daily') {
          if (gameState === 'won') intro = `I completed the Daily Coastle in ${guesses.length} guesses!`;
          else intro = "I did not guess today's Daily Coastle...";
      } else {
          if (gameState === 'won') intro = `I guessed ${answer?.name} in ${guesses.length} guesses in coastle endless mode.`;
          else intro = `I did not guess ${answer?.name} in coastle endless mode.`;
      }

      const text = `${intro}\n\n${grid}\n\nPlay at: parkrating.com/coastle`;
 
      try {
        if (navigator.share) {
            await navigator.share({
                title: 'Coastle',
                text: text,
            });
        } else {
            throw new Error("Web Share not supported");
        }
      } catch (err) {
        const success = await legacyCopy(text);
        if (success) showToast("Results copied!");
        else showToast("Failed to copy");
      }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (gameState !== "playing") {
        if (gameMode === 'endless') resetGame();
        return;
    }
    if (!input.trim() || !allCoasters.length) return;
    const q = input.trim().toLowerCase();
    const exact = allCoasters.find((c) => c.name.toLowerCase() === q) ?? suggestions[0];
    if (!exact) {
      showToast("Coaster not found in your ratings");
      return;
    }
    handleGuess(exact);
  }

  const handleInputFocus = () => {
      setIsFocused(true);
      setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100); 
  };

  if (!loading && (error || !answer)) {
    return <div className="text-red-500 p-10 text-center font-bold">Failed to load game: {error || "No data"}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 dark:from-neutral-950 dark:to-neutral-900 p-2 sm:p-6 flex flex-col items-center overflow-x-hidden">
      
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-full shadow-2xl whitespace-nowrap animate-bounce z-[200]">
          {toast}
        </div>
      )}

      {/* Header Container */}
      <div 
        className={`
            transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
            ${showMenu ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}
            md:max-h-none md:opacity-100
        `}
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
        <div className="w-full max-w-sm grid grid-cols-3 gap-1 bg-slate-200 dark:bg-neutral-800 p-1 rounded-xl mb-4 mx-auto animate-reveal">
            {[
                { id: 'play', label: 'Play', icon: PlayIcon },
                { id: 'howto', label: 'How To', icon: BookOpenIcon },
                { id: 'leaderboard', label: 'Stats', icon: ChartBarIcon }
            ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex flex-col items-center justify-center py-2 rounded-lg text-xs font-bold transition-all duration-200
                            ${isActive 
                                ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm scale-100' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-neutral-700/50 hover:scale-95'}
                        `}
                    >
                        <Icon className="w-5 h-5 mb-0.5" />
                        {tab.label}
                    </button>
                )
            })}
        </div>
      </div>

      {/* Play Content */}
      {activeTab === 'play' && (
          // CHANGED: Increased mobile gap to gap-4 (middle ground between gap-2 and gap-6)
          <div key="play-tab" className="w-full max-w-[1400px] flex flex-col items-center gap-4 sm:gap-6 animate-reveal">
              
            {/* Mode Switch Container */}
            <div 
                className={`
                    transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
                    ${showMenu ? 'max-h-[50px] opacity-100 mb-0' : 'max-h-0 opacity-0 mb-0'}
                    md:max-h-none md:opacity-100 md:mb-0
                `}
            >
                <div className="bg-slate-200 dark:bg-neutral-800 p-1 rounded-full flex gap-1 relative z-10 items-center mx-auto w-fit">
                    <button 
                        onClick={() => switchMode('daily')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${gameMode === 'daily' ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                    Daily
                    </button>
                    <button 
                        onClick={() => switchMode('endless')}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${gameMode === 'endless' ? 'bg-white dark:bg-neutral-700 text-fuchsia-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                    Endless
                    </button>
                </div>
            </div>

            {/* Sticky Search Bar - Using provided reference styling */}
            <div 
              ref={containerRef} 
              className={`
                  w-full max-w-xl sticky top-0 z-40 
                  py-2 px-2 sm:px-0 transition-all flex items-center gap-2
                  ${!showMenu ? 'bg-white dark:bg-neutral-950 md:bg-transparent' : ''} 
              `}
            >
              
              {gameMode === 'daily' && gameState !== 'playing' ? (
                  <div className="w-full"><Countdown /></div>
              ) : (
                  <form onSubmit={handleSubmit} className="relative group w-full">
                    <div className="absolute -inset-[1.5px] rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-400 to-fuchsia-500 opacity-40 blur-sm group-focus-within:opacity-70 transition duration-500" />
                    
                    <div className={`
                        relative rounded-2xl bg-white/80 dark:bg-neutral-950/70 backdrop-blur border border-gray-200 dark:border-neutral-700 shadow-sm transition-all duration-300
                    `}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <input
                          ref={inputRef}
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onFocus={handleInputFocus}
                          disabled={gameState !== "playing"}
                          placeholder={gameState === "playing" ? "Search coaster..." : "Game Over"}
                          className="w-full bg-transparent outline-none text-base sm:text-lg font-medium placeholder:text-gray-400 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        
                        <button
                          type={gameState === "playing" ? "submit" : "button"}
                          onClick={gameState !== "playing" ? resetGame : undefined}
                          disabled={gameState === "playing" && !input.trim()}
                          className={`
                            px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide 
                            transition border border-transparent shadow-sm flex items-center gap-2
                            ${gameState !== 'playing' 
                               ? 'bg-blue-600 text-white hover:bg-blue-700 w-auto whitespace-nowrap' 
                               : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-80 disabled:opacity-30'}
                          `}
                        >
                          {gameState === "playing" ? "Guess" : (
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

              {/* Exit/Reset Button - Mobile Only (md:hidden) and only when focused/active */}
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-slate-100 dark:border-neutral-800 overflow-hidden z-40 max-h-[300px] overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleGuess(s)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors border-b border-slate-100 dark:border-neutral-800 last:border-0 group"
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
                        <div className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">{s.name}</div>
                        <div className="text-xs text-slate-400 font-medium">{s.park}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results Table - MOVED ABOVE MOBILE HISTORY */}
            <div className="w-full flex justify-center pb-12 px-1">
              <table className="w-full table-fixed border-separate border-spacing-x-1 sm:border-spacing-x-2 sm:border-spacing-y-2">
                <thead>
                  <tr className="text-[9px] sm:text-xs uppercase tracking-widest text-slate-400 font-bold">
                    <th className="hidden md:table-cell pb-2 text-center w-[200px]">Coaster</th>
                    <th className="pb-2 text-center">Rating</th>
                    <th className="pb-2 text-center">
                      <span className="md:hidden">Mfr</span>
                      <span className="hidden md:inline">Manufacturer</span>
                    </th>
                    <th className="pb-2 text-center">Park</th>
                    <th className="pb-2 text-center">Country</th>
                    <th className="pb-2 text-center">Count</th>
                    <th className="hidden md:table-cell pb-2 text-center opacity-50">Last Ride</th>
                    <th className="pb-2 text-center">Year</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {guesses.map((g, idx) => (
                    <GuessRow key={idx} guess={g} answer={answer} />
                  ))}
                  
                  {Array.from({ length: Math.max(0, MAX_GUESSES - guesses.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="opacity-30">
                      <td className="hidden md:table-cell p-2 text-center align-middle">
                        <div className="h-16 w-full bg-slate-300 dark:bg-neutral-800 rounded-lg animate-pulse" />
                      </td>
                      {Array.from({ length: 7 }).map((_, cIdx) => (
                        <td 
                          key={cIdx} 
                          // 0:Rating 1:Mfr 2:Park 3:Country 4:Count 5:LastRide 6:Year
                          className={`p-0.5 sm:p-2 align-middle ${cIdx === 5 ? 'hidden md:table-cell' : ''}`}
                        >
                          <div className={`h-12 sm:h-16 w-full rounded-lg border-2 border-dashed border-slate-300 dark:border-neutral-700`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Guess History (Legend) - MOVED HERE */}
            <div className="w-full px-4 mb-2 md:hidden flex flex-col items-center">
              {guesses.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 animate-reveal" style={{ animationDelay: `${i * 100}ms` }}>
                    <span className="text-slate-400 font-mono text-xs w-4">{i + 1}.</span>
                    <span className="font-bold truncate max-w-[250px]">{g.coaster.name}</span>
                </div>
              ))}
            </div>

          </div>
      )}

      {/* --- TAB CONTENT: HOW TO --- */}
      {/* Removed {showMenu && ...} wrapper here to allow viewing on Desktop at all times */}
      {activeTab === 'howto' && (
          <div key="howto-tab" className="w-full max-w-xl animate-reveal">
             <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-neutral-800 text-center">
                <div className="inline-block p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
                    <BookOpenIcon className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black mb-6 dark:text-white">
                    Instructions
                </h2>
                <ul className="space-y-6 text-slate-600 dark:text-slate-300 text-left">
                    <li className="flex gap-4">
                        <div className="text-3xl bg-slate-50 dark:bg-neutral-800 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">🎢</div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Guess the Coaster</p>
                            <p className="text-sm">Search and guess any roller coaster from the parkrating database. Play daily or endless mode.</p>
                        </div>
                    </li>
                    <li className="flex gap-4">
                        <div className="text-3xl bg-emerald-50 dark:bg-emerald-900/20 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">🟩</div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Perfect Match</p>
                            <p className="text-sm">Green indicates the attribute matches the secret coaster exactly.</p>
                        </div>
                    </li>
                    <li className="flex gap-4">
                        <div className="text-3xl bg-red-50 dark:bg-red-900/20 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">🟥</div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Incorrect</p>
                            <p className="text-sm">Red indicates the attribute does not match.</p>
                        </div>
                    </li>
                    <li className="flex gap-4">
                        <div className="text-3xl bg-slate-50 dark:bg-neutral-800 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">⬇️</div>
                        <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">Higher or Lower</p>
                            <p className="text-sm">Arrows for numeric values (Year, Rating, Ride Count) tell you if the answer is higher or lower than your guess.</p>
                        </div>
                    </li>
                </ul>
             </div>
          </div>
      )}

      {/* --- TAB CONTENT: LEADERBOARD --- */}
      {/* Removed {showMenu && ...} wrapper here */}
      {activeTab === 'leaderboard' && (
          <div key="leaderboard-tab" className="w-full max-w-xl animate-reveal">
             <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-neutral-800 text-center">
                 <div className="inline-block p-3 bg-yellow-100 text-yellow-600 rounded-full mb-4">
                     <div className="text-4xl">🏆</div>
                 </div>
                 <h2 className="text-3xl font-black mb-8 dark:text-white">Your Stats</h2>
                 
                 <div className="grid grid-cols-4 gap-4 mb-10">
                   {[
                       { label: 'Played', val: stats.played },
                       { label: 'Win %', val: stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0 },
                       { label: 'Streak', val: stats.currentStreak },
                       { label: 'Max', val: stats.maxStreak },
                   ].map((s) => (
                       <div key={s.label} className="flex flex-col items-center">
                           <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{s.val}</div>
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</div>
                       </div>
                   ))}
                 </div>

                 <div className="text-left bg-slate-50 dark:bg-neutral-800/50 p-6 rounded-2xl">
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 text-center">Guess Distribution</h3>
                    <div className="space-y-3">
                        {stats.guessDistribution.map((count, i) => {
                        const max = Math.max(...stats.guessDistribution, 1);
                        const width = Math.max(7, (count / max) * 100); 
                        return (
                            <div key={i} className="flex items-center gap-3 text-sm font-bold">
                            <span className="w-3 text-slate-400">{i + 1}</span>
                            <div 
                                className={`h-8 flex items-center justify-end px-3 rounded-lg ${count > 0 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-neutral-700'}`}
                                style={{ width: `${width}%` }}
                            >
                                {count}
                            </div>
                            </div>
                        )
                        })}
                    </div>
                 </div>

                 {/* Always show Share button here if a game was recently finished (checking if gameState is not playing) */}
                 {gameState !== 'playing' && (
                     <div className="mt-8 pt-8 border-t border-slate-100 dark:border-neutral-800">
                        <button 
                            onClick={handleShare}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/30 transform hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                        >
                            <ShareIcon className="w-6 h-6" />
                            Share Results
                        </button>
                     </div>
                 )}
             </div>
          </div>
      )}


      {/* Win/Loss Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`
            relative rounded-3xl p-1 max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500
            ${gameState === "won" ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 bg-shine" : "bg-slate-700"}
          `}>
            <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-6 text-center relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
              
              <button onClick={() => setShowModal(false)} className="absolute top-3 right-3 p-2 bg-slate-100 dark:bg-neutral-800 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition z-10">
                <XMarkIcon className="w-5 h-5" />
              </button>

              <div className="mb-4 mt-2">
                 {gameState === "won" ? (
                   <div className="w-20 h-20 mx-auto bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center animate-bounce"><div className="text-5xl">🏆</div></div>
                 ) : (
                   <div className="w-20 h-20 mx-auto bg-slate-100 text-slate-500 rounded-full flex items-center justify-center grayscale opacity-80"><div className="text-5xl">🎢</div></div>
                 )}
              </div>
              
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">
                {gameState === "won" ? "Nailed It!" : "Track Incomplete"}
              </h2>
              
              <div className="relative my-6 group perspective">
                <div className="bg-slate-50 dark:bg-neutral-800 rounded-2xl p-4 border border-slate-200 dark:border-neutral-700 shadow-inner relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">The Answer Was</p>
                  <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 leading-tight">
                    {answer?.name}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  onClick={handleShare}
                  className="w-full py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 transition hover:opacity-90 dark:hover:bg-slate-200 dark:hover:text-slate-900 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                >
                  <ShareIcon className="w-5 h-5" />
                  Share Result
                </button>
                <div className="flex gap-3">
                    {/* Hide Play Again if Daily */}
                    {gameMode === 'endless' && (
                        <button onClick={resetGame} className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110">
                            Play Again
                        </button>
                    )}
                    <button onClick={() => { setShowModal(false); setActiveTab('leaderboard'); }} className={`${gameMode === 'endless' ? 'flex-none px-4' : 'flex-1 py-3.5'} rounded-xl font-bold text-slate-600 dark:text-slate-300 border-2 border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800`}>
                        <ChartBarIcon className="w-6 h-6 mx-auto" />
                        {gameMode === 'daily' && <span className="ml-2">See Stats</span>}
                    </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}