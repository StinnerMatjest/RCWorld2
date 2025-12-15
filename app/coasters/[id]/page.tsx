"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { RollerCoaster } from "@/app/types";
import MainPageButton from "@/app/components/MainPageButton";
import { getRatingColor } from "@/app/utils/design";
import CoasterInfo from "@/app/components/coasterpage/CoasterInfo";
import CoasterRanking, { StatBlock, SkeletonStatBlock } from "@/app/components/coasterpage/CoasterRanking";
import CoasterSpecsPanel from "@/app/components/coasterpage/CoasterSpecsPanel";
import CoasterHighlightsPanel from "@/app/components/coasterpage/CoasterHighlights";
import CoasterGallery from "@/app/components/coasterpage/CoasterGallery";
import CoasterText from "@/app/components/coasterpage/CoasterText";
import Image from "next/image";

// --- Skeleton Loader ---
const CoasterSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 font-sans animate-pulse">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="w-full">
           <div className="h-12 sm:h-16 md:h-24 bg-gray-200 dark:bg-gray-800 rounded-lg w-3/4 md:w-1/2 mb-4"></div>
           <div className="h-6 sm:h-8 w-48 sm:w-64 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
        </div>
        
        <div className="flex items-end gap-6 md:gap-12 w-full lg:w-auto justify-start lg:justify-end">
            <SkeletonStatBlock />
            <SkeletonStatBlock />
            <SkeletonStatBlock />
        </div>
      </div>
      
      <div className="w-full aspect-video md:aspect-[21/9] bg-gray-200 dark:bg-gray-800 rounded-2xl mb-8 md:mb-12"></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8 h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
        <div className="lg:col-span-4 h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
      </div>
    </div>
  </div>
);

