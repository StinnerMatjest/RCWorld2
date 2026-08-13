"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTodayString } from "@/app/utils/coastle";
import type { GameStats } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";

type DailyState = {
  date: string;
  status: "playing" | "won" | "lost";
  guesses?: any[];
};

type ConnectionsSavedState = {
  solved?: string[];
  mistakes?: number;
};

function safeParseStats(raw: string | null): GameStats | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (
      typeof s?.played === "number" &&
      typeof s?.won === "number" &&
      typeof s?.currentStreak === "number"
    ) {
      return s as GameStats;
    }
  } catch { }
  return null;
}

function safeParseDaily(raw: string | null): DailyState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (typeof s?.date === "string" && typeof s?.status === "string") {
      return s as DailyState;
    }
  } catch { }
  return null;
}

function safeParseConnectionsState(raw: string | null): ConnectionsSavedState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (Array.isArray(s?.solved) || typeof s?.mistakes === "number") {
      return s as ConnectionsSavedState;
    }
  } catch { }
  return null;
}

// ─── Game icons: navy badge + glyph, one per game ────────────────────────────

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full rounded-full bg-[#0b2b48] border-[3px] border-[#e9820e] shadow-lg flex items-center justify-center overflow-hidden">
      {children}
    </div>
  );
}

/** Coastle: a mystery guess with Wordle-style feedback tiles. */
function IconCoastle() {
  return (
    <IconBadge>
      <svg viewBox="0 0 48 48" className="w-[60%] h-[60%]" fill="none">
        <text x="24" y="24" textAnchor="middle" fontSize="24" fontWeight="900" fill="#e9820e" fontFamily="inherit">?</text>
        <rect x="6" y="30" width="10" height="10" rx="2.5" fill="#4ade80" />
        <rect x="19" y="30" width="10" height="10" rx="2.5" fill="#facc15" />
        <rect x="32" y="30" width="10" height="10" rx="2.5" fill="#475569" />
      </svg>
    </IconBadge>
  );
}

/** Connections: the four color groups. */
function IconConnections() {
  return (
    <IconBadge>
      <svg viewBox="0 0 48 48" className="w-[54%] h-[54%]">
        <rect x="4" y="4" width="18" height="18" rx="4.5" fill="#facc15" />
        <rect x="26" y="4" width="18" height="18" rx="4.5" fill="#4ade80" />
        <rect x="4" y="26" width="18" height="18" rx="4.5" fill="#60a5fa" />
        <rect x="26" y="26" width="18" height="18" rx="4.5" fill="#c084fc" />
      </svg>
    </IconBadge>
  );
}

/** Zoomle: a magnifier — clean lens, nothing inside. */
function IconZoomle() {
  return (
    <IconBadge>
      <svg viewBox="0 0 48 48" className="w-[64%] h-[64%]" fill="none">
        <circle cx="20" cy="20" r="12.5" stroke="#fff" strokeWidth="3.4" />
        <line x1="29.5" y1="29.5" x2="41" y2="41" stroke="#e9820e" strokeWidth="4.4" strokeLinecap="round" />
      </svg>
    </IconBadge>
  );
}

/** Rankle: the slot reel with the lit center window. */
function IconRankle() {
  return (
    <IconBadge>
      <svg viewBox="0 0 48 48" className="w-[58%] h-[58%]" fill="none">
        <rect x="7" y="4" width="34" height="40" rx="7" stroke="#fff" strokeWidth="3" />
        <rect x="11.5" y="18.5" width="25" height="11" rx="3.5" fill="rgba(233,130,14,0.25)" stroke="#e9820e" strokeWidth="2.6" />
        <line x1="15" y1="11.5" x2="33" y2="11.5" stroke="#ffffff88" strokeWidth="3" strokeLinecap="round" />
        <line x1="15" y1="36.5" x2="33" y2="36.5" stroke="#ffffff88" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </IconBadge>
  );
}

