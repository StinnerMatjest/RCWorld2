"use client";

import { ShareIcon } from "./Icons";
import { GameStats } from "@/app/types";

interface LeaderboardProps {
  stats: GameStats;
  gameState: "playing" | "won" | "lost";
  onShare: () => void;
}

export function Leaderboard({ stats, gameState, onShare }: LeaderboardProps) {
  return (
    <div className="w-full max-w-xl animate-reveal">
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

        {/* Always show Share button here if a game was recently finished */}
        {gameState !== 'playing' && (
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-neutral-800">
            <button
              onClick={onShare}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center cursor-pointer gap-2 transition shadow-lg shadow-emerald-500/30 transform hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <ShareIcon className="w-6 h-6" />
              Share Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}