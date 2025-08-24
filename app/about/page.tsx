"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import TripCard, { Trip } from "../components/TripCard";
import { trips, getDaysUntil, getNextTrip } from "@/app/utils/trips";

const groupTripsByYear = (filteredTrips: Trip[]) => {
  const grouped: { [year: string]: Trip[] } = {};

  filteredTrips
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
    .forEach((trip) => {
      const year = new Date(trip.startDate).getFullYear().toString();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(trip);
    });

  return grouped;
};

export default function AboutPage() {
  const [showPast, setShowPast] = useState(false);

  const filtered = trips.filter((t) =>
    showPast ? t.status === "past" : t.status !== "past"
  );
  const undecidedTrips = filtered.filter(
    (t) => t.startDate === "undecided" || t.endDate === "undecided"
  );
  const decidedTrips = filtered.filter(
    (t) => t.startDate !== "undecided" && t.endDate !== "undecided"
  );

  const grouped = groupTripsByYear(decidedTrips);
  const nextTrip = getNextTrip();

  return (
    <div className="w-full dark:bg-gray-900">
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-20">
        {/* Intro */}
        <section className="text-center space-y-6 animate-fade-in-up delay-0">
          <Image
            src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/temp%20logo.jpg"
            alt="The ParkRating Brothers"
            width={350}
            height={350}
            className="rounded-xl mx-auto object-cover"
            unoptimized
          />
          <h1 className="text-4xl font-extrabold dark:text-white">About ParkRating</h1>

          {/* Body copy */}
          <div className="text-lg text-gray-700 dark:text-gray-400 max-w-2xl mx-auto space-y-4 text-center leading-relaxed">
            <p className="text-1xl font-semibold text-black dark:text-white">
              We are two brothers with a passion for theme parks and thrilling
              coasters.
            </p>
            <p>
              ParkRating is our passion project where we share honest and
              sometimes polarizing reviews — all based on our own first-hand
              experiences, visiting theme parks all across the world.
            </p>
            <p>
              We rate everything from park appearance, coasters and flat rides to
              food, management, ride operations, and many more (Actually, just 4
              more). For more information about this, visit our{" "}
              <Link
                href="/info"
                className="text-black dark:text-blue-300 hover:text-blue-400 dark:hover:text-blue-200 underline"
              >
                Rating Evaluation
              </Link>{" "}
              page.
            </p>
            <p>
              Take a look around and feel free to yell at us for not rating your
              favorite coaster higher.
            </p>
          </div>
        </section>

        {/* Live Countdown */}
        {nextTrip && (
          <p className="text-center text-green-700 dark:text-green-400 font-bold text-3xl -mt-12">
            🎢 Next trip in {getDaysUntil(nextTrip.startDate)} days
          </p>
        )}

        {/* Toggle + Trips */}
        <section className="animate-fade-in-up delay-1">
          <div className="flex justify-center mb-10 gap-4">
            <button
              onClick={() => setShowPast(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition
              ${
                !showPast
                  ? "bg-black text-white border-black dark:bg-white dark:text-gray-900 dark:border-white"
                  : "bg-white text-black border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-white/10 dark:hover:bg-gray-700"
              }`}
            >
              Upcoming Trips
            </button>
            <button
              onClick={() => setShowPast(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition
              ${
                showPast
                  ? "bg-black text-white border-black dark:bg-white dark:text-gray-900 dark:border-white"
                  : "bg-white text-black border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-white/10 dark:hover:bg-gray-700"
              }`}
            >
              Past Trips
            </button>
          </div>

          {/* Dated Trips First */}
          <div className="space-y-16 animate-fade-in-up delay-2">
            {Object.entries(grouped).map(([year, yearTrips]) => (
              <div key={year} className="space-y-4">
                <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white">
                  {year}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {yearTrips.map((trip, i) => (
                    <TripCard key={i} trip={trip} />
                  ))}
                </div>
              </div>
            ))}

            {/* Undecided Trips Last */}
            {undecidedTrips.length > 0 && (
              <div className="space-y-4 pt-10">
                <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white">
                  As Soon As Possible
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {undecidedTrips.map((trip, i) => (
                    <TripCard key={`undecided-${i}`} trip={trip} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
