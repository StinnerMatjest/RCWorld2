"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { RollerCoaster } from "@/app/types";
import MainPageButton from "@/app/components/MainPageButton";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { getRatingColor } from "@/app/utils/design";
import CoasterInfo from "@/app/components/coasterpage/CoasterInfo";
import CoasterRanking from "@/app/components/coasterpage/CoasterRanking";
import CoasterSpecsPanel from "@/app/components/coasterpage/CoasterSpecsPanel";
import CoasterGallery from "@/app/components/coasterpage/CoasterGallery";
import CoasterText from "@/app/components/coasterpage/CoasterText";
import Image from "next/image";

const CoasterPage: React.FC = () => {
  const { id: coasterId } = useParams();
  const [coaster, setCoaster] = useState<RollerCoaster | null>(null);
  const [allCoasters, setAllCoasters] = useState<RollerCoaster[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch specfic coaster
  useEffect(() => {
    if (!coasterId) return;
    (async () => {
      const res = await fetch(`/api/coasters/${coasterId}`);
      const data = await res.json();
      setCoaster(data.coaster);
      setLoading(false);
    })();
  }, [coasterId]);

  // Fetch all coasters
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/coasters");
        const data = await res.json();
        setAllCoasters(data.coasters || []);
      } catch (err) {
        console.error("Failed to fetch all coasters:", err);
      }
    })();
  }, []);

  // Fetch header image
  useEffect(() => {
    if (!coasterId || !coaster?.name || !coaster?.parkId) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coaster.name)}&parkId=${coaster.parkId}`
        );
        const data = await res.json();
        setHeaderImage(data.headerImage || null);
      } catch (err) {
        console.error("Failed to fetch coaster header image", err);
      }
    })();
  }, [coasterId, coaster?.name, coaster?.parkId]);

  if (loading || !coaster) return <LoadingSpinner />;

  return (
    <div className="w-full">
      {/* Header Image */}
      {headerImage && (
        <div
          className="relative w-full aspect-[16/8] md:aspect-[16/4] max-h-screen overflow-hidden cursor-pointer group"
          onClick={() => window.open(headerImage, "_blank")}
          title="Click to view full image"
        >
          <Image
            src={headerImage}
            alt={coaster.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 pointer-events-none" />
          <h1 className="absolute bottom-6 left-6 text-4xl md:text-5xl font-bold text-white z-20 drop-shadow-lg pointer-events-none">
            {coaster.name}
          </h1>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[25%_50%_25%] gap-6 w-full py-10 px-6 md:px-20 bg-base-200 dark:bg-gray-900">
        {/* Left Panel */}
        <div className="flex flex-col space-y-6 self-start">
          {/* Coaster Info Box */}
          <div className="bg-blue-50 dark:bg-gray-800 rounded-2xl p-6 text-center space-y-6 border border-gray-300 dark:border-white/10 shadow-sm dark:shadow-xl ring ring-gray-200 dark:ring-white/10">
            <h2 className="text-xl font-semibold mb-1 dark:text-white">Coaster Info</h2>
            <div className="border-t border-gray-300 dark:border-white/10 my-3" />
            <CoasterInfo coaster={coaster} />
          </div>

          {/* Coaster Ranking Box */}
          <div className="bg-blue-50 dark:bg-gray-800 rounded-2xl p-6 text-center space-y-2 border border-gray-300 dark:border-white/10 shadow-sm dark:shadow-xl ring ring-gray-200 dark:ring-white/10">
            <h2 className="text-xl font-semibold mb-2 dark:text-white">Coaster Ranking</h2>
            <CoasterRanking coaster={coaster} allCoasters={allCoasters} />
          </div>
        </div>

        {/* Middle Panel */}
        <div className="space-y-8 flex flex-col items-center w-full">
          <h2 className="text-3xl md:text-5xl font-extrabold text-center dark:text-white tracking-tight">
            {coaster.name}
          </h2>

          {/* Rating Card */}
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-xl bg-white dark:bg-gray-800 border-4 flex flex-col items-center justify-center transition-all
      ${coaster.rating !== null
              ? getRatingColor(Number(coaster.rating))
              : "border-gray-300 dark:border-gray-500"}`}>
            <span className="text-[5rem] md:text-[7rem] font-extrabold leading-none dark:text-white">
              {coaster.rating ?? "N/A"}
            </span>
            <p className="mt-3 text-lg font-medium text-gray-700 dark:text-gray-300">
              Overall Rating
            </p>
          </div>

          <CoasterText coasterId={coaster.id} />
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          <CoasterSpecsPanel specs={coaster.specs} />
          <CoasterGallery coasterId={coaster.id} coasterName={coaster.name} parkId={coaster.parkId} />
        </div>
      </div>


      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default CoasterPage;
