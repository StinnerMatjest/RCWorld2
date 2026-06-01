"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { getParkFlag } from "@/app/utils/design";
import LoadingSpinner from "@/app/components/LoadingSpinner";

// ─── Types ───────────────────────────────────────────────────────────────────

type Coaster = {
  id: number; name: string; park_name: string; park_country: string | null;
  year: number | null; height: number | null; speed: number | null;
  inversions: number | null; length: number | null; drop: number | null;
  gforce: number | null; duration: number | null;
  isbestcoaster: boolean; header_image?: string | null;
};

type PhotoRound = { image: string; focus: string; focal_index: number; answer: Coaster; options: Coaster[] };
type DailyState = { date: string; scores: (number | null)[]; done: boolean };
type RoundResult = {
  image: string; focus: string; focal_index: number;
  answer: Coaster; guessedId: number | null; pts: number | null;
};

const STORAGE_KEY = (date: string) => `zoomle-${date}`;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function buildShareText(date: string, scores: (number|null)[], maxScore: number): string {
  const total = scores.reduce<number>((s, p) => s + (p ?? 0), 0);
  const lines = scores.map((p, i) => {
    const sq = p === null ? "⬛" : p >= 5 ? "🟩" : p >= 4 ? "🟨" : p >= 3 ? "🟧" : "🟥";
    return `${sq} Round ${i + 1}: ${p !== null ? `+${p} pts` : "0 pts"}`;
  });
  return [
    `Daily Zoomle — ${date}`,
    `I scored ${total} out of ${maxScore}`,
    "",
    ...lines,
    "",
    "Play at parkrating.com/games/zoomle",
  ].join("\n");
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REVEAL_DURATION    = 20;
const START_SCALE        = 9;
const OPTION_STAGGER_MS    = 380;
const OPTION_INITIAL_DELAY = 600;  // pause before first option appears
const POST_OPTIONS_PAUSE   = 4500; // study time after all options visible

const POINT_BRACKETS = [
  { threshold: 0.22, points: 5, label: "INCREDIBLE! 🔥" },  // 0-4.4s
  { threshold: 0.45, points: 4, label: "Sharp eye! 👁️"  },  // 4.4-9s
  { threshold: 0.65, points: 3, label: "Nice one! 🎢"   },  // 9-13s
  { threshold: 0.82, points: 2, label: "Getting there!" },  // 13-16.4s
  { threshold: 1.00, points: 1, label: "Close enough!"  },  // 16.4-20s
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isVideo(path: string) { return /\.(mp4|webm|mov)$/i.test(path); }

function pickRandom<T>(arr: T[], n: number): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c.slice(0, n);
}

function getPoints(p: number) { for (const b of POINT_BRACKETS) if (p <= b.threshold) return b.points; return 1; }
function getLabel(p: number)  { for (const b of POINT_BRACKETS) if (p <= b.threshold) return b.label;  return "Close enough!"; }

// ─── Score counter ────────────────────────────────────────────────────────────

function ScoreCounter({ score, maxScore, date, isMobile }: { score: number; maxScore: number; date: string; isMobile: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (score === 0) return;
    const duration = 2000;
    let startTime: number | null = null;
    let rafId: number;
    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      // Square-root easing: counts up quickly then slows to the final number
      setDisplay(Math.round(score * Math.pow(progress, 0.5)));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    const id = setTimeout(() => { rafId = requestAnimationFrame(tick); }, 500);
    return () => { clearTimeout(id); cancelAnimationFrame(rafId); };
  }, [score]);

  const label = score >= maxScore * 0.8 ? "Spotting legend! 🏆"
    : score >= maxScore * 0.5 ? "Sharp eye! 🎢" : "Keep exploring!";

  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
      className="text-center mb-8 flex-shrink-0">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{date}</p>
      <p className={`text-8xl font-black tabular-nums leading-none ${isMobile ? "text-white" : "text-slate-900 dark:text-white"}`}>
        {display}
      </p>
      <p className={`text-lg font-bold mt-1 ${isMobile ? "text-slate-500" : "text-slate-400"}`}>out of {maxScore}</p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        className={`mt-2 text-base font-bold ${isMobile ? "text-slate-300" : "text-slate-600 dark:text-slate-300"}`}>
        {label}
      </motion.p>
    </motion.div>
  );
}

