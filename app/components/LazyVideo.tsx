"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { inlineUrl, posterUrl } from "@/app/lib/videoFiles";

/**
 * A clip in the page. It shows its poster frame and starts by itself, muted and
 * looping, when it scrolls into view, playing the 1080 px copy; scrolled away it
 * pauses. Nothing of a clip that is never on screen is downloaded. Fullscreen
 * switches to the clip at its full size.
 *
 * A clip from before the transcoding (no poster, so no 1080 px copy either) does
 * not start by itself: raw phone clips are 50–120 MB each and once put over a
 * gigabyte on one park page. It shows a play button and plays the clip on a click.
 */
export default function LazyVideo({ src, className = "", style, ...rest }: { src: string } & Omit<VideoHTMLAttributes<HTMLVideoElement>, "src">) {
  const [playing, setPlaying] = useState(false);
  // The poster is made together with the 1080 px copy: its arrival says the copy exists.
  const [posterOk, setPosterOk] = useState(false);
  const [inView, setInView] = useState(false);
  const [file, setFile] = useState(() => inlineUrl(src));
  const rootRef = useRef<HTMLElement | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);

  // A cached poster can be complete before its load handler is attached.
  useEffect(() => { const p = posterRef.current; if (p && p.complete && p.naturalWidth > 0) setPosterOk(true); }, []);

  // Whichever element is the clip's box right now, watch whether it is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [playing]);

  // Converted clips start on their own the first time they come into view.
  useEffect(() => { if (inView && posterOk) setPlaying(true); }, [inView, posterOk]);

  // Once started: play while on screen, pause while away.
  useEffect(() => {
    const v = rootRef.current as HTMLVideoElement | null;
    if (!playing || !v || v.tagName !== "VIDEO") return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [playing, inView]);

  if (playing) {
    return (
      <video
        ref={(el) => { rootRef.current = el; }}
        src={file}
        poster={posterUrl(src)}
        muted loop autoPlay playsInline controls preload="auto"
        // No 1080 px copy after all: the clip itself plays.
        onError={() => { if (file !== src) setFile(src); }}
        // Fullscreen is the whole screen: play the clip at its full size there (a 4K clip stays 4K).
        onPlay={(e) => {
          const v = e.currentTarget;
          v.onfullscreenchange = () => { if (document.fullscreenElement === v && file !== src) { const t = v.currentTime; setFile(src); v.currentTime = t; } };
        }}
        className={className}
        style={style}
        {...rest}
      />
    );
  }
  return (
    <button ref={(el) => { rootRef.current = el; }} type="button" onClick={() => setPlaying(true)} aria-label="Play the clip" className={`${className} group cursor-pointer bg-black`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={posterRef} src={posterUrl(src)} alt="" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={style ? { objectPosition: (style as { objectPosition?: string }).objectPosition } : undefined}
        onLoad={() => setPosterOk(true)} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      {!posterOk && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-black/55 group-hover:bg-black/70 transition-colors flex items-center justify-center">
            <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      )}
    </button>
  );
}
