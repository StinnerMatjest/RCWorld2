"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { getParkFlag, getRatingColor } from "@/app/utils/design";

// ─── Types ───────────────────────────────────────────────────────────────────

type ApiCoaster = {
  id: number;
  name: string;
  year: number | null;
  manufacturerName: string | null;
  scale: string | null;
  rating: number | null;
  parkId: number;
  parkName: string;
  country: string | null;
  specs: {
    height: number | null;
    speed: number | null;
    length: number | null;
    drop: number | null;
    inversions: number | null;
  } | null;
};

type Metric = {
  key: string;
  em: string;
  name: string;
  unit: string;
  get: (c: ApiCoaster) => number | null;
  qHigh: string;
  qLow: string;
  qExact?: string;
};

type Tier = {
  name: string;
  color: string;
  mult: number;
  rel: [number, number];
  year: [number, number];
  rating: [number, number];
  inv: [number, number] | null;
  exact?: boolean;
};

type RoundMode = "higher" | "lower" | "exact";

type Round = {
  m: Metric;
  a: ApiCoaster;
  b: ApiCoaster;
  va: number;
  vb: number;
  mode: RoundMode;
  exactVal?: number;
  tier: Tier;
  imgA: string;
  imgB: string;
};

type Phase = "loading" | "error" | "spin" | "bet" | "pick" | "result" | "clearing" | "end";

// ─── Game config ─────────────────────────────────────────────────────────────

const METRICS: Metric[] = [
  { key: "speed", em: "⚡", name: "Top speed", unit: " km/h", get: (c) => c.specs?.speed ?? null,
    qHigh: "Which coaster is <hl>faster</hl>?", qLow: "Which coaster is <hl>slower</hl>?",
    qExact: "Which coaster tops out at exactly <hl>{v}</hl>?" },
  { key: "height", em: "🗼", name: "Height", unit: " m", get: (c) => c.specs?.height ?? null,
    qHigh: "Which coaster is <hl>taller</hl>?", qLow: "Which coaster is <hl>shorter</hl>?",
    qExact: "Which coaster is exactly <hl>{v}</hl> tall?" },
  { key: "length", em: "📏", name: "Track length", unit: " m", get: (c) => c.specs?.length ?? null,
    qHigh: "Which coaster has the <hl>longer track</hl>?", qLow: "Which has the <hl>shorter track</hl>?",
    qExact: "Which track is exactly <hl>{v}</hl> long?" },
  { key: "drop", em: "⛰️", name: "Drop", unit: " m", get: (c) => c.specs?.drop ?? null,
    qHigh: "Which coaster has the <hl>bigger drop</hl>?", qLow: "Which has the <hl>smaller drop</hl>?",
    qExact: "Which coaster drops exactly <hl>{v}</hl>?" },
  { key: "inversions", em: "🌀", name: "Inversions", unit: "", get: (c) => c.specs?.inversions ?? null,
    qHigh: "Which coaster has <hl>more inversions</hl>?", qLow: "Which has <hl>fewer inversions</hl>?" },
  { key: "year", em: "📅", name: "Year", unit: "", get: (c) => c.year,
    qHigh: "Which coaster is <hl>newer</hl>?", qLow: "Which coaster was <hl>built first</hl>?",
    qExact: "Which coaster opened exactly in <hl>{v}</hl>?" },
  { key: "rating", em: "⭐", name: "Our rating", unit: "/10", get: (c) => c.rating,
    qHigh: "Which coaster did <hl>we rate higher</hl>?", qLow: "Which did <hl>we rate lower</hl>?" },
];

// five tiers, one per round; the finale asks for an EXACT value
const TIERS: Tier[] = [
  { name: "EASY", color: "#4ade80", mult: 1, rel: [0.35, 99], year: [20, 99], rating: [1.5, 99], inv: [4, 99] },
  { name: "NORMAL", color: "#a3e635", mult: 1.5, rel: [0.12, 0.35], year: [8, 20], rating: [0.7, 1.5], inv: [2, 3] },
  { name: "MEDIUM", color: "#facc15", mult: 2, rel: [0.04, 0.12], year: [3, 8], rating: [0.3, 0.7], inv: [1, 1] },
  { name: "HARD", color: "#fb923c", mult: 2.5, rel: [0.004, 0.03], year: [1, 2], rating: [0.05, 0.2], inv: null },
  { name: "IMPOSSIBLE", color: "#f87171", mult: 3, rel: [0.02, 99], year: [1, 99], rating: [0, 0], inv: null, exact: true },
];

const ROUNDS = 5;
// one tier per round, climbing straight up the ladder
const TIER_BY_ROUND = [0, 1, 2, 3, 4];
// exact-value finale only uses physical stats (no rating, no inversions)
const EXACT_KEYS = ["speed", "height", "length", "drop", "year"];
const TILE = 80; // 5 visible tiles = 400px, same height as the cards
const N = METRICS.length;
const REPEATS = 48;
const START_BANK = 100;
const WINDOW_PAD = 2 * TILE; // window shows the 3rd of 5 visible tiles

