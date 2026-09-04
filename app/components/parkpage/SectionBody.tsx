"use client";

import React from "react";
import { splitMedia, parseFocusStr } from "../FocusedImage";
import { SectionImage } from "../SectionImage";
import { SECTION_IMAGE_ASPECT, resolveSectionLayout } from "@/app/utils/sectionImageAspect";
import { MarkdownText } from "../MarkdownText";
import SpoilerText from "../SpoilerText";

export const isVideoUrl = (src: string) => /\.(mp4|webm|ogg)$/i.test(src);

export interface SectionBodyProps {
  text: string;
  /** Media entries in the stored "url|cx cy zoom" form. */
  media: string[];
  layout?: string | null;
  /** Used when `layout` is empty. Leave undefined for the legacy alternating row. */
  defaultLayout?: string | null;
  /** Which side the legacy alternating row puts this section's image on. */
  fallbackRight?: boolean;
  isSpoiler?: boolean;
  isAdminMode?: boolean;
  altLabel: string;
  textClassName?: string;
  onMediaClick?: (url: string, index: number) => void;
}

/**
 * Renders one review section body (text plus zero, one or two images) in the
 * arrangement its layout asks for. The park page, the description and the
 * editor preview all render through this, so they cannot drift apart.
 */
export function SectionBody({
  text,
  media,
  layout,
  defaultLayout,
  fallbackRight = false,
  isSpoiler = false,
  isAdminMode = false,
  altLabel,
  textClassName = "text-slate-400 leading-relaxed md:text-lg",
  onMediaClick,
}: SectionBodyProps) {
  const resolved = resolveSectionLayout(layout, media.length, { defaultLayout, fallbackRight });
  const isRow = resolved.mode === "row";
  const isDouble = resolved.mode === "double";

  const renderMedia = (entry: string, index: number, isHalf = false) => {
    const { url, focus } = splitMedia(entry);
    const pan = parseFocusStr(focus);
    const a = (isRow || isHalf) ? SECTION_IMAGE_ASPECT.row : SECTION_IMAGE_ASPECT.full;
    const clickable = !!onMediaClick;
    return (
      <div
        key={`${index}-${entry}`}
        className={`${isHalf ? "flex-1 min-w-0" : "w-full flex-shrink-0"} rounded-2xl overflow-hidden group relative shadow-sm ${clickable ? "cursor-zoom-in" : ""} ${isDouble ? "mt-4 mb-4" : ""}`}
        onClick={clickable ? () => onMediaClick(url, index) : undefined}
      >
        {isVideoUrl(url) ? (
          <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: a.desktop }}>
            <video src={url} className="absolute inset-0 w-full h-full object-cover rounded-2xl" muted loop autoPlay playsInline preload="metadata" />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/55 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Video
            </span>
          </div>
        ) : (
          <SectionImage
            src={url}
            alt={altLabel}
            cx={pan.cx}
            cy={pan.cy}
            mobileAspect={a.mobile}
            desktopAspect={a.desktop}
            sizes={isRow ? "(min-width: 768px) 30vw, 100vw" : "(min-width: 768px) 60vw, 100vw"}
          />
        )}
        {clickable && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl pointer-events-none">
            {isVideoUrl(url) ? (
              <svg className="w-10 h-10 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="w-8 h-8 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6" /></svg>
            )}
          </div>
        )}
      </div>
    );
  };

  const md = (
    <MarkdownText
      text={text}
      className={`${textClassName} ${isSpoiler ? "" : "flex-1"}`}
      forceReveal={isAdminMode}
      isAdminMode={isAdminMode}
    />
  );
  const textContent = isSpoiler ? (
    <SpoilerText forceReveal={isAdminMode} block={true} isAdminMode={isAdminMode} className="flex-1">
      {md}
    </SpoilerText>
  ) : md;

  if (resolved.mode === "none") return <div>{textContent}</div>;

  if (isDouble) {
    return (
      <div>
        <div className="flex flex-col">
          {renderMedia(media[0], 0)}
          {textContent}
          {renderMedia(media[1], 1)}
        </div>
      </div>
    );
  }

  if (resolved.mode === "row") {
    return (
      <div>
        <div className={`flex flex-col gap-6 items-start ${resolved.isRight ? "md:flex-row-reverse" : "md:flex-row"}`}>
          <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col gap-4 mt-1.5">
            {media.map((entry, i) => renderMedia(entry, i))}
          </div>
          {textContent}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={`flex gap-4 ${resolved.isAbove ? "flex-col" : "flex-col-reverse"}`}>
        <div className={`flex mt-1.5 ${media.length === 2 ? "flex-row gap-2 md:gap-3" : "flex-col gap-4"}`}>
          {media.map((entry, i) => renderMedia(entry, i, media.length === 2))}
        </div>
        {textContent}
      </div>
    </div>
  );
}
