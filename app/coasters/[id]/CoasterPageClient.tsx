"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { RollerCoaster, RollerCoasterHighlights, RollerCoasterSpecs } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { computeCoasterRanks, type CoasterRankStats } from "@/app/utils/ranking";
import BackToParkButton from "@/app/components/buttons/BackToParkButton";
import CoasterHero, { type HeaderFocus } from "@/app/components/coasterpage/CoasterHero";
import CoasterScoreRow from "@/app/components/coasterpage/CoasterScoreRow";
import CoasterRankRail from "@/app/components/coasterpage/CoasterRankRail";
import CoasterPhotoStrip from "@/app/components/coasterpage/CoasterPhotoStrip";
import CoasterFacts from "@/app/components/coasterpage/CoasterFacts";
import CoasterVerdict from "@/app/components/coasterpage/CoasterVerdict";
import CoasterText from "@/app/components/coasterpage/CoasterText";
import CoasterGallery from "@/app/components/coasterpage/CoasterGallery";
import CoasterInfo from "@/app/components/coasterpage/CoasterInfo";
import CoasterNeighbours from "@/app/components/coasterpage/CoasterNeighbours";
import CoasterLightbox from "@/app/components/coasterpage/CoasterLightbox";
import CoasterHeaderModal from "@/app/components/coasterpage/CoasterHeaderModal";
import CoasterStripEditor from "@/app/components/coasterpage/CoasterStripEditor";
import { mediaCaptions } from "@/app/components/parkpage/SectionBody";
import type { CoasterTextEntry, CoasterGalleryImage, CoasterMini } from "@/app/components/coasterpage/coasterPageTypes";

interface CoasterPageClientProps {
  initialId: string;
  initialCoaster?: RollerCoaster | null;
  initialCoasterText?: CoasterTextEntry[];
  initialRanks?: CoasterRankStats | null;
  initialHeaderImage?: string | null;
  initialHeaderFocus?: HeaderFocus;
  initialGallery?: CoasterGalleryImage[];
  initialLadder?: CoasterMini[];
  initialSiblings?: CoasterMini[];
  initialParkName?: string | null;
  initialParkSlug?: string | null;
  initialParkId?: number | null;
}

const NO_FOCUS: HeaderFocus = { mobile: null, desktop: null };

const CoasterSkeleton = () => (
  <div className="min-h-screen bg-[#0f172a] animate-pulse">
    <div className="w-full aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9] max-h-[68vh] bg-slate-900" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="h-12 w-2/3 bg-slate-900 rounded" />
      <div className="h-64 bg-slate-900 rounded-2xl" />
    </div>
  </div>
);

