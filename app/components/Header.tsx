"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import Navbar from "./Navbar"
import { getNextTrip, getDaysUntil } from "@/app/utils/trips"

const Header = () => {
  const nextTrip = getNextTrip()
  const days = nextTrip ? getDaysUntil(nextTrip.startDate) : null

  return (
    <header className="w-full bg-white py-2 px-6 flex items-center justify-between relative animate-fade-in z-[20]">
      {/* Logo Left */}
      <div className="relative h-20 w-48 sm:h-24 md:h-32 lg:h-36">
        <Link href="/">
          <Image
            src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/Parkrating.png"
            alt="Parkrating Logo"
            fill
            className="object-contain cursor-pointer"
            unoptimized
          />
        </Link>
      </div>

      {/* Center Countdown or Fallback */}
      <Link
        href="/about"
        className="absolute left-1/2 -translate-x-1/2 text-center text-green-600 font-semibold text-xs sm:text-sm md:text-base lg:text-lg hover:underline"
      >
        {nextTrip && days
          ? `🎢 ${days} days until next trip`
          : `🥲 No trip planned. Disappointed. Get going!`}
      </Link>
      <Navbar />
    </header>
  )
}

export default Header
