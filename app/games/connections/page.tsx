"use client";

import { useEffect, useState } from "react";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import Link from "next/link";
import { fetchConnectionsData } from "@/app/components/connections/utils";
import { getUsableCategories } from "@/app/components/connections/categories";
import { buildDailyPuzzleGroups } from "@/app/components/connections/generator";
import { getTodayString } from "@/app/utils/coastle";
import ConnectionsGame, {
  type Group,
  GROUP_COLOR_CLASS_MAP,
} from "@/app/components/connections/ConnectionsGame";

function getTodaySeed() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getStorageKey() {
  if (process.env.NODE_ENV === "development") return "connections-dev";
  return `connections-${getTodayString()}`;
}

export default function ConnectionsPage() {
  const { isAdminMode } = useAdminMode();
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function loadDailyPuzzle() {
      try {
        const [allCoasters, disabledRes] = await Promise.all([
          fetchConnectionsData(),
          fetch("/api/connections/categories"),
        ]);

        const disabledData = await disabledRes.json();
        const disabledCategories = new Set<string>(disabledData.disabledCategories || []);
        const usableCategories = getUsableCategories(allCoasters, disabledCategories, true);
        const result = buildDailyPuzzleGroups(usableCategories, getTodaySeed());
        const dailyGroups = isAdminMode ? result.best : result.bestStandard;

        if (dailyGroups.length !== 4) {
          setError(usableCategories.length < 4 ? "NOT_ENOUGH_CATEGORIES" : "GENERATION_FAILED");
          return;
        }

        setGroups(dailyGroups.map((group) => ({
          id: group.categoryId,
          label: group.label,
          difficulty: group.difficulty,
          color: GROUP_COLOR_CLASS_MAP[group.difficulty],
          coasters: group.coasters.map((c) => c.name),
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load puzzle");
      } finally {
        setMounted(true);
      }
    }

    loadDailyPuzzle();
  }, [isAdminMode]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || groups.length !== 4) {
    let displayError = error || "Failed to load today's puzzle.";
    if (error === "NOT_ENOUGH_CATEGORIES") {
      displayError = isAdminMode
        ? "Not enough categories. You have fewer than 4 usable categories enabled."
        : "Today's puzzle is currently under maintenance. Please check back shortly!";
    } else if (error === "GENERATION_FAILED") {
      displayError = isAdminMode
        ? "The algorithm couldn't find a valid 4-group puzzle. Please enable more categories."
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

  return <ConnectionsGame initialGroups={groups} persistKey={getStorageKey()} />;
}
