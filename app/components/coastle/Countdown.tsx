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
    <div className="w-full h-[42px] sm:h-[46px] flex items-center justify-center gap-2 bg-slate-100 dark:bg-neutral-800 rounded-2xl text-slate-500 dark:text-slate-400 font-bold text-sm sm:text-base animate-reveal shadow-inner border border-slate-200 dark:border-neutral-700">
      <ClockIcon className="w-5 h-5" />
      <span>Next Coastle: {timeLeft}</span>
    </div>
  );
}