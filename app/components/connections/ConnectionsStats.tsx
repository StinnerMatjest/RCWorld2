"use client";

import { ShareIcon } from "@/app/components/coastle/Icons";
import { ConnectionsStats } from "@/app/components/connections/types";

interface Props {
  stats: ConnectionsStats;
  gameState: "playing" | "won" | "lost";
  onShare: () => void;
}

export function ConnectionsStatsView({ stats, gameState, onShare }: Props) {
  const winPct =
    stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const items = [
    { label: "Played", value: stats.played },
    { label: "Win %", value: winPct },
    { label: "Streak", value: stats.currentStreak },
    { label: "Max", value: stats.maxStreak },
  ];

  return (
    <div className="w-full max-w-xl animate-reveal">
      <div className="rounded-3xl p-[1px] bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 shadow-xl">
        <div className="bg-white dark:bg-slate-900 rounded-[calc(1.5rem-1px)] p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-slate-900 shadow-lg mb-4">
            <span className="text-3xl">🏆</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 mb-8">
            Your Connections Stats
          </h2>

          <div className="grid grid-cols-4 gap-4 mb-8">
            {items.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 shadow-sm"
              >
                <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">
                  {s.value}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="text-left rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-800/60 dark:to-slate-800/30 p-5 sm:p-6">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 text-center tracking-widest">
              Guess Distribution
            </h3>

            <div className="space-y-3">
              {stats.guessDistribution.map((count, i) => {
                const max = Math.max(...stats.guessDistribution, 1);
                const width = Math.max(10, (count / max) * 100);
                const label = i < 4 ? `${i + 1}` : "X";

                return (
                  <div key={i} className="flex items-center gap-3 text-sm font-bold">
                    <span className="w-4 text-slate-500 dark:text-slate-400 text-center">
                      {label}
                    </span>
                    <div
                      className={`h-9 flex items-center justify-end px-3 rounded-xl transition-all ${
                        count > 0
                          ? "bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 text-white shadow-md"
                          : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                      style={{ width: `${width}%` }}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {gameState !== "playing" && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onShare}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-white font-bold rounded-2xl flex items-center justify-center cursor-pointer gap-2 transition shadow-lg shadow-emerald-500/30 transform hover:scale-[1.02]"
              >
                <ShareIcon className="w-5 h-5" />
                Share Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}