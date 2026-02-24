"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";
import { getNextTrip, getDaysUntil } from "@/app/utils/trips";

const Header = () => {
  const nextTrip = getNextTrip();
  const days = nextTrip ? getDaysUntil(nextTrip.startDate) : null;
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

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
        ${
          isVisible
            ? "max-h-[300px] opacity-100"
            : "max-h-0 opacity-0 md:max-h-[300px] md:opacity-100"
        }
        ${isAnimating || !isVisible ? "overflow-hidden" : "overflow-visible"}
      `}
    >
      <header className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-4 md:py-6 px-4 md:px-6 relative animate-fade-in">
        <div className="relative grid grid-cols-2 items-center gap-x-3 lg:flex lg:items-center lg:justify-between">
          {/* Logo - slightly more left */}
          <div className="relative -ml-2 md:ml-0 h-14 sm:h-16 md:h-20 lg:h-20 w-36 sm:w-44 md:w-52 lg:w-56">
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

          {/* Navbar */}
          <div className="justify-self-end lg:order-3 z-50">
            <Navbar />
          </div>

          {/* Countdown - hidden on mobile */}
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
`}
              title={
                nextTrip && days
                  ? `${days} days until next trip`
                  : "No trip planned. Disappointed. Get going!"
              }
            >
              {nextTrip && days
                ? `🎢 ${days} days until next trip`
                : `🥲 No trip planned. Disappointed. Get going!`}
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;