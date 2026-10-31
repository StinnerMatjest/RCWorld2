"use client";

import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

/**
 * A muted, looping clip that loads only once it comes near the screen and plays
 * only while it is there. autoplay starts the download whatever preload says, so a
 * page with clips in its gallery or review loaded them all with the page (Liseberg:
 * two 69 MB clips, 139 MB, before anyone scrolled to them).
 */
export default function LazyVideo({ src, ...rest }: { src: string } & Omit<VideoHTMLAttributes<HTMLVideoElement>, "src">) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); video.play().catch(() => {}); }
      else video.pause();
    }, { rootMargin: "200px" });
    io.observe(video);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={near ? src : undefined} muted loop autoPlay playsInline preload="metadata" {...rest} />;
}
