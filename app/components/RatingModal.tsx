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
  Europe: ["Austria","Belgium","Bulgaria","Croatia","Czech Republic","Denmark","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Malta","Netherlands","Norway","Poland","Portugal","Romania","Spain","Sweden","Switzerland","Turkey","United Kingdom"],
  "North America": ["Canada","Mexico","Puerto Rico","United States"],
  "Central America": ["Costa Rica","Cuba","Dominican Republic","El Salvador","Guatemala","Honduras","Nicaragua","Panama"],
  "South America": ["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Paraguay","Peru","Uruguay","Venezuela"],
  Asia: ["China","India","Indonesia","Japan","Malaysia","South Korea","Thailand","Vietnam"],
  Oceania: ["Australia","New Zealand","Fiji"],
  Africa: ["South Africa","Egypt","Kenya","Nigeria","Morocco","Tunisia"],
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

/** Store snapshot (no re-render storms) */
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

  const [parkInfo, setParkInfo] = useState({
    name: "",
    continent: "",
    country: "",
    city: "",
    image: null as File | null,
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category: Category = CATEGORIES[categoryIndex];

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to top when category changes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }, [categoryIndex]);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  useEffect(() => {
    if (!parkInfo.image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(parkInfo.image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [parkInfo.image]);

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
    Boolean(parkInfo.image) &&
    selectedDate !== null;

  const submitData = async () => {
    setLoading(true);
    try {
      let imagePath = "/images/Error.PNG";
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

      const parkResponse = await fetch("/api/parks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parkPayload),
      });
      if (!parkResponse.ok) {
        const err = await parkResponse.json().catch(() => ({}));
        alert(`Error creating park: ${err.message || "Unknown error"}`);
        return;
      }

      const savedPark = await parkResponse.json();
      const ratingPayload = {
        ...ratingsStore.all(),
        date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
        parkId: savedPark.parkId,
      };

      const ratingResponse = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratingPayload),
      });
      if (!ratingResponse.ok) {
        alert("Failed to save rating");
      } else {
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
        className="fixed left-0 right-0 top-0 z-[9999] bg-black/50 dark:bg-black/70 backdrop-blur-sm flex justify-center items-start"
        style={{
          height: "100dvh",
          paddingTop: "120px",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={closeModal}
      >
        <div
          className="bg-white dark:bg-gray-900 dark:text-gray-100 border border-transparent dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] relative flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scroll container */}
          <div
            ref={scrollContainerRef}
            className="relative flex-1 overflow-y-auto"
            style={{
              WebkitOverflowScrolling: "touch",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
            }}
          >
            {/* Close */}
            <button
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-300 dark:text-gray-400 dark:hover:text-white text-2xl transition cursor-pointer z-[10000]"
              onClick={closeModal}
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Title */}
            <h2 className="px-4 sm:px-8 pt-8 pb-4 text-2xl sm:text-3xl text-center font-bold">
              {step === 1 && "Step 1: Park Details"}
              {step === 2 && "Step 2: Rate the Park"}
              {step === 3 && "Step 3: Summary"}
            </h2>

            <AnimatePresence mode="wait">
              {/* STEP 1 */}
              {step === 1 && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="px-4 sm:px-8 pb-24 space-y-4"
                >
                  <DatePicker
                    selected={selectedDate}
                    onChange={(d) => setSelectedDate(d)}
                    className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                    placeholderText="Select visit date"
                    dateFormat="yyyy-MM-dd"
                  />
                  <input
                    placeholder="Park name"
                    value={parkInfo.name}
                    onChange={(e) => setParkInfo((p) => ({ ...p, name: e.target.value }))}
                    className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />
                  <select
                    value={parkInfo.continent}
                    onChange={(e) =>
                      setParkInfo((p) => ({ ...p, continent: e.target.value, country: "" }))
                    }
                    className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <option value="">Select Continent</option>
                    {Object.keys(continentCountries).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={parkInfo.country}
                    disabled={!parkInfo.continent}
                    onChange={(e) => setParkInfo((p) => ({ ...p, country: e.target.value }))}
                    className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 disabled:opacity-60"
                  >
                    <option value="">Select Country</option>
                    {parkInfo.continent &&
                      continentCountries[parkInfo.continent]?.map((country) => (
                        <option key={country}>{country}</option>
                      ))}
                  </select>
                  <input
                    placeholder="City"
                    value={parkInfo.city}
                    onChange={(e) => setParkInfo((p) => ({ ...p, city: e.target.value }))}
                    className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                  />

                  {/* Image chooser + preview */}
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 cursor-pointer">
                      Choose Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          setParkInfo((p) => ({ ...p, image: e.target.files?.[0] ?? null }))
                        }
                      />
                    </label>
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md border border-gray-300 dark:border-gray-700"
                      />
                    )}
                  </div>
                  {parkInfo.image && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      Selected: {parkInfo.image.name}
                    </p>
                  )}

                  <button
                    disabled={!isFormValid}
                    onClick={() => {
                      if (!isFormValid) {
                        alert("Please fill out all required fields.");
                        return;
                      }
                      setStep(2);
                    }}
                    className={`w-full mt-6 p-3 rounded-md font-semibold text-white transition cursor-pointer ${
                      isFormValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Proceed to ratings →
                  </button>
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <motion.div
                  key="ratings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="pb-24"
                >
                  {/* Sticky header */}
                  <div className="sticky top-0 left-0 right-0 z-[10001] w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 pt-3 pb-3 shadow-sm">
                    <ProgressBar categories={CATEGORIES} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          setCategoryIndex((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length)
                        }
                        className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs sm:text-sm cursor-pointer"
                      >
                        ← Prev
                      </button>

                      <div className="text-sm sm:text-base font-semibold truncate text-center">
                        {toTitleCaseFromCamel(category)} · {categoryIndex + 1}/{CATEGORIES.length}
                      </div>

                      <button
                        onClick={() => {
                          if (categoryIndex === CATEGORIES.length - 1) setStep(3);
                          else setCategoryIndex((i) => (i + 1) % CATEGORIES.length);
                        }}
                        className="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs sm:text-sm cursor-pointer"
                      >
                        {categoryIndex === CATEGORIES.length - 1 ? "Finish →" : "Next →"}
                      </button>
                    </div>
                  </div>

                  {/* Lane */}
                  <div className="px-4 sm:px-8 pt-6">
                    <ParkRankLane
                      key={category}
                      category={category}
                      newParkName={parkInfo.name || "New Park"}
                      initialRating={ratingsStore.get(category)}
                      newParkImageUrl={imagePreview ?? undefined}
                      onSetRating={(v) => ratingsStore.set(category, v)}
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="px-4 sm:px-8 pb-28 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Summary</h3>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm underline cursor-pointer"
                      aria-label="Edit park details"
                    >
                      Edit park details
                    </button>
                  </div>

                  <div className="text-gray-700 dark:text-gray-300 space-y-1">
                    <div><strong>Park:</strong> {parkInfo.name}</div>
                    <div><strong>Location:</strong> {parkInfo.city}, {parkInfo.country}</div>
                    <div><strong>Date:</strong> {selectedDate?.toISOString().split("T")[0]}</div>
                  </div>

                  <SummaryList
                    categories={CATEGORIES}
                    onEditCategory={(cat) => jumpToCategory(cat)}
                  />

                  <button
                    onClick={submitData}
                    disabled={loading}
                    className={`mt-6 w-full p-3 text-white font-semibold rounded-md transition cursor-pointer ${
                      loading
                        ? "bg-gray-400 dark:bg-gray-600"
                        : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                    }`}
                  >
                    {loading ? <Loading /> : "Submit All Ratings"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Suspense>
  );
};

export default RatingModal;