const tierFor = (r: number) => TIERS[TIER_BY_ROUND[Math.min(ROUNDS, Math.max(1, r)) - 1]];
const roundsForTier = (t: Tier) =>
  Array.from({ length: ROUNDS }, (_, i) => i + 1).filter((r) => tierFor(r) === t);

function gapOk(m: Metric, va: number, vb: number, tier: Tier): boolean {
  const diff = Math.abs(va - vb);
  if (["speed", "height", "length", "drop"].includes(m.key)) {
    const rel = diff / Math.max(va, vb);
    return rel >= tier.rel[0] && rel <= tier.rel[1];
  }
  if (m.key === "year") return diff >= tier.year[0] && diff <= tier.year[1];
  if (m.key === "rating") return diff >= tier.rating[0] && diff <= tier.rating[1];
  if (m.key === "inversions") {
    if (!tier.inv) return false;
    // "1 vs 0 inversions" is a giveaway (you can see a loop in the photo) —
    // only the EASY tier may serve pairs where one coaster has none
    if (tier !== TIERS[0] && Math.min(va, vb) === 0) return false;
    return diff >= tier.inv[0] && diff <= tier.inv[1];
  }
  return false;
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function QText({ html }: { html: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: html
          .replaceAll("<hl>", '<span class="text-brand">')
          .replaceAll("</hl>", "</span>"),
      }}
    />
  );
}

// The result amount holds, then drains to 0 with the exact easing the bank
// uses to rise — the points visibly flow from one number into the other.
function TransferAmount({ amount, positive, mult }: { amount: number; positive: boolean; mult: number }) {
  const [shown, setShown] = useState(amount);
  useEffect(() => {
    setShown(amount);
    let raf: number;
    const start = setTimeout(() => {
      const t0 = performance.now();
      const dur = 1100;
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setShown(Math.round(amount * Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 1250);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [amount]);
  return positive ? (
    <span className="text-green-400">
      ✅{shown > 0 && <> +{shown}{shown === amount && mult > 1 && <span className="text-green-400/60"> (×{mult})</span>}</>}
    </span>
  ) : (
    <span className="text-red-400">
      ❌{shown > 0 && <> −{shown}{shown === amount && mult > 1 && <span className="text-red-400/60"> (×{mult})</span>}</>}
    </span>
  );
}

function BankTween({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    if (from === value) return;
    setDir(value > from ? 1 : -1);
    const t0 = performance.now();
    const dur = 1100;
    let raf: number;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
      else { prevRef.current = value; setTimeout(() => setDir(0), 250); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <b
      className={`text-base inline-block transition-all duration-300 ${
        dir === 1 ? "text-green-400 scale-125" : dir === -1 ? "text-red-400 scale-125" : "text-brand-light"
      }`}
    >
      {shown}
    </b>
  );
}

function CountUpVal({ value, unit }: { value: number; unit: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const dur = 850;
    let raf: number;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const isYearLike = Number.isInteger(value) && value > 1800 && value < 2100 && unit === "";
  return (
    <span>
      {Number.isInteger(value)
        ? isYearLike
          ? Math.round(shown)
          : Math.round(shown).toLocaleString("en-GB")
        : shown.toFixed(1)}
      {unit}
    </span>
  );
}

/**
 * Particle burst erupting from the winning card — spawned at the element's
 * center, particles fly outwards with spin and gravity via the Web
 * Animations API, then the whole thing cleans itself up.
 */
function burstFrom(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height * 0.4;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;z-index:60;pointer-events:none;`;
  document.body.appendChild(host);
  const colors = ["#e9820e", "#f8941e", "#4ade80", "#fef3c7", "#ffffff"];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("div");
    const size = 5 + Math.random() * 6;
    const round = Math.random() < 0.4;
    p.style.cssText = `position:absolute;width:${size}px;height:${round ? size : size * 1.6}px;` +
      `background:${colors[Math.floor(Math.random() * colors.length)]};` +
      `border-radius:${round ? "50%" : "2px"};left:0;top:0;`;
    host.appendChild(p);
    // launch upward-biased, then gravity pulls the tail of the arc down
    const angle = (-90 + (Math.random() * 240 - 120)) * (Math.PI / 180);
    const dist = 70 + Math.random() * 110;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = (Math.random() - 0.5) * 720;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) rotate(${rot * 0.6}deg) scale(1.05)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy + 90 + Math.random() * 60}px) rotate(${rot}deg) scale(0.5)`, opacity: 0 },
      ],
      { duration: 750 + Math.random() * 450, easing: "cubic-bezier(0.15, 0.55, 0.45, 1)", fill: "forwards" }
    );
  }
  setTimeout(() => host.remove(), 1400);
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RankleClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pool, setPool] = useState<ApiCoaster[]>([]);
  const [bank, setBank] = useState(START_BANK);
  const [roundNo, setRoundNo] = useState(1);
  const [round, setRound] = useState<Round | null>(null);
  const [bet, setBet] = useState(25);
  const [lockedBet, setLockedBet] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<"A" | "B" | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [started, setStarted] = useState(false);
  const [spinLaunched, setSpinLaunched] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const roundDataRef = useRef<Round | null>(null);
  const curOffsetRef = useRef(0);          // current strip offset in px (translateY(-x))
  const spinLockRef = useRef(false);       // reel launched, ignore input
  const metricCountRef = useRef<Record<string, number>>({});
  const imgCacheRef = useRef<Record<number, string | null>>({});
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const roundRef = useRef(1);
  const bankRef = useRef(START_BANK);
  const dragRef = useRef<{ startY: number; baseOff: number; lastY: number; lastT: number; vel: number; moved: number } | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

  // load coaster pool
  useEffect(() => {
    const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
    fetch("/api/coasters")
      .then((r) => r.json())
      .then((d) => {
        const list: ApiCoaster[] = (Array.isArray(d) ? d : d.coasters) ?? [];
        // the API serialises numerics as strings — normalise so tier math and
        // getRatingColor (which type-checks for number) behave
        const normalized = list.map((c) => ({
          ...c,
          year: num(c.year),
          rating: num(c.rating),
          specs: c.specs
            ? {
                height: num(c.specs.height),
                speed: num(c.specs.speed),
                length: num(c.specs.length),
                drop: num(c.specs.drop),
                inversions: num(c.specs.inversions),
              }
            : null,
        }));
        setPool(normalized.filter((c) => c.scale !== "Kiddie" && c.rating != null && c.specs));
      })
      .catch(() => setPhase("error"));
  }, []);

  const fetchImage = useCallback(async (c: ApiCoaster): Promise<string | null> => {
    if (c.id in imgCacheRef.current) return imgCacheRef.current[c.id];
    try {
      const r = await fetch(
        `/api/coasters/${c.id}/gallery?parkId=${c.parkId}&name=${encodeURIComponent(c.name)}`
      );
      const img = r.ok ? (await r.json()).headerImage ?? null : null;
      imgCacheRef.current[c.id] = img;
      return img;
    } catch {
      imgCacheRef.current[c.id] = null;
      return null;
    }
  }, []);

  const pickPair = useCallback(
    (tier: Tier, ignoreVariety: boolean): Omit<Round, "imgA" | "imgB"> | null => {
      // 5 rounds, 7 metrics: every round gets a different metric
      let metricSet = ignoreVariety
        ? METRICS
        : METRICS.filter((m) => (metricCountRef.current[m.key] || 0) < 1);
      // the exact finale only works on physical stats
      if (tier.exact) {
        const exactSet = metricSet.filter((m) => EXACT_KEYS.includes(m.key));
        metricSet = exactSet.length ? exactSet : METRICS.filter((m) => EXACT_KEYS.includes(m.key));
      }
      if (!metricSet.length || pool.length < 6) return null;
      for (let t = 0; t < 3000; t++) {
        const m = metricSet[Math.floor(Math.random() * metricSet.length)];
        const a = pool[Math.floor(Math.random() * pool.length)];
        const b = pool[Math.floor(Math.random() * pool.length)];
        if (a.id === b.id || a.parkName === b.parkName) continue;
        const va = m.get(a), vb = m.get(b);
        if (va == null || vb == null || va === vb) continue;
        if (tier.exact) {
          // the two candidates must be NEIGHBOURS (62 vs 61, not 62 vs 30) —
          // otherwise the named value gives the answer away
          if (["speed", "height", "length", "drop"].includes(m.key)) {
            const rel = Math.abs(va - vb) / Math.max(va, vb);
            if (rel < 0.004 || rel > 0.1) continue;
          }
          if (m.key === "year" && Math.abs(va - vb) > 3) continue;
          return { m, a, b, va, vb, mode: "exact" as const, exactVal: Math.random() < 0.5 ? va : vb, tier };
        }
        if (!gapOk(m, va, vb, tier)) continue;
        return { m, a, b, va, vb, mode: (Math.random() < 0.4 ? "lower" : "higher") as RoundMode, tier };
      }
      return null;
    },
    [pool]
  );

  // ── reel helpers ─────────────────────────────────────────────────────────

  const setStrip = (transition: string, offset: number) => {
    const s = stripRef.current;
    if (!s) return;
    s.style.transition = transition;
    s.style.transform = `translateY(-${offset}px)`;
    curOffsetRef.current = offset;
  };

  /** Silently re-anchor mid-strip, keeping the same visible tile (same index mod N). */
  const rebaseStrip = () => {
    const curTile = Math.round((curOffsetRef.current + WINDOW_PAD) / TILE);
    const midTile = Math.floor(REPEATS / 2) * N + (((curTile % N) + N) % N);
    setStrip("none", midTile * TILE - WINDOW_PAD);
  };

  /**
   * Launch the reel toward the scripted metric.
   * dir  1 = tiles roll DOWN (natural pull),  -1 = tiles roll UP.
   * speed 0.4..2 scales travel & duration. windup adds the acceleration stage
   * (auto-spin); flicks skip it because the hand supplied the acceleration.
   */
  const launchSpin = useCallback((dir: 1 | -1, speed: number, windup: boolean) => {
    const r = roundDataRef.current;
    if (!r || spinLockRef.current) return;
    spinLockRef.current = true;
    setSpinLaunched(true);
    const idx = METRICS.findIndex((m) => m.key === r.m.key);
    const curTile = Math.round((curOffsetRef.current + WINDOW_PAD) / TILE);
    const travel = Math.round(16 + 10 * speed);
    let targetTile: number;
    if (dir === 1) {
      // rolling down: strip offset decreases
      targetTile = curTile - travel;
      targetTile -= (((targetTile % N) - idx) % N + N) % N;
      while (targetTile < 3) targetTile += N;
    } else {
      targetTile = curTile + travel;
      targetTile += ((idx - (targetTile % N)) % N + N) % N;
      while (targetTile > REPEATS * N - 4) targetTile -= N;
    }
    const from = curOffsetRef.current;
    const offset = targetTile * TILE - WINDOW_PAD;
    const D = offset - from;
    const overshoot = offset - dir * 16;
    const s = () => stripRef.current;
    let t = 0;
    if (windup) {
      // pull: slow heave into motion
      setStrip("transform 0.5s cubic-bezier(0.6, 0.05, 0.85, 0.4)", from + D * 0.12);
      t = 510;
    }
    later(() => { if (s()) s()!.style.filter = "blur(3px)"; }, t + 100);
    later(() => setStrip("transform 0.7s linear", from + D * 0.68), t);
    later(() => setStrip(`transform ${(1.7 + 0.3 * speed).toFixed(2)}s cubic-bezier(0.05, 0.7, 0.15, 1)`, overshoot), t + 710);
    later(() => { if (s()) s()!.style.filter = ""; }, t + 1500);
    const settleAt = t + 710 + (1.7 + 0.3 * speed) * 1000;
    later(() => setStrip("transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)", offset), settleAt);
    later(() => {
      setBet(Math.min(25, bankRef.current));
      setPhase("bet");
    }, settleAt + 550);
  }, [later]);

  // ── round flow ──────────────────────────────────────────────────────────

  const pendingRoundRef = useRef<Round | null>(null);

  /** Build a round (pair + both images) without committing it. */
  const prepareRound = useCallback(async (): Promise<Round | null> => {
    const wantTier = tierFor(roundRef.current);
    for (let attempt = 0; attempt < 12; attempt++) {
      const cand =
        pickPair(wantTier, false) ||
        pickPair(TIERS[Math.max(0, TIERS.indexOf(wantTier) - 1)], false) ||
        pickPair(TIERS[0], false) ||
        pickPair(wantTier, true) ||
        pickPair(TIERS[0], true);
      if (!cand) break;
      const [imgA, imgB] = await Promise.all([fetchImage(cand.a), fetchImage(cand.b)]);
      if (imgA && imgB) return { ...cand, imgA, imgB };
    }
    return null;
  }, [pickPair, fetchImage]);

  // warm the first round while the player is still looking at the PLAY button
  useEffect(() => {
    if (pool.length && !pendingRoundRef.current && !started) {
      prepareRound().then((r) => { pendingRoundRef.current = r; });
    }
  }, [pool, started, prepareRound]);

  const startRound = useCallback(async () => {
    const full = pendingRoundRef.current ?? (await prepareRound());
    pendingRoundRef.current = null;
    if (!full) { setPhase("error"); return; }
    metricCountRef.current[full.m.key] = (metricCountRef.current[full.m.key] || 0) + 1;
    roundDataRef.current = full;
    spinLockRef.current = false;
    setSpinLaunched(false);
    setRound(full);
    setPicked(null);
    setLastCorrect(null);
    rebaseStrip();          // invisible: same tile face, fresh travel room both ways
    setPhase("spin");       // cards fade in; the reel now waits for the player
  }, [pickPair, fetchImage]);

  const statusRowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const play = () => {
    if (!pool.length || started) return;
    setStarted(true);
    later(() => startRound(), 450);
    // mobile: snap instantly so RANKLE + the score row sit at the top —
    // the game simply *starts* in position instead of scrolling to it
    requestAnimationFrame(() => {
      if (window.innerWidth < 768) {
        headerRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
      }
    });
  };

  const lockBet = () => {
    if (phase !== "bet") return;
    setLockedBet(bet);
    setPhase("pick");
  };

  const answer = (side: "A" | "B", cardEl?: HTMLElement) => {
    if (phase !== "pick" || !round) return;
    const myVal = side === "A" ? round.va : round.vb;
    const otherVal = side === "A" ? round.vb : round.va;
    const correct =
      round.mode === "exact" ? myVal === round.exactVal
      : round.mode === "lower" ? myVal < otherVal
      : myVal > otherVal;
    if (correct && cardEl) burstFrom(cardEl);
    // the multiplier cuts both ways: wins pay it, losses cost it
    const payout = Math.round(lockedBet * round.tier.mult);
    const newBank = bankRef.current + (correct ? payout : -payout);
    bankRef.current = newBank;
    setPicked(side);
    setLastCorrect(correct);
    setHistory((h) => [...h, correct]);
    setPhase("result");
    // beat 1: values count up — beat 2: the score drains into the bank
    later(() => setBank(newBank), 1250);
    if (roundRef.current >= ROUNDS || newBank <= 0) {
      later(() => setPhase("end"), 3400);
    } else {
      roundRef.current += 1;
      setRoundNo(roundRef.current);
      // prepare the next matchup NOW, while the result plays out
      prepareRound().then((r) => { pendingRoundRef.current = r; });
      // beat 3: cards bow out — beat 4: next contestants arrive, reel awaits
      later(() => setPhase("clearing"), 3200);
      later(() => { startRound(); }, 3680);
    }
  };

  const restart = () => {
    bankRef.current = START_BANK;
    roundRef.current = 1;
    metricCountRef.current = {};
    setBank(START_BANK);
    setRoundNo(1);
    setHistory([]);
    setRound(null);
    roundDataRef.current = null;
    pendingRoundRef.current = null; // may hold a round prepared for the wrong tier
    setPhase("loading");
    later(() => startRound(), 300);
  };

  // ── reel pointer interaction (drag / flick / click) ─────────────────────

  const reelInteractive = phase === "spin" && !spinLaunched;

  const onReelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reelInteractive) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      baseOff: curOffsetRef.current,
      lastY: e.clientY,
      lastT: performance.now(),
      vel: 0,
      moved: 0,
    };
  };

  const onReelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || !reelInteractive) return;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(dy));
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.vel = 0.8 * d.vel + 0.2 * ((e.clientY - d.lastY) / dt); // px/ms, smoothed
    d.lastY = e.clientY;
    d.lastT = now;
    // finger drags the drum 1:1 — finger down = tiles roll down = offset shrinks
    const off = Math.min(
      (REPEATS * N - 4) * TILE,
      Math.max(3 * TILE, d.baseOff - dy)
    );
    setStrip("none", off);
  };

  const onReelPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !reelInteractive) return;
    if (d.moved < 8) {
      // a plain click: pull the lever for them
      launchSpin(1, 1, true);
      return;
    }
    const v = d.vel; // finger px/ms; positive = downward flick
    if (Math.abs(v) < 0.15) {
      // released without momentum: treat as a gentle pull in the drag direction
      launchSpin(v >= 0 ? 1 : -1, 0.5, false);
      return;
    }
    launchSpin(v > 0 ? 1 : -1, Math.min(2, Math.max(0.4, Math.abs(v) * 1.2)), false);
  };

  // ── render helpers ───────────────────────────────────────────────────────

  const fmtExact = (r: Round) => {
    const v = r.exactVal!;
    if (r.m.key === "year") return String(v);
    return (Number.isInteger(v) ? v.toLocaleString("en-GB") : v.toFixed(1)) + r.m.unit;
  };
  const questionHtml = round
    ? round.mode === "exact"
      ? round.m.qExact!.replace("{v}", fmtExact(round))
      : round.mode === "lower" ? round.m.qLow : round.m.qHigh
    : "";
  const tier = round?.tier ?? tierFor(roundNo);
  // stage lighting: cards sit in shadow until it's their turn in the flow
  // (reel -> bet -> pick), guiding the eye through the round
  const cardVeil = phase === "spin" ? 0.62 : phase === "bet" ? 0.45 : 0;
  // mobile shows one thing at a time: reel while spinning, cards afterwards
  const mobileReelStage = phase === "spin" || phase === "loading";
  const isAnswerSide = (side: "A" | "B") => {
    if (!round) return false;
    const v = side === "A" ? round.va : round.vb;
    if (round.mode === "exact") return v === round.exactVal;
    return round.mode === "lower" ? v === Math.min(round.va, round.vb) : v === Math.max(round.va, round.vb);
  };

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4 text-slate-300">
        <p>Could not load the coaster pool. 🎢💥</p>
        <button onClick={restart} className="px-6 py-2.5 rounded-full bg-brand text-slate-950 font-bold cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`${started ? "min-h-[calc(100vh+120px)] pb-40" : "min-h-screen pb-10"} md:min-h-screen md:pb-28 bg-[#0f172a] px-3 pt-6 flex flex-col items-center overflow-x-hidden`}>
      <style>{`
        @keyframes rankle-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        @keyframes rankle-rise { from { opacity:0; transform: translateY(26px) scale(0.97); } to { opacity:1; transform:none; } }
        @keyframes rankle-fadein { from { opacity:0; } to { opacity:1; } }
        @keyframes rankle-out { to { opacity:0; transform: scale(0.95) translateY(10px); } }
        @keyframes rankle-nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(7px); } }
        /* mobile-only entrance for elements that take the stage sequentially */
        @media (max-width: 767px) {
          .m-rise { animation: rankle-rise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        }
      `}</style>

      {/* header — same treatment as Coastle/Connections */}
      <header ref={headerRef} className="mb-2 text-center mt-2 px-4 scroll-mt-1">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-600 drop-shadow-sm italic transform -skew-x-6 pr-4">
          RANKLE
        </h1>
      </header>

      {!started ? (
        <div className="flex flex-col items-center gap-5 mt-4 sm:mt-8">
          <p className="text-sm text-slate-400 font-medium max-w-sm text-center">
            The reel picks a stat, you pick a coaster. You start with {START_BANK} points and can bet
            up to 100 each round. Survive all {ROUNDS} rounds and beat the bank.
          </p>
          {/* difficulty legend: this is what the colored dot in the HUD means */}
          <div className="flex flex-col gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-400">
            {TIERS.map((t) => {
              const rounds = roundsForTier(t);
              const label = rounds.length > 1 ? `rounds ${rounds[0]}–${rounds[rounds.length - 1]}` : `round ${rounds[0]}`;
              return (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="w-24" style={{ color: t.color }}>{t.name}</span>
                  <span className="text-slate-500 normal-case font-medium tracking-normal">
                    {label} · wins pay ×{t.mult}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={play}
            disabled={!pool.length}
            className="px-14 py-4 rounded-full font-black text-lg tracking-widest bg-gradient-to-br from-[#e9820e] to-[#d46f00] text-slate-950
              shadow-[0_8px_32px_rgba(233,130,14,0.45)] cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
          >
            {pool.length ? "▶ PLAY" : "LOADING…"}
          </button>
        </div>
      ) : (
        <>
          {/* status row: bank · round dots · tier — flat text, no pills */}
          <div ref={statusRowRef} className="mt-3 flex items-center gap-4 sm:gap-5 justify-center whitespace-nowrap scroll-mt-2" style={{ animation: "rankle-rise 0.5s ease both" }}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Bank <BankTween value={bank} />
            </div>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < history.length
                      ? history[i] ? "bg-green-400" : "bg-red-400"
                      : i === history.length ? "bg-brand" : "bg-slate-700"
                  }`}
                />
              ))}
              <span className="ml-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
                {Math.min(roundNo, ROUNDS)}/{ROUNDS}
              </span>
            </div>
            <span className="text-slate-700">·</span>
            {/* tier: the colored dot carries it on phones; name + payout from sm up */}
            <div className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color }} />
              <span className="hidden sm:inline" style={{ color: tier.color }}>{tier.name}</span>
              <span className="text-slate-300">×{tier.mult}</span>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              title="How to play"
              aria-label="How to play"
              className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-brand-light hover:border-brand text-[13px] font-black transition-all cursor-pointer"
            >
              ?
            </button>
          </div>

          {/* question banner: fixed height + one line on desktop so the cards never shift */}
          <div className="h-[64px] sm:h-[72px] mt-3 mb-3 flex flex-col items-center justify-center text-center max-w-3xl" style={{ animation: "rankle-rise 0.5s ease 0.08s both" }}>
            <div className="text-xl sm:text-3xl font-black leading-tight text-slate-100 md:whitespace-nowrap">
              {phase === "loading" ? (
                <span className="text-slate-500">…</span>
              ) : phase === "spin" ? (
                <span className="text-slate-400">{spinLaunched ? "…" : <>Spin the wheel <span className="inline-block" style={{ animation: "rankle-nudge 1.4s ease-in-out infinite" }}>👇</span></>}</span>
              ) : (phase === "result" || phase === "clearing") && lastCorrect !== null ? (
                <TransferAmount
                  key={history.length}
                  amount={Math.round(lockedBet * (round?.tier.mult ?? 1))}
                  positive={lastCorrect}
                  mult={round?.tier.mult ?? 1}
                />
              ) : (
                <QText html={questionHtml} />
              )}
            </div>
          </div>

          {/* table: slot / reel / slot */}
          <div
            className="w-full max-w-4xl grid gap-4 items-center justify-items-center grid-cols-2 md:grid-cols-[1fr_auto_1fr] [grid-template-areas:'reel_reel'_'a_b'] md:[grid-template-areas:'a_reel_b'] mb-6"
            style={{ animation: "rankle-rise 0.6s cubic-bezier(0.22,1,0.36,1) 0.16s both" }}
          >
            {(["A", "B"] as const).map((side) => {
              const c = side === "A" ? round?.a : round?.b;
              const img = side === "A" ? round?.imgA : round?.imgB;
              const v = side === "A" ? round?.va : round?.vb;
              const filled = !!round && phase !== "loading" && phase !== "end";
              const pickable = phase === "pick";
              const showVal = phase === "result" || phase === "clearing";
              const winner = showVal && isAnswerSide(side);
              const loser = showVal && picked === side && !lastCorrect;
              return (
                <div
                  key={side}
                  onClick={(e) => pickable && answer(side, e.currentTarget)}
                  style={
                    phase === "clearing"
                      ? { animation: "rankle-out 0.45s ease both" }
                      : phase === "spin"
                      ? { animation: `rankle-rise 0.55s cubic-bezier(0.22,1,0.36,1) ${side === "A" ? "0s" : "0.15s"} both` }
                      : loser
                      ? { animation: "rankle-shake 0.4s" }
                      : undefined
                  }
                  className={`w-full max-w-[320px] h-[300px] sm:h-[400px] rounded-2xl overflow-hidden relative
                    border-2 transition-all duration-200
                    ${side === "A" ? "[grid-area:a]" : "[grid-area:b]"}
                    ${mobileReelStage ? "hidden md:block" : ""}
                    ${phase === "bet" ? "m-rise" : ""}
                    ${!filled ? "border-transparent bg-transparent" : "bg-gray-900 shadow-md"}
                    ${winner ? "border-green-400 shadow-[0_0_30px_rgba(74,222,128,0.3)]"
                      : loser ? "border-red-400"
                      : pickable ? "border-slate-600 cursor-pointer hover:border-brand hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(233,130,14,0.25)]"
                      : filled ? "border-slate-700" : ""}`}
                >
                  {filled && c && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img ?? ""} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-4 pt-3 pb-12 pointer-events-none">
                        <div className="flex items-center gap-2">
                          {c.country && (
                            <Image src={getParkFlag(c.country)} alt="" width={20} height={14} className="rounded-sm shrink-0" unoptimized />
                          )}
                          <span className="text-white/90 text-sm font-bold drop-shadow-md leading-tight">{c.parkName}</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-14 pb-4 pointer-events-none">
                        <h3 className="text-white font-black text-xl sm:text-2xl leading-tight drop-shadow-md">{c.name}</h3>
                        {c.manufacturerName && (
                          <div className="text-white/60 text-[11px] font-medium mt-0.5">{c.manufacturerName}</div>
                        )}
                      </div>
                      {/* stage-lighting veil: dark while the reel/bet own the moment */}
                      <div
                        className="absolute inset-0 bg-[#0f172a] pointer-events-none transition-opacity duration-500 z-[5]"
                        style={{ opacity: cardVeil }}
                      />
                      {showVal && v != null && (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/60 z-[6]"
                          style={{ animation: "rankle-fadein 0.45s ease both" }}
                        >
                          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60 mb-1">
                            {round!.m.name}
                          </span>
                          <span
                            className={`text-4xl sm:text-5xl font-black tabular-nums drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] ${
                              round!.m.key === "rating" ? getRatingColor(v) : winner ? "text-green-300" : "text-white"
                            }`}
                          >
                            <CountUpVal value={v} unit={round!.m.unit} />
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* reel — grab it, flick it either way, or click to pull */}
            <div className={`[grid-area:reel] ${mobileReelStage ? "m-rise" : "hidden md:block"} max-md:h-[368px]`}>
              <div
                onPointerDown={onReelPointerDown}
                onPointerMove={onReelPointerMove}
                onPointerUp={onReelPointerUp}
                onPointerCancel={onReelPointerUp}
                className={`relative w-[230px] h-[400px] max-md:scale-[0.92] max-md:origin-top rounded-2xl bg-[#0b1428] border-2 overflow-hidden select-none transition-shadow duration-300
                  ${reelInteractive
                    ? "border-brand/70 cursor-grab active:cursor-grabbing shadow-[0_16px_44px_rgba(0,0,0,0.45),0_0_34px_rgba(233,130,14,0.28),inset_0_0_34px_rgba(0,0,0,0.6)]"
                    : "border-slate-700 shadow-[0_16px_44px_rgba(0,0,0,0.45),inset_0_0_34px_rgba(0,0,0,0.6)]"}`}
                style={{ touchAction: "none" }}
              >
                <div className="absolute inset-x-0 top-0 h-[160px] z-[3] pointer-events-none bg-gradient-to-b from-[#0b1428] via-[#0b1428d9] to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-[160px] z-[3] pointer-events-none bg-gradient-to-t from-[#0b1428] via-[#0b1428d9] to-transparent" />
                <div
                  className={`absolute top-[160px] left-[5px] right-[5px] h-[80px] rounded-xl border-[2.5px] z-[4] pointer-events-none transition-all duration-300 ${
                    phase === "bet" || phase === "pick" || phase === "result" || phase === "clearing"
                      ? "border-brand shadow-[0_0_22px_rgba(233,130,14,0.35),inset_0_0_16px_rgba(233,130,14,0.12)]"
                      : "border-slate-700"
                  }`}
                />
                <div ref={stripRef} className="absolute inset-x-0 top-0 will-change-transform">
                  {Array.from({ length: REPEATS }).flatMap((_, r) =>
                    METRICS.map((m) => (
                      <div key={`${r}-${m.key}`} className="h-[80px] flex items-center justify-center gap-2.5">
                        <span className="text-[25px]">{m.em}</span>
                        <span className="text-[16px] font-black tracking-wide uppercase text-slate-100">{m.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* bet bar: bottom sheet on mobile, floating pill on desktop */}
          <div
            className={`fixed z-20 inset-x-0 bottom-0 md:inset-x-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2
              bg-slate-900/95 md:bg-slate-800/95 backdrop-blur-sm border-t md:border rounded-t-2xl md:rounded-full
              px-4 pt-3 pb-4 md:px-5 md:py-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-3
              shadow-2xl transition-all duration-300 md:max-w-[96vw]
              ${phase === "bet"
                ? "opacity-100 border-brand/70 md:scale-[1.03] shadow-[0_-10px_44px_rgba(233,130,14,0.22)] md:shadow-[0_12px_44px_rgba(233,130,14,0.3)]"
                : "opacity-35 saturate-50 pointer-events-none border-slate-700"}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Bet</span>
              <input
                type="range"
                min={1}
                max={Math.min(100, bank)}
                value={bet}
                onChange={(e) => setBet(parseInt(e.target.value))}
                className="flex-1 md:flex-none md:w-36 accent-[#e9820e]"
              />
              <span className="text-xl font-black text-brand-light min-w-[42px] text-center">{bet}</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {[10, 25, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => setBet(Math.min(v, Math.min(100, bank)))}
                  className="flex-1 md:flex-none text-[11px] font-bold px-3 py-2 md:py-1.5 rounded-xl md:rounded-full border border-slate-600 text-slate-300 hover:border-brand hover:text-brand-light cursor-pointer"
                >
                  {v}
                </button>
              ))}
              <button
                onClick={() => setBet(Math.min(100, bank))}
                className="flex-1 md:flex-none text-[11px] font-bold px-3 py-2 md:py-1.5 rounded-xl md:rounded-full border border-slate-600 text-slate-300 hover:border-brand hover:text-brand-light cursor-pointer"
              >
                MAX
              </button>
              <button
                onClick={lockBet}
                className="flex-[2] md:flex-none text-[13px] font-black tracking-wide px-6 py-2.5 rounded-xl md:rounded-full bg-gradient-to-br from-[#e9820e] to-[#d46f00] text-slate-950 shadow-[0_4px_18px_rgba(233,130,14,0.4)] active:scale-95 cursor-pointer"
              >
                LOCK 🔒
              </button>
            </div>
          </div>
        </>
      )}

      {/* help fold-out */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-start sm:items-center justify-center overflow-y-auto px-4 py-10"
          onClick={() => setShowHelp(false)}
        >
          <div className="relative w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowHelp(false)}
              aria-label="Close"
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-700 text-slate-200 font-bold shadow-lg hover:bg-slate-600 cursor-pointer"
            >
              ✕
            </button>
            <div className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <h2 className="text-xl font-black uppercase tracking-wide text-white">How To Play</h2>
              <p className="mt-3 text-sm text-slate-300 leading-6">
                Spin the wheel to draw a stat, place your bet, then pick the coaster you think wins the duel.
                You start with {START_BANK} points and can bet up to 100 each round. The round multiplier
                cuts both ways: wins pay your bet times it, and losses cost the same. Survive all {ROUNDS}{" "}
                rounds with the biggest bank you can, and don&apos;t go bust.
              </p>
              <div className="mt-5 flex flex-col gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-400">
                {TIERS.map((t) => {
                  const rounds = roundsForTier(t);
                  const label = rounds.length > 1 ? `rounds ${rounds[0]}–${rounds[rounds.length - 1]}` : `round ${rounds[0]}`;
                  return (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="w-24" style={{ color: t.color }}>{t.name}</span>
                      <span className="text-slate-500 normal-case font-medium tracking-normal">
                        {label} · wins pay ×{t.mult}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* end overlay */}
      {phase === "end" && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl px-8 py-7 text-center shadow-2xl max-w-[90vw]">
            <div className="text-3xl font-black text-slate-100">
              {bank <= 0 ? "💥 BUST" : `🏁 ${bank}`}
            </div>
            <div className="text-[13px] text-slate-400 mt-1.5">
              {bank <= 0 ? "The bank took everything." : bank > START_BANK ? `Started with ${START_BANK} — nice work.` : `Started with ${START_BANK} — ouch.`}
            </div>
            <div className="mt-4 inline-block text-left font-mono text-[13px] bg-[#0b1428] rounded-xl px-4 py-3 whitespace-pre text-slate-200">
              {`Rankle 🎰\n${history.map((h) => (h ? "🟩" : "🟥")).join("")}\nBank: ${Math.max(0, bank)}`}
            </div>
            <div className="mt-5">
              <button
                onClick={restart}
                className="px-8 py-3 rounded-full font-black text-sm tracking-wide bg-gradient-to-br from-[#e9820e] to-[#d46f00] text-slate-950 shadow-[0_4px_18px_rgba(233,130,14,0.4)] cursor-pointer active:scale-95"
              >
                SPIN AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
