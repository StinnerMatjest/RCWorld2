"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { XMarkIcon, ShareIcon } from "./Icons";
import { CoastleCoaster } from "@/app/types";

interface ResultModalProps {
  isOpen: boolean;
  gameState: "won" | "lost" | "playing";
  answer: CoastleCoaster | null;
  gameMode: "daily" | "endless";
  guessesCount: number;
  maxGuesses: number;
  currentStreak?: number;
  onClose: () => void;
  onShare: () => void;
  onReset: () => void;
}

function formatRating(val: unknown): string {
  if (val === null || val === undefined) return "—";
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function ConfettiBurst({ enabled }: { enabled: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        key: i,
        left: Math.round(Math.random() * 100),
        delay: Math.random() * 0.12,
        duration: 0.75 + Math.random() * 0.4,
        rotate: Math.round(Math.random() * 360),
        drift: (Math.random() * 2 - 1) * 55,
      })),
    []
  );

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.key}
          className="absolute top-0 h-2 w-1.5 rounded-sm opacity-0"
          style={{
            left: `${p.left}%`,
            animation: `confettiFall ${p.duration}s ease-out ${p.delay}s 1 forwards`,
            background:
              p.key % 3 === 0
                ? "linear-gradient(180deg, #60a5fa, #a78bfa)"
                : p.key % 3 === 1
                ? "linear-gradient(180deg, #34d399, #fbbf24)"
                : "linear-gradient(180deg, #fb7185, #f97316)",
            ["--rot" as any]: `${p.rotate}deg`,
            ["--drift" as any]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function ResultModal({
  isOpen,
  gameState,
  answer,
  gameMode,
  guessesCount,
  maxGuesses,
  currentStreak,
  onClose,
  onShare,
  onReset,
}: ResultModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const isWon = gameState === "won";
  const isLost = gameState === "lost";
  const answerId = answer?.id ?? null;

  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // Old gallery contract: needs parkId
  useEffect(() => {
    if (!isOpen || !answerId || !answer?.name) return;

    const name: string = answer.name;
    let cancelled = false;

    async function run() {
      try {
        setHeaderImage(null);
        setImageLoaded(false);

        const coasterRes = await fetch(`/api/coasters/${answerId}`, { cache: "no-store" });
        if (!coasterRes.ok) return;

        const coasterData = await coasterRes.json();
        const parkId = coasterData?.coaster?.parkId;
        if (!parkId) return;

        const galleryUrl = `/api/coasters/${answerId}/gallery?name=${encodeURIComponent(
          name
        )}&parkId=${encodeURIComponent(String(parkId))}`;

        const galleryRes = await fetch(galleryUrl, { cache: "no-store" });
        if (!galleryRes.ok) return;

        const galleryData = await galleryRes.json();
        const img = (galleryData?.headerImage ?? null) as string | null;

        if (!cancelled) setHeaderImage(img);
      } catch {
        // silent fail
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, answerId, answer?.name]);

  if (!isOpen) return null;

  const coasterName = answer?.name ?? "—";
  const park = answer?.park ?? "—";
  const manufacturer = (answer as any)?.manufacturer ?? "—";
  const year = (answer as any)?.year ?? "—";
  const rideCount = (answer as any)?.rideCount ?? "—";
  const rating = formatRating((answer as any)?.rating);

  const title = isWon ? "NAILED IT!" : "TRACK INCOMPLETE";
  const subtitle = isWon
    ? `Solved ${guessesCount}/${maxGuesses}`
    : `Used ${guessesCount}/${maxGuesses}`;

  const nameGradient = "bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600";

  const primaryBtn =
    "bg-slate-900 text-white hover:opacity-90 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white";
  const secondaryBtn =
    "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @keyframes confettiFall {
          0% { transform: translate3d(var(--drift), -10px, 0) rotate(var(--rot)); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate3d(calc(var(--drift) * 0.2), 190px, 0) rotate(calc(var(--rot) + 220deg)); opacity: 0; }
        }

        /* subtle, professional nudge */
        @keyframes arrowNudge {
          0%, 72%, 100% { transform: translateX(0); }
          82% { transform: translateX(4px); }
          92% { transform: translateX(0); }
        }
        .animate-arrowNudge {
          animation: arrowNudge 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-arrowNudge { animation: none !important; }
        }
      `}</style>

      <div
        className={`
          relative w-full max-w-[420px] sm:max-w-md md:max-w-lg
          rounded-3xl p-1 shadow-2xl overflow-hidden
          animate-in zoom-in-95 duration-500
          ${isWon ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 bg-shine" : "bg-slate-700"}
        `}
      >
        <div className="relative bg-white dark:bg-neutral-900 rounded-[22px] p-4 sm:p-6 md:p-8 overflow-hidden">
          <ConfettiBurst enabled={isWon} />

          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white/70 dark:bg-neutral-800/70 transition z-10 cursor-pointer"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="text-center mt-1">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            <div className="mt-1 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">
              {subtitle}
            </div>

            {gameMode === "daily" && typeof currentStreak === "number" && (
              <div className="mt-2 text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                🔥 Streak: {currentStreak}
              </div>
            )}
          </div>

          {/* Banner */}
          {headerImage && (
            <button
              type="button"
              onClick={() => window.open(headerImage, "_blank", "noopener,noreferrer")}
              className="relative w-full h-32 sm:h-52 rounded-2xl overflow-hidden bg-slate-200 dark:bg-neutral-800 shadow-sm cursor-zoom-in mt-4 sm:mt-5 md:mt-6"
              title="Open image"
            >
              <Image
                src={headerImage}
                alt={coasterName}
                fill
                unoptimized
                priority
                className={`object-cover transition-all duration-700 ${
                  imageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
                }`}
                onLoad={() => setImageLoaded(true)}
              />
            </button>
          )}

          {/* Answer */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
              {isLost ? "THE CORRECT ANSWER WAS" : "THE ANSWER WAS"}
            </div>

            <div className={`mt-2 text-3xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text ${nameGradient}`}>
              {coasterName}
            </div>

            <div className="mt-1 text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200">
              {park}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 sm:mt-5 md:mt-6 grid grid-cols-2 gap-2.5 sm:gap-3.5">
            <div className="rounded-2xl bg-slate-100/80 dark:bg-neutral-800/60 p-3.5 sm:p-4">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Rating
              </div>
              <div className="mt-1 text-base sm:text-xl font-black text-slate-900 dark:text-white">{rating}</div>
            </div>

            <div className="rounded-2xl bg-slate-100/80 dark:bg-neutral-800/60 p-3.5 sm:p-4">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Year
              </div>
              <div className="mt-1 text-base sm:text-xl font-black text-slate-900 dark:text-white">{year}</div>
            </div>

            <div className="rounded-2xl bg-slate-100/80 dark:bg-neutral-800/60 p-3.5 sm:p-4">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Manufacturer
              </div>
              <div className="mt-1 text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                {manufacturer}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-100/80 dark:bg-neutral-800/60 p-3.5 sm:p-4">
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Ride Count
              </div>
              <div className="mt-1 text-sm sm:text-lg font-black text-slate-900 dark:text-white">{rideCount}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 sm:mt-5 md:mt-6 flex flex-col gap-2.5 sm:gap-3">
            <div className="flex gap-2.5">
              <button
                onClick={onShare}
                className={`flex-1 py-2 sm:py-3 md:py-3.5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition cursor-pointer ${primaryBtn}`}
              >
                <ShareIcon className="w-5 h-5" />
                Share Result
              </button>

              {answerId && (
                <Link
                  href={`/coasters/${answerId}`}
                  onClick={onClose}
                  className={`shrink-0 w-12 sm:w-14 rounded-2xl grid place-items-center font-black transition cursor-pointer ${secondaryBtn}`}
                  title="Read more about this coaster"
                  aria-label="Open coaster page"
                >
                  {/* better looking chevron + nudge animation */}
                  <svg
                    viewBox="0 0 24 24"
                    className="w-6 h-6 animate-arrowNudge"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              )}
            </div>

            {gameMode === "endless" && (
              <button
                onClick={onReset}
                className="w-full py-2 sm:py-3 md:py-3.5 rounded-2xl font-black text-sm sm:text-base text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 transition cursor-pointer"
              >
                Play Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}