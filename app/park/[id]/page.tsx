"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import MainPageButton from "@/app/components/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";
import RatingExplanations from "@/app/components/RatingExplanations";
import Coasterlist from "@/app/components/Coasterlist";
import ParkHeader from "@/app/components/ParkHeader";
import ParkInfo from "@/app/components/ParkInfo";
import Gallery from "@/app/components/Gallery";
import ArchivePanel from "@/app/components/ArchivePanel";
import type { Park, Rating, RatingWarningType, RollerCoaster } from "@/app/types";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const ParkPage: React.FC = () => {
  const { id: parkId } = useParams();
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visit");
  const selectedRatingId = visitId ? Number(visitId) : undefined;
  const [park, setPark] = useState<Park | null>(null);
  const [coasters, setCoasters] = useState<RollerCoaster[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loadingCoasters, setLoadingCoasters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoaster, setEditingCoaster] = useState<RollerCoaster>();
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!parkId) return;
    (async () => {
      const [parkRes, coastersRes, ratingsRes, explanationsRes] =
        await Promise.all([
          fetch(`/api/park/${parkId}`),
          fetch(`/api/park/${parkId}/coasters`),
          fetch(`/api/park/${parkId}/ratings`),
          fetch(`/api/park/${parkId}/parkTexts`),
        ]);

      setPark(await parkRes.json());
      setCoasters(await coastersRes.json());
      setLoadingCoasters(false);

      const ratingsData = await ratingsRes.json();
      setRatings(
        ratingsData.ratings
          .filter((r: Rating) => r.parkId === Number(parkId))
          .map((r: Rating) => ({
            ...r,
            warnings: (r.warnings ?? []).map((w: any) => ({
              ratingId: w.ratingId,
              category: w.category,
              ride: w.ride,
              note: w.note,
            })) as RatingWarningType[],
          }))
          .sort((a: Rating, b: Rating) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
          )
      );

      const explanationsData: { category: string; text: string }[] =
        await explanationsRes.json();
      const explanationMap: Record<string, string> = {};
      for (const item of explanationsData) {
        explanationMap[item.category] = item.text;
      }
      setExplanations(explanationMap);

    })();
  }, [parkId]);

  const selectedRating = ratings.find((r) => r.id.toString() === visitId);

  const refreshCoasters = async () => {
    const res = await fetch(`/api/park/${parkId}/coasters`);
    setCoasters(await res.json());
  };

  if (!park) return <LoadingSpinner />;

  return (
    <div className="w-full">
      <ParkHeader park={park} />

      <div className="grid grid-cols-1 md:grid-cols-[20%_1fr_1fr] gap-6 w-full py-10 px-6 md:px-20 bg-base-200 dark:bg-gray-900">
        {/* Info Panel */}
        <div
          className="
            bg-blue-50 dark:bg-gray-800
            rounded-2xl p-6 text-center space-y-6 self-start
            border border-gray-300 dark:border-white/10
            shadow-sm dark:shadow-xl
            ring ring-gray-200 dark:ring-white/10
          "
        >
          <div>
            <h2 className="text-xl font-semibold mb-1 dark:text-white">Park Info</h2>
            <div className="border-t border-gray-300 dark:border-white/10 my-3" />
            <ParkInfo park={park} />

            <div className="border-t border-gray-300 dark:border-white/10 my-3" />
            <ArchivePanel
              ratings={ratings}
              parkId={Number(parkId)}
              currentRatingId={selectedRatingId}
            />
          </div>
        </div>

        {/* Introduction and Rating Explanations */}
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-semibold dark:text-white">Introduction</h2>
            <div className="border-t border-gray-300 dark:border-white/10 my-3" />
            <p className="text-gray-700 dark:text-gray-400 text-base leading-relaxed">
              {explanations.description ?? "No description available."}
            </p>
          </div>

          <RatingExplanations
            rating={selectedRating ?? ratings[0]}
            explanations={explanations}
            parkId={Number(parkId)}
          />
        </div>

        {/* Coasters */}
        <div className="space-y-6">
          <Coasterlist
            coasters={coasters}
            loading={loadingCoasters}
            onAdd={() => {
              setEditingCoaster(undefined);
              setShowModal(true);
            }}
            onEdit={(c) => {
              setEditingCoaster(c);
              setShowModal(true);
            }}
          />
          {showModal && (
            <CoasterCreatorModal
              parkId={Number(parkId)}
              coaster={editingCoaster}
              onClose={() => {
                setShowModal(false);
                setEditingCoaster(undefined);
                refreshCoasters();
              }}
              onCoasterAdded={refreshCoasters}
            />
          )}
          <Gallery parkId={park.id} parkName={park.name} />
        </div>
      </div>

      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default ParkPage;