function StatsRow({
  stats,
  dailyDone,
  href,
}: {
  stats: GameStats | null;
  dailyDone: boolean | null;
  href: string;
}) {
  const played = stats?.played ?? null;
  const winPct =
    stats && stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : null;
  const streak = stats?.currentStreak ?? null;
  const router = useRouter();

  const items = [
    { label: "Streak", value: streak },
    { label: "Played", value: played },
    { label: "Win %", value: winPct },
  ];

  return (
    <div className="mt-3 w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-center gap-6 sm:gap-8">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="text-lg sm:text-xl font-black text-slate-100 leading-none">
              {it.value === null ? "—" : it.value}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {it.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        {dailyDone ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`${href}?results=true`);
            }}
            className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
            Results
          </button>
        ) : (
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Daily available
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  href,
  label,
  gradient,
  stats,
  dailyDone,
  icon,
  showStats,
}: {
  href: string;
  label: string;
  gradient: string;
  stats: GameStats | null;
  dailyDone: boolean | null;
  icon: React.ReactNode;
  showStats: boolean;
}) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') router.push(href); }}
      aria-label={label}
      className="group w-full min-w-0 cursor-pointer focus:outline-none"
    >
      <div className="flex flex-col items-center justify-start py-4 sm:py-10 transition-transform duration-200 group-hover:scale-[1.05] group-active:scale-[0.99] origin-center">
        <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32">{icon}</div>

        <div className="mt-3 sm:mt-4 flex flex-col items-center">
          <div
            className={`
              text-[26px] sm:text-4xl xl:text-[2.6rem]
              font-black tracking-tighter
              bg-clip-text text-transparent
              bg-gradient-to-r ${gradient}
              drop-shadow-sm italic
              leading-none
              pr-1 sm:pr-2
              whitespace-nowrap
            `}
          >
            {label}
          </div>

          <div className="mt-2 sm:mt-3 w-full">
            <div
              className={`
                h-[3px] rounded-full
                bg-gradient-to-r ${gradient}
                opacity-70
                transform origin-left scale-x-0
                transition-transform duration-200
                group-hover:scale-x-100
                group-focus-visible:scale-x-100
              `}
            />
          </div>
        </div>

        <div className={showStats ? "block w-full" : "hidden sm:block w-full"}>
          <StatsRow stats={stats} dailyDone={dailyDone} href={href} />
        </div>
      </div>
    </div>
  );
}