// ─── Flag button ─────────────────────────────────────────────────────────────

function FlagButton({ image, focalIndex, dark }: { image: string; focalIndex: number; dark?: boolean }) {
  const [flagged, setFlagged] = useState(false);
  const [sending, setSending] = useState(false);

  async function flag() {
    if (flagged || sending) return;
    setSending(true);
    await fetch("/api/zoomle/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: image, focal_index: focalIndex }),
    });
    setFlagged(true);
    setSending(false);
  }

  return (
    <button onClick={flag} disabled={flagged || sending}
      title={flagged ? "Flagged — won't appear again" : "Flag this zoom as bad"}
      className={`flex-shrink-0 text-base transition-all cursor-pointer disabled:cursor-default ${
        flagged ? "opacity-100" : dark ? "opacity-40 hover:opacity-80" : "opacity-40 hover:opacity-80"
      }`}>
      {flagged ? "🚩" : "🏳️"}
    </button>
  );
}

// ─── Zoomle ───────────────────────────────────────────────────────────────────

function PhotoGame({ dailyRounds, dailyDate, zoomlePool, poolTotal = 0, poolImages = 0, isMobile = true }: {
  dailyRounds: PhotoRound[];
  dailyDate: string;
  zoomlePool: { image: string; focus: string; coaster_id: number }[];
  poolTotal?: number;
  poolImages?: number;
  isMobile?: boolean;
}) {
  const ROUNDS = dailyRounds.length || 10;
  const [started, setStarted]           = useState(false);
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [rounds, setRounds]             = useState<PhotoRound[]>([]);
  const [round, setRound]               = useState(0);
  const [dailyScores, setDailyScores]   = useState<(number|null)[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [phase, setPhase]               = useState<"intro" | "playing" | "guessed">("intro");
  const [visibleCount, setVisibleCount] = useState(0);
  const [introSecs, setIntroSecs]       = useState<number | null>(null);
  const [gameKey, setGameKey]           = useState(0); // increments each time game truly starts
  const [guessedId, setGuessedId]       = useState<number | null>(null);
  const [score, setScore]               = useState(0);
  const [done, setDone]                 = useState(false);
  const [secsLeft, setSecsLeft]         = useState(REVEAL_DURATION);
  const [ptsAvail, setPtsAvail]         = useState(5);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  // Direct DOM refs for smooth zoom — no React re-renders for the transform
  const imgRef        = useRef<HTMLElement>(null);
  const timerBarRef   = useRef<HTMLDivElement>(null);
  const rafRef        = useRef<number | null>(null);
  const startTimeRef  = useRef<number>(0);
  const progressRef   = useRef<number>(0);
  const introTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  const buildRounds = useCallback(() => {
    // Use pre-built daily rounds from the server
    setRounds(dailyRounds);
    setRound(0); setGuessedId(null); setVisibleCount(0);
    setScore(0); setDone(false); setPointsEarned(null); setPhase("intro");
    setSecsLeft(REVEAL_DURATION); setPtsAvail(5); setDailyScores([]); setRoundResults([]); setIntroSecs(null);
    progressRef.current = 0;
  }, [dailyRounds]);

  useEffect(() => { if (dailyRounds.length > 0) buildRounds(); }, [dailyRounds.length]);

  // Stop any running animation
  const stopReveal = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  // Start RAF-driven zoom + timer (no React re-renders for transform)
  const startReveal = useCallback(() => {
    stopReveal();
    progressRef.current = 0;
    startTimeRef.current = performance.now();

    if (imgRef.current) {
      imgRef.current.style.transform = `scale(${START_SCALE})`;
      imgRef.current.style.transition = "none";
    }
    if (timerBarRef.current) {
      timerBarRef.current.style.width = "100%";
      timerBarRef.current.style.transition = "none";
    }

    const tick = (now: number) => {
      const p = Math.min((now - startTimeRef.current) / 1000 / REVEAL_DURATION, 1);
      progressRef.current = p;

      // Non-linear zoom: stays tight longer, opens faster near the end
      const scale = START_SCALE - (START_SCALE - 1) * Math.pow(p, 1.6);
      if (imgRef.current) imgRef.current.style.transform = `scale(${scale})`;

      // Timer bar — direct DOM
      if (timerBarRef.current) {
        const pct = (1 - p) * 100;
        timerBarRef.current.style.width = `${pct}%`;
        timerBarRef.current.style.backgroundColor =
          pct > 50 ? "#3b82f6" : pct > 25 ? "#f59e0b" : "#ef4444";
      }

      // React state only for the number display (every ~200ms is fine)
      const secs = Math.ceil((1 - p) * REVEAL_DURATION);
      setSecsLeft(secs);
      setPtsAvail(getPoints(p));

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopReveal]);

  // Intro sequence — only fires once game has started (gameKey > 0)
  useEffect(() => {
    if (phase !== "intro" || done || !rounds.length || gameKey === 0) return;
    setVisibleCount(0);
    setIntroSecs(null); // start with "See your options"
    introTimers.current.forEach(clearTimeout);
    introTimers.current = [];
    // Must declare before use
    const totalIntroMs = OPTION_INITIAL_DELAY + 4 * OPTION_STAGGER_MS + POST_OPTIONS_PAUSE;
    // Options reveal
    [0, 1, 2, 3].forEach(i =>
      introTimers.current.push(setTimeout(() => setVisibleCount(i + 1), OPTION_INITIAL_DELAY + i * OPTION_STAGGER_MS))
    );
    // Countdown in last 3s — never overlaps with options appearing
    introTimers.current.push(setTimeout(() => setIntroSecs(3), totalIntroMs - 3100));
    introTimers.current.push(setTimeout(() => setIntroSecs(2), totalIntroMs - 2100));
    introTimers.current.push(setTimeout(() => setIntroSecs(1), totalIntroMs - 1100));
    introTimers.current.push(setTimeout(() => setIntroSecs(0), totalIntroMs - 200));
    introTimers.current.push(setTimeout(() => setPhase("playing"), totalIntroMs));
    return () => introTimers.current.forEach(clearTimeout);
  }, [phase, round, done, rounds.length, gameKey]);

  // Start reveal when playing
  useEffect(() => {
    if (phase !== "playing" || done || !rounds.length) return;
    startReveal();
    return stopReveal;
  }, [phase, round, done, rounds.length, startReveal, stopReveal]);

  // Cleanup on unmount
  useEffect(() => () => stopReveal(), [stopReveal]);

  // Show nav + save to localStorage when game ends
  useEffect(() => {
    if (!done) return;
    showNav();
    if (dailyDate) {
      const state: DailyState = { date: dailyDate, scores: dailyScores, done: true };
      try { localStorage.setItem(STORAGE_KEY(dailyDate), JSON.stringify(state)); } catch {}
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGuess(coasterId: number) {
    if (phase !== "playing" || guessedId !== null) return;
    stopReveal();

    // Snap image to full reveal
    if (imgRef.current) { imgRef.current.style.transition = "transform 0.9s cubic-bezier(0.33,1,0.68,1)"; imgRef.current.style.transform = "scale(1)"; }
    if (timerBarRef.current) { timerBarRef.current.style.width = "0%"; }

    const p = progressRef.current;
    setPhase("guessed"); setGuessedId(coasterId);
    const correct = coasterId === rounds[round].answer.id;
    const pts = correct ? getPoints(p) : 0;
    setPointsEarned(pts);
    if (correct) setScore(s => s + pts);
    const roundPts = correct ? pts : null;
    setDailyScores(prev => [...prev, roundPts]);
    setRoundResults(prev => [...prev, {
      image: rounds[round].image,
      focus: rounds[round].focus,
      focal_index: rounds[round].focal_index,
      answer: rounds[round].answer,
      guessedId: coasterId,
      pts: roundPts,
    }]);

    setTimeout(() => {
      // Fade image out first, then swap round
      if (imgRef.current) {
        imgRef.current.style.transition = "opacity 0.45s ease";
        imgRef.current.style.opacity = "0";
      }
      setTimeout(() => {
        if (round + 1 >= rounds.length) { setDone(true); return; }
        setRound(r => r + 1); setGuessedId(null); setPointsEarned(null); setPhase("intro");
        setSecsLeft(REVEAL_DURATION); setPtsAvail(5); progressRef.current = 0;
      }, 550);
    }, 3200);
  }

  if (zoomlePool.length === 0) return <p className="text-slate-400 text-center py-8 text-sm">No images in the Zoomle pool yet. <a href="/games/zoomle/config" className="underline">Set them up here.</a></p>;

  // ── Nav helpers ─────────────────────────────────────────────────────────────
  function showNav() { /* nav always visible — nothing to restore */ }

  // ── Start screen ────────────────────────────────────────────────────────────
  function handleStart() {
    // Slide the site navbar out of view
    setStarted(true);
    // 3 → 2 → 1 → GO (0) → game
    let n = 3;
    setCountdown(n);
    const tick = setInterval(() => {
      n--;
      if (n < 0) {
        clearInterval(tick);
        setCountdown(null);
        setGameKey(k => k + 1); // triggers intro effect
        setPhase("intro");
      } else {
        setCountdown(n);
      }
    }, 900);
  }

  if (isMobile && !started) return (
    <div className="bg-slate-900 flex flex-col items-center justify-center overflow-hidden -mt-px" style={{ minHeight: "calc(100dvh - 56px)" }}>
      <div className="flex flex-col items-center gap-8 px-6 text-center">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-fuchsia-400 italic -skew-x-6 pr-2 leading-none">
            ZOOMLE
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-slate-400 text-sm font-bold mt-3 uppercase tracking-widest">
            Guess the coaster
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          className="flex flex-col items-center gap-2 text-slate-500 text-sm">
          <p>🔍 The image zooms out slowly</p>
          <p>⚡ Guess early for more points</p>
          <p>🎢 {poolImages} images · {poolTotal} combinations</p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={handleStart}
          className="px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 text-white text-xl font-black tracking-wide shadow-2xl shadow-indigo-500/30 hover:opacity-90 active:scale-95 transition-all cursor-pointer">
          Start Game
        </motion.button>

      </div>
    </div>
  );


  const maxScore = rounds.length * 5;

  if (done) return (
    <div className={`flex flex-col gap-0 ${isMobile ? "bg-slate-900 px-4 pt-8 pb-12" : "w-full py-6"}`}>
      {/* Total score — animated count-up */}
      <ScoreCounter score={score} maxScore={maxScore} date={dailyDate} isMobile={isMobile} />

      {/* Round cards — stagger after score has settled */}
      <div className="flex flex-col gap-3 mb-6">
        {roundResults.map((r, i) => {
          const correct = r.pts !== null;
          const guessedCoaster = r.guessedId !== null && !correct
            ? rounds[i]?.options.find(o => o.id === r.guessedId)
            : null;
          return (
            <motion.div key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.7 + i * 0.25, ease: [0.33, 1, 0.68, 1] }}
              className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 ${
                isMobile ? "bg-slate-800" : "bg-blue-50 dark:bg-slate-800"
              }`}>
              {/* Thumbnail */}
              <div className="relative w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-700">
                {isVideo(r.image) ? (
                  <video src={r.image} muted playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: `scale(${START_SCALE})`, transformOrigin: r.focus }} />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.image} alt="" className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: `scale(${START_SCALE})`, transformOrigin: r.focus }} />
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-black text-base leading-tight truncate ${
                  isMobile ? "text-white" : "text-slate-900 dark:text-white"
                }`}>{r.answer.name}</p>
                <p className={`text-sm truncate mt-0.5 ${isMobile ? "text-slate-400" : "text-slate-500"}`}>
                  {isMobile
                    ? guessedCoaster
                      ? <span className="text-rose-400">Guessed: {guessedCoaster.name}</span>
                      : null
                    : guessedCoaster
                      ? <>{r.answer.park_name}<span className="text-rose-400"> · guessed {guessedCoaster.name}</span></>
                      : r.answer.park_name}
                </p>
              </div>
              {/* Score — plain coloured text, no box */}
              <p className={`flex-shrink-0 text-2xl font-black tabular-nums ${
                r.pts === null ? "text-rose-400"
                : r.pts >= 4 ? "text-amber-400"
                : "text-emerald-400"
              }`}>
                {r.pts === null ? "0" : `+${r.pts}`}
              </p>
              <FlagButton image={r.image} focalIndex={r.focal_index} dark={isMobile} />
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.7 + roundResults.length * 0.25 + 0.3 }}
        className="flex flex-col gap-3">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(buildShareText(dailyDate, dailyScores, maxScore));
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm hover:opacity-80 transition-opacity cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share result
        </button>
      </motion.div>
    </div>
  );

  if (!rounds.length) return <p className="text-center text-slate-400 py-8">Need at least 4 coasters with header images.</p>;

  const current  = rounds[round];
  if (!current) return null;
  const revealed = phase === "guessed";
  const correct  = guessedId === current.answer.id;

  // ── Desktop start screen ────────────────────────────────────────────────────
  if (!isMobile && !started) {
    // Background must not be any of today's round images
    const todayImages = new Set(dailyRounds.map(r => r.image));
    const bgImg = zoomlePool.find(p => !todayImages.has(p.image))?.image;
    return (
      <div className="w-full flex flex-col items-center gap-6 pt-4 pb-12">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 20 }}
          className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
          <p>🔍 The image zooms out slowly</p>
          <p>⚡ Guess early for more points</p>
          <p>🖼️ {poolImages} images · {poolTotal} combinations</p>
          <p>🎢 {ROUNDS} rounds per game</p>
        </motion.div>
        <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleStart}
          className="px-12 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 text-white text-xl font-black tracking-wide shadow-2xl shadow-indigo-500/30 hover:opacity-90 active:scale-95 transition-all cursor-pointer">
          Start Game
        </motion.button>
      </div>
    );
  }

  // ── Countdown — fullscreen on mobile, inline on desktop ──────────────────────
  if (countdown !== null) {
    const todayImgSet = new Set(dailyRounds.map(r => r.image));
    const countdownBg = zoomlePool.find(p => !todayImgSet.has(p.image))?.image;
    return isMobile ? (
    <div className="bg-slate-900 flex items-center justify-center overflow-hidden" style={{ minHeight: "calc(100dvh - 56px)" }}>
      <AnimatePresence mode="wait">
        <motion.div key={countdown}
          initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-center">
          {countdown > 0 ? (
            <span className={`text-[10rem] font-black leading-none ${
              countdown === 3 ? "text-white" : countdown === 2 ? "text-amber-500" : "text-rose-500"
            }`}>{countdown}</span>
          ) : (
            <span className="text-7xl font-black text-emerald-500 tracking-tight">GO! 🎢</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  ) : (
    <div className="w-full flex items-center justify-center py-20">
      <AnimatePresence mode="wait">
        <motion.div key={countdown}
          initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-center">
          {countdown > 0 ? (
            <span className={`text-[8rem] font-black leading-none ${
              countdown === 3 ? "text-slate-900 dark:text-white" : countdown === 2 ? "text-amber-500" : "text-rose-500"
            }`}>{countdown}</span>
          ) : (
            <span className="text-6xl font-black text-emerald-500 tracking-tight">GO! 🎢</span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );}

  // ── Desktop layout: two-column, fills the screen ──────────────────────────
  if (!isMobile) return (
      <motion.div className="w-full grid grid-cols-[3fr_1.5fr] gap-8 items-start"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}>

        {/* Left: image */}
        <div className="flex flex-col gap-3">
          {/* Timer */}
          <div className={`flex items-center gap-3 transition-opacity duration-200 ${phase === "playing" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <motion.span key={`secs-${round}-${secsLeft}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
              className={`text-4xl font-black tabular-nums w-14 text-center leading-none ${secsLeft <= 3 ? "text-rose-500" : secsLeft <= 7 ? "text-amber-500" : "text-slate-900 dark:text-white"}`}>
              {secsLeft}
            </motion.span>
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-blue-100 dark:bg-slate-700">
              <div ref={timerBarRef} className="h-full rounded-full bg-blue-500" style={{ width: "100%", transition: "none" }} />
            </div>
            <motion.div key={`pts-${round}-${ptsAvail}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
              className="flex-shrink-0 flex flex-col items-center leading-none">
              <span className={`text-xl font-black tabular-nums ${ptsAvail >= 4 ? "text-amber-500" : "text-slate-400 dark:text-slate-500"}`}>{ptsAvail}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">pts</span>
            </motion.div>
          </div>

          {/* Image — aspect-[3/2] matches the focal point config editor exactly */}
          <div className="relative rounded-2xl overflow-hidden bg-blue-50 dark:bg-slate-800 w-full" style={{ aspectRatio: "3/2" }}>
            <AnimatePresence>
              {phase === "intro" && (
                <motion.div key="ph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <motion.span animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="text-5xl opacity-20">🎢</motion.span>
                  <AnimatePresence mode="wait">
                    {introSecs === null ? (
                      <motion.p key="study"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm font-black uppercase tracking-widest text-slate-400">
                        See your options
                      </motion.p>
                    ) : (
                      <motion.p key={`cd-${introSecs}`}
                        initial={{ opacity: 0, scale: 1.15 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`text-xl font-black uppercase tracking-widest ${introSecs > 0 ? "text-slate-900 dark:text-white" : "text-amber-400"}`}>
                        {introSecs > 0 ? `Image in ${introSecs}` : "Image coming!"}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
            {isVideo(current.image) ? (
              <video ref={imgRef as React.RefObject<HTMLVideoElement>} src={current.image}
                autoPlay muted loop playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: phase === "intro" ? 0 : 1, transform: `scale(${START_SCALE})`,
                  transformOrigin: current.focus, willChange: "transform", transition: "opacity 0.9s ease" }} />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img ref={imgRef as React.RefObject<HTMLImageElement>} src={current.image} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: phase === "intro" ? 0 : 1, transform: `scale(${START_SCALE})`,
                  transformOrigin: current.focus, willChange: "transform", transition: "opacity 0.9s ease" }} />
            )}
          </div>

          {/* Result strip — below image, fixed height */}
          <div className="h-10 flex-shrink-0">
            <AnimatePresence>
              {revealed && pointsEarned !== null && (
                <motion.div key="res" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  className={`h-full rounded-xl flex items-center justify-center px-4 ${correct ? "bg-emerald-500" : "bg-blue-50 dark:bg-slate-800"}`}>
                  <p className={`font-black text-lg ${correct ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>
                    {correct ? `${getLabel(progressRef.current)} · +${pointsEarned} pts` : `It was ${current.answer.name}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: round info + options — stretches to match image height */}
        <div className="flex flex-col self-stretch gap-3">
          {/* Round / score */}
          <div className="flex items-center justify-center flex-shrink-0">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Round {round + 1} / {rounds.length}
            </p>
          </div>

          {/* Options — flex-1 so they fill remaining height = same as image */}
          <AnimatePresence mode="wait">
            <motion.div key={`grid-${round}`}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.4, ease: "easeIn" } }}
              className="flex flex-col gap-3 flex-1">
              {current.options.map((opt, i) => {
                const show      = i < visibleCount || phase !== "intro";
                const isAnswer  = opt.id === current.answer.id;
                const isGuessed = guessedId === opt.id;
                let cls = "bg-blue-50 dark:bg-slate-800 cursor-default";
                if (phase === "playing") cls = "bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 cursor-pointer";
                if (revealed) cls = isAnswer ? "bg-emerald-500 cursor-default" : isGuessed ? "bg-rose-500 cursor-default" : "bg-blue-50 dark:bg-slate-800 opacity-30 cursor-default";
                return (
                  <div key={opt.id} className="flex-1 min-h-0">
                    <AnimatePresence>
                      {show && (
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => handleGuess(opt.id)} disabled={phase !== "playing"}
                          className={`w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl px-4 text-center transition-all ${cls}`}>
                          {opt.park_country && (
                            <Image src={getParkFlag(opt.park_country)} alt="" width={30} height={21} className="rounded-sm flex-shrink-0" unoptimized />
                          )}
                          <p className={`font-black text-base leading-tight ${revealed && (isAnswer || isGuessed) ? "text-white" : "text-slate-900 dark:text-white"}`}>{opt.name}</p>
                          <p className={`text-xs ${revealed && (isAnswer || isGuessed) ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}>{opt.park_name}</p>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    );

    // ── Mobile layout: fullscreen ──────────────────────────────────────────────
    return (
      <div className="bg-slate-900 flex flex-col gap-2.5 px-3 pt-3 pb-3 -mt-px" style={{ minHeight: "calc(100dvh - 56px)" }}>
        {/* Mobile title row */}
        <div className="flex-shrink-0 text-center">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6 pr-4">
            ZOOMLE
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Guess the coaster · Round {round + 1} / {rounds.length}</p>
        </div>
        {/* Timer */}
        <div className={`flex items-center gap-2.5 flex-shrink-0 transition-opacity duration-200 ${phase === "playing" ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <motion.div key={`secs-${round}-${secsLeft}`} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
            className={`text-3xl font-black tabular-nums w-12 text-center leading-none ${secsLeft <= 3 ? "text-rose-400" : secsLeft <= 7 ? "text-amber-400" : "text-white"}`}>{secsLeft}
          </motion.div>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-800">
            <div ref={timerBarRef} className="h-full rounded-full bg-blue-500" style={{ width: "100%", transition: "none" }} />
          </div>
          <motion.div key={`pts-${round}-${ptsAvail}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
            className="flex-shrink-0 flex flex-col items-center leading-none">
            <span className={`text-xl font-black tabular-nums ${ptsAvail >= 4 ? "text-amber-400" : "text-slate-500"}`}>{ptsAvail}</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">pts</span>
          </motion.div>
        </div>
        {/* Image */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-800 w-full flex-shrink-0" style={{ aspectRatio: "3/2" }}>
          <AnimatePresence>
            {phase === "intro" && (
              <motion.div key="ph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <motion.span animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="text-4xl opacity-20">🎢</motion.span>
                <AnimatePresence mode="wait">
                  {introSecs === null ? (
                    <motion.p key="study" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                      className="text-xs font-black uppercase tracking-widest text-slate-400">See your options</motion.p>
                  ) : (
                    <motion.p key={`cd-${introSecs}`} initial={{ opacity: 0, scale: 1.15 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                      className={`text-sm font-black uppercase tracking-widest ${introSecs > 0 ? "text-white" : "text-amber-400"}`}>
                      {introSecs > 0 ? `Image in ${introSecs}` : "Image coming!"}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          {isVideo(current.image) ? (
            <video ref={imgRef as React.RefObject<HTMLVideoElement>} src={current.image}
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: phase === "intro" ? 0 : 1, transform: `scale(${START_SCALE})`,
                transformOrigin: current.focus, willChange: "transform", transition: "opacity 0.9s ease" }} />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img ref={imgRef as React.RefObject<HTMLImageElement>} src={current.image} alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: phase === "intro" ? 0 : 1, transform: `scale(${START_SCALE})`,
                transformOrigin: current.focus, willChange: "transform", transition: "opacity 0.9s ease" }} />
          )}
        </div>
        {/* Result strip */}
        <div className="flex-shrink-0 h-9">
          <AnimatePresence>
            {revealed && pointsEarned !== null && (
              <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className={`h-full rounded-xl flex items-center justify-center px-4 ${correct ? "bg-emerald-500" : "bg-slate-800"}`}>
                <p className="text-white font-black text-base">{correct ? `${getLabel(progressRef.current)} · +${pointsEarned} pts` : `It was ${current.answer.name}`}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Options */}
        <AnimatePresence mode="wait">
          <motion.div key={`grid-${round}`} exit={{ opacity: 0, y: -8, transition: { duration: 0.4, ease: "easeIn" } }} className="grid grid-cols-2 gap-2 flex-shrink-0">
            {current.options.map((opt, i) => {
              const show = i < visibleCount || phase !== "intro";
              const isAnswer = opt.id === current.answer.id;
              const isGuessed = guessedId === opt.id;
              let cls = "bg-slate-800 cursor-default";
              if (phase === "playing") cls = "bg-slate-800 hover:bg-slate-700 cursor-pointer";
              if (revealed) cls = isAnswer ? "bg-emerald-500 cursor-default" : isGuessed ? "bg-rose-500 cursor-default" : "bg-slate-800 opacity-30 cursor-default";
              return (
                <div key={opt.id} className="h-16">
                  <AnimatePresence>
                    {show && (
                      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                        onClick={() => handleGuess(opt.id)} disabled={phase !== "playing"}
                        className={`w-full h-full flex items-center gap-2.5 rounded-xl px-3 text-left transition-colors ${cls}`}>
                        {opt.park_country && <Image src={getParkFlag(opt.park_country)} alt="" width={24} height={17} className="rounded flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-black text-sm leading-tight truncate text-white">{opt.name}</p>
                          <p className={`text-xs truncate ${revealed && (isAnswer || isGuessed) ? "text-white/70" : "text-slate-400"}`}>{opt.park_name}</p>
                        </div>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestGames() {
  const [dailyRounds, setDailyRounds] = useState<PhotoRound[]>([]);
  const [dailyDate, setDailyDate]     = useState("");
  const [poolTotal, setPoolTotal]       = useState(0);
  const [poolImages, setPoolImages]     = useState(0);
  const [zoomlePool, setZoomlePool]   = useState<{ image: string; focus: string; coaster_id: number }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isMobile, setIsMobile]       = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const today = getTodayStr();
    Promise.all([
      fetch(`/api/zoomle?date=${today}`).then(r => r.json()),
      fetch("/api/zoomle/images").then(r => r.json()),
    ]).then(([daily, pool]) => {
      setDailyDate(daily.date ?? today);
      setPoolTotal(daily.total ?? 0);
      setPoolImages(daily.uniqueImages ?? 0);
      setZoomlePool((pool.images ?? []).map((i: any) => ({
        image: i.image_path, focus: i.focus ?? "50% 50%", coaster_id: i.coaster_id,
      })));
      // Map API rounds → PhotoRound[]
      setDailyRounds((daily.rounds ?? []).map((r: any) => ({
        image:       r.image,
        focus:       r.focus ?? "50% 50%",
        focal_index: r.focal_index ?? 4,
        answer:  { id: r.answer_id, name: r.answer_name, park_name: r.park_name, park_country: r.park_country ?? null,
                   year: null, height: null, speed: null, inversions: null, length: null, drop: null, gforce: null, duration: null, isbestcoaster: false },
        options: (r.options ?? []).map((o: any) => ({ id: o.id, name: o.name, park_name: o.park_name, park_country: o.park_country ?? null,
                   year: null, height: null, speed: null, inversions: null, length: null, drop: null, gforce: null, duration: null, isbestcoaster: false })),
      })));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
      <LoadingSpinner />
    </div>
  );

  // Desktop: matches Connections/Coastle layout exactly
  if (!isMobile) return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-2 sm:p-6 flex flex-col items-center overflow-x-hidden select-none">
      <header className="mb-2 text-center mt-2 space-y-2 px-4 animate-reveal">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6 pr-4">
          ZOOMLE
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
          Guess the coaster
        </p>
      </header>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        className="w-full max-w-5xl">
        <PhotoGame dailyRounds={dailyRounds} dailyDate={dailyDate} zoomlePool={zoomlePool} poolTotal={poolTotal} poolImages={poolImages} isMobile={false} />
      </motion.div>
    </div>
  );

  // Mobile: fullscreen with start screen + countdown
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="contents">
      <PhotoGame dailyRounds={dailyRounds} dailyDate={dailyDate} zoomlePool={zoomlePool} poolTotal={poolTotal} poolImages={poolImages} isMobile={true} />
    </motion.div>
  );
}