const CoasterPage: React.FC = () => {
  const { id: coasterId } = useParams();
  
  const [coaster, setCoaster] = useState<RollerCoaster | null>(null);
  const [allCoasters, setAllCoasters] = useState<RollerCoaster[]>([]);
  const [headerImage, setHeaderImage] = useState<string | null>(null);
  const [parkName, setParkName] = useState<string | null>(null); 
  const [pageLoading, setPageLoading] = useState(true);
  const [imageVisualLoaded, setImageVisualLoaded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!pageLoading) {
      const timer = setTimeout(() => setContentVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [pageLoading]);

  useEffect(() => {
    if (!coasterId) return;

    (async () => {
      try {
        const [coasterRes, allCoastersRes] = await Promise.all([
             fetch(`/api/coasters/${coasterId}`),
             fetch("/api/coasters")
        ]);

        if (!coasterRes.ok) throw new Error("Failed to load coaster");
        
        const coasterData = await coasterRes.json();
        const allCoastersData = await allCoastersRes.json();
        const coasterObj = coasterData.coaster;

        let galleryPromise = Promise.resolve(null);
        let parkPromise = Promise.resolve("Unknown Park");

        if (coasterObj?.name && coasterObj?.parkId) {
            galleryPromise = fetch(
                `/api/coasters/${coasterId}/gallery?name=${encodeURIComponent(coasterObj.name)}&parkId=${coasterObj.parkId}`
            ).then(res => res.ok ? res.json().then(d => d.headerImage) : null)
             .catch(() => null);
        }

        if (coasterObj?.parkId) {
            parkPromise = fetch(`/api/park/${coasterObj.parkId}`)
                .then(res => res.ok ? res.json().then(d => d.name) : "Unknown Park")
                .catch(() => "Unknown Park");
        }

        const [galleryImg, fetchedParkName] = await Promise.all([galleryPromise, parkPromise]);

        setCoaster(coasterObj);
        setAllCoasters(allCoastersData.coasters || []);
        setHeaderImage(galleryImg);
        setParkName(fetchedParkName);

      } catch (err) {
        console.error("Error loading page data:", err);
      } finally {
        setPageLoading(false);
      }
    })();
  }, [coasterId]);

  const getSafeColorClass = (rating: number | null) => {
    try {
        if (!rating) return "text-gray-900 dark:text-white";
        const color = getRatingColor(Number(rating));
        // Removed "dark:text-white" so the color persists in dark mode
        return color.replace('bg-', 'text-').replace('border-', '');
    } catch {
        return "text-gray-900 dark:text-white";
    }
  };

  if (pageLoading || !coaster) return <CoasterSkeleton />;

  const baseAnim = "transition-all duration-700 ease-out transform";
  const visibleClass = "opacity-100 translate-y-0";
  const hiddenClass = "opacity-0 translate-y-4";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col lg:flex-row justify-between items-center lg:items-end gap-6 lg:gap-8 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
          
          {/* Left: Title & Metadata */}
          {/* Added items-center for mobile, lg:items-start for desktop */}
          <div className="w-full lg:w-auto flex flex-col items-center lg:items-start gap-2 sm:gap-3">
             {/* Added text-center for mobile, lg:text-left for desktop */}
             <h1 className="text-4xl sm:text-6xl md:text-7xl xl:text-8xl font-black tracking-tighter uppercase italic text-gray-900 dark:text-white leading-none break-words max-w-full text-center lg:text-left">
               {coaster.name}
             </h1>

             {/* Metadata Row */}
             {/* Added justify-center for mobile, lg:justify-start for desktop */}
             <div className="flex flex-wrap justify-center lg:justify-start items-center gap-2 sm:gap-3 mt-1">
                <span className="px-2 sm:px-3 py-1 bg-black text-white dark:bg-white dark:text-black rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-sm">
                   {coaster.manufacturer}
                </span>
                <span className="text-gray-300 dark:text-gray-700 hidden sm:inline">|</span>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                   {coaster.model || "Coaster Model"}
                </span>
             </div>
          </div>

          {/* Right: RANKINGS SECTION */}
          {/* Added justify-center for mobile consistency, though usually kept flexible */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4 sm:gap-8 md:gap-12 shrink-0 w-full lg:w-auto justify-center lg:justify-end">
             <CoasterRanking coaster={coaster} allCoasters={allCoasters} parkName={parkName} />

             {coaster.rating && (
                <div className={`${baseAnim} ${contentVisible ? visibleClass : hiddenClass} delay-300`}>
                    <StatBlock 
                       mainValue={coaster.rating}
                       label="SCORE"
                       subLabel={null}
                       colorClass={getSafeColorClass(coaster.rating)}
                    />
                </div>
             )}
          </div>

        </div>

        {/* IMAGE BANNER */}
        <div 
          className="relative w-full aspect-video md:aspect-[32/9] rounded-2xl overflow-hidden shadow-sm mb-8 md:mb-12 bg-gray-200 dark:bg-gray-800 group cursor-pointer"
          onClick={() => headerImage && window.open(headerImage, "_blank")}
        >
            {headerImage && (
              <Image
                src={headerImage}
                alt={coaster.name}
                fill
                className={`object-cover transition-all duration-1000 group-hover:scale-105 ${
                  imageVisualLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg"
                }`}
                priority
                unoptimized
                onLoad={() => setImageVisualLoaded(true)}
              />
            )}
        </div>

        {/* CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
          
          {/* LEFT COLUMN (Text & Gallery) */}
          <div className="lg:col-span-8 flex flex-col gap-8 md:gap-12 order-2 lg:order-1">
            <section>
                <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white border-l-4 border-blue-600 pl-4">The Experience</h3>
                <CoasterText coasterId={coaster.id} />
            </section>

            <section>
                 <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white border-l-4 border-blue-600 pl-4">Gallery</h3>
                 <CoasterGallery coasterId={coaster.id} coasterName={coaster.name} parkId={coaster.parkId} />
            </section>
          </div>

          {/* RIGHT COLUMN (Info & Specs) */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="sticky top-8 flex flex-col gap-8 md:gap-12">
                <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                        Information
                    </h4>
                    <CoasterInfo coaster={coaster} />
                </div>

                <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                        Technical Specs
                    </h4>
                    <CoasterSpecsPanel specs={coaster.specs} />
                </div>
                {coaster.highlights && (
                    <div>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                            {coaster.name} Strengths/Weaknesses
                        </h4>
                        <CoasterHighlightsPanel highlights={coaster.highlights} />
                    </div>
                )}
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-12 md:mt-20 pt-8 md:pt-10 border-t border-gray-200 dark:border-gray-800">
          <MainPageButton />
        </div>
      </div>
    </div>
  );
};

export default CoasterPage;