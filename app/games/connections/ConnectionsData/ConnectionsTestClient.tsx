"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import {
  fetchConnectionsData,
  getNotRiddenCoasters,
  type ConnectionsCoaster,
} from "@/app/components/connections/utils";
import {
  getAllCategories,
  getUsableCategories,
  type CategoryDefinition,
} from "@/app/components/connections/categories";
import {
  buildCandidateGroups,
  buildDailyPuzzleGroups,
  type CandidateGroup,
} from "@/app/components/connections/generator";

export default function ConnectionsTestPage() {
  const { isAdminMode } = useAdminMode();
  const [allCoasters, setAllCoasters] = useState<ConnectionsCoaster[]>([]);
  const [disabledOverrides, setDisabledOverrides] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dailyPuzzleGroups, setDailyPuzzleGroups] = useState<CandidateGroup[]>([]);

  useEffect(() => {
    async function run() {
      try {
        const [coasterData, disabledDataRes] = await Promise.all([
          fetchConnectionsData(),
          fetch("/api/connections/categories")
        ]);

        setAllCoasters(coasterData);

        if (disabledDataRes.ok) {
          const disabledData = await disabledDataRes.json();
          setDisabledOverrides(disabledData.disabledCategories || []);
        }

      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    run();
  }, []);

  const handleToggleCategory = async (categoryId: string, currentlyEnabled: boolean) => {
    try {
      setDisabledOverrides((prev) =>
        currentlyEnabled ? [...prev, categoryId] : prev.filter(id => id !== categoryId)
      );
      await fetch("/api/connections/categories", {
        method: currentlyEnabled ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });

    } catch (err) {
      console.error("Failed to toggle category", err);
    }
  };

  const handleEnableAll = async () => {
    if (!confirm("Are you sure you want to enable ALL categories?")) return;

    const toEnable = [...disabledOverrides];
    if (toEnable.length === 0) return;

    setDisabledOverrides([]);

    try {
      await fetch("/api/connections/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: toEnable }),
      });
    } catch (err) {
      console.error("Failed to bulk enable categories", err);
    }
  };

  const handleDisableAll = async () => {
    if (!confirm("Are you sure you want to disable ALL categories?")) return;

    const toDisable = allCategories
      .filter((cat) => !disabledOverrides.includes(cat.id))
      .map((cat) => cat.id);

    if (toDisable.length === 0) return;

    setDisabledOverrides((prev) => [...prev, ...toDisable]);

    try {
      await fetch("/api/connections/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: toDisable }),
      });
    } catch (err) {
      console.error("Failed to bulk disable categories", err);
    }
  };

  const notRidden = useMemo(() => getNotRiddenCoasters(allCoasters), [allCoasters]);

  const allCategories = useMemo(() => getAllCategories(allCoasters), [allCoasters]);

  const disabledSet = useMemo(() => new Set(disabledOverrides), [disabledOverrides]);

  const usableCategories = useMemo(() =>
    getUsableCategories(allCoasters, disabledSet, isAdminMode),
    [allCoasters, disabledSet, isAdminMode]
  );

  const actuallyEnabledCount = useMemo(() =>
    allCategories.filter((cat) => !disabledSet.has(cat.id)).length,
    [allCategories, disabledSet]
  );

  const actuallyDisabledCount = allCategories.length - actuallyEnabledCount;

  const seed = "2026-04-04";

  const candidateGroups = useMemo(() =>
    buildCandidateGroups(usableCategories, seed),
    [usableCategories]
  );

  useEffect(() => {
    if (allCoasters.length === 0) return;

    setIsGenerating(true);

    const timer = setTimeout(() => {
      const groups = buildDailyPuzzleGroups(usableCategories, seed);
      setDailyPuzzleGroups(groups);
      setIsGenerating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [usableCategories]);

  const categoriesByKind = allCategories.reduce((acc, cat) => {
    if (!acc[cat.kind]) acc[cat.kind] = [];
    acc[cat.kind].push(cat);
    return acc;
  }, {} as Record<string, CategoryDefinition[]>);

  // Sort the category groups alphabetically
  const sortedKinds = Object.keys(categoriesByKind).sort();

    if (isLoading) {
    return (
      <LoadingSpinner
        messages={["Fetching categories from the database...", "Aligning the coaster tracks..."]}
        className="min-h-[50vh] pt-0 justify-center bg-transparent dark:bg-transparent"
      />
    );
  }

  return (
    <div className="p-10 text-slate-900 dark:text-white">
      <h1 className="text-xl font-bold mb-4">Connections Test</h1>

      {error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <>
          <p className="mb-2">Loaded {allCoasters.length} coasters</p>
          <p className="mb-2">Not ridden: {notRidden.length}</p>
          <p className="mb-2">All categories: {allCategories.length}</p>
          <p className="mb-2">Usable categories: {usableCategories.length}</p>
          <p className="mb-2 text-green-600 dark:text-green-400 font-bold">Enabled categories: {actuallyEnabledCount}</p>
          <p className="mb-2 text-red-600 dark:text-red-400 font-bold">Disabled categories: {actuallyDisabledCount}</p>
          <p className="mb-2">Candidate groups: {candidateGroups.length}</p>
          <p className="mb-6">Daily puzzle groups: {isGenerating ? <span className="animate-pulse text-amber-500 font-bold">Calculating...</span> : dailyPuzzleGroups.length}</p>

          <h2 className="text-lg font-bold mb-3">Daily puzzle groups</h2>

          <div className="space-y-4">
            {isGenerating ? (
              <div className="p-5 border-2 border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center">
                <span className="animate-pulse font-bold tracking-wider uppercase text-sm">
                  Calculating daily puzzle...
                </span>
              </div>
            ) : dailyPuzzleGroups.length === 0 ? (
              <div className="p-5 border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
                <p className="font-bold">Generation Failed</p>
                <p className="text-sm opacity-80 mt-1">
                  Could not find a valid 4-group puzzle without overlapping coasters. Try enabling more categories.
                </p>
              </div>
            ) : (
              dailyPuzzleGroups.map((group, index) => (
                <div
                  key={`${group.categoryId}-${index}`}
                  className="border border-slate-300 dark:border-slate-700 p-3 rounded"
                >
                  <p className="font-bold">{group.label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {group.difficulty} • {group.kind}
                  </p>
                  <ul className="list-disc pl-6 text-slate-700 dark:text-slate-300">
                    {group.coasters.map((coaster) => (
                      <li key={coaster.id}>{coaster.name}</li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between items-end mt-10 mb-3">
            <h2 className="text-lg font-bold">All categories (debug)</h2>

            {isAdminMode && (
              <div className="flex gap-2">
                <button
                  onClick={handleEnableAll}
                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Enable All
                </button>
                <button
                  onClick={handleDisableAll}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Disable All
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 text-sm mt-6">
            {sortedKinds.map((kind) => {
              const cats = categoriesByKind[kind];
              const displayKind = kind.replace("_", " ");

              return (
                <details
                  key={kind}
                  className="group border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden"
                >
                  <summary className="cursor-pointer bg-slate-100 dark:bg-slate-800 p-4 font-bold uppercase tracking-wider text-sm flex justify-between items-center select-none hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <span>{displayKind} ({cats.length})</span>
                    <span className="transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </summary>

                  <div className="p-3 space-y-2 bg-white dark:bg-slate-900">
                    {cats.map((cat) => {
                      const matches = cat.filter(allCoasters);
                      const isActuallyEnabled = !disabledOverrides.includes(cat.id);
                      const isViable = matches.length >= 4;

                      // TRICOLOR LOGIC
                      let containerClass = "bg-red-100 border-red-300 text-slate-900 dark:bg-red-950/30 dark:border-red-900 dark:text-white";
                      if (isActuallyEnabled) {
                        containerClass = isViable
                          ? "bg-green-100 border-green-300 text-slate-900 dark:bg-green-950/30 dark:border-green-900 dark:text-white"
                          : "bg-amber-100 border-amber-300 text-slate-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-white";
                      }

                      return (
                        <div
                          key={cat.id}
                          className={`p-3 rounded border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${containerClass}`}
                        >
                          <div className="w-full">
                            <div className="font-bold flex items-center gap-2">
                              <span>{cat.label} ({matches.length})</span>

                              {cat.adminOnly && (
                                <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shadow-sm">
                                  Admin Only
                                </span>
                              )}
                            </div>

                            <div className="text-xs opacity-70 mt-1 flex gap-1.5 items-center">
                              <span>{cat.difficulty}</span>
                              <span>•</span>
                              <span className="font-bold uppercase tracking-wider">
                                {!isActuallyEnabled
                                  ? "Disabled"
                                  : isViable
                                    ? "Active"
                                    : "Active (Unviable < 4)"}
                              </span>
                            </div>

                            {matches.length > 0 && (
                              <div className="text-xs mt-2 opacity-80">
                                Example:{" "}
                                {matches
                                  .slice(0, 4)
                                  .map((c) => c.name)
                                  .join(", ")}
                                {matches.length > 4 && "..."}
                              </div>
                            )}
                          </div>

                          {isAdminMode && (
                            <button
                              onClick={() => handleToggleCategory(cat.id, isActuallyEnabled)}
                              className={`shrink-0 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${isActuallyEnabled
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-sm"
                                : "bg-green-500 hover:bg-green-600 text-white shadow-sm"
                                }`}
                            >
                              {isActuallyEnabled ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}