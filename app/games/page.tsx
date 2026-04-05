"use client";

import Link from "next/link";
import Image from "next/image";
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

function ModeIcon({
  lightSrc,
  darkSrc,
  className,
}: {
  lightSrc?: string;
  darkSrc: string;
  className: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {lightSrc ? (
        <>
          <Image
            src={lightSrc}
            alt=""
            fill
            priority
            className="object-contain dark:hidden"
          />
          <Image
            src={darkSrc}
            alt=""
            fill
            priority
            className="object-contain hidden dark:block"
          />
        </>
      ) : (
        <Image src={darkSrc} alt="" fill priority className="object-contain" />
      )}
    </div>
  );
}

function StatsRow({
  stats,
  dailyDone,
}: {
  stats: GameStats | null;
  dailyDone: boolean | null;
}) {
  const played = stats?.played ?? null;
  const winPct =
    stats && stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : null;
  const streak = stats?.currentStreak ?? null;

  const items = [
    { label: "Streak", value: streak },
    { label: "Played", value: played },
    { label: "Win %", value: winPct },
  ];

  const dailyText =
    dailyDone === null ? "Daily available" : dailyDone ? "Daily done ✅" : "Daily available";

  return (
    <div className="mt-3 w-full flex flex-col items-center">
      <div className="w-full flex items-center justify-center gap-6 sm:gap-8">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-none">
              {it.value === null ? "—" : it.value}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">
              {it.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400">
        {dailyText}
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
  iconDarkSrc,
  iconLightSrc,
}: {
  href: string;
  label: string;
  gradient: string;
  stats: GameStats | null;
  dailyDone: boolean | null;
  iconDarkSrc: string;
  iconLightSrc?: string;
}) {
  return (
    <Link href={href} aria-label={label} className="group w-full min-w-0 cursor-pointer focus:outline-none">
      {/* Desktop */}
      <div className="hidden sm:flex flex-col items-center justify-center py-10">
        <div
          className={`
            flex flex-col items-center
            transition-transform duration-200
            group-hover:scale-[1.055]
            group-active:scale-[0.99]
            origin-center
          `}
        >
          <ModeIcon lightSrc={iconLightSrc} darkSrc={iconDarkSrc} className="w-28 h-28 md:w-32 md:h-32" />

          <div className="mt-4 flex flex-col items-center">
            <div
              className={`
                text-5xl md:text-6xl
                font-black tracking-tighter
                bg-clip-text text-transparent
                bg-gradient-to-r ${gradient}
                drop-shadow-sm italic
                leading-none
                pr-2
                whitespace-nowrap
              `}
            >
              {label}
            </div>

            <div className="mt-3 w-full">
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

          <StatsRow stats={stats} dailyDone={dailyDone} />
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden py-4">
        <div
          className={`
            grid grid-cols-[104px_1fr] items-center gap-4
            transition-transform duration-200
            group-hover:scale-[1.03]
            group-active:scale-[0.99]
            origin-center
          `}
        >
          <div className="flex items-center justify-center">
            <ModeIcon lightSrc={iconLightSrc} darkSrc={iconDarkSrc} className="w-24 h-24" />
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`
                text-4xl
                font-black tracking-tighter
                bg-clip-text text-transparent
                bg-gradient-to-r ${gradient}
                drop-shadow-sm italic
                leading-none
                pr-2
                whitespace-nowrap
              `}
            >
              {label}
            </div>

            <div className="mt-2 w-full">
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

            <StatsRow stats={stats} dailyDone={dailyDone} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function GamesLauncherPage() {
  const { isAdminMode } = useAdminMode();
  const [standardStats, setStandardStats] = useState<GameStats | null>(null);
  const [insiderStats, setInsiderStats] = useState<GameStats | null>(null);
  const [connectionsStats, setConnectionsStats] = useState<GameStats | null>(null);
  const [standardDailyDone, setStandardDailyDone] = useState<boolean | null>(null);
  const [insiderDailyDone, setInsiderDailyDone] = useState<boolean | null>(null);
  const [connectionsDailyDone, setConnectionsDailyDone] = useState<boolean | null>(null);

  useEffect(() => {
    setStandardStats(
      safeParseStats(localStorage.getItem("coastle-standard-stats")) ??
      safeParseStats(localStorage.getItem("coastle-stats"))
    );

    setInsiderStats(
      safeParseStats(localStorage.getItem("coastle-insider-stats")) ??
      safeParseStats(localStorage.getItem("coastle-stats"))
    );
    setConnectionsStats(safeParseStats(localStorage.getItem("connections-stats")));

    const today = getTodayString();

    const stdDaily = safeParseDaily(localStorage.getItem("coastle-standard-daily-state"));
    const insDaily =
      safeParseDaily(localStorage.getItem("coastle-insider-daily-state")) ??
      safeParseDaily(localStorage.getItem("coastle-daily-state"));

    const connectionsDaily = safeParseConnectionsState(
      localStorage.getItem(`connections-${today}`)
    );

    setStandardDailyDone(
      stdDaily ? stdDaily.date === today && stdDaily.status !== "playing" : false
    );

    setInsiderDailyDone(
      insDaily ? insDaily.date === today && insDaily.status !== "playing" : false
    );

    setConnectionsDailyDone(
      connectionsDaily
        ? (connectionsDaily.solved?.length ?? 0) >= 4 || (connectionsDaily.mistakes ?? 0) >= 4
        : false
    );
  }, []);

  const gradient = useMemo(() => "from-blue-600 via-indigo-600 to-fuchsia-600", []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 px-4 py-6 sm:py-10 flex items-start justify-center">
      <div className="w-full max-w-7xl">
        <header className="text-center mt-2 md:mt-0 mb-8 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6">
            Games
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-bold uppercase tracking-widest">
            Choose a game below.
          </p>

          <div className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium max-w-3xl mx-auto space-y-1">
            <span className="block">
              <span className="font-bold text-slate-800 dark:text-slate-100">Standard</span> = Focus on general coaster knowledge.
            </span>
            <span className="block">
              <span className="font-bold text-slate-800 dark:text-slate-100">Insider</span> = Focus on  insider knowledge and ratings.
            </span>
            <span className="block">
              <span className="font-bold text-slate-800 dark:text-slate-100">Connections</span> = Group four coasters by 4 categories.
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          <ModeButton
            href="/games/coastle/standard"
            label="Standard"
            gradient={gradient}
            stats={standardStats}
            dailyDone={standardDailyDone}
            iconLightSrc="/logos/favicon.svg"
            iconDarkSrc="/logos/faviconload.svg"
          />

          <ModeButton
            href="/games/coastle/insider"
            label="Insider"
            gradient={gradient}
            stats={insiderStats}
            dailyDone={insiderDailyDone}
            iconDarkSrc="/logos/faviconbw.svg"
          />

          <div className="flex flex-col h-full relative">
            <ModeButton
              href="/games/connections"
              label="Connections"
              gradient={gradient}
              stats={connectionsStats}
              dailyDone={connectionsDailyDone}
              iconLightSrc="/logos/favicon.svg"
              iconDarkSrc="/logos/faviconbw.svg"
            />

            {/* Categories Button */}
            {isAdminMode && (
              <div className="absolute -bottom-8 left-0 right-0 flex justify-center">
                <Link
                  href="/ConnectionsData"
                  className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-sm cursor-pointer"
                >
                  ⚙️ Manage Categories
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}