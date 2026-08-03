"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiCoaster } from "./RankleClient";

/**
 * The Rankle bonus round: after surviving all five duels the player can cash
 * out, or put the entire bank on one estimate. A photo reel draws a coaster,
 * one question with a slider and 15 seconds, then a cinematic reveal where the
 * answer climbs a scale toward the player's locked guess.
 *
 * The target pick consumes the seeded daily RNG, so every player faces the
 * same coaster and question. Reel decoys are cosmetic and unseeded.
 */

type AiMetric = {
  key: string;
  q: string;
  short: string;
  unit: string;
  lo: number;
  hi: number;
  get: (c: ApiCoaster) => number | null;
};

// values come from the API as-is (imperial), so the questions ask in mph/ft.
// fixed ranges per metric: identical every day, so the slider never leaks the answer
const AI_METRICS: AiMetric[] = [
  { key: "speed",  q: "How <hl>fast</hl> is {name}?",         short: "top speed",    unit: "mph", lo: 10,  hi: 100,  get: (c) => c.specs?.speed ?? null },
  { key: "height", q: "How <hl>tall</hl> is {name}?",         short: "height",       unit: "ft",  lo: 10,  hi: 280,  get: (c) => c.specs?.height ?? null },
  { key: "length", q: "What <hl>length</hl> is {name}?",      short: "track length", unit: "ft",  lo: 500, hi: 6000, get: (c) => c.specs?.length ?? null },
  { key: "year",   q: "What <hl>year</hl> was {name} built?", short: "opening year", unit: "",    lo: 1910, hi: 2026, get: (c) => c.year },
];

// payout bands, tightest first — rel = fraction of the true value, yr = years
const PAYOUTS = [
  { mult: 3,   rel: 0.02, yr: 0, label: "SPOT ON: ×3!",        color: "#4ade80" },
  { mult: 2,   rel: 0.06, yr: 1, label: "VERY CLOSE: ×2",      color: "#a3e635" },
  { mult: 1.5, rel: 0.13, yr: 3, label: "CLOSE: ×1.5",         color: "#facc15" },
  { mult: 1,   rel: 0.25, yr: 8, label: "BALLPARK: BANK SAFE", color: "#fb923c" },
];
const BUST_COLOR = "#f87171";

const BLOCK = 13, REPEATS = 6, TIDX = 9, TIMER_MS = 15000;

export type AllInResolution = {
  mult: number;
  guess: number;
  actual: number;
  metricKey: string;
  coasterName: string;
};

type Target = { m: AiMetric; c: ApiCoaster; v: number; img: string };

function reelGeo() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
    ? { W: 440, H: 560, TILE: 168 }
    : { W: Math.min(360, (typeof window !== "undefined" ? window.innerWidth : 360) - 28), H: 510, TILE: 150 };
}

// same particle burst as the main game's win celebration
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

const fmtVal = (m: AiMetric, v: number) =>
  m.key === "year" ? String(Math.round(v)) : Math.round(v).toLocaleString("en-GB");

export function AllInRound({
  pool,
  bank,
  rng,
  fetchImage,
  onCashOut,
  onResolved,
}: {
  pool: ApiCoaster[];
  bank: number;
  rng: () => number;
  fetchImage: (c: ApiCoaster) => Promise<string | null>;
  onCashOut: () => void;
  onResolved: (r: AllInResolution) => void;
}) {
  const [stage, setStage] = useState<"choice" | "reel" | "question" | "reveal">("choice");
  const [ready, setReady] = useState(false);
  const [geo, setGeo] = useState(() => reelGeo());
  const [blockTiles, setBlockTiles] = useState<{ id: number; name: string; parkName: string; img: string }[]>([]);
  const [guess, setGuess] = useState(0);
  const [locked, setLocked] = useState(false);
  const [fading, setFading] = useState(false);
  const [verdict, setVerdict] = useState<{ label: string; color: string } | null>(null);
  const [bankLine, setBankLine] = useState<string | null>(null);

  const targetRef = useRef<Target | null>(null);
  const decoysRef = useRef<{ c: ApiCoaster; img: string }[]>([]);
  const thumbsRef = useRef<Record<number, string>>({});
  const preparedRef = useRef(false);
  const resolvedRef = useRef(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const shadeTopRef = useRef<HTMLDivElement>(null);
  const shadeBotRef = useRef<HTMLDivElement>(null);
  const curOffsetRef = useRef(0);
  const spinStateRef = useRef<"idle" | "armed" | "spinning">("idle");
  const dragRef = useRef<{ startY: number; baseOff: number; lastY: number; lastT: number; vel: number; moved: number } | null>(null);

  const timerFillRef = useRef<HTMLDivElement>(null);
  const timerTextRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef(0);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedRef = useRef(false);
  const guessRef = useRef(0);

  const bigNumRef = useRef<HTMLDivElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);
  const flagNumRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const sloRef = useRef<HTMLDivElement>(null);
  const shiRef = useRef<HTMLDivElement>(null);
  const scorezoneRef = useRef<HTMLDivElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);
  const bandsRef = useRef<(HTMLDivElement | null)[]>([]);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    if (timerIdRef.current) clearInterval(timerIdRef.current);
  }, []);

  // ── prepare: seeded target + cosmetic decoys + reel thumbnails ────────────
  useEffect(() => {
    if (preparedRef.current || !pool.length) return;
    preparedRef.current = true;
    // consume the seeded stream synchronously so every player draws the same target
    const cands: { m: AiMetric; c: ApiCoaster; v: number }[] = [];
    for (let t = 0; t < 120 && cands.length < 25; t++) {
      const m = AI_METRICS[Math.floor(rng() * AI_METRICS.length)];
      const c = pool[Math.floor(rng() * pool.length)];
      const v = m.get(c);
      if (v != null && v > 0 && v >= m.lo && v <= m.hi) cands.push({ m, c, v });
    }
    (async () => {
      // image availability is server-consistent, so "first candidate with an
      // image" is still the same pick for everyone
      let target: Target | null = null;
      for (const cand of cands) {
        const img = await fetchImage(cand.c);
        if (img) { target = { ...cand, img }; break; }
      }
      if (!target) { onCashOut(); return; } // no viable target: bank the points
      targetRef.current = target;

      const others = pool.filter((c) => c.id !== target.c.id);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const fetched = await Promise.all(
        others.slice(0, 26).map(async (c) => ({ c, img: await fetchImage(c) }))
      );
      decoysRef.current = fetched.filter((d): d is { c: ApiCoaster; img: string } => !!d.img).slice(0, 12);

      // downscale reel thumbnails — decoding dozens of full-res photos into a
      // transform-animated strip stutters on phones
      const thumb = (id: number, url: string) =>
        new Promise<void>((res) => {
          const i = new Image();
          i.crossOrigin = "anonymous";
          i.onload = () => {
            try {
              const w = 400;
              const h = Math.max(1, Math.round(i.naturalHeight * (w / i.naturalWidth)));
              const cv = document.createElement("canvas");
              cv.width = w; cv.height = h;
              cv.getContext("2d")?.drawImage(i, 0, 0, w, h);
              thumbsRef.current[id] = cv.toDataURL("image/jpeg", 0.72);
            } catch {} // CORS taint: tiles fall back to the original URL
            res();
          };
          i.onerror = () => res();
          i.src = url;
        });
      await Promise.all([
        thumb(target.c.id, target.img),
        ...decoysRef.current.map((d) => thumb(d.c.id, d.img)),
      ]);
      setReady(true);
    })();
  }, [pool, rng, fetchImage, onCashOut]);

  const tileImg = (id: number, url: string) => thumbsRef.current[id] ?? url;

  // ── stage 1 -> 2: build the looping strip and arm the reel ────────────────
  const goAllIn = () => {
    const t = targetRef.current;
    if (!t || !ready) return;
    const ds = decoysRef.current.slice();
    while (ds.length < 12 && ds.length > 0) ds.push(ds[ds.length % decoysRef.current.length]);
    const block = ds.slice(0, 12).map((d) => ({ id: d.c.id, name: d.c.name, parkName: d.c.parkName, img: tileImg(d.c.id, d.img) }));
    block.splice(TIDX, 0, { id: t.c.id, name: t.c.name, parkName: t.c.parkName, img: tileImg(t.c.id, t.img) });
    const g = reelGeo();
    setGeo(g);
    setBlockTiles(block);
    setStage("reel");
  };

  const setStrip = useCallback((transition: string, off: number) => {
    const s = stripRef.current;
    if (!s) return;
    s.style.transition = transition;
    s.style.transform = `translateY(-${off}px)`;
    curOffsetRef.current = off;
  }, []);

  useEffect(() => {
    if (stage !== "reel" || !blockTiles.length) return;
    const { H, TILE } = geo;
    const winTop = (H - TILE) / 2;
    // anchor mid-strip, a few tiles away from a target instance
    const startTile = Math.floor(REPEATS / 2) * BLOCK + ((TIDX + 7) % BLOCK);
    setStrip("none", startTile * TILE - winTop);
    spinStateRef.current = "armed";
  }, [stage, blockTiles, geo, setStrip]);

  // ── reel spin: flick is a trigger, every spin runs at the same speed ──────
  const launchSpin = useCallback((dir: 1 | -1, windup: boolean) => {
    if (spinStateRef.current !== "armed") return;
    spinStateRef.current = "spinning";
    const strip = stripRef.current;
    if (!strip) return;
    const { H, TILE } = geo;
    const winTop = (H - TILE) / 2;
    const curTile = Math.round((curOffsetRef.current + winTop) / TILE);
    const travel = 34;
    let targetTile: number;
    if (dir === 1) {
      targetTile = curTile - travel;
      targetTile -= (((targetTile % BLOCK) - TIDX) % BLOCK + BLOCK) % BLOCK;
      while (targetTile < 3) targetTile += BLOCK;
    } else {
      targetTile = curTile + travel;
      targetTile += ((TIDX - (targetTile % BLOCK)) % BLOCK + BLOCK) % BLOCK;
      while (targetTile > REPEATS * BLOCK - 4) targetTile -= BLOCK;
    }
    const from = curOffsetRef.current;
    const offset = targetTile * TILE - winTop;
    const D = offset - from;
    // random finish: fly past + spring back / stop short + creep in / clean stop
    const r = Math.random();
    const endMode = r < 0.38 ? "over" : r < 0.72 ? "creep" : "clean";
    const extra = endMode === "over" ? TILE * (0.18 + Math.random() * 0.3)
                : endMode === "creep" ? -TILE * (0.16 + Math.random() * 0.24)
                : 0;
    const stopAt = offset - dir * extra;

    // ONE continuous transition launch->stop: chaining transitions via timers
    // dead-stops the reel for a beat whenever a handoff timer fires late
    const useBlur = window.matchMedia("(min-width: 768px)").matches;
    let t = 0, start = from, v0: number;
    if (windup) {
      setStrip("transform 0.55s cubic-bezier(0.6, 0.05, 0.85, 0.4)", from + D * 0.12);
      t = 560;
      start = from + D * 0.12;
      v0 = (4 * Math.abs(D * 0.12)) / 550;
    } else {
      v0 = 3; // uniform launch speed: the flick only picks the direction
      void strip.offsetHeight;
    }
    const mainDist = Math.max(1, Math.abs(stopAt - start));
    const T = 5900 + Math.random() * 700;
    const slope = (v0 * T) / mainDist;
    const x1 = Math.max(0.06, Math.min(0.42, 1 / slope));
    const y1 = Math.min(1, slope * x1);
    const launch = () =>
      setStrip(`transform ${Math.round(T)}ms cubic-bezier(${x1.toFixed(3)}, ${y1.toFixed(3)}, 0.28, 0.985)`, stopAt);
    if (windup) later(launch, t);
    else launch();
    if (useBlur) {
      later(() => { if (stripRef.current) stripRef.current.style.filter = "blur(2px)"; }, t + 80);
      later(() => { if (stripRef.current) stripRef.current.style.filter = ""; }, t + T * 0.45);
    }
    const stopTime = t + T;
    let landAt: number;
    if (endMode === "over") {
      later(() => setStrip("transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)", offset), stopTime + 130);
      landAt = stopTime + 700;
    } else if (endMode === "creep") {
      later(() => setStrip("transform 0.9s cubic-bezier(0.3, 0.55, 0.15, 1)", offset), stopTime + 360);
      landAt = stopTime + 1280;
    } else {
      landAt = stopTime + 60;
    }
    // snap exact, then spotlight the winner: everything else falls dark
    later(() => {
      setStrip("none", offset);
      if (shadeTopRef.current) shadeTopRef.current.style.opacity = "1";
      if (shadeBotRef.current) shadeBotRef.current.style.opacity = "1";
      const tile = stripRef.current?.children[targetTile] as HTMLElement | undefined;
      const ph = tile?.firstElementChild as HTMLElement | undefined;
      if (ph) ph.style.filter = "brightness(1.08) saturate(1.06)";
    }, landAt);
    later(() => beginQuestion(), landAt + 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, later, setStrip]);

  const onReelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (spinStateRef.current !== "armed") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { startY: e.clientY, baseOff: curOffsetRef.current, lastY: e.clientY, lastT: performance.now(), vel: 0, moved: 0 };
  };
  const onReelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || spinStateRef.current !== "armed") return;
    const dy = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(dy));
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.vel = 0.8 * d.vel + 0.2 * ((e.clientY - d.lastY) / dt);
    d.lastY = e.clientY;
    d.lastT = now;
    const off = Math.min((REPEATS * BLOCK - 4) * geo.TILE, Math.max(3 * geo.TILE, d.baseOff - dy));
    setStrip("none", off);
  };
  const onReelPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || spinStateRef.current !== "armed") return;
    if (d.moved < 8) { launchSpin(1, true); return; } // a plain tap pulls the lever
    launchSpin(d.vel >= 0 ? 1 : -1, false);
  };

  // ── stage 3: the question ─────────────────────────────────────────────────
  const beginQuestion = useCallback(() => {
    const t = targetRef.current;
    if (!t) return;
    const mid = Math.round((t.m.lo + t.m.hi) / 2);
    guessRef.current = mid;
    setGuess(mid);
    setLocked(false);
    lockedRef.current = false;
    setFading(false);
    setStage("question");
    deadlineRef.current = performance.now() + TIMER_MS;
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    timerIdRef.current = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - performance.now());
      if (timerFillRef.current) timerFillRef.current.style.transform = `scaleX(${left / TIMER_MS})`;
      if (timerTextRef.current) {
        timerTextRef.current.textContent = (left / 1000).toFixed(1) + "s";
        timerTextRef.current.className = `mt-1.5 text-[13px] font-black tabular-nums ${left < 5000 ? "text-red-400 animate-pulse" : "text-slate-400"}`;
      }
      // time's up: the guess is wherever the slider sits right now
      if (left <= 0) {
        if (timerIdRef.current) clearInterval(timerIdRef.current);
        if (!lockedRef.current) lockIn(true);
      }
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGuessBoth = (v: number) => {
    guessRef.current = v;
    setGuess(v);
  };

  // hold-to-repeat fine tuning
  const holdRef = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const nudge = (dir: number) => {
    if (lockedRef.current) return;
    const t = targetRef.current!;
    setGuessBoth(Math.max(t.m.lo, Math.min(t.m.hi, guessRef.current + dir)));
  };
  const holdStart = (dir: number) => {
    nudge(dir);
    holdRef.current.t = setTimeout(() => {
      holdRef.current.i = setInterval(() => nudge(dir), 60);
    }, 400);
  };
  const holdStop = () => {
    if (holdRef.current.t) clearTimeout(holdRef.current.t);
    if (holdRef.current.i) clearInterval(holdRef.current.i);
    holdRef.current = {};
  };

  const lockIn = (timedOut = false) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setLocked(true);
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    void timedOut;
    later(() => setFading(true), 900);
    later(() => beginReveal(guessRef.current), 1450);
  };

  // ── stage 4: the cinematic reveal ─────────────────────────────────────────
  const beginReveal = (finalGuess: number) => {
    const t = targetRef.current;
    if (!t) return;
    const { m, v } = t;
    setStage("reveal");
    setVerdict(null);
    setBankLine(null);

    const view = { min: m.lo, max: m.hi };
    const pct = (val: number) => Math.max(0, Math.min(100, ((val - view.min) / (view.max - view.min)) * 100));
    const half = (p: (typeof PAYOUTS)[number]) => (m.key === "year" ? Math.max(p.yr, 0.4) : v * p.rel);

    const layout = () => {
      PAYOUTS.forEach((p, i) => {
        const el = bandsRef.current[i];
        if (!el) return;
        el.style.left = pct(v - half(p)) + "%";
        el.style.width = pct(v + half(p)) - pct(v - half(p)) + "%";
      });
      if (flagRef.current) flagRef.current.style.left = pct(finalGuess) + "%";
      if (pointerRef.current && pointerVal != null) pointerRef.current.style.left = pct(pointerVal) + "%";
      if (sloRef.current) sloRef.current.textContent = fmtVal(m, view.min) + (m.unit ? " " + m.unit : "");
      if (shiRef.current) shiRef.current.textContent = fmtVal(m, view.max) + (m.unit ? " " + m.unit : "");
    };
    let pointerVal: number | null = null;

    later(() => {
      // initial paint after the stage renders
      PAYOUTS.forEach((_, i) => { const el = bandsRef.current[i]; if (el) el.style.opacity = "0"; });
      if (sloRef.current) sloRef.current.style.opacity = "";
      if (shiRef.current) shiRef.current.style.opacity = "";
      if (flagNumRef.current) flagNumRef.current.textContent = fmtVal(m, finalGuess);
      if (flagRef.current) { flagRef.current.style.opacity = "0"; }
      if (pointerRef.current) { pointerRef.current.style.opacity = "0"; pointerRef.current.style.left = "0%"; }
      if (bigNumRef.current) { bigNumRef.current.textContent = "?"; bigNumRef.current.style.color = "#334155"; }
      if (scorezoneRef.current) scorezoneRef.current.style.opacity = "0";
      layout();
    }, 30);

    // beat 1: plant the player's flag exactly where the slider thumb was
    later(() => {
      if (!flagRef.current) return;
      flagRef.current.style.opacity = "1";
      flagRef.current.animate(
        [
          { opacity: 0, transform: "translateX(-50%) translateY(-16px)" },
          { opacity: 1, transform: "translateX(-50%) translateY(0)" },
        ],
        { duration: 500, easing: "cubic-bezier(0.34,1.56,0.64,1)", fill: "forwards" }
      );
    }, 500);

    // beat 2: the crawl — always grows up from the left
    const DUR = 4600, CRAWL_START = 1400;
    const unit = m.unit ? ` ${m.unit}` : "";
    later(() => {
      if (pointerRef.current) pointerRef.current.style.opacity = "1";
      if (bigNumRef.current) bigNumRef.current.style.color = "";
      const t0 = performance.now();
      const ease = (p: number) => 1 - Math.pow(2, -10.5 * p);
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / DUR);
        const e = p >= 1 ? 1 : ease(p);
        pointerVal = m.lo + (v - m.lo) * e;
        if (bigNumRef.current) bigNumRef.current.textContent = fmtVal(m, pointerVal) + unit;
        layout();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, CRAWL_START);

    // beat 3: photo-finish zoom into the answer, flag and pointer riding along
    const LAND = CRAWL_START + DUR;
    const ZOOM_DUR = 1400;
    later(() => {
      if (sloRef.current) sloRef.current.style.opacity = "0";
      if (shiRef.current) shiRef.current.style.opacity = "0";
      let zs = m.key === "year" ? 14 : v * 0.45;
      const need = Math.abs(finalGuess - v) * 1.15;
      zs = Math.max(zs, Math.min(need, m.key === "year" ? 45 : v * 0.95));
      const fromView = { min: view.min, max: view.max };
      const toView = { min: v - zs, max: v + zs };
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ZOOM_DUR);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        view.min = fromView.min + (toView.min - fromView.min) * e;
        view.max = fromView.max + (toView.max - fromView.max) * e;
        layout();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, LAND + 800);

    // beat 4: bands fade in widest -> tightest, score zone, then the verdict
    PAYOUTS.slice().reverse().forEach((p, i) => {
      later(() => {
        const el = bandsRef.current[PAYOUTS.length - 1 - i];
        if (el) el.style.opacity = "1";
      }, LAND + 800 + ZOOM_DUR - 300 + i * 180);
    });
    const outer = half(PAYOUTS[PAYOUTS.length - 1]);
    const nice = (x: number) => {
      if (m.key === "year") return String(Math.round(x));
      const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(x) || 1)) - 1));
      return (Math.round(x / mag) * mag).toLocaleString("en-GB");
    };
    later(() => {
      if (!scorezoneRef.current) return;
      scorezoneRef.current.innerHTML =
        `Acceptable range <b style="color:#fb923c">${nice(v - outer)} to ${nice(v + outer)}${m.unit ? " " + m.unit : ""}</b>`;
      scorezoneRef.current.style.opacity = "1";
    }, LAND + 800 + ZOOM_DUR - 300 + PAYOUTS.length * 180);

    later(() => {
      const diff = Math.abs(finalGuess - v);
      let hit: (typeof PAYOUTS)[number] | null = null;
      for (const p of PAYOUTS) { if (diff <= half(p)) { hit = p; break; } }
      const mult = hit ? hit.mult : 0;
      const newBank = Math.round(bank * mult);
      setVerdict({ label: hit ? hit.label : "YOU BUSTED", color: hit ? hit.color : BUST_COLOR });
      setBankLine(mult === 1 ? `Bank stays at ${bank}` : `Bank: ${bank} → ${newBank}`);
      if (mult >= 1.5) later(() => { if (verdictRef.current) burstFrom(verdictRef.current); }, 150);
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        later(() => onResolved({ mult, guess: finalGuess, actual: v, metricKey: m.key, coasterName: t.c.name }), 2200);
      }
    }, LAND + 800 + ZOOM_DUR + PAYOUTS.length * 180 + 400);
  };

  // ── render ────────────────────────────────────────────────────────────────
  const t = targetRef.current;
  const winTop = (geo.H - geo.TILE) / 2;
  const questionHtml = t
    ? t.m.q.replace("{name}", t.c.name).replaceAll("<hl>", '<span class="text-brand">').replaceAll("</hl>", "</span>")
    : "";

  return (
    <div className="w-full flex flex-col items-center" style={{ animation: "rankle-rise 0.5s ease both" }}>
      {/* stage 1: the choice */}
      {stage === "choice" && (
        <div className="flex flex-col items-center gap-4 mt-8 md:mt-12 text-center px-4">
          <h2 className="text-3xl md:text-4xl font-black text-slate-100">Cash out or go all in?</h2>
          <p className="text-sm md:text-[15px] text-slate-400 max-w-md leading-relaxed">
            This round is <b className="text-slate-200">all or nothing</b>. One coaster, one question, 15 seconds.
            The closer your guess, the more you win. Good luck.
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
            {PAYOUTS.map((p) => (
              <span key={p.mult} className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.color }} />
                {p.mult === 3 ? "spot on ×3" : p.mult === 2 ? "very close ×2" : p.mult === 1.5 ? "close ×1.5" : "ballpark ×1"}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: BUST_COLOR }} />
              miss = 0
            </span>
          </div>
          <div className="flex gap-3.5 mt-3 flex-wrap justify-center">
            <button
              onClick={onCashOut}
              className="px-8 py-3.5 rounded-2xl font-black text-[15px] tracking-wide border-[1.5px] border-slate-600 text-slate-300 hover:border-slate-400 active:scale-95 transition cursor-pointer"
            >
              💰 CASH OUT
            </button>
            <button
              onClick={goAllIn}
              disabled={!ready}
              className="px-8 py-3.5 rounded-2xl font-black text-[15px] tracking-wide bg-gradient-to-br from-[#e9820e] to-[#d46f00] text-slate-950 shadow-[0_8px_30px_rgba(233,130,14,0.4)] active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              style={ready ? { animation: "allin-pulse 1.6s ease-in-out infinite" } : undefined}
            >
              {ready ? "🎢 ALL IN" : "Loading…"}
            </button>
          </div>
          <style>{`@keyframes allin-pulse { 0%,100%{box-shadow:0 8px 30px rgba(233,130,14,0.4)} 50%{box-shadow:0 8px 46px rgba(233,130,14,0.75)} }`}</style>
        </div>
      )}

      {/* stage 2: the coaster reel */}
      {stage === "reel" && (
        <div className="flex flex-col items-center mt-5" style={{ animation: "rankle-rise 0.5s ease both" }}>
          <div className="text-[11px] tracking-[3px] uppercase text-slate-400 font-bold mb-3.5">
            {spinStateRef.current === "spinning" ? "Drawing your coaster…" : "Flick the reel to spin"}
          </div>
          <div
            onPointerDown={onReelPointerDown}
            onPointerMove={onReelPointerMove}
            onPointerUp={onReelPointerUp}
            onPointerCancel={onReelPointerUp}
            className="relative rounded-2xl bg-[#0b1428] border-2 border-brand/70 overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-[0_16px_44px_rgba(0,0,0,0.45),0_0_34px_rgba(233,130,14,0.28),inset_0_0_34px_rgba(0,0,0,0.6)]"
            style={{ width: geo.W, height: geo.H, touchAction: "none" }}
          >
            {/* top/bottom fades */}
            <div className="absolute inset-x-0 top-0 h-[35%] z-[3] pointer-events-none bg-gradient-to-b from-[#0b1428] via-[#0b1428d9] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[35%] z-[3] pointer-events-none bg-gradient-to-t from-[#0b1428] via-[#0b1428d9] to-transparent" />
            {/* spotlight shades: fade in on landing */}
            <div ref={shadeTopRef} className="absolute inset-x-0 z-[4] pointer-events-none transition-opacity duration-[650ms]" style={{ top: 0, height: winTop, background: "rgba(5,11,26,0.82)", opacity: 0 }} />
            <div ref={shadeBotRef} className="absolute inset-x-0 z-[4] pointer-events-none transition-opacity duration-[650ms]" style={{ top: winTop + geo.TILE, bottom: 0, background: "rgba(5,11,26,0.82)", opacity: 0 }} />
            <div ref={stripRef} className="absolute will-change-transform" style={{ left: 5, right: 5, top: 0 }}>
              {Array.from({ length: REPEATS }).flatMap((_, rep) =>
                blockTiles.map((tile, bi) => (
                  <div key={`${rep}-${bi}`} className="py-1" style={{ height: geo.TILE }}>
                    <div
                      className="relative h-full rounded-[10px] overflow-hidden bg-slate-800 bg-cover bg-center transition-[filter] duration-500"
                      style={{ backgroundImage: `url('${tile.img}')` }}
                    >
                      <div className="absolute inset-x-0 bottom-0 pt-6 pb-2 px-3 bg-gradient-to-t from-black/85 to-transparent">
                        <div className="text-[15px] md:text-lg font-black leading-tight drop-shadow-md">{tile.name}</div>
                        <div className="text-[10.5px] md:text-xs text-white/65 font-medium mt-0.5">{tile.parkName}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* stage 3: the question */}
      {stage === "question" && t && (
        <div
          className={`flex flex-col items-center mt-3 w-full px-3 transition-all duration-[450ms] ${fading ? "opacity-0 -translate-y-3 scale-[0.97] pointer-events-none" : ""}`}
          style={{ animation: "rankle-rise 0.5s ease both" }}
        >
          <div className="relative w-full max-w-[340px] md:max-w-[480px] h-[195px] md:h-[300px] rounded-2xl overflow-hidden bg-gray-900 shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.img} alt={t.c.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute top-0 inset-x-0 px-3.5 pt-2.5 pb-10 bg-gradient-to-b from-black/70 to-transparent">
              <span className="text-[12.5px] font-bold text-white/90 drop-shadow">{t.c.parkName}{t.c.country ? ` · ${t.c.country}` : ""}</span>
            </div>
            <div className="absolute bottom-0 inset-x-0 px-3.5 pt-8 pb-3 bg-gradient-to-t from-black/90 via-black/55 to-transparent">
              <h3 className="text-[21px] md:text-[28px] font-black leading-tight drop-shadow-md">{t.c.name}</h3>
              {t.c.manufacturerName && <div className="text-[10.5px] text-white/60 mt-0.5">{t.c.manufacturerName}</div>}
            </div>
          </div>
          <div
            className="mt-3.5 text-[22px] md:text-3xl font-black leading-tight text-center text-slate-100"
            dangerouslySetInnerHTML={{ __html: questionHtml }}
          />
          <div className="w-full max-w-[400px] md:max-w-[560px] mt-2.5 flex flex-col items-center">
            <div className={`text-[44px] md:text-6xl font-black leading-none tabular-nums transition-colors duration-300 ${locked ? "text-blue-400" : "text-brand-light"}`}>
              {fmtVal(t.m, guess)}
              {t.m.unit && <span className="text-[17px] md:text-2xl text-slate-400 font-bold ml-1">{t.m.unit}</span>}
            </div>
            {locked && (
              <div className="mt-1.5 text-[10px] font-black tracking-[2.5px] uppercase text-blue-400 border-[1.5px] border-blue-400/50 rounded-full px-3.5 py-1" style={{ animation: "rankle-rise 0.3s ease both" }}>
                Locked in
              </div>
            )}
            <div className="flex items-center gap-3 w-full mt-3">
              <button
                onPointerDown={(e) => { e.preventDefault(); holdStart(-1); }}
                onPointerUp={holdStop}
                onPointerLeave={holdStop}
                onPointerCancel={holdStop}
                disabled={locked}
                className="min-w-[46px] h-9 rounded-full bg-slate-800 border-[1.5px] border-slate-600 text-slate-300 text-[13px] font-black hover:border-brand hover:text-brand-light active:scale-95 cursor-pointer px-2.5"
              >
                −1
              </button>
              <input
                type="range"
                min={t.m.lo}
                max={t.m.hi}
                step={1}
                value={guess}
                disabled={locked}
                onChange={(e) => setGuessBoth(parseInt(e.target.value))}
                className="flex-1 accent-[#e9820e]"
              />
              <button
                onPointerDown={(e) => { e.preventDefault(); holdStart(1); }}
                onPointerUp={holdStop}
                onPointerLeave={holdStop}
                onPointerCancel={holdStop}
                disabled={locked}
                className="min-w-[46px] h-9 rounded-full bg-slate-800 border-[1.5px] border-slate-600 text-slate-300 text-[13px] font-black hover:border-brand hover:text-brand-light active:scale-95 cursor-pointer px-2.5"
              >
                +1
              </button>
            </div>
            <div className="flex justify-between w-full px-[50px] mt-1 text-[11px] font-bold text-slate-600 tabular-nums">
              <span>{fmtVal(t.m, t.m.lo)}{t.m.unit ? ` ${t.m.unit}` : ""}</span>
              <span>{fmtVal(t.m, t.m.hi)}{t.m.unit ? ` ${t.m.unit}` : ""}</span>
            </div>
            <button
              onClick={() => lockIn()}
              disabled={locked}
              className="mt-3.5 px-11 py-3 rounded-full font-black text-[14px] md:text-[15px] tracking-wide bg-gradient-to-br from-[#e9820e] to-[#d46f00] text-slate-950 shadow-[0_4px_18px_rgba(233,130,14,0.4)] active:scale-95 cursor-pointer disabled:grayscale-[0.5] disabled:brightness-75 disabled:cursor-default"
            >
              {locked ? "LOCKED ✓" : "LOCK IT IN 🔒"}
            </button>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3.5 w-full max-w-[340px] md:max-w-[480px]">
              <div ref={timerFillRef} className="h-full w-full rounded-full origin-left bg-gradient-to-r from-green-400 via-yellow-400 to-red-400" />
            </div>
            <div ref={timerTextRef} className="mt-1.5 text-[13px] font-black tabular-nums text-slate-400">15.0s</div>
          </div>
        </div>
      )}

      {/* stage 4: the reveal */}
      {stage === "reveal" && t && (
        <div className="w-full max-w-[520px] md:max-w-[680px] mt-6 md:mt-8 flex flex-col items-center px-3" style={{ animation: "rankle-rise 0.5s ease both" }}>
          <div className="text-[11px] tracking-[3px] uppercase text-slate-400 font-bold">The answer</div>
          <div className="mt-1.5 text-[15px] font-bold text-slate-300 text-center">
            <b className="text-brand-light">{t.c.name}</b> · {t.m.short}
          </div>
          <div ref={bigNumRef} className="mt-4 text-[54px] md:text-[76px] font-black leading-tight min-h-[64px] md:min-h-[88px] tabular-nums drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">?</div>
          <div className="relative h-[100px] mt-4" style={{ width: "calc(100% - 72px)" }}>
            <div className="absolute left-0 right-0 h-[9px] rounded-[5px] bg-slate-800" style={{ top: 46 }} />
            <div ref={sloRef} className="absolute left-0 text-[11px] font-bold text-slate-500 tabular-nums transition-opacity duration-[400ms]" style={{ top: 26 }} />
            <div ref={shiRef} className="absolute right-0 text-right text-[11px] font-bold text-slate-500 tabular-nums transition-opacity duration-[400ms]" style={{ top: 26 }} />
            {PAYOUTS.map((p, i) => (
              <div
                key={p.mult}
                ref={(el) => { bandsRef.current[i] = el; }}
                className="absolute h-[9px] rounded-[5px] transition-opacity duration-500"
                style={{ top: 46, background: p.color, opacity: 0, zIndex: PAYOUTS.length - i }}
              />
            ))}
            <div ref={flagRef} className="absolute text-center z-10" style={{ top: 2, transform: "translateX(-50%)", opacity: 0 }}>
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-400">You</div>
              <div ref={flagNumRef} className="text-[16px] font-black text-blue-400 tabular-nums" />
              <div className="w-[3px] h-[20px] bg-blue-400 mx-auto mt-0.5 rounded-sm" />
            </div>
            <div ref={pointerRef} className="absolute text-center z-10 transition-opacity duration-300" style={{ top: 59, transform: "translateX(-50%)", left: "0%", opacity: 0 }}>
              <div className="w-[3.5px] h-[22px] mx-auto rounded-sm bg-brand shadow-[0_0_12px_rgba(233,130,14,0.7)]" />
              <div className="text-[11px] font-black uppercase tracking-wider text-brand-light mt-1">actual</div>
            </div>
          </div>
          <div ref={scorezoneRef} className="mt-0.5 text-[12.5px] font-bold text-slate-400 tabular-nums transition-opacity duration-500" style={{ opacity: 0 }} />
          <div
            ref={verdictRef}
            className="mt-5 text-[33px] md:text-[44px] font-black text-center transition-all duration-[450ms]"
            style={{
              color: verdict?.color ?? "#fff",
              opacity: verdict ? 1 : 0,
              transform: verdict ? "scale(1)" : "scale(0.6)",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {verdict?.label ?? ""}
          </div>
          <div className={`mt-2 text-base font-bold text-slate-400 transition-opacity duration-[400ms] ${bankLine ? "opacity-100" : "opacity-0"}`}>
            {bankLine ?? ""}
          </div>
        </div>
      )}
    </div>
  );
}
