"use client";

import React, { useEffect, useState } from "react";

type Props = {
  messages?: string[];
  className?: string; // optional extra positioning if you need it later
};

const FALLBACKS = [
  "Adjusting the seats on Helix…",
  "Checking the inversions on Helix…",
  "Locking the restraints on F.L.Y…",
  "Measuring the speed of Troy…",
  "Preparing the drop of Kondaa…",
  "Sharing the love of Storm…",
  "Taming the twists of Taron…",
  "Smoothing the airtime on Balder…",
  "Diving deep with Valkyria…",
  "Flying on Zadra",
  "Weaving left and right on Hyperion",
  "Spreading the wings of Fēnix…"
];

const LoadingSpinner: React.FC<Props> = ({ messages, className }) => {
  const list = messages?.length ? messages : FALLBACKS;

  const [msg, setMsg] = useState<string>(""); // empty on server to avoid mismatch

  useEffect(() => {
    // pick once on client
    setMsg(list[Math.floor(Math.random() * list.length)]);
  }, [list]);

  return (
    <div
      className={`flex flex-col items-center justify-start min-h-screen pt-32 bg-gray-100 dark:bg-[#0f172a] ${className ?? ""}`}
    >
      {/* polished bouncing dots */}
      <div className="flex space-x-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full bg-blue-500 dark:bg-blue-400 shadow-lg"
            style={{
              animation: `pulseBounce 0.8s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Loading text (placeholder first to keep hydration stable) */}
      <p
        className="mt-5 text-gray-700 dark:text-gray-300 font-semibold tracking-wide text-lg"
        aria-live="polite"
        suppressHydrationWarning
      >
        {msg || "Loading…"}
      </p>

      <style jsx>{`
        @keyframes pulseBounce {
          0%,
          80%,
          100% {
            transform: scale(1) translateY(0);
            opacity: 0.8;
          }
          40% {
            transform: scale(1.25) translateY(-8px);
            opacity: 1;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.6);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
