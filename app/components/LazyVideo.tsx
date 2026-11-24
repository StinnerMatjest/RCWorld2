"use client";

import { useState, type VideoHTMLAttributes } from "react";
import { inlineUrl, posterUrl } from "@/app/lib/videoFiles";

/**
 * A clip in the page: its poster frame with a play button, and nothing of the
 * clip itself downloaded until it is clicked. Then the 1080 px copy plays,
 * muted and looping, in place. (Clips used to autoplay as they came near the
 * screen; with raw phone clips of 50–120 MB each, a park page pulled over a
 * gigabyte for a visitor who never pressed play.)
 */
export default function LazyVideo({ src, className = "", style, ...rest }: { src: string } & Omit<VideoHTMLAttributes<HTMLVideoElement>, "src">) {
  const [playing, setPlaying] = useState(false);
  // No 1080 px copy stored (clips from before the transcoding): the clip itself plays.
  const [file, setFile] = useState(() => inlineUrl(src));
  if (playing) {
    return (
      <video
        src={file}
        poster={posterUrl(src)}
        muted loop autoPlay playsInline controls preload="auto"
        onError={() => { if (file !== src) setFile(src); }}
        className={className}
        style={style}
        {...rest}
      />
    );
  }
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label="Play the clip" className={`${className} group cursor-pointer bg-black`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterUrl(src)} alt="" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={style ? { objectPosition: (style as { objectPosition?: string }).objectPosition } : undefined} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-14 h-14 rounded-full bg-black/55 group-hover:bg-black/70 transition-colors flex items-center justify-center">
          <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </span>
    </button>
  );
}
