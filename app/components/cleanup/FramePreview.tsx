"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { parseFocusStr } from "@/app/components/FocusedImage";

/**
 * A photo drawn in a frame the way the site places it (FocusedImage's rule:
 * cover the frame, times the zoom, focus point at the centre, edges clamped),
 * redrawn on every change of `focus`. Used beside a crop editor so one framing
 * can be judged in several shapes at once.
 */
export default function FramePreview({ src, focus, aspect, className = "", children, onClick }: {
  src: string; focus: string | null | undefined; aspect: string; className?: string; children?: React.ReactNode; onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  let style: React.CSSProperties = { opacity: 0 };
  if (nat && box.w && box.h) {
    const { cx, cy, zoom } = parseFocusStr(focus);
    const cs = Math.max(box.w / nat.w, box.h / nat.h);
    const dw = nat.w * cs * zoom, dh = nat.h * cs * zoom;
    style = { width: dw, height: dh, left: Math.min(0, Math.max(box.w - dw, box.w / 2 - cx * dw)), top: Math.min(0, Math.max(box.h - dh, box.h / 2 - cy * dh)) };
  }
  return (
    <div ref={ref} onClick={onClick} className={`relative overflow-hidden bg-slate-950 ${className}`} style={{ aspectRatio: aspect, containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="absolute max-w-none select-none pointer-events-none" style={style}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      {children && <div className="absolute inset-0 pointer-events-none">{children}</div>}
    </div>
  );
}
