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
  
  // Helper state to handle the overflow toggle for smooth animation
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      setIsAnimating(true);
      setIsVisible(e.detail.visible);
      // Stop hiding overflow after animation ends to allow dropdowns to pop out
      setTimeout(() => setIsAnimating(false), 500); 
    };

    window.addEventListener('toggle-header' as any, handleToggle as any);
    return () => {
      window.removeEventListener('toggle-header' as any, handleToggle as any);
    };
  }, []);

  return (
    <div 
      className={`
        transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-50
        ${isVisible 
            ? 'max-h-[300px] opacity-100' 
            : 'max-h-0 opacity-0 md:max-h-[300px] md:opacity-100' // Force visible on Desktop
        }
        ${isAnimating || !isVisible ? 'overflow-hidden' : 'overflow-visible'}
      `}
    >
      <header className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-2 px-6 relative animate-fade-in">
        <div className="relative grid grid-cols-2 items-center gap-x-3 lg:flex lg:items-center lg:justify-between">
          {/* Logo */}
          <div className="relative h-16 w-40 sm:h-20 sm:w-48 md:h-24 lg:h-24 lg:w-64">
            {/* Light mode logo */}
            <Link href="/" aria-label="Go to homepage">
              <Image
                src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/Parkrating.png"
                alt="Parkrating Logo"
                fill
                className="object-contain cursor-pointer dark:hidden"
                unoptimized
              />
            </Link>
            {/* Dark mode text logo */}
            <div className="hidden dark:flex items-center h-full">
              <Link
                href="/"
                aria-label="Go to homepage"
                className="font-extrabold tracking-tight text-slate-100 hover:text-slate-300 transition-colors text-xl sm:text-2xl leading-none"
              >
                Parkrating
              </Link>
            </div>
          </div>

          {/* Navbar */}
          <div className="justify-self-end lg:order-3 z-50">
            <Navbar />
          </div>

          {/* Countdown */}
          <div
            className={`
              col-span-2 mt-1 sm:mt-1 lg:mt-0 lg:order-2 lg:col-span-2 lg:flex lg:justify-center
              xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2
              xl:z-0
            `}
          >
            <Link
              href="/about"
              className={`
                text-green-600 dark:text-green-400 font-semibold hover:underline whitespace-nowrap truncate px-2 leading-none
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