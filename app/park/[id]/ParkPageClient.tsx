"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { FocusedImage, splitMedia } from "@/app/components/FocusedImage";
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

  // Cover/overview image lightbox (click to enlarge, matches RatingText)
  const [coverLightbox, setCoverLightbox] = useState<string | null>(null);
  useEffect(() => {
    if (!coverLightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCoverLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [coverLightbox]);

  // --- Menu & Advanced Delete States ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteContext, setDeleteContext] = useState<"select" | { type: "park" } | { type: "visit", rating: Rating }>("select");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCloseModal = () => {
    router.push(pathname, { scroll: false });
  };

  const handleRefreshData = () => {
    refreshRatings();
    fetchParkData();
  };

  const executeDelete = async () => {
    if (!park?.id || deleteContext === "select") return;
    setIsDeleting(true);

    try {
      if (deleteContext.type === "park") {
        const res = await fetch(`/api/park/${park.id}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/");
          router.refresh();
        } else console.error("Failed to delete park");
      } else if (deleteContext.type === "visit") {
        const res = await fetch(`/api/ratings/${deleteContext.rating.id}`, { method: "DELETE" });
        if (res.ok) {
          setShowDeleteModal(false);
          setDeleteContext("select");
          handleRefreshData();
          router.push(`/park/${park.slug}`);
        } else console.error("Failed to delete visit");
      }
    } catch (error) {
      console.error("Error during deletion:", error);
    } finally {
      setIsDeleting(false);
    }
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

              {/* Admin 3-Dot Menu */}
              {isAdminMode && visibleRatings.length > 0 && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50 cursor-pointer"
                    aria-label="Settings"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in-up origin-top-right">
                      <Link
                        href={`?modal=true&pendingParkId=${park.id}&editRatingId=${selectedRatingId ?? visibleRatings[0]?.id}`}
                        scroll={false}
                        onClick={() => setIsMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit Visit
                      </Link>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowDeleteModal(true);
                          setDeleteContext("select");
                          setConfirmText("");
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-slate-800 transition-colors flex items-center gap-2 font-medium border-t border-slate-800 cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete...
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-4" />

            <MarkdownText
              text={explanations.description ?? "No description available."}
              className="text-slate-400 text-base leading-relaxed"
            />
            {sectionImages.description && sectionImages.description.split(",").map((entry, i) => {
              const { url, focus } = splitMedia(entry);
              const isVid = /\.(mp4|webm|ogg)$/i.test(url);
              return (
                <div
                  key={i}
                  className={`relative mt-6 w-full h-72 xl:h-96 rounded-2xl overflow-hidden shadow-sm ${isVid ? "" : "group cursor-zoom-in"}`}
                  onClick={isVid ? undefined : () => setCoverLightbox(url)}
                >
                  {isVid ? (
                    <video src={url} className="w-full h-full object-cover rounded-2xl" muted loop autoPlay playsInline />
                  ) : (
                    <>
                      <div className="absolute inset-0 overflow-hidden rounded-2xl transition-transform duration-500 group-hover:scale-105 transform-gpu will-change-transform">
                        <FocusedImage src={url} alt={`Introduction ${i + 1}`} focusStr={focus} className="absolute inset-0 w-full h-full" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl">
                        <svg className="w-8 h-8 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6" /></svg>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {coverLightbox && (
              <div
                className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                onClick={() => setCoverLightbox(null)}
              >
                <button
                  onClick={() => setCoverLightbox(null)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverLightbox}
                  alt=""
                  className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
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

      {/* --- Advanced Delete Modal --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">

            {/* View 1: Select what to delete */}
            {deleteContext === "select" && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-2xl font-bold text-white">Manage Deletions</h3>
                  <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-white text-xl p-1 cursor-pointer">✕</button>
                </div>
                <p className="text-slate-400 mb-6 text-sm">Select a specific visit to delete, or delete the entire park.</p>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Recorded Visits</h4>
                  {visibleRatings.map(rating => (
                    <div key={rating.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                      <div>
                        <span className="text-slate-200 font-medium block">{new Date(rating.date).toLocaleDateString("en-GB")}</span>
                        <span className="text-xs text-slate-500">Score: {rating.overall.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => setDeleteContext({ type: "visit", rating })}
                        className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-900/50 cursor-pointer"
                      >
                        Delete Visit
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-5 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-red-500/70 mb-3">Danger Zone</h4>
                  <div className="flex items-center justify-between bg-red-900/10 p-4 rounded-xl border border-red-900/30">
                    <div>
                      <span className="text-slate-200 font-bold block">Entire Park</span>
                      <span className="text-xs text-slate-400">Deletes {park.name} and all data</span>
                    </div>
                    <button
                      onClick={() => setDeleteContext({ type: "park" })}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                    >
                      Delete Park
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* View 2: Confirm Visit Deletion */}
            {deleteContext !== "select" && deleteContext.type === "visit" && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-white mb-2">Delete Visit?</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Are you sure you want to delete the visit from <strong className="text-white">{new Date(deleteContext.rating.date).toLocaleDateString("en-GB")}</strong>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 mt-auto">
                  <button onClick={() => setDeleteContext("select")} disabled={isDeleting} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 cursor-pointer">Back</button>
                  <button onClick={executeDelete} disabled={isDeleting} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                    {isDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            )}

            {/* View 3: Confirm Park Deletion (Text Input Required) */}
            {deleteContext !== "select" && deleteContext.type === "park" && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-white mb-2">Delete Entire Park?</h3>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  This will permanently delete <strong className="text-white">{park.name}</strong>, along with all its visits, coasters, and gallery images. This action cannot be undone.
                </p>
                <div className="mb-8">
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Please type <strong className="text-red-400 select-none">{park.name}</strong> to confirm.
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={park.name}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-auto">
                  <button onClick={() => { setDeleteContext("select"); setConfirmText(""); }} disabled={isDeleting} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 cursor-pointer">Back</button>
                  <button
                    onClick={executeDelete}
                    disabled={isDeleting || confirmText !== park.name}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <RatingModal
        closeModal={handleCloseModal}
        fetchRatingsAndParks={handleRefreshData}
      />
    </div>
  );
};

export default ParkPage;