"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type RatingCarouselProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode; // typically a list of <RatingCard />
};

export function RatingCarousel({ title, subtitle, children }: RatingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollByOneCard = (direction: "prev" | "next") => {
    const container = scrollRef.current;
    if (!container) return;

    // Find the first card to measure width
    const firstCard = container.querySelector<HTMLElement>("[data-carousel-card]");
    if (!firstCard) return;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const styles = getComputedStyle(container);
    const gap = parseFloat(styles.columnGap || styles.gap || "0");

    const scrollAmount = cardWidth + gap;

    container.scrollBy({
      left: direction === "next" ? scrollAmount : -scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <section className="w-full">
      {(title || subtitle) && (
        <header className="mb-3 flex items-baseline justify-between px-4 md:px-0">
          <div>
            {title && (
              <h2 className="text-lg font-semibold tracking-tight md:text-xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground md:text-sm">
                {subtitle}
              </p>
            )}
          </div>

          {/* Desktop buttons (hidden on small) */}
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByOneCard("prev")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs shadow-sm transition hover:bg-accent"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByOneCard("next")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs shadow-sm transition hover:bg-accent"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      <div className="relative">
        {/* Gradient edges for nicer feel */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent md:w-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:w-10" />

        <div
          ref={scrollRef}
          className="
            flex gap-4 overflow-x-auto scroll-smooth px-4 pb-2 md:px-0
            snap-x snap-mandatory
            [scrollbar-width:none] [-ms-overflow-style:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {React.Children.map(children, (child, index) => (
            <div
              data-carousel-card
              // 80% of viewport on small, 60% on md, then fixedish width
              className="snap-center snap-always shrink-0 basis-[80%] md:basis-[60%] lg:basis-[420px]"
              aria-label={`Card ${index + 1}`}
            >
              {child}
            </div>
          ))}
        </div>

        {/* Mobile buttons floating over bottom right */}
        <div className="pointer-events-none absolute bottom-2 right-4 flex gap-2 md:hidden">
          <button
            type="button"
            onClick={() => scrollByOneCard("prev")}
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-md ring-1 ring-border"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByOneCard("next")}
            className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-md ring-1 ring-border"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
