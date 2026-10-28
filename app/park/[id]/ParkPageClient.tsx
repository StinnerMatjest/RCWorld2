"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { SectionBody, mediaCaptions } from "@/app/components/parkpage/SectionBody";
import RatingModal from "@/app/components/RatingModal";
import MainPageButton from "@/app/components/buttons/MainPageButton";
import CoasterCreatorModal from "@/app/components/coasterpage/CoasterCreatorModal";
import CoasterPhotoStrip from "@/app/components/coasterpage/CoasterPhotoStrip";
import CoasterStripEditor from "@/app/components/coasterpage/CoasterStripEditor";
import ParkText from "@/app/components/parkpage/ParkText";
import ParkHero from "@/app/components/parkpage/ParkHero";
import VisitSwitcher from "@/app/components/parkpage/VisitSwitcher";
import PhotoDeck from "@/app/components/parkpage/PhotoDeck";
import ParkCoasterList from "@/app/components/parkpage/ParkCoasterList";
import ParkScorecard from "@/app/components/parkpage/ParkScorecard";
import VisitGallery, { type VisitGalleryImage } from "@/app/components/parkpage/VisitGallery";
import PhotoViewer from "@/app/components/parkpage/PhotoViewer";
import type { Park, Visit, RatingWarningType, RollerCoaster } from "@/app/types";
import type { ParkRanks } from "@/app/utils/parkRanks";
import { useAdminMode } from "@/app/context/AdminModeContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";

type ParkPageClientProps = {
  initialId: string;
  initialPark?: Park | null;
  initialRatings?: Visit[];
  initialCoasters?: RollerCoaster[];
  initialRanks?: ParkRanks | null;
  initialExplanations?: Record<string, string>;
  initialSectionImages?: Record<string, string>;
  initialSectionLayouts?: Record<string, string>;
  initialSectionSpoilers?: Record<string, boolean>;
  /** The visit the server rendered texts and gallery for. */
  initialVisitId?: number | null;
  /** undefined = server fetch failed, fetch client-side; [] = no photos. */
  initialGalleryImages?: VisitGalleryImage[];
};

const mapWarnings = (r: Visit): Visit => ({
  ...r,
  warnings: (r.warnings ?? []).map((w: Partial<RatingWarningType>) => ({
    id: w.id, ratingId: w.ratingId, category: w.category, ride: w.ride, note: w.note,
    severity: w.severity || "Moderate",
  })) as RatingWarningType[],
});
const byDateDesc = (a: Visit, b: Visit) => new Date(b.date).getTime() - new Date(a.date).getTime();

/**
 * The park page. Phones: hero, visit line, photo deck, coasters, the review
 * (scorecard first), all photos. Desktop: hero, then three columns: scorecard,
 * photo strip + review + all photos, coasters.
 */
const ParkPage: React.FC<ParkPageClientProps> = ({
  initialId,
  initialPark = null,
  initialRatings = [],
  initialCoasters,
  initialRanks = null,
  initialExplanations = {},
  initialSectionImages = {},
  initialSectionLayouts = {},
  initialSectionSpoilers = {},
  initialVisitId = null,
  initialGalleryImages,
}) => {
  const params = useParams();
  const parkSlug = String(params?.id ?? initialId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const visitId = searchParams.get("visit");

  const [park, setPark] = useState<Park | null>(initialPark);
  const [coasters, setCoasters] = useState<RollerCoaster[]>(initialCoasters ?? []);
  const [ratings, setRatings] = useState<Visit[]>(initialRatings);
  const [galleryImages, setGalleryImages] = useState<VisitGalleryImage[]>(initialGalleryImages ?? []);
  const galleryCaptions = useMemo(() => mediaCaptions(galleryImages), [galleryImages]);
  const [loadingCoasters, setLoadingCoasters] = useState(initialCoasters === undefined);
  const [loadingGallery, setLoadingGallery] = useState(initialGalleryImages === undefined);
  // First run of the visit-data effect is skipped for the visit the server
  // already rendered; switching visits (or a failed seed) still fetches.
  const seededVisitRef = useRef<number | null>(
    initialGalleryImages !== undefined && initialVisitId != null ? initialVisitId : null
  );
  const [showCoasterModal, setShowCoasterModal] = useState(false);
  const [editingCoaster, setEditingCoaster] = useState<RollerCoaster>();
  const [stripEditorOpen, setStripEditorOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>(initialExplanations);
  const [sectionImages, setSectionImages] = useState<Record<string, string>>(initialSectionImages);
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, string>>(initialSectionLayouts);
  const [sectionSpoilers, setSectionSpoilers] = useState<Record<string, boolean>>(initialSectionSpoilers);
  const { isAdminMode } = useAdminMode();

  // --- Admin menu & delete flow ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteContext, setDeleteContext] = useState<"select" | { type: "park" } | { type: "visit", rating: Visit }>("select");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCloseModal = () => { router.push(pathname, { scroll: false }); };
  const handleRefreshData = () => { refreshRatings(); fetchParkData(); };

  const executeDelete = async () => {
    if (!park?.id || deleteContext === "select") return;
    setIsDeleting(true);
    try {
      if (deleteContext.type === "park") {
        const res = await fetch(`/api/park/${park.id}`, { method: "DELETE" });
        if (res.ok) { router.push("/"); router.refresh(); } else console.error("Failed to delete park");
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
    if (park?.name) document.title = `${park.name} | Parkrating`;
    else if (parkSlug && parkSlug !== "undefined") {
      document.title = `${String(parkSlug).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} | Parkrating`;
    } else document.title = "Parkrating";
  }, [park, parkSlug, visitId]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!parkSlug || parkSlug === "undefined" || parkSlug === "null") return;
    // Server already sent park, ratings and coasters. Only fetch when a seed is missing.
    if (initialPark && initialCoasters !== undefined) return;
    (async () => {
      try {
        const parkRes = await fetch(`/api/park/${parkSlug}`);
        const parkData = await parkRes.json();
        if (!parkRes.ok || parkData.error) {
          console.error("Park not found or API error:", parkData.error);
          setLoadingCoasters(false);
          setLoadingGallery(false);
          return;
        }
        const numericParkId = parkData.id;
        const noStore = { cache: "no-store" as const, headers: { Pragma: "no-cache", "Cache-Control": "no-cache" } };
        const [coastersRes, ratingsRes] = await Promise.all([
          fetch(`/api/park/${numericParkId}/coasters`, noStore),
          fetch(`/api/park/${numericParkId}/ratings`, noStore),
        ]);
        const coastersData = await coastersRes.json();
        const ratingsData = await ratingsRes.json();
        setCoasters(Array.isArray(coastersData) ? coastersData : []);
        setRatings(
          (Array.isArray(ratingsData?.ratings) ? ratingsData.ratings : [])
            .filter((r: Visit) => r.parkId === numericParkId)
            .map(mapWarnings)
            .sort(byDateDesc)
        );
        setPark(parkData);
        setLoadingCoasters(false);
      } catch (error) {
        console.error("Failed to fetch park data:", error);
        setLoadingCoasters(false);
      }
    })();
  }, [parkSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRatings = ratings.filter((r) => isAdminMode || r.published);
  const selectedRating = visibleRatings.find((r) => r.id.toString() === visitId);
  const activeVisit = selectedRating ?? visibleRatings[0];
  const activeRatingId = activeVisit?.id;

  useEffect(() => {
    if (!park?.id || !activeRatingId) {
      setGalleryImages([]);
      setLoadingGallery(false);
      return;
    }
    if (seededVisitRef.current !== null && seededVisitRef.current === activeRatingId) {
      seededVisitRef.current = null;
      setLoadingGallery(false);
      return;
    }
    seededVisitRef.current = null;

    (async () => {
      setLoadingGallery(true);
      try {
        const [explanationsRes, galleryRes] = await Promise.all([
          fetch(`/api/park/${park.id}/parkTexts?visitId=${activeRatingId}`),
          fetch(`/api/visits/${activeRatingId}/gallery`),
        ]);
        if (!explanationsRes.ok) throw new Error(`Explanations API failed: ${explanationsRes.statusText}`);
        if (!galleryRes.ok) throw new Error(`Gallery API failed: ${galleryRes.statusText}`);
        const explanationsData = await explanationsRes.json();
        const galleryData = await galleryRes.json();
        if (!Array.isArray(explanationsData)) throw new Error("Unexpected response from parkTexts API");

        const explanationMap: Record<string, string> = {};
        const imageMap: Record<string, string> = {};
        const layoutMap: Record<string, string> = {};
        const spoilerMap: Record<string, boolean> = {};
        for (const item of explanationsData) {
          if (!item.visitId || item.visitId === activeRatingId) {
            explanationMap[item.category] = item.text;
            if (item.imageUrl) imageMap[item.category] = item.imageUrl;
            if (item.imageLayout) layoutMap[item.category] = item.imageLayout;
            spoilerMap[item.category] = item.isSpoiler || false;
          }
        }
        setExplanations(explanationMap);
        setSectionImages(imageMap);
        setSectionLayouts(layoutMap);
        setSectionSpoilers(spoilerMap);
        setGalleryImages(galleryData.gallery || []);
      } catch (error) {
        console.error("Failed to fetch visit data:", error);
      } finally {
        setLoadingGallery(false);
      }
    })();
  }, [park, activeRatingId]);

  const refreshGallery = async () => {
    if (!activeRatingId) return;
    try {
      const res = await fetch(`/api/visits/${activeRatingId}/gallery`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gallery fetch failed");
      const data = await res.json();
      setGalleryImages(data.gallery || []);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshCoasters = async () => {
    if (!park?.id) return;
    const res = await fetch(`/api/park/${park.id}/coasters`);
    setCoasters(await res.json());
  };

  const fetchParkData = async () => {
    if (!parkSlug || parkSlug === "undefined" || parkSlug === "null") return;
    const res = await fetch(`/api/park/${parkSlug}`);
    setPark(await res.json());
  };

  const refreshRatings = async () => {
    if (!park?.id) return;
    const res = await fetch(`/api/park/${park.id}/ratings`, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    });
    const ratingsData = await res.json();
    setRatings(
      (Array.isArray(ratingsData?.ratings) ? ratingsData.ratings : [])
        .filter((r: Visit) => r.parkId === park.id)
        .map(mapWarnings)
        .sort(byDateDesc)
    );
  };

  // The server seeds published visits only; reload the full list whenever
  // admin mode is on, so pending reviews can be seen and published.
  useEffect(() => {
    if (!isAdminMode || !park?.id) return;
    refreshRatings().catch((err) => console.error("Failed to load draft visits:", err));
  }, [isAdminMode, park?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Every photo on the page opens in the one viewer (the gallery's), by its place in the gallery. */
  const openPhoto = (url: string) => {
    const i = galleryImages.findIndex((g) => g.path === url);
    if (i >= 0) setLightboxIndex(i);
    else window.open(url, "_blank");
  };

  if (!park) return <LoadingSpinner />;

  const descriptionMedia = (sectionImages.description || "").split(",").filter(Boolean);

  const adminMenu = isAdminMode && activeVisit && (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50 cursor-pointer"
        aria-label="Visit settings"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in-up origin-top-right">
          <Link
            href={`?modal=true&pendingParkId=${park.id}&editRatingId=${activeVisit.id}`}
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
            onClick={() => { setIsMenuOpen(false); setShowDeleteModal(true); setDeleteContext("select"); setConfirmText(""); }}
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
  );

  const review = activeVisit ? (
    <section id="review" className="scroll-mt-20">
      {/* Phones: "Our review" opens the scorecard. Desktop has the scorecard in the rail, so Introduction leads as before. */}
      <div className="flex items-center justify-between gap-4 lg:hidden">
        <h2 className="text-3xl font-bold text-white tracking-tight">Our review</h2>
        <div className="flex items-center gap-3">
          <VisitSwitcher visits={visibleRatings} active={activeVisit} parkSlug={park.slug} />
          {adminMenu}
        </div>
      </div>
      <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-5 lg:hidden" />
      {isAdminMode && <div className="hidden lg:flex justify-end mb-3">{adminMenu}</div>}

      {/* Phones: the scorecard opens the review and is its table of contents. Desktop has it in the left rail. */}
      <ParkScorecard rating={activeVisit} ranks={initialRanks} className="lg:hidden mb-10" />

      <div id="section-description" className="scroll-mt-6 mb-12">
        <h2 className="text-4xl font-bold text-white tracking-tight">Introduction</h2>
        <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-4" />
        <SectionBody
          text={explanations.description ?? "No description available."}
          media={descriptionMedia}
          layout={sectionLayouts.description}
          defaultLayout="below"
          isSpoiler={sectionSpoilers.description || false}
          isAdminMode={isAdminMode}
          altLabel="Introduction"
          textClassName="text-slate-400 text-base leading-relaxed"
          onMediaClick={(url) => openPhoto(url)}
          captions={galleryCaptions}
        />
      </div>

      <ParkText
        rating={activeVisit}
        explanations={explanations}
        sectionImages={sectionImages}
        sectionLayouts={sectionLayouts}
        sectionSpoilers={sectionSpoilers}
        galleryImages={galleryImages}
        parkId={park.id}
        parkName={park.name}
        onWarningsUpdate={refreshRatings}
        onGalleryUpdate={refreshGallery}
        onMediaOpen={openPhoto}
        onSectionsUpdate={(texts, images, layouts, spoilers) => {
          setExplanations(texts);
          setSectionImages(images);
          setSectionLayouts(layouts);
          setSectionSpoilers(spoilers);
        }}
        coasters={coasters}
      />
    </section>
  ) : (
    <section className="py-10 text-center text-slate-500">No published visit yet.</section>
  );

  const coasterListProps = {
    coasters,
    loading: loadingCoasters,
    isAdminMode,
    onAdd: () => { setEditingCoaster(undefined); setShowCoasterModal(true); },
    onEdit: (c: RollerCoaster) => { setEditingCoaster(c); setShowCoasterModal(true); },
  };

  return (
    <div className="w-full bg-[#0f172a] overflow-x-clip">
      <ParkHero
        park={park}
        visit={activeVisit ?? null}
        visitCount={ratings.length}
        cardRating={ratings.find((r) => r.published) ?? ratings[0] ?? null}
        ranks={initialRanks}
        isAdminMode={isAdminMode}
        onUpdate={() => { fetchParkData(); refreshRatings(); }}
        onOpenPhoto={openPhoto}
      />

      <div className="w-full px-4 sm:px-6 md:px-20 pt-4 lg:pt-7 pb-12">
        {/* Phones: the deck and the coasters come before the review. */}
        <div className="lg:hidden space-y-9 mb-10">
          {activeRatingId && (
            <PhotoDeck
              images={galleryImages}
              parkName={park.name}
              onOpen={(img) => openPhoto(img.path)}
              isAdminMode={isAdminMode}
              onEdit={() => setStripEditorOpen(true)}
            />
          )}
          <ParkCoasterList {...coasterListProps} cap={7} />
        </div>

        <div className="lg:grid lg:grid-cols-[1.4fr_5.5fr_3.5fr] [@media(min-width:2560px)]:lg:grid-cols-[1.8fr_6fr_3.5fr] lg:gap-6">
          <aside className="hidden lg:block min-w-0">
            {activeVisit && (
              <div className="sticky top-6">
                <VisitSwitcher visits={visibleRatings} active={activeVisit} parkSlug={park.slug} className="mb-5" />
                <ParkScorecard rating={activeVisit} ranks={initialRanks} label="Scorecard" />
              </div>
            )}
          </aside>

          <div className="min-w-0 space-y-12">
            {activeRatingId && galleryImages.length > 0 && (
              <div className="hidden lg:block">
                <CoasterPhotoStrip
                  images={galleryImages}
                  coasterName={park.name}
                  onOpen={openPhoto}
                  isAdminMode={isAdminMode}
                  onEdit={() => setStripEditorOpen(true)}
                />
              </div>
            )}

            {review}
          </div>

          {/* Desktop: coasters, then the full gallery, in the right column. Phones: the gallery alone, after the review. */}
          <aside className="min-w-0 mt-12 lg:mt-0 space-y-12">
            <div className="hidden lg:block">
              <ParkCoasterList {...coasterListProps} />
            </div>
            {activeRatingId && (galleryImages.length > 0 || isAdminMode || loadingGallery) && (
              <VisitGallery
                visitId={activeRatingId}
                parkName={park.name}
                initialImages={galleryImages}
                refreshImages={refreshGallery}
                onHeaderChanged={() => { refreshRatings(); fetchParkData(); }}
                loading={loadingGallery}
                selectedIndex={lightboxIndex}
                onSelectedIndexChange={setLightboxIndex}
                renderViewer={false}
              />
            )}
          </aside>
        </div>

        <div className="flex justify-center mt-12 lg:mt-16 pt-8 border-t border-slate-800">
          <MainPageButton />
        </div>
      </div>

      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <PhotoViewer
          images={galleryImages}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          parkName={park.name}
          isAdminMode={isAdminMode}
          onImagesChanged={refreshGallery}
        />
      )}

      {showCoasterModal && (
        <CoasterCreatorModal
          parkId={park.id}
          coaster={editingCoaster}
          onClose={() => { setShowCoasterModal(false); setEditingCoaster(undefined); refreshCoasters(); }}
          onCoasterAdded={refreshCoasters}
        />
      )}

      {isAdminMode && stripEditorOpen && activeRatingId && (
        <CoasterStripEditor
          coasterId={activeRatingId}
          coasterName={park.name}
          gallery={galleryImages}
          endpoint={`/api/visits/${activeRatingId}/gallery`}
          onClose={() => setStripEditorOpen(false)}
          onSaved={refreshGallery}
        />
      )}

      {/* --- Delete modal --- */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
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
                        <span className="text-slate-200 font-medium block">{new Date(rating.date).toLocaleDateString("en-GB", { timeZone: "UTC" })}</span>
                        <span className="text-xs text-slate-500">Score: {Number(rating.overall).toFixed(2)}</span>
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

            {deleteContext !== "select" && deleteContext.type === "visit" && (
              <div className="animate-fade-in-up">
                <h3 className="text-2xl font-bold text-white mb-2">Delete Visit?</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Are you sure you want to delete the visit from <strong className="text-white">{new Date(deleteContext.rating.date).toLocaleDateString("en-GB", { timeZone: "UTC" })}</strong>? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 mt-auto">
                  <button onClick={() => setDeleteContext("select")} disabled={isDeleting} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 cursor-pointer">Back</button>
                  <button onClick={executeDelete} disabled={isDeleting} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                    {isDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            )}

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

      <RatingModal closeModal={handleCloseModal} fetchRatingsAndParks={handleRefreshData} />
    </div>
  );
};

export default ParkPage;
