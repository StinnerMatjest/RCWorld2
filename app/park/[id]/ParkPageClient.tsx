"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import MainPageButton from "@/app/components/buttons/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";
import RatingText from "@/app/components/RatingText";
import Coasterlist from "@/app/components/parkpage/Coasterlist";
import ParkHeader from "@/app/components/ParkHeader";
import ParkGallery, { type GalleryImage } from "@/app/components/parkpage/ParkGallery";
import VisitPanel from "@/app/components/parkpage/VisitPanel";
import VisitPanelDropdown from "@/app/components/parkpage/VisitPanelDropdown";
import type { Park, Rating, RatingWarningType, RollerCoaster } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";

type ParkPageClientProps = {
  initialId: string;
};

const ParkPage: React.FC<ParkPageClientProps> = ({ initialId }) => {
  const params = useParams();
  const parkSlug = String(params?.id ?? initialId);
  const searchParams = useSearchParams();
  const visitId = searchParams.get("visit");
  const selectedRatingId = visitId ? Number(visitId) : undefined;
  const [park, setPark] = useState<Park | null>(null);
  const [coasters, setCoasters] = useState<RollerCoaster[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [loadingCoasters, setLoadingCoasters] = useState(true);
  const [loadingExplanations, setLoadingExplanations] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoaster, setEditingCoaster] = useState<RollerCoaster>();
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [sectionImages, setSectionImages] = useState<Record<string, string>>({});
  const { isAdminMode } = useAdminMode();

  useEffect(() => {
    if (park?.name) {
      document.title = `${park.name} | Parkrating`;
    } else if (parkSlug && parkSlug !== "undefined") {
      const placeholder = String(parkSlug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      document.title = `${placeholder} | Parkrating`;
    } else {
      document.title = "Parkrating";
    }
  }, [park, parkSlug, visitId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!parkSlug || parkSlug === "undefined" || parkSlug === "null") return;

    (async () => {
      try {
        const parkRes = await fetch(`/api/park/${parkSlug}`);
        const parkData = await parkRes.json();

        if (!parkRes.ok || parkData.error) {
          console.error("Park not found or API error:", parkData.error);
          return;
        }

        const numericParkId = parkData.id;
        const [coastersRes, ratingsRes, galleryRes] = await Promise.all([
          fetch(`/api/park/${numericParkId}/coasters`, {
            cache: "no-store",
            headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
          }),
          fetch(`/api/park/${numericParkId}/ratings`, {
            cache: "no-store",
            headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
          }),
          fetch(`/api/park/${numericParkId}/gallery`, {
            cache: "no-store",
            headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
          }),
        ]);

        const coastersData = await coastersRes.json();
        const ratingsData = await ratingsRes.json();
        const galleryData = await galleryRes.json();

        setCoasters(Array.isArray(coastersData) ? coastersData : []);
        setGalleryImages(galleryData.gallery || []);

        setRatings(
          (Array.isArray(ratingsData?.ratings) ? ratingsData.ratings : [])
            .filter((r: Rating) => r.parkId === numericParkId)
            .map((r: Rating) => ({
              ...r,
              warnings: (r.warnings ?? []).map((w: any) => ({
                id: w.id,
                ratingId: w.ratingId,
                category: w.category,
                ride: w.ride,
                note: w.note,
                severity: w.severity || "Moderate",
              })) as RatingWarningType[],
            }))
            .sort(
              (a: Rating, b: Rating) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )
        );

        setPark(parkData);
        setLoadingCoasters(false);
      } catch (error) {
        console.error("Failed to fetch park data:", error);
      }
    })();
  }, [parkSlug]);

  const selectedRating = ratings.find((r) => r.id.toString() === visitId);
  const activeRatingId = selectedRating?.id ?? ratings[0]?.id;

  useEffect(() => {
    if (park && !loadingCoasters && ratings.length === 0) {
      setLoadingExplanations(false);
      return;
    }

    if (!park?.id || !activeRatingId) return;

    const fetchExplanations = async () => {
      try {
        const res = await fetch(`/api/park/${park.id}/parkTexts?ratingId=${activeRatingId}`);
        const explanationsData = await res.json();

        const explanationMap: Record<string, string> = {};
        const imageMap: Record<string, string> = {};
        for (const item of explanationsData) {
          if (!item.ratingId || item.ratingId === activeRatingId) {
            explanationMap[item.category] = item.text;
            if (item.imageUrl) imageMap[item.category] = item.imageUrl;
          }
        }
        setExplanations(explanationMap);
        setSectionImages(imageMap);
      } catch (error) {
        console.error("Failed to fetch explanations:", error);
      } finally {
        setLoadingExplanations(false);
      }
    };

    fetchExplanations();
  }, [park, loadingCoasters, ratings.length, activeRatingId]);

  const refreshGallery = async () => {
    if (!park?.id) return;
    const res = await fetch(`/api/park/${park.id}/gallery`);
    const data = await res.json();
    setGalleryImages(data.gallery || []);
  };

  const refreshCoasters = async () => {
    if (!park?.id) return;
    const res = await fetch(`/api/park/${park.id}/coasters`);
    setCoasters(await res.json());
  };

  const fetchParkData = async () => {
    if (!parkSlug || parkSlug === "undefined" || parkSlug === "null") return;
    const res = await fetch(`/api/park/${parkSlug}`);
    const data = await res.json();
    setPark(data);
  };

  const refreshRatings = async () => {
    if (!park?.id) return;
    const res = await fetch(`/api/park/${park.id}/ratings`, {
      cache: "no-store",
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
    });

    const ratingsData = await res.json();
    setRatings(
      (Array.isArray(ratingsData?.ratings) ? ratingsData.ratings : [])
        .filter((r: Rating) => r.parkId === park.id)
        .map((r: Rating) => ({
          ...r,
          warnings: (r.warnings ?? []).map((w: any) => ({
            id: w.id,
            ratingId: w.ratingId,
            category: w.category,
            ride: w.ride,
            note: w.note,
            severity: w.severity || "Moderate",
          })) as RatingWarningType[],
        }))
        .sort(
          (a: Rating, b: Rating) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
    );
  };

  if (!park || loadingCoasters || loadingExplanations) return <LoadingSpinner />;

  return (
    <div className="w-full">
      <ParkHeader
        park={park}
        isAdminMode={isAdminMode}
        onUpdate={fetchParkData}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_5.5fr_3.5fr] xl:grid-cols-[1.8fr_6fr_3.5fr] gap-8 w-full py-10 px-6 md:px-12 xl:px-20 bg-base-200 dark:bg-gray-900">
        <div className="self-start md:sticky md:top-6 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4 md:p-5 flex flex-col gap-5">
          <VisitPanel
            ratings={ratings}
            parkSlug={park.slug}
            currentRatingId={selectedRatingId}
            coasters={coasters}
          />

          {/* Divider line between Visit and Scores */}
          <div className="border-t border-gray-100 dark:border-gray-700/60" />

          {(selectedRating ?? ratings[0]) && (
            <VisitPanelDropdown rating={selectedRating ?? ratings[0]} />
          )}
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-bold dark:text-white tracking-tight">Introduction</h2>
            <div className="w-12 h-1 bg-blue-500 rounded-full mt-3 mb-4" />
            <p className="text-gray-700 dark:text-gray-400 text-base leading-relaxed">
              {explanations.description ?? "No description available."}
            </p>
          </div>

          <RatingText
            rating={selectedRating ?? ratings[0]}
            explanations={explanations}
            sectionImages={sectionImages}
            galleryImages={galleryImages}
            parkId={park.id}
            parkName={park.name}
            onWarningsUpdate={refreshRatings}
            onSectionImagesUpdate={setSectionImages}
            coasters={coasters}
          />
        </div>

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
              parkId={park.id}
              coaster={editingCoaster}
              onClose={() => {
                setShowModal(false);
                setEditingCoaster(undefined);
                refreshCoasters();
              }}
              onCoasterAdded={refreshCoasters}
            />
          )}
          <ParkGallery
            parkId={park.id}
            parkName={park.name}
            initialImages={galleryImages}
            refreshImages={refreshGallery}
          />
        </div>

        <div className="md:col-span-3 flex justify-center pt-6">
          <MainPageButton />
        </div>
      </div>
    </div>
  );
};

export default ParkPage;