const CoasterPage: React.FC<CoasterPageClientProps> = ({
  initialId,
  initialCoaster = null,
  initialCoasterText = [],
  initialRanks = null,
  initialHeaderImage = null,
  initialHeaderFocus = NO_FOCUS,
  initialGallery = [],
  initialLadder = [],
  initialSiblings = [],
  initialParkName = null,
  initialParkSlug = null,
  initialParkId = null,
}) => {
  const params = useParams();
  const coasterId = String(params?.id ?? initialId);
  const { isAdminMode } = useAdminMode();

  const [coaster, setCoaster] = useState<RollerCoaster | null>(initialCoaster);
  const [ranks, setRanks] = useState<CoasterRankStats | null>(initialRanks);
  const [headerImage, setHeaderImage] = useState<string | null>(initialHeaderImage);
  const [headerFocus, setHeaderFocus] = useState<HeaderFocus>(initialHeaderFocus);
  const [gallery, setGallery] = useState<CoasterGalleryImage[]>(initialGallery);
  const [coasterText, setCoasterText] = useState<CoasterTextEntry[]>(initialCoasterText);
  const [parkName, setParkName] = useState<string | null>(initialParkName);
  const [parkSlug, setParkSlug] = useState<string | null>(initialParkSlug);
  const [parkId, setParkId] = useState<number | null>(initialParkId);
  const [pageLoading, setPageLoading] = useState(!initialCoaster);
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [stripEditorOpen, setStripEditorOpen] = useState(false);

  useEffect(() => {
    document.title = coaster?.name ? `${coaster.name} | Parkrating` : "Parkrating";
  }, [coaster]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const loadGallery = useCallback(async (id: number | string) => {
    const res = await fetch(`/api/coasters/${id}/gallery`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setHeaderImage(data.headerImage ?? null);
    setHeaderFocus({ mobile: data.headerFocus?.mobile ?? null, desktop: data.headerFocus?.desktop ?? null });
    setGallery(Array.isArray(data.gallery) ? data.gallery : []);
  }, []);

  // The server normally seeds everything; this is the fallback for a client-side mount without it.
  useEffect(() => {
    if (!coasterId || coasterId === "undefined" || coasterId === "null" || initialCoaster) return;
    (async () => {
      try {
        const [coasterRes, textRes] = await Promise.all([
          fetch(`/api/coasters/${coasterId}`),
          fetch(`/api/coasters/${coasterId}/text`),
        ]);
        if (!coasterRes.ok) throw new Error("Failed to load coaster");
        const { coaster: c } = await coasterRes.json();
        const textData = await textRes.json();
        setCoaster(c);
        setParkName(c?.parkName ?? null);
        setParkSlug(c?.parkSlug ?? null);
        setParkId(c?.parkId ?? null);
        setCoasterText((textData.texts || []).sort((a: CoasterTextEntry, b: CoasterTextEntry) => a.order - b.order));
        if (c?.id) await loadGallery(c.id);
      } catch (err) {
        console.error("Error loading page data:", err);
      } finally {
        setPageLoading(false);
      }
    })();
  }, [coasterId, initialCoaster, loadGallery]);

  const refreshText = async () => {
    const res = await fetch(`/api/coasters/${coasterId}/text`);
    const data = await res.json();
    setCoasterText((data.texts || []).sort((a: CoasterTextEntry, b: CoasterTextEntry) => a.order - b.order));
  };

  const refreshCoasterData = async () => {
    try {
      const res = await fetch("/api/coasters");
      const data = await res.json();
      const all = data.coasters || [];
      const updated = all.find((c: RollerCoaster) => c.id === coaster?.id);
      if (updated) {
        setCoaster((prev) => ({ ...(prev as RollerCoaster), ...updated }));
        setRanks(computeCoasterRanks(all, updated));
      }
    } catch (err) {
      console.error("Failed to refresh coaster:", err);
    }
  };

  const photos = useMemo(() => {
    const list = gallery.map((g) => g.path).filter((p) => p !== headerImage);
    if (headerImage) list.unshift(headerImage);
    return list;
  }, [gallery, headerImage]);

  const captions = useMemo(() => mediaCaptions(gallery), [gallery]);

  const openPhoto = useCallback((url: string) => {
    const i = photos.indexOf(url);
    if (i === -1) window.open(url, "_blank");
    else setLightbox(i);
  }, [photos]);

  if (pageLoading || !coaster) return <CoasterSkeleton />;

  const headerRow = gallery.find((g) => g.path === headerImage) ?? null;

  const verdict = (
    <CoasterVerdict
      highlights={coaster.highlights || []}
      coasterId={coaster.id}
      isAdminMode={isAdminMode}
      onSaved={(h: RollerCoasterHighlights[]) => setCoaster((c) => (c ? { ...c, highlights: h } : c))}
    />
  );

  const numbers = (
    <CoasterFacts
      specs={coaster.specs}
      scale={coaster.scale}
      coasterId={coaster.id}
      isAdminMode={isAdminMode}
      onSaved={(s: RollerCoasterSpecs) => setCoaster((c) => (c ? { ...c, specs: s } : c))}
    />
  );

  // Reusable button linking to the detailed standings
  const DetailedRankingsButton = () => (
    <Link
      href={`/coasters/${coaster.slug}/rankings`}
      className="mt-4 flex items-center justify-between w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand/60 transition-all group shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand/10 text-brand rounded-lg group-hover:bg-brand group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
        </div>
        <span className="font-bold text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest text-xs">Detailed Standings</span>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-600 group-hover:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-16 font-sans">
      <CoasterHero
        coaster={coaster}
        parkName={parkName}
        parkSlug={parkSlug}
        headerImage={headerImage}
        headerFocus={headerFocus}
        isAdminMode={isAdminMode}
        onPickHeader={() => setIsHeaderModalOpen(true)}
        onOpenPhoto={openPhoto}
      />

      <div id="below-hero" className="w-full px-4 sm:px-6 md:px-20 pt-5 sm:pt-6 lg:py-10 scroll-mt-4">

        {/* Phones and tablets: the ranks as a row under the hero. */}
        <div className="lg:hidden mb-8">
          <CoasterScoreRow
            rideCount={coaster.ridecount}
            stats={ranks}
            parkName={parkName}
            parkSlug={parkSlug}
            parkId={parkId}
            manufacturerName={coaster.manufacturerName}
            manufacturerId={coaster.manufacturerId}
          />
          <DetailedRankingsButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_5.5fr_3.5fr] [@media(min-width:2560px)]:grid-cols-[1.8fr_6fr_3.5fr] gap-10 lg:gap-6">

          {/* Desktop: the ranks where the park page keeps its visit panel. */}
          <div className="hidden lg:block min-w-0">
            <div>
              <CoasterRankRail
                rideCount={coaster.ridecount}
                stats={ranks}
                parkName={parkName}
                parkSlug={parkSlug}
                parkId={parkId}
                manufacturerName={coaster.manufacturerName}
                manufacturerId={coaster.manufacturerId}
              />
              <DetailedRankingsButton />
            </div>
          </div>

          <div className="min-w-0 space-y-10 md:space-y-14">
            <div className="-mx-4 sm:mx-0">
              <CoasterPhotoStrip
                images={gallery}
                coasterName={coaster.name}
                onOpen={openPhoto}
                isAdminMode={isAdminMode}
                onEdit={() => setStripEditorOpen(true)}
              />
            </div>

            {/* Phone: highs and lows and the numbers before the reading. */}
            <div className="lg:hidden space-y-8">
              {verdict}
              {numbers}
            </div>

            <section id="review" className="scroll-mt-20">
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Our review</h2>
              <div className="w-12 h-1 bg-brand rounded-full mt-3 mb-6" />
              <CoasterText
                coasterId={coaster.id}
                coasterName={coaster.name}
                initialTexts={coasterText}
                refreshTexts={refreshText}
                galleryImages={gallery}
                headerImage={headerImage}
                onMediaClick={openPhoto}
              />
            </section>

            {(gallery.length > 0 || isAdminMode) && (
              <section id="gallery" className="scroll-mt-20">
                <CoasterGallery coasterId={coaster.id} coasterName={coaster.name} parkId={coaster.parkId} />
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-8 lg:max-w-[24rem]">
            <div className="hidden lg:block">{verdict}</div>
            <div
              className="space-y-8 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto pb-8"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="hidden lg:block">{numbers}</div>

              {/* Admin only: this is where the coaster's basics are edited. */}
              {isAdminMode && (
                <section>
                  <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Details</p>
                  <CoasterInfo coaster={coaster} onUpdate={refreshCoasterData} />
                </section>
              )}

              <CoasterNeighbours
                currentId={coaster.id}
                ladder={initialLadder}
                siblings={initialSiblings}
                parkName={parkName}
                parkSlug={parkSlug}
              />
            </div>
          </aside>
        </div>

        <div className="flex justify-center mt-12 md:mt-16 pt-8 border-t border-slate-800">
          <BackToParkButton parkSlug={parkSlug} parkId={parkId} parkName={parkName} />
        </div>
      </div>

      {isHeaderModalOpen && (
        <CoasterHeaderModal
          coasterId={coaster.id}
          coasterName={coaster.name}
          gallery={gallery}
          current={{ imageId: headerRow?.id ?? null, focusMobile: headerFocus.mobile, focusDesktop: headerFocus.desktop }}
          onClose={() => setIsHeaderModalOpen(false)}
          onSaved={() => loadGallery(coaster.id)}
        />
      )}

      {isAdminMode && stripEditorOpen && (
        <CoasterStripEditor
          coasterId={coaster.id}
          coasterName={coaster.name}
          gallery={gallery}
          onClose={() => setStripEditorOpen(false)}
          onSaved={() => loadGallery(coaster.id)}
        />
      )}

      {lightbox !== null && (
        <CoasterLightbox
          urls={photos}
          index={lightbox}
          captions={captions}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </div>
  );
};

export default CoasterPage;