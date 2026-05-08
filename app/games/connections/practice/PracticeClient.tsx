"use client";

import { useEffect, useState } from "react";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { fetchConnectionsData } from "@/app/components/connections/utils";
import { getUsableCategories } from "@/app/components/connections/categories";
import { buildDailyPuzzleGroups } from "@/app/components/connections/generator";
import ConnectionsGame, {
  GROUP_COLOR_CLASS_MAP,
  type Group,
} from "@/app/components/connections/ConnectionsGame";

// ─── Types ────────────────────────────────────────────────────────────────────

type BoardRecord = {
  groups: Group[];
  score: number;
  hasDuplicate: boolean;
  completed: boolean;
  won: boolean;
  mistakes: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────


function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hasDuplicateColors(groups: Group[]) {
  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.difficulty] = (counts[g.difficulty] ?? 0) + 1;
  return Object.values(counts).some((c) => c > 1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PracticeClient() {
  const { isAdminMode } = useAdminMode();
  const [genCount, setGenCount] = useState(0);
  const [boards, setBoards] = useState<BoardRecord[]>([]);
  const [idx,    setIdx]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function generate(count = genCount) {
    setLoading(true);
    setError(null);
    // Each generation uses a date offset so the pool is fully different each time
    const base = new Date();
    base.setDate(base.getDate() + count);
    const seed = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    try {
      const [coasters, disabledRes] = await Promise.all([
        fetchConnectionsData(),
        fetch("/api/connections/categories"),
      ]);
      const { disabledCategories = [] } = await disabledRes.json();
      const usable = getUsableCategories(coasters, new Set(disabledCategories), true);
      const result = buildDailyPuzzleGroups(usable, seed);

      if (!result.boards.length) { setError("No boards generated for this seed."); return; }

      const mapped: BoardRecord[] = result.boards.map((b) => {
        const groups: Group[] = b.groups.map((g) => ({
          id: g.categoryId,
          label: g.label,
          difficulty: g.difficulty,
          color: GROUP_COLOR_CLASS_MAP[g.difficulty],
          coasters: g.coasters.map((c) => c.name),
        }));
        return { groups, score: b.score, hasDuplicate: hasDuplicateColors(groups), completed: false, won: false, mistakes: 0 };
      });

      setBoards((prev) => count === 0 ? mapped : [...prev, ...mapped]);
      if (count === 0) setIdx(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate boards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { generate(0); }, []);

  if (!isAdminMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 text-slate-400">
        Admin mode required.
      </div>
    );
  }

  const board = boards[idx] ?? null;

  return (
    <div>
      {/* Board picker strip */}
      {(boards.length > 0 || loading) && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
          <div className="max-w-3xl mx-auto">
            {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {boards.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg border text-xs font-bold tabular-nums transition cursor-pointer ${
                    !b.completed
                      ? i === idx
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400"
                      : b.won && b.mistakes === 0
                        ? "border-amber-400 bg-amber-400 text-white"
                        : b.won
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-red-500 bg-red-500 text-white"
                  }`}
                >
                  {i + 1}
                </button>

              ))}

              {/* + button appends a fresh batch */}
              <button
                onClick={() => { const next = genCount + 1; setGenCount(next); generate(next); }}
                disabled={loading}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-violet-400 hover:text-violet-500 text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                {loading ? "…" : "+"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The actual game — identical to daily */}
      {board && (
        <ConnectionsGame
          key={idx}
          initialGroups={board.groups}
          onNextBoard={idx < boards.length - 1 ? () => setIdx(idx + 1) : undefined}
          onComplete={(won, mistakes) => setBoards((prev) => prev.map((b, i) => i === idx ? { ...b, completed: true, won, mistakes } : b))}
        />
      )}

      {loading && !boards.length && (
        <div className="min-h-[50vh] flex items-center justify-center text-slate-400 animate-pulse">
          Generating boards...
        </div>
      )}
    </div>
  );
}
