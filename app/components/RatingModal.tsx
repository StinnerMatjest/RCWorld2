"use client";

import React, { useRef, useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Loading from "./Loading";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ParkRankLane from "./ParkRankLane";
import { AnimatePresence, motion } from "framer-motion";
import { useSyncExternalStore } from "react";
import { ratingsStore, type Ratings } from "@/app/utils/ratingStoreManager";
import { getRatingColor } from "@/app/utils/design";

interface ModalProps {
  closeModal: () => void;
  fetchRatingsAndParks: () => void;
}

const continentCountries: Record<string, string[]> = {
  Europe: ["Austria", "Belgium", "Bulgaria", "Croatia", "Czech Republic", "Denmark", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Malta", "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Spain", "Sweden", "Switzerland", "Turkey", "United Kingdom"],
  "North America": ["Canada", "Mexico", "Puerto Rico", "United States"],
  "Central America": ["Costa Rica", "Cuba", "Dominican Republic", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama"],
  "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Paraguay", "Peru", "Uruguay", "Venezuela"],
  Asia: ["China", "India", "Indonesia", "Japan", "Malaysia", "South Korea", "Thailand", "Vietnam"],
  Oceania: ["Australia", "New Zealand", "Fiji"],
  Africa: ["South Africa", "Egypt", "Kenya", "Nigeria", "Morocco", "Tunisia"],
};

const CATEGORIES = [
  "parkAppearance",
  "bestCoaster",
  "coasterDepth",
  "waterRides",
  "flatridesAndDarkrides",
  "food",
  "snacksAndDrinks",
  "parkPracticality",
  "rideOperations",
  "parkManagement",
] as const;

type Category = typeof CATEGORIES[number];

function toTitleCaseFromCamel(key: string) {
  const spaced = key.replace(/([A-Z])/g, " $1").trim();
  return spaced
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function useRatingsSnapshot(): Ratings {
  return useSyncExternalStore<Ratings>(
    ratingsStore.subscribe,
    ratingsStore.getSnapshot,
    ratingsStore.getServerSnapshot
  );
}

function ProgressBar({ categories }: { categories: readonly string[] }) {
  const ratings = useRatingsSnapshot();
  const ratedCount = categories.reduce((acc, c) => acc + (ratings[c] !== undefined ? 1 : 0), 0);
  const progressPct = Math.round((ratedCount / categories.length) * 100);
  return (
    <div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="mt-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 text-right">
        {ratedCount}/{categories.length} categories rated
      </div>
    </div>
  );
}

function SummaryList({
  categories,
  onEditCategory,
}: {
  categories: readonly string[];
  onEditCategory: (cat: string) => void;
}) {
  const ratings = useRatingsSnapshot();
  return (
    <div className="mt-4 border-t border-gray-300 dark:border-gray-700 pt-3 space-y-1 max-h-[40vh] overflow-y-auto">
      {categories.map((c) => {
        const val = ratings[c];
        const text = val !== undefined ? val.toFixed(1) : "0.0";
        const color = val !== undefined ? getRatingColor(val) : "";
        return (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="truncate">{toTitleCaseFromCamel(c)}</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${color}`}>{text}</span>
              <button
                type="button"
                onClick={() => onEditCategory(c)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={`Edit ${c}`}
                title="Edit"
              >
                ✎
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const RatingModal: React.FC<ModalProps> = ({ closeModal, fetchRatingsAndParks }) => {
  const searchParams = useSearchParams();
  const isOpen = searchParams?.get("modal") === "true";
  const pendingParkId = searchParams?.get("pendingParkId");

  const [parkInfo, setParkInfo] = useState({
    name: "",
    continent: "",
    country: "",
    city: "",
    image: null as File | null,
    existingImagePath: "" as string,
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [isDraftPark, setIsDraftPark] = useState(false);
  const [editingParkId, setEditingParkId] = useState<string | null>(null);

  const [visitDetails, setVisitDetails] = useState({
    start: "",
    end: "",
    durationMinutes: 0,
  });

  const [loading, setLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category: Category = CATEGORIES[categoryIndex];

  const [pendingGalleryImages, setPendingGalleryImages] = useState<{ title: string; url: string }[]>([]);
  const [pendingCoasterStats, setPendingCoasterStats] = useState<{ id: number; count: number }[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsFetchingData(true);
      return;
    }

    const importSlug = searchParams?.get("importChecklist");

    async function fetchModalData() {
      setIsFetchingData(true);
      try {
        let cl: any = null;
        let slugToFetch = importSlug;
        let fetchedParkData: any = null;

        // Fetch Park Data
        if (pendingParkId) {
          const pRes = await fetch(`/api/park/${pendingParkId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (!pData.error) fetchedParkData = pData;
          }
        }

        // Hunt for Checklist via park slug
        if (pendingParkId && fetchedParkData && !slugToFetch) {
          try {
            const clListRes = await fetch("/api/checklists");
            if (clListRes.ok) {
              const clListData = await clListRes.json();
              const lists = Array.isArray(clListData) ? clListData : (clListData.checklists || []);

              // Fallback match: check ID, OR check if the checklist slug starts with the park's slug
              const match = lists.find((c: any) =>
                String(c.park_id) === String(pendingParkId) ||
                String(c.parkId) === String(pendingParkId) ||
                (c.slug && fetchedParkData.slug && c.slug.includes(fetchedParkData.slug))
              );
              if (match) slugToFetch = match.slug;
            }
          } catch (e) {
            console.error("Could not fetch checklists list", e);
          }
        }

        // Fetch Checklist Details
        if (slugToFetch) {
          try {
            const res = await fetch(`/api/checklists/${slugToFetch}`);
            if (res.ok) {
              const data = await res.json();
              if (data.checklist) cl = data.checklist;
            }
          } catch (e) {
            console.error("Could not fetch checklist details", e);
          }
        }

        // Fetch Park Data if we ONLY have the checklist (And haven't fetched park yet)
        if (!fetchedParkData && cl) {
          let lookupId = cl.park_id || cl.parkId;

          if (!lookupId && cl.slug) {
            lookupId = cl.slug.split("-visit-")[0];
          }

          if (lookupId) {
            const pRes = await fetch(`/api/park/${lookupId}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (!pData.error) fetchedParkData = pData;
            }
          }
        }

        // Apply Park Data to Form
        if (fetchedParkData) {
          setEditingParkId(fetchedParkData.id.toString());

          const draft = fetchedParkData.continent === "Unknown" || fetchedParkData.country === "Unknown";
          setIsDraftPark(draft);

          let fallbackName = fetchedParkData.name;
          if (!fallbackName && cl?.title) {
            fallbackName = cl.title.replace(/\s\d{4}\sVisit$/i, "").trim();
          }

          setParkInfo({
            name: fallbackName || "",
            continent: draft ? "" : (fetchedParkData.continent || ""),
            country: draft ? "" : (fetchedParkData.country || ""),
            city: draft || fetchedParkData.city === "Unknown" ? "" : (fetchedParkData.city || ""),
            existingImagePath: draft || fetchedParkData.imagepath === "/images/error.PNG" || fetchedParkData.imagepath === "/images/Error.PNG" ? "" : (fetchedParkData.imagepath || ""),
            image: null,
          });

          if (draft) {
            setIsLocked(false);
          } else {
            setIsLocked(Boolean(importSlug && !pendingParkId));
          }

          const ratingsRes = await fetch(`/api/park/${fetchedParkData.id}/ratings`);
          if (ratingsRes.ok) {
            const ratingsData = await ratingsRes.json();
            if (ratingsData.ratings && ratingsData.ratings.length > 0) {
              const latest = ratingsData.ratings[0];
              CATEGORIES.forEach((cat) => {
                if (latest[cat] !== undefined) {
                  ratingsStore.set(cat, latest[cat]);
                }
              });
            }
          }
        } else {
          setEditingParkId(null);
          setIsDraftPark(false);
          setIsLocked(false);

          let fallbackName = "";
          if (cl?.title) fallbackName = cl.title.replace(/\s\d{4}\sVisit$/i, "").trim();

          setParkInfo(prev => ({
            ...prev,
            name: fallbackName,
            continent: "",
            country: "",
            city: "",
            existingImagePath: "",
            image: null
          }));
        }

        // Populate Visit Stats
        let vStart = cl?.visit_start;
        let vEnd = cl?.visit_end;
        let vDur = cl?.duration;

        if (!vStart && typeof window !== "undefined") {
          const localStart = window.localStorage.getItem("parkrating-visit-start-v1");
          if (localStart) {
            vStart = localStart;
            vEnd = window.localStorage.getItem("parkrating-visit-end-v1") || "";
            const localDur = window.localStorage.getItem("parkrating-visit-duration-v1");
            vDur = localDur ? parseInt(localDur, 10) : 0;
          }
        }

        if (vStart) {
          setSelectedDate(new Date(vStart));
          setVisitDetails({
            start: vStart,
            end: vEnd || "",
            durationMinutes: vDur ? Math.floor(vDur / 60) : 0,
          });
        } else {
          setSelectedDate(new Date());
        }

        // Sync checklist images and coasters
        if (cl) {
          const imagesToSync = (cl.items || [])
            .filter((item: any) => item.imageUrl && !item.skipped)
            .map((item: any) => ({
              title: item.label,
              url: item.imageUrl,
            }));
          setPendingGalleryImages(imagesToSync);

          const coastersToSync = (cl.items || [])
            .filter((item: any) => item.isCoaster && item.rideCount > 0 && !item.skipped)
            .map((item: any) => {
              const idString = item.id.replace("pic-coaster-", "");
              return {
                id: parseInt(idString, 10),
                count: item.rideCount,
              };
            });
          setPendingCoasterStats(coastersToSync);
        }

      } catch (error) {
        console.error("Failed to load modal data:", error);
      } finally {
        setIsFetchingData(false);
      }
    }

    fetchModalData();
  }, [searchParams, isOpen, pendingParkId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [categoryIndex]);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  useEffect(() => {
    if (parkInfo.image) {
      const url = URL.createObjectURL(parkInfo.image);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (parkInfo.existingImagePath) {
      setImagePreview(parkInfo.existingImagePath);
    } else {
      setImagePreview(null);
    }
  }, [parkInfo.image, parkInfo.existingImagePath]);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const isFormValid =
    Boolean(parkInfo.name) &&
    Boolean(parkInfo.continent) &&
    Boolean(parkInfo.country) &&
    Boolean(parkInfo.city) &&
    (Boolean(parkInfo.image) || Boolean(parkInfo.existingImagePath)) &&
    selectedDate !== null;

  const handleDeleteDraft = async () => {
    if (!editingParkId) return;
    if (!confirm("Are you sure you want to delete this draft park? This will permanently remove the park, its coasters, and its checklist.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/park/${editingParkId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        closeModal();
        fetchRatingsAndParks();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete draft park");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while deleting the draft park.");
    } finally {
      setLoading(false);
    }
  };

  const submitData = async () => {
    setLoading(true);
    try {
      let imagePath = parkInfo.existingImagePath || "/images/Error.PNG";

      if (parkInfo.image) {
        const formData = new FormData();
        formData.append("file", parkInfo.image);
        const r2Response = await fetch("/api/upload", { method: "POST", body: formData });
        if (r2Response.ok) {
          const r2Result = await r2Response.json();
          imagePath = r2Result.imagePath;
        } else {
          alert("Image upload failed");
          return;
        }
      }

      const parkPayload = {
        name: parkInfo.name,
        continent: parkInfo.continent,
        country: parkInfo.country,
        city: parkInfo.city,
        imagepath: imagePath,
      };

      let finalParkId = editingParkId;

      if (editingParkId && isDraftPark) {
        const parkResponse = await fetch(`/api/park/${editingParkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parkPayload),
        });
        if (!parkResponse.ok) throw new Error("Failed to update draft park");

      } else if (!editingParkId) {
        const parkResponse = await fetch("/api/parks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...parkPayload, slug: "" }),
        });
        if (!parkResponse.ok) throw new Error("Failed to create park");
        const savedPark = await parkResponse.json();
        finalParkId = savedPark.parkId;
      }

      const ratingPayload = {
        ...ratingsStore.all(),
        date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
        visitStart: visitDetails.start || null,
        visitEnd: visitDetails.end || null,
        duration: visitDetails.durationMinutes > 0 ? (visitDetails.durationMinutes / 60).toFixed(2) : 0,
        parkId: finalParkId,
      };

      const ratingResponse = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingPayload),
      });

      if (!ratingResponse.ok) {
        alert("Failed to save rating");
      } else {
        try {
          const syncPromises = [];

          if (pendingGalleryImages.length > 0) {
            for (const img of pendingGalleryImages) {
              let cleanTitle = img.title || "Extra Park Photo";
              const lowerLabel = cleanTitle.toLowerCase();

              if (lowerLabel.includes("park entrance")) cleanTitle = `${parkInfo.name} Entrance`;
              else if (lowerLabel.includes("food")) cleanTitle = `${parkInfo.name} Food`;
              else if (lowerLabel.includes("snacks")) cleanTitle = `${parkInfo.name} Snacks & Drinks`;
              else if (lowerLabel.includes("flatrides")) cleanTitle = `${parkInfo.name} Flatrides`;
              else if (lowerLabel.includes("inside park picture")) {
                const numMatch = lowerLabel.match(/\d+/);
                cleanTitle = `${parkInfo.name} Scenery ${numMatch ? numMatch[0] : ""}`.trim();
              } else cleanTitle = cleanTitle.replace(/^take picture of\s+/i, "");

              syncPromises.push(
                fetch(`/api/park/${finalParkId}/gallery`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    title: cleanTitle,
                    path: img.url,
                    description: cleanTitle,
                    parkId: finalParkId,
                  }),
                })
              );
            }
          }

          if (pendingCoasterStats.length > 0) {
            syncPromises.push(
              fetch(`/api/park/${finalParkId}/coasters`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ updates: pendingCoasterStats }),
              })
            );
          }

          await Promise.allSettled(syncPromises);
        } catch (syncError) {
          console.error("Non-fatal error during background sync:", syncError);
        }

        alert("All ratings submitted successfully!");
        setTimeout(() => closeModal(), 800);
      }
    } catch (e) {
      console.error(e);
      alert("Submission failed.");
    } finally {
      setLoading(false);
      fetchRatingsAndParks();
    }
  };

  const jumpToCategory = (cat: string) => {
    const idx = CATEGORIES.indexOf(cat as Category);
    if (idx >= 0) {
      setCategoryIndex(idx);
      setStep(2);
    }
  };

  if (!isOpen) return null;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div
        className="fixed left-0 right-0 top-0 z-[9999] bg-black/60 dark:bg-black/80 flex justify-center items-start overflow-hidden"
        style={{ height: "100dvh", paddingTop: "120px" }}
        onClick={closeModal}
      >
        <div
          className="bg-white dark:bg-gray-900 dark:text-gray-100 border border-transparent dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] relative flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={scrollContainerRef}
            className="relative flex-1 overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
          >
            <button
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-300 dark:text-gray-400 dark:hover:text-white text-2xl transition cursor-pointer z-[10000]"
              onClick={closeModal}
            >
              ✕
            </button>

            {isFetchingData ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 dark:text-gray-400">
                <div className="w-12 h-12 mb-4 animate-spin text-blue-500">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                  </svg>
                </div>
                <p className="text-sm font-medium animate-pulse">Loading park data...</p>
              </div>
            ) : (
              <>
                <h2 className="px-4 sm:px-8 pt-8 pb-4 text-2xl sm:text-3xl text-center font-bold">
                  {step === 1 && "Step 1: Park Details"}
                  {step === 2 && "Step 2: Rate the Park"}
                  {step === 3 && "Step 3: Summary"}
                </h2>

                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="info"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ willChange: "transform, opacity" }}
                      className="px-4 sm:px-8 pb-24 space-y-4 transform-gpu"
                    >
                      {isLocked && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold uppercase tracking-wider mb-2">
                          <span>🔒 Checklist Data Locked</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Visit Date</label>
                        <DatePicker
                          selected={selectedDate}
                          onChange={(d) => !isLocked && setSelectedDate(d)}
                          disabled={isLocked}
                          className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-60"
                          placeholderText="Select visit date"
                          dateFormat="yyyy-MM-dd"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Park Name</label>
                        <input
                          placeholder="Park name"
                          value={parkInfo.name}
                          readOnly={isLocked}
                          onChange={(e) => setParkInfo((p) => ({ ...p, name: e.target.value }))}
                          className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 read-only:opacity-60"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Continent</label>
                          <select
                            value={parkInfo.continent}
                            disabled={isLocked}
                            onChange={(e) => setParkInfo((p) => ({ ...p, continent: e.target.value, country: "" }))}
                            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-60"
                          >
                            <option value="">Continent</option>
                            {Object.keys(continentCountries).map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Country</label>
                          <select
                            value={parkInfo.country}
                            disabled={!parkInfo.continent || isLocked}
                            onChange={(e) => setParkInfo((p) => ({ ...p, country: e.target.value }))}
                            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-60"
                          >
                            <option value="">Country</option>
                            {parkInfo.continent && continentCountries[parkInfo.continent]?.map((country) => <option key={country}>{country}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">City</label>
                        <input
                          placeholder="City"
                          value={parkInfo.city}
                          readOnly={isLocked}
                          onChange={(e) => setParkInfo((p) => ({ ...p, city: e.target.value }))}
                          className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 read-only:opacity-60"
                        />
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Visit Stats</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Entry Time</label>
                            <input
                              type="datetime-local"
                              value={visitDetails.start ? new Date(new Date(visitDetails.start).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                              readOnly={isLocked}
                              onChange={(e) => setVisitDetails(v => ({ ...v, start: e.target.value }))}
                              className="w-full p-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 read-only:opacity-60"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Exit Time</label>
                            <input
                              type="datetime-local"
                              value={visitDetails.end ? new Date(new Date(visitDetails.end).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                              readOnly={isLocked}
                              onChange={(e) => setVisitDetails(v => ({ ...v, end: e.target.value }))}
                              className="w-full p-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 read-only:opacity-60"
                            />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Duration (Minutes)</label>
                            <input
                              type="number"
                              value={visitDetails.durationMinutes}
                              readOnly={isLocked}
                              onChange={(e) => setVisitDetails(v => ({ ...v, durationMinutes: parseInt(e.target.value) || 0 }))}
                              className="w-full p-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 read-only:opacity-60"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <label className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 cursor-pointer text-sm">
                          {parkInfo.existingImagePath ? "Replace Header Image" : "Choose Header Image"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setParkInfo((p) => ({ ...p, image: e.target.files?.[0] ?? null }))} />
                        </label>
                        {imagePreview && (
                          <div className="relative group">
                            <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-md border border-gray-300 dark:border-gray-700" />
                            {!parkInfo.image && parkInfo.existingImagePath && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 mt-6">
                        {isDraftPark && editingParkId && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleDeleteDraft}
                            className="px-4 py-3 rounded-md font-semibold text-red-600 bg-red-100 hover:bg-red-200 transition dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-60"
                          >
                            Delete Draft
                          </button>
                        )}
                        <button
                          disabled={!isFormValid || loading}
                          onClick={() => setStep(2)}
                          className={`flex-1 p-3 rounded-md font-semibold text-white transition ${isFormValid && !loading ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
                        >
                          Proceed to ratings →
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="ratings"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ willChange: "transform, opacity" }}
                      className="pb-24 transform-gpu"
                    >
                      <div className="sticky top-0 left-0 right-0 z-[10001] w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 pt-3 pb-3 shadow-sm">
                        <ProgressBar categories={CATEGORIES} />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button onClick={() => setCategoryIndex((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length)} className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-xs sm:text-sm">← Prev</button>
                          <div className="text-sm font-semibold truncate">{toTitleCaseFromCamel(category)} · {categoryIndex + 1}/{CATEGORIES.length}</div>
                          <button onClick={() => categoryIndex === CATEGORIES.length - 1 ? setStep(3) : setCategoryIndex((i) => (i + 1) % CATEGORIES.length)} className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-xs sm:text-sm">{categoryIndex === CATEGORIES.length - 1 ? "Finish →" : "Next →"}</button>
                        </div>
                      </div>
                      <div className="px-4 sm:px-8 pt-6">
                        <ParkRankLane key={category} category={category} newParkName={parkInfo.name || "New Park"} initialRating={ratingsStore.get(category)} newParkImageUrl={imagePreview ?? undefined} onSetRating={(v) => ratingsStore.set(category, v)} />
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="summary"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ willChange: "transform, opacity" }}
                      className="px-4 sm:px-8 pb-28 space-y-4 transform-gpu"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">Summary</h3>
                        {!isLocked && <button type="button" onClick={() => setStep(1)} className="text-sm underline">Edit details</button>}
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                        <div><strong>Park:</strong> {parkInfo.name}</div>
                        <div><strong>Date:</strong> {selectedDate?.toISOString().split("T")[0]}</div>
                        {visitDetails.durationMinutes > 0 && <div><strong>Time:</strong> {formatDuration(visitDetails.durationMinutes * 60)}</div>}
                      </div>
                      <SummaryList categories={CATEGORIES} onEditCategory={(cat) => jumpToCategory(cat)} />
                      <button onClick={submitData} disabled={loading} className={`mt-6 w-full p-3 text-white font-semibold rounded-md ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}>
                        {loading ? <Loading /> : "Submit All Ratings"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    </Suspense>
  );
};

export default RatingModal;