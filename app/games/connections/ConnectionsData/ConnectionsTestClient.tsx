"use client";

import { useEffect, useMemo, useState } from "react";
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
  type GeneratedBoard,
} from "@/app/components/connections/generator";

type TaggedBoard = GeneratedBoard & {
  isAdmin: boolean;
  isStandard: boolean;
};

function DifficultyDot({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    yellow: "bg-amber-400",
    green:  "bg-emerald-500",
    blue:   "bg-sky-500",
    purple: "bg-violet-600",
  };
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${colors[difficulty] ?? "bg-slate-400"}`}
      title={difficulty}
    />
  );
}

function BoardDots({ groups }: { groups: CandidateGroup[] }) {
  const difficulties = groups.map((g) => g.difficulty);
  const counts = difficulties.reduce((acc, d) => { acc[d] = (acc[d] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const hasDuplicate = Object.values(counts).some((c) => c > 1);
  return (
    <span className="flex items-center gap-1">
      {difficulties.map((d, i) => <DifficultyDot key={i} difficulty={d} />)}
      {hasDuplicate && (
        <span className="ml-1 text-[10px] font-black text-amber-500 uppercase tracking-wider">dup</span>
      )}
    </span>
  );
}

function getTodaySeed() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function boardKey(groups: CandidateGroup[]) {
  return groups
    .map((group) =>
      group.coasters
        .map((coaster) => coaster.id)
        .sort((a, b) => a - b)
        .join("-")
    )
    .sort()
    .join("||");
}

export default function ConnectionsTestPage() {
  const { isAdminMode } = useAdminMode();
  const [allCoasters, setAllCoasters] = useState<ConnectionsCoaster[]>([]);
  const [disabledOverrides, setDisabledOverrides] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [adminPuzzleGroups, setAdminPuzzleGroups] = useState<CandidateGroup[]>([]);
  const [standardPuzzleGroups, setStandardPuzzleGroups] = useState<CandidateGroup[]>([]);
  const [generatedBoards, setGeneratedBoards] = useState<TaggedBoard[]>([]);

  useEffect(() => {
    async function run() {
      try {
        const [coasterData, disabledDataRes] = await Promise.all([
          fetchConnectionsData(),
          fetch("/api/connections/categories"),
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
        currentlyEnabled ? [...prev, categoryId] : prev.filter((id) => id !== categoryId)
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

  const visibleUsableCategories = useMemo(
    () => getUsableCategories(allCoasters, disabledSet, isAdminMode),
    [allCoasters, disabledSet, isAdminMode]
  );

  const adminUsableCategories = useMemo(
    () => getUsableCategories(allCoasters, disabledSet, true),
    [allCoasters, disabledSet]
  );

  const actuallyEnabledCount = useMemo(
    () => allCategories.filter((cat) => !disabledSet.has(cat.id)).length,
    [allCategories, disabledSet]
  );

  const actuallyDisabledCount = allCategories.length - actuallyEnabledCount;

  const seed = getTodaySeed();

  const candidateGroups = useMemo(
    () => buildCandidateGroups(visibleUsableCategories, seed),
    [visibleUsableCategories, seed]
  );

  useEffect(() => {
    if (allCoasters.length === 0) return;

    setIsGenerating(true);

    const timer = setTimeout(() => {
      const result = buildDailyPuzzleGroups(adminUsableCategories, seed);

      setAdminPuzzleGroups(result.best);
      setStandardPuzzleGroups(result.bestStandard);

      const adminSelectedKey = boardKey(result.best);
      const standardSelectedKey = boardKey(result.bestStandard);

      const mergedBoards: TaggedBoard[] = result.boards.map((board) => {
        const key = boardKey(board.groups);
        return {
          ...board,
          isAdmin: key === adminSelectedKey,
          isStandard: key === standardSelectedKey,
        };
      });

      setGeneratedBoards(mergedBoards);
      setIsGenerating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [allCoasters.length, adminUsableCategories, seed]);

  const categoriesByKind = allCategories.reduce((acc, cat) => {
    if (!acc[cat.kind]) acc[cat.kind] = [];
    acc[cat.kind].push(cat);
    return acc;
  }, {} as Record<string, CategoryDefinition[]>);

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
          <p className="mb-2">Seed: {seed}</p>
          <p className="mb-2">Loaded {allCoasters.length} coasters</p>
          <p className="mb-2">Not ridden: {notRidden.length}</p>
          <p className="mb-2">All categories: {allCategories.length}</p>
          <p className="mb-2">Visible usable categories: {visibleUsableCategories.length}</p>
          <p className="mb-2">Admin usable categories: {adminUsableCategories.length}</p>
          <p className="mb-2 text-green-600 dark:text-green-400 font-bold">
            Enabled categories: {actuallyEnabledCount}
          </p>
          <p className="mb-2 text-red-600 dark:text-red-400 font-bold">
            Disabled categories: {actuallyDisabledCount}
          </p>
          <p className="mb-2">Visible candidate groups: {candidateGroups.length}</p>

          <p className="mb-6">
            Generated boards:{" "}
            {isGenerating ? (
              <span className="animate-pulse text-amber-500 font-bold">Calculating...</span>
            ) : (
              "Done"
            )}
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10">
            <div>
              <h2 className="text-lg font-bold mb-3">Selected board (admin)</h2>

              <div className="space-y-4">
                {isGenerating ? (
                  <div className="p-5 border-2 border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center">
                    <span className="animate-pulse font-bold tracking-wider uppercase text-sm">
                      Calculating admin board...
                    </span>
                  </div>
                ) : adminPuzzleGroups.length === 0 ? (
                  <div className="p-5 border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
                    <p className="font-bold">Admin generation failed</p>
                  </div>
                ) : (
                  adminPuzzleGroups.map((group, index) => (
                    <div
                      key={`${group.categoryId}-${index}-admin`}
                      className="border border-slate-300 dark:border-slate-700 p-3 rounded"
                    >
                      <p className="font-bold">{group.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                        <DifficultyDot difficulty={group.difficulty} />
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
            </div>

            <div>
              <h2 className="text-lg font-bold mb-3">Selected board (standard)</h2>

              <div className="space-y-4">
                {isGenerating ? (
                  <div className="p-5 border-2 border-dashed border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center">
                    <span className="animate-pulse font-bold tracking-wider uppercase text-sm">
                      Calculating standard board...
                    </span>
                  </div>
                ) : standardPuzzleGroups.length === 0 ? (
                  <div className="p-5 border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
                    <p className="font-bold">Standard generation failed</p>
                  </div>
                ) : (
                  standardPuzzleGroups.map((group, index) => (
                    <div
                      key={`${group.categoryId}-${index}-standard`}
                      className="border border-slate-300 dark:border-slate-700 p-3 rounded"
                    >
                      <p className="font-bold">{group.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                        <DifficultyDot difficulty={group.difficulty} />
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
            </div>
          </div>

          {generatedBoards.length > 0 && (
            <>
              <div className="flex justify-between items-end mt-10 mb-3">
                <h2 className="text-lg font-bold">Generated boards</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Higher score = better board
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-10">
                {generatedBoards.map((board, i) => (
                  <details
                    key={`${board.seed}-${i}`}
                    className={`group rounded-lg border overflow-hidden ${
                      board.isAdmin || board.isStandard
                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold">#{i + 1}</span>

                        <span className="text-sm font-semibold">
                          Score: {board.score}
                        </span>

                        <BoardDots groups={board.groups} />

                            {/* Blue = valid standard board */}
                            {board.isStandardValid && (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-sky-500"
                                title="Valid standard board"
                              />
                            )}
                        {board.isAdmin && (
                          <span className="text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded bg-violet-600 text-white">
                            Admin
                          </span>
                        )}

                        {board.isStandard && (
                          <span className="text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded bg-sky-600 text-white">
                            Standard
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {board.seed}
                        </span>
                        <span className="transition-transform duration-200 group-open:rotate-180">
                          ▼
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {board.groups.map((group, idx) => (
                        <div
                          key={`${group.categoryId}-${idx}-${board.seed}`}
                          className="border border-slate-200 dark:border-slate-700 p-3 rounded"
                        >
                          <p className="font-bold">{group.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                            <DifficultyDot difficulty={group.difficulty} />
                            {group.difficulty} • {group.kind}
                          </p>
                          <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                            {group.coasters.map((c) => (
                              <li key={c.id}>{c.name}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-between items-end mt-10 mb-3">
            <h2 className="text-lg font-bold">All categories (debug)</h2>

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

                      let containerClass =
                        "bg-red-100 border-red-300 text-slate-900 dark:bg-red-950/30 dark:border-red-900 dark:text-white";
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

                          <button
                            onClick={() => handleToggleCategory(cat.id, isActuallyEnabled)}
                            className={`shrink-0 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                              isActuallyEnabled
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-sm"
                                : "bg-green-500 hover:bg-green-600 text-white shadow-sm"
                            }`}
                          >
                            {isActuallyEnabled ? "Disable" : "Enable"}
                          </button>
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