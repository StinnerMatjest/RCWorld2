"use client";

import { useState, useEffect } from "react";
import { ClockIcon } from "./Icons";

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculate = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();

      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      return `${h}h ${m}m ${s}s`;
    };

    setTimeLeft(calculate());
    const interval = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="
        w-full h-[40px]
        flex items-center justify-center gap-2
        rounded-2xl border shadow-sm
        bg-gradient-to-r from-blue-50 via-indigo-50 to-fuchsia-50
        border-slate-200
        text-slate-700
        dark:from-slate-800 dark:via-slate-800 dark:to-slate-700
        dark:border-slate-600
        dark:text-slate-200
      "
    >
      <ClockIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-300" />
      <span className="text-xs sm:text-sm font-bold tracking-wide">
        New Daily Game in{" "}
        <span className="text-indigo-600 dark:text-indigo-300">
          {timeLeft}
        </span>
      </span>
    </div>
  );
}