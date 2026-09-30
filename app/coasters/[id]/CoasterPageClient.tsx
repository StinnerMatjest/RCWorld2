"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RollerCoaster, RollerCoasterHighlights, RollerCoasterSpecs } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { computeCoasterRanks, type CoasterRankStats } from "@/app/utils/ranking";
import BackToParkButton from "@/app/components/buttons/BackToParkButton";
import CoasterHero, { type HeaderFocus } from "@/app/components/coasterpage/CoasterHero";
import CoasterScoreRow from "@/app/components/coasterpage/CoasterScoreRow";
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

/**
 * The coaster page, set the way the park page is: photo hero with the name
 * and score, then plain content on the ground with thin rules, no boxes.
 * Phone order: ranks, photo strip, highs and lows, the numbers, the review
 * with photos woven in, the full gallery, what to ride next, details. On
 * desktop the right rail holds highs and lows, then the numbers (which stick
 * once reached), then the ranking lists and details.
 */
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

  const [stripEditorOpen, setStripEditorOpen] = useState(false);

  // Desktop rail: stick by the top when it fits the screen, by the bottom when it
  // is taller, so its end (the ranking lists) is what stays in view while reading.
  const railRef = useRef<HTMLDivElement>(null);
  const [railTop, setRailTop] = useState<number>(24);
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      setRailTop(h + 48 <= vh ? 24 : vh - h - 24);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [gallery, coasterText, ranks]);

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

  // Every photo on the page in one order (hero first), for the lightbox.
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

  const parkHref = parkSlug ? `/park/${parkSlug}` : parkId ? `/park/${parkId}` : "/parks";
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

      <div id="below-hero" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 scroll-mt-4">
        <CoasterScoreRow
          rideCount={coaster.ridecount}
          stats={ranks}
          parkName={parkName}
          parkSlug={parkSlug}
          parkId={parkId}
          manufacturerName={coaster.manufacturerName}
          manufacturerId={coaster.manufacturerId}
        />

        <div className="hidden sm:flex items-center justify-between mt-5 mb-2">
          <Link href={parkHref} className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to {parkName || "park"}
          </Link>
        </div>

        <div className="mt-8 md:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-8 min-w-0 space-y-10 md:space-y-14">
            <div className="-mx-4 sm:mx-0">
              <CoasterPhotoStrip
                images={gallery}
                coasterName={coaster.name}
                onOpen={openPhoto}
                isAdminMode={isAdminMode}
                onEdit={() => setStripEditorOpen(true)}
              />
            </div>

            {/* Phone: highs and lows and the numbers before the reading. Desktop: they live in the right rail. */}
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

            <section className="max-w-xl">
              <p className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Details</p>
              <CoasterInfo coaster={coaster} onUpdate={refreshCoasterData} />
            </section>
          </div>

          <aside className="lg:col-span-4 min-w-0">
            {/* The whole rail sticks on desktop. When it is taller than the screen it
                pins by its bottom edge instead, so the numbers and the ranking lists
                stay in view while the review scrolls; at the end of the review it
                scrolls away with the rest and the details below the photos show. */}
            <div ref={railRef} className="space-y-8 lg:sticky" style={{ top: railTop }}>
              <div className="hidden lg:block">{verdict}</div>
              <div className="hidden lg:block">{numbers}</div>
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