export default function GamesLauncherPage() {
  const { isAdminMode } = useAdminMode();
  const [showStats, setShowStats] = useState(false);
  const [standardStats, setStandardStats] = useState<GameStats | null>(null);
  const [zoomleStats, setZoomleStats] = useState<GameStats | null>(null);
  const [connectionsStats, setConnectionsStats] = useState<GameStats | null>(null);
  const [rankleStats, setRankleStats] = useState<GameStats | null>(null);
  const [dailyCoastleDone, setStandardDailyDone] = useState<boolean | null>(null);
  const [zoomleDailyDone, setZoomleDailyDone] = useState<boolean | null>(null);
  const [connectionsDailyDone, setConnectionsDailyDone] = useState<boolean | null>(null);
  const [rankleDailyDone, setRankleDailyDone] = useState<boolean | null>(null);

  useEffect(() => {
    setStandardStats(
      safeParseStats(localStorage.getItem("coastle-standard-stats")) ??
      safeParseStats(localStorage.getItem("coastle-stats"))
    );

    // Zoomle has no cumulative stats yet — future feature
    setConnectionsStats(safeParseStats(localStorage.getItem("connections-stats")));


    // Fix: Check for both the new and legacy daily state keys
    const stdDaily =
      safeParseDaily(localStorage.getItem("coastle-daily-state")) ??
      safeParseDaily(localStorage.getItem("coastle-standard-daily-state"));

    // Inside the useEffect in games/page.tsx
    const today = getTodayString();

    // Add the admin suffix check here:
    const connectionsKey = isAdminMode ? `connections-${today}-admin` : `connections-${today}`;
    const connectionsDaily = safeParseConnectionsState(
      localStorage.getItem(connectionsKey)
    );

    const today2 = getTodayString();
    const zoomleRaw = localStorage.getItem(`zoomle-${today2}`);
    const zoomleState = zoomleRaw ? JSON.parse(zoomleRaw) : null;

    setStandardDailyDone(
      stdDaily ? stdDaily.date === today && stdDaily.status !== "playing" : false
    );

    setZoomleDailyDone(zoomleState?.done === true);

    setConnectionsDailyDone(
      connectionsDaily
        ? (connectionsDaily.solved?.length ?? 0) >= 4 || (connectionsDaily.mistakes ?? 0) >= 4
        : false
    );

    setRankleStats(safeParseStats(localStorage.getItem("rankle-stats")));
    try {
      const rankleRaw = localStorage.getItem(`rankle-${today}`);
      setRankleDailyDone(rankleRaw ? JSON.parse(rankleRaw)?.done === true : false);
    } catch {
      setRankleDailyDone(false);
    }
  }, []);

  const gradient = useMemo(() => "from-blue-600 via-indigo-600 to-fuchsia-600", []);

  return (
    <div className="min-h-screen bg-[#0f172a] px-4 py-6 sm:py-10 flex items-start justify-center">
      <div className="w-full max-w-7xl">
        <header className="text-center mt-2 md:mt-0 mb-4 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter text-brand drop-shadow-sm italic transform -skew-x-6">
            Games
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-widest">
            Choose a game below.
          </p>

          <div className="hidden sm:block mt-4 text-sm sm:text-base text-slate-300 font-medium max-w-3xl mx-auto space-y-1">
            <span className="block">
              <span className="font-bold text-slate-100">Coastle</span> = Focus on general coaster knowledge.
            </span>
            <span className="block">
              <span className="font-bold text-slate-100">Connections</span> = Group four coasters by 4 categories.
            </span>
            <span className="block">
              <span className="font-bold text-slate-100">Zoomle</span> = Guess the coaster as the image slowly reveals.
            </span>
            <span className="block">
              <span className="font-bold text-slate-100">Rankle</span> = Spin the reel and bet on coaster stat duels.
            </span>
          </div>
          {/* phones: stats live behind this toggle so all 4 games fit at once */}
          <button
            onClick={() => setShowStats((s) => !s)}
            className="sm:hidden mt-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 underline underline-offset-4 decoration-slate-600 active:text-slate-200 cursor-pointer"
          >
            📊 {showStats ? "Hide stats" : "Show stats"}
          </button>
        </header>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-6 xl:gap-8">
          <ModeButton
            href="/games/coastle"
            label="Coastle"
            gradient={gradient}
            stats={standardStats}
            dailyDone={dailyCoastleDone}
            icon={<IconCoastle />}
            showStats={showStats}
          />

          <div className="flex flex-col h-full relative">
            <ModeButton
              href="/games/connections"
              label="Connections"
              gradient={gradient}
              stats={connectionsStats}
              dailyDone={connectionsDailyDone}
              icon={<IconConnections />}
              showStats={showStats}
            />

            {isAdminMode && (
              <div className="sm:absolute sm:-bottom-14 left-0 right-0 flex justify-center gap-2 pb-2 sm:pb-0">
                <Link
                  href="/ConnectionsData"
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-700 hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  ⚙️ Manage
                </Link>
                <Link
                  href="/games/connections/practice"
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-700 hover:text-violet-400 transition-all shadow-sm cursor-pointer"
                >
                  🎮 Practice
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-col h-full relative">
            <ModeButton
              href="/games/zoomle"
              label="Zoomle"
              gradient={gradient}
              stats={zoomleStats}
              dailyDone={zoomleDailyDone}
              icon={<IconZoomle />}
              showStats={showStats}
            />
            {isAdminMode && (
              <div className="sm:absolute sm:-bottom-14 left-0 right-0 flex justify-center pb-2 sm:pb-0">
                <Link href="/games/zoomle/config"
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-700 hover:text-white transition-all shadow-sm cursor-pointer">
                  ⚙️ Config
                </Link>
              </div>
            )}
          </div>

          <ModeButton
            href="/games/rankle"
            label="Rankle"
            gradient={gradient}
            stats={rankleStats}
            dailyDone={rankleDailyDone}
            icon={<IconRankle />}
            showStats={showStats}
          />
        </div>
      </div>
    </div>
  );
}