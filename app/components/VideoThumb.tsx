"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Still-frame thumbnail for a video URL.
 *
 * Every `<video>` element costs a decoder and a large compositor layer, so a
 * gallery grid with several clips makes scrolling stutter. Instead, each clip is
 * decoded once (one at a time), a single frame is drawn into a small offscreen
 * canvas that is cached for the page's lifetime, and every thumbnail just copies
 * that frame into its own canvas. Cross-origin clips work because nothing is
 * ever read back out of the canvas.
 */

const SNAPSHOT_WIDTH = 480;
const snapshots = new Map<string, Promise<HTMLCanvasElement>>();
let queue: Promise<unknown> = Promise.resolve();

// Decoding a clip competes with scrolling for the GPU, so snapshots only start
// once the page has been still for a moment.
const QUIET_MS = 700;
let lastScroll = 0;
let trackingScroll = false;
function trackScroll() {
  if (trackingScroll || typeof window === "undefined") return;
  trackingScroll = true;
  window.addEventListener("scroll", () => { lastScroll = Date.now(); }, { capture: true, passive: true });
}
function whenQuiet(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const wait = QUIET_MS - (Date.now() - lastScroll);
      if (wait <= 0) resolve();
      else setTimeout(check, wait);
    };
    setTimeout(check, 400);
  });
}

/** Browsers defer media loading in hidden tabs; don't start (or time out) a snapshot until the tab is visible. */
function whenVisible(): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

export function getVideoSnapshot(src: string): Promise<HTMLCanvasElement> { return snapshot(src); }

function snapshot(src: string): Promise<HTMLCanvasElement> {
  const cached = snapshots.get(src);
  if (cached) return cached;
  trackScroll();

  const p = new Promise<HTMLCanvasElement>((resolve, reject) => {
    // Serialise decodes so a grid of clips does not open a decoder per clip.
    queue = queue.then(whenVisible).then(whenQuiet).then(() => new Promise<void>((done) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      let finished = false;

      const finish = (err?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (err) reject(err);
        video.removeAttribute("src");
        video.load(); // release the decoder
        done();
      };
      const draw = () => {
        if (finished) return;
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) { finish(new Error("no frame")); return; }
        const canvas = document.createElement("canvas");
        canvas.width = SNAPSHOT_WIDTH;
        canvas.height = Math.round(SNAPSHOT_WIDTH * (h / w));
        const ctx = canvas.getContext("2d");
        if (!ctx) { finish(new Error("no 2d context")); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
        finish();
      };
      const timer = setTimeout(() => finish(new Error("timeout")), 20000);

      video.addEventListener("error", () => finish(new Error("video error")), { once: true });
      video.addEventListener("seeked", draw, { once: true });
      video.addEventListener("loadeddata", () => {
        // Frame 0 is often black; grab a frame slightly in.
        const t = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0;
        if (t > 0) video.currentTime = t;
        else draw();
      }, { once: true });
      video.src = src;
    }));
  });
  snapshots.set(src, p);
  p.catch(() => snapshots.delete(src));
  return p;
}

export function VideoThumb({ src, className = "" }: { src: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    snapshot(src)
      .then((snap) => {
        if (!alive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = snap.width;
        canvas.height = snap.height;
        canvas.getContext("2d")?.drawImage(snap, 0, 0);
        setState("ready");
      })
      .catch(() => { if (alive) setState("failed"); });
    return () => { alive = false; };
  }, [src]);

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${state === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
      )}
    </div>
  );
}
