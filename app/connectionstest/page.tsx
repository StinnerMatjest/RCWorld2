"use client";

import { useEffect, useState } from "react";
import {
  fetchConnectionsData,
  getNotRiddenCoasters,
  type ConnectionsCoaster,
} from "@/app/components/connections/utils";
import {
  getAllCategories,
  getUsableCategories,
} from "@/app/components/connections/categories";
import {
  buildCandidateGroups,
  buildDailyPuzzleGroups,
} from "@/app/components/connections/generator";

export default function ConnectionsTestPage() {
  const [allCoasters, setAllCoasters] = useState<ConnectionsCoaster[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const data = await fetchConnectionsData();
        console.log("Connections data:", data);
        setAllCoasters(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    run();
  }, []);

  const notRidden = getNotRiddenCoasters(allCoasters);
  const allCategories = getAllCategories(allCoasters);
  const usableCategories = getUsableCategories(allCoasters);

  const seed = "2026-04-04";

  const candidateGroups = buildCandidateGroups(usableCategories, seed);
  const dailyPuzzleGroups = buildDailyPuzzleGroups(usableCategories, seed);

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
          <p className="mb-2">Candidate groups: {candidateGroups.length}</p>
          <p className="mb-6">Daily puzzle groups: {dailyPuzzleGroups.length}</p>

          <h2 className="text-lg font-bold mb-3">Daily puzzle groups</h2>

          <div className="space-y-4">
            {dailyPuzzleGroups.map((group) => (
              <div
                key={group.categoryId}
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
            ))}
          </div>

          <h2 className="text-lg font-bold mt-10 mb-3">All categories (debug)</h2>

          <div className="space-y-2 text-sm">
            {allCategories.map((cat) => {
              const matches = cat.filter(allCoasters);

              return (
                <div
                  key={cat.id}
                  className={`p-3 rounded border ${
                    cat.enabled
                      ? "bg-green-100 border-green-300 text-slate-900"
                      : "bg-red-100 border-red-300 text-slate-900"
                  } dark:bg-slate-800 dark:border-slate-700 dark:text-white`}
                >
                  <div className="font-bold">
                    {cat.label} ({matches.length})
                  </div>

                  <div className="text-xs opacity-70 mt-1">
                    {cat.kind} • {cat.difficulty} •{" "}
                    {cat.enabled ? "enabled" : "disabled"}
                  </div>

                  {matches.length >= 4 && (
                    <div className="text-xs mt-2">
                      Example:{" "}
                      {matches
                        .slice(0, 4)
                        .map((c) => c.name)
                        .join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}