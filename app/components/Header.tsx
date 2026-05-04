"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import { getDaysUntil } from "@/app/utils/trips";

const Header = () => {
  const [days, setDays] = useState<number | null>(null);
  const [underReviewParks, setUnderReviewParks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const fetchHeaderData = async () => {
      try {
        // Fetch both trips and ratings simultaneously
        const [tripsRes, ratingsRes] = await Promise.all([
          fetch("/api/trips"),
          fetch("/api/ratings")
        ]);

        if (tripsRes.ok) {
          const tripsData = await tripsRes.json();
          const next = tripsData.trips
            ?.filter((t: any) => t.status === "booked" && getDaysUntil(t.startDate))
            .sort(
              (a: any, b: any) =>
                new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
            )[0];

          if (next) {
            setDays(getDaysUntil(next.startDate));
          }
        }

        if (ratingsRes.ok) {
          const ratingsData = await ratingsRes.json();
          // Filter for unpublished ratings, grab the park name, and remove duplicates
          if (ratingsData.ratings) {
            const unpublishedParks = ratingsData.ratings
              .filter((r: any) => r.published === false)
              .map((r: any) => r.park);

            setUnderReviewParks(Array.from(new Set(unpublishedParks)));
          }
        }
      } catch (error) {
        console.error("Failed to fetch header data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeaderData();
  }, []);

  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      setIsAnimating(true);
      setIsVisible(e.detail.visible);
      setTimeout(() => setIsAnimating(false), 500);
    };

    window.addEventListener("toggle-header" as any, handleToggle as any);
    return () => {
      window.removeEventListener("toggle-header" as any, handleToggle as any);
    };
  }, []);

  return (
    <div
      className={`
        transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-50
        ${isVisible
          ? "max-h-[300px] opacity-100"
          : "max-h-0 opacity-0 md:max-h-[300px] md:opacity-100"
        }
        ${isAnimating || !isVisible ? "overflow-hidden" : "overflow-visible"}
      `}
    >
      <header className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-4 md:py-6 px-4 md:px-6 relative animate-fade-in">
        <div className="relative grid grid-cols-2 items-center gap-x-3 lg:flex lg:items-center lg:justify-between">
          <div className="relative -ml-2 md:ml-0 h-14 sm:h-16 md:h-20 lg:h-20 w-36 sm:w-44 md:w-52 lg:w-56 z-10">
            <Link
              href="/"
              aria-label="Go to homepage"
              className="block h-full w-full"
            >
              <Image
                src="/logos/logolight.svg"
                alt="Parkrating Logo"
                fill
                priority
                className="object-contain dark:hidden"
              />
              <Image
                src="/logos/logodark.svg"
                alt="Parkrating Logo"
                fill
                priority
                className="object-contain hidden dark:block"
              />
            </Link>
          </div>

          <div className="justify-self-end lg:order-3 z-50">
            <Navbar />
          </div>

          {/* Centered Countdown */}
          <div
            className={`
              hidden md:block
              col-span-2 mt-4 lg:mt-2 lg:order-2 lg:col-span-2 lg:flex lg:justify-center
              xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2
              xl:z-0
            `}
          >
            <Link
              href="/about"
              className={`
                text-[#e9820e] dark:text-[#e9820e] font-semibold hover:underline whitespace-nowrap truncate px-2 leading-none
                text-xs sm:text-sm lg:text-base xl:text-base
                block text-center max-w-[90vw] lg:max-w-[50vw] xl:max-w-[60vw]
                ${isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}
              `}
              title={days ? `${days} days until next trip` : "Next trip countdown"}
            >
              {days ? `🎢 ${days} days until next trip` : `No trip planned yet this season`}
            </Link>
          </div>
        </div>

        {/* Parks Under Review */}
        {underReviewParks.length > 0 && (
          <div className="hidden md:flex absolute bottom-1 left-0 w-full justify-center pointer-events-none z-0">
            <span
              className={`
                italic text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap truncate px-4 leading-none
                text-[10px] sm:text-xs lg:text-sm tracking-wide
                ${isLoading ? "opacity-0" : "opacity-100 transition-opacity duration-300 delay-100"}
              `}
              title={`Parks currently under review: ${underReviewParks.join(", ")}`}
            >
              Parks currently under review: {underReviewParks.join(", ")}
            </span>
          </div>
        )}
      </header>
    </div>
  );
};

export default Header;