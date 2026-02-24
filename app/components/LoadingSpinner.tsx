"use client";

import React, { useEffect, useState } from "react";

type Props = {
  messages?: string[];
  className?: string;
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
  "Spreading the wings of Fēnix…",
];

const LoadingSpinner: React.FC<Props> = ({ messages, className }) => {
  const list = messages?.length ? messages : FALLBACKS;
const [msg] = useState(() => {
  const chosen = list[Math.floor(Math.random() * list.length)];
  return chosen;
});

  return (
    <div
      className={`flex flex-col items-center justify-start min-h-screen pt-32 bg-gray-100 dark:bg-[#0f172a] ${
        className ?? ""
      }`}
    >
      {/* Bigger favicon-centered loader */}
      <div className="relative w-36 h-36">
        {/* Center favicon (bigger) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/logos/faviconload.svg"
            alt="Loading"
            className="w-20 h-20 drop-shadow-sm"
            draggable={false}
          />
        </div>

        {/* Orbiting balls */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              animation: `orbit 1.4s linear ${i * 0.18}s infinite`,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full shadow-md"
              style={{
                width: "16px",
                height: "16px",
                top: "-8px",
                backgroundColor: "#e9820e",
                animation: `pulseBounce 0.9s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Loading text */}
      <p
        className="mt-7 text-gray-700 dark:text-gray-300 font-semibold tracking-wide text-lg"
        aria-live="polite"
        suppressHydrationWarning
      >
        {msg}
      </p>

      <style jsx>{`
        @keyframes orbit {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulseBounce {
          0%,
          80%,
          100% {
            transform: scale(1) translateY(0);
            opacity: 0.85;
          }
          40% {
            transform: scale(1.25) translateY(-3px);
            opacity: 1;
            box-shadow: 0 6px 18px rgba(233, 130, 14, 0.45);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;