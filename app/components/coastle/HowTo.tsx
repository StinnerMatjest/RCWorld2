"use client";

import { BookOpenIcon } from "./Icons";

export function HowTo() {
  return (
    <div className="w-full max-w-xl animate-reveal">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-neutral-800 text-center">
        <div className="inline-block p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
          <BookOpenIcon className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black mb-6 dark:text-white">
          Instructions
        </h2>

        <ul className="space-y-6 text-slate-600 dark:text-slate-300 text-left">
          <li className="flex gap-4">
            <div className="text-3xl bg-slate-50 dark:bg-neutral-800 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
              🎢
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                Guess the Coaster
              </p>
              <p className="text-sm">
                Search and guess any roller coaster from the parkrating database.
                Play daily or endless mode.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <div className="text-3xl bg-emerald-50 dark:bg-emerald-900/20 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
              🟩
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                Perfect Match
              </p>
              <p className="text-sm">
                Green indicates the attribute matches the secret coaster exactly.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <div className="text-3xl bg-amber-50 dark:bg-amber-900/20 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
              🟨
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                Close
              </p>
              <p className="text-sm">
                Yellow means your guess is close, the attribute is similar, but not an
                exact match.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <div className="text-3xl bg-red-50 dark:bg-red-900/20 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
              🟥
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                Incorrect
              </p>
              <p className="text-sm">Red indicates the attribute does not match.</p>
            </div>
          </li>

          <li className="flex gap-4">
            <div className="text-3xl bg-slate-50 dark:bg-neutral-800 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
              ⬇️
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                Higher or Lower
              </p>
              <p className="text-sm">
                Arrows will tell you if the answer is higher or lower than your guess.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}