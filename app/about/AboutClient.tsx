"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Trip } from "../components/aboutpage/TripCard";
import TripCreatorModal from "../components/aboutpage/TripCreatorModal";
import VisitTimeline from "../components/aboutpage/VisitTimeline";
import { getDaysUntil } from "@/app/utils/trips";
import { useAdminMode } from "@/app/context/AdminModeContext";

export default function AboutPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>(undefined);

  // Admin Mode
  const { isAdminMode } = useAdminMode();

  const fetchTrips = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/trips");
      if (!res.ok) throw new Error("Failed to fetch trips");
      const data = await res.json();
      setTrips(data.trips);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setShowModal(true);
  };

  const nextTrip = trips
    .filter((t) => t.status === "booked" && getDaysUntil(t.startDate))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

  return (
    <div className="w-full bg-[#0f172a] relative">
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-20">

        {/* Intro */}
        <section className="text-center space-y-6 animate-fade-in-up delay-0">
          <Image
            src="/logos/parkrating.png"
            alt="ParkRating Logo"
            width={350}
            height={350}
            className="mx-auto"
            priority
          />
          <h1 className="text-4xl font-extrabold text-white">About ParkRating</h1>

          <div className="text-lg text-slate-400 max-w-2xl mx-auto space-y-4 text-center leading-relaxed">
            <p className="text-1xl font-semibold text-white">
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
                className="text-brand hover:text-brand-light underline transition-colors"
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
        {!isLoading && nextTrip && (
          <p className="text-center text-green-400 font-bold text-3xl -mt-12">
            🎢 Next trip in {getDaysUntil(nextTrip.startDate)} days
          </p>
        )}

        {/* Visit timeline — the future flows down into every park we've reviewed */}
        <section className="animate-fade-in-up delay-1">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Our Journey
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Every park we&apos;ve visited and reviewed — and where we&apos;re headed next.
              Click a visit to read the full review.
            </p>
            {isAdminMode && (
              <button
                onClick={() => {
                  setEditingTrip(undefined);
                  setShowModal(true);
                }}
                className="mt-5 bg-brand hover:bg-brand-light text-white font-bold py-2 px-6 rounded-xl shadow-lg transition cursor-pointer"
              >
                + Add New Trip
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <p className="text-lg text-slate-400 font-medium animate-pulse">
                Loading journey…
              </p>
            </div>
          ) : (
            <VisitTimeline trips={trips} isAdminMode={isAdminMode} onEditTrip={handleEditTrip} />
          )}
        </section>
      </main>

      {/* Modal */}
      {showModal && (
        <TripCreatorModal
          trip={editingTrip}
          onClose={() => {
            setShowModal(false);
            setEditingTrip(undefined);
          }}
          onSaved={fetchTrips}
        />
      )}
    </div>
  );
}