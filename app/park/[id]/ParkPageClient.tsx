"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import RatingModal from "@/app/components/RatingModal";
import MainPageButton from "@/app/components/buttons/MainPageButton";
import CoasterCreatorModal from "@/app/components/CoasterCreatorModal";
import RatingText from "@/app/components/parkpage/RatingText";
import Coasterlist from "@/app/components/parkpage/Coasterlist";
import ParkHeader from "@/app/components/ParkHeader";
import ParkGallery, { type GalleryImage } from "@/app/components/parkpage/ParkGallery";
import VisitPanel from "@/app/components/parkpage/VisitPanel";
import VisitPanelDropdown from "@/app/components/parkpage/VisitPanelDropdown";
import type { Park, Rating, RatingWarningType, RollerCoaster } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { MarkdownText } from "@/app/components/MarkdownText";

type ParkPageClientProps = {
  initialId: string;
};

const ParkPage: React.FC<ParkPageClientProps> = ({ initialId }) => {
  const params = useParams();
  const parkSlug = String(params?.id ?? initialId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, string>>({});
  const { isAdminMode } = useAdminMode();

  const handleCloseModal = () => {
    router.push(pathname, { scroll: false });
  };

  const handleRefreshData = () => {
    refreshRatings();
    fetchParkData();
  };

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

  // Filter ratings at the page level so draft reviews never act as the default for non-admins
  const visibleRatings = ratings.filter((r) => isAdminMode || r.published);

  const selectedRating = visibleRatings.find((r) => r.id.toString() === visitId);
  const activeRatingId = selectedRating?.id ?? visibleRatings[0]?.id;

  useEffect(() => {
    if (park && !loadingCoasters && visibleRatings.length === 0) {
      setLoadingExplanations(false);
      return;
    }

    if (!park?.id || !activeRatingId) return;

    const fetchExplanations = async () => {
      try {
        const res = await fetch(`/api/park/${park.id}/parkTexts?ratingId=${activeRatingId}`);
        const explanationsData = await res.json();
        if (!Array.isArray(explanationsData)) throw new Error("Unexpected response from parkTexts API");

        const explanationMap: Record<string, string> = {};
        const imageMap: Record<string, string> = {};
        const layoutMap: Record<string, string> = {};
        for (const item of explanationsData) {
          if (!item.ratingId || item.ratingId === activeRatingId) {
            explanationMap[item.category] = item.text;
            if (item.imageUrl) imageMap[item.category] = item.imageUrl;
            if (item.imageLayout) layoutMap[item.category] = item.imageLayout;
          }
        }
        setExplanations(explanationMap);
        setSectionImages(imageMap);
        setSectionLayouts(layoutMap);
      } catch (error) {
        console.error("Failed to fetch explanations:", error);
      } finally {
        setLoadingExplanations(false);
      }
    };

    fetchExplanations();
  }, [park, loadingCoasters, visibleRatings.length, activeRatingId]);

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
      {/* Locked background grid to #0f172a */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_5.5fr_3.5fr] [@media(min-width:2560px)]:grid-cols-[1.8fr_6fr_3.5fr] gap-6 w-full py-10 px-6 md:px-20 bg-[#0f172a]">
        <div className="self-start md:sticky md:top-6 min-w-0 space-y-4">
          <VisitPanel
            ratings={visibleRatings}
            parkSlug={park.slug}
            currentRatingId={selectedRatingId}
            coasters={coasters}
          />
          {(selectedRating ?? visibleRatings[0]) && (
            <VisitPanelDropdown rating={selectedRating ?? visibleRatings[0]} />
          )}
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>

              {/* Edit Rating Button */}
              {isAdminMode && visibleRatings.length > 0 && (
                <Link
                  href={`?modal=true&pendingParkId=${park.id}`}
                  scroll={false}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit Rating
                </Link>
              )}
            </div>

            <div className="w-12 h-1 bg-blue-500 rounded-full mt-3 mb-4" />

            {/* THIS FIXES THE INVISIBLE INTRODUCTION TEXT */}
            <MarkdownText
              text={explanations.description ?? "No description available."}
              className="text-slate-400 text-base leading-relaxed"
            />
          </div>

          <RatingText
            rating={selectedRating ?? visibleRatings[0]}
            explanations={explanations}
            sectionImages={sectionImages}
            sectionLayouts={sectionLayouts}
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
      <RatingModal
        closeModal={handleCloseModal}
        fetchRatingsAndParks={handleRefreshData}
      />
    </div>
  );
};

export default ParkPage;