"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { RollerCoaster, RollerCoasterHighlights, RollerCoasterSpecs } from "@/app/types";
import { useAdminMode } from "@/app/context/AdminModeContext";
import { computeCoasterRanks, type CoasterRankStats } from "@/app/utils/ranking";
import BackToParkButton from "@/app/components/buttons/BackToParkButton";
import CoasterHero from "@/app/components/coasterpage/CoasterHero";
import CoasterRankStrip from "@/app/components/coasterpage/CoasterRankStrip";
import CoasterPhotoStrip from "@/app/components/coasterpage/CoasterPhotoStrip";
import CoasterFacts from "@/app/components/coasterpage/CoasterFacts";
import CoasterVerdict from "@/app/components/coasterpage/CoasterVerdict";
import CoasterText from "@/app/components/coasterpage/CoasterText";
import CoasterGallery from "@/app/components/coasterpage/CoasterGallery";
import CoasterInfo from "@/app/components/coasterpage/CoasterInfo";
import CoasterNeighbours from "@/app/components/coasterpage/CoasterNeighbours";
import CoasterLightbox from "@/app/components/coasterpage/CoasterLightbox";
import CoasterHeaderModal from "@/app/components/coasterpage/CoasterHeaderModal";
import { mediaCaptions } from "@/app/components/parkpage/SectionBody";
import type { CoasterTextEntry, CoasterGalleryImage, CoasterMini } from "@/app/components/coasterpage/coasterPageTypes";

interface CoasterPageClientProps {
  initialId: string;
  initialCoaster?: RollerCoaster | null;
  initialCoasterText?: CoasterTextEntry[];
  initialRanks?: CoasterRankStats | null;
  initialHeaderImage?: string | null;
  initialGallery?: CoasterGalleryImage[];
  initialLadder?: CoasterMini[];
  initialSiblings?: CoasterMini[];
  initialParkName?: string | null;
  initialParkSlug?: string | null;
  initialParkId?: number | null;
}

const CoasterSkeleton = () => (
  <div className="min-h-screen bg-[#0f172a] animate-pulse">
    <div className="w-full aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9] max-h-[70vh] bg-slate-900" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 bg-slate-900 rounded-2xl" />)}</div>
      <div className="h-64 bg-slate-900 rounded-2xl" />
    </div>
  </div>
);

/**
 * The coaster page. Mobile order: photo hero, ranks, photo strip, verdict and
 * numbers, the review (with photos woven in), the full gallery, details and
 * what to ride next. On desktop the verdict, numbers, details and neighbours
 * move into a sticky right column beside the review.
 */
const CoasterPage: React.FC<CoasterPageClientProps> = ({
  initialId,
  initialCoaster = null,
  initialCoasterText = [],
  initialRanks = null,
  initialHeaderImage = null,
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

  const loadGallery = useCallback(async (id: number | string, name?: string, pId?: number | null) => {
    const qs = name ? `?name=${encodeURIComponent(name)}&parkId=${pId ?? ""}` : "";
    const res = await fetch(`/api/coasters/${id}/gallery${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    setHeaderImage(data.headerImage ?? null);
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
        if (c?.id) await loadGallery(c.id, c.name, c.parkId);
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
    const list = gallery.map((g) => g.path);
    if (headerImage && !list.includes(headerImage)) list.unshift(headerImage);
    else if (headerImage) { list.splice(list.indexOf(headerImage), 1); list.unshift(headerImage); }
    return list;
  }, [gallery, headerImage]);
  const captions = useMemo(() => mediaCaptions(gallery), [gallery]);
  const openPhoto = useCallback((url: string) => {
    const i = photos.indexOf(url);
    setLightbox(i === -1 ? null : i);
    if (i === -1) window.open(url, "_blank");
  }, [photos]);

  if (pageLoading || !coaster) return <CoasterSkeleton />;

  const stripImages = gallery.length ? gallery : [];
  const parkHref = parkSlug ? `/park/${parkSlug}` : parkId ? `/park/${parkId}` : "/parks";

  const overview = (
    <>
      <CoasterVerdict
        highlights={coaster.highlights || []}
        coasterId={coaster.id}
        isAdminMode={isAdminMode}
        onSaved={(h: RollerCoasterHighlights[]) => setCoaster((c) => (c ? { ...c, highlights: h } : c))}
      />
      <CoasterFacts
        specs={coaster.specs}
        coasterId={coaster.id}
        isAdminMode={isAdminMode}
        onSaved={(s: RollerCoasterSpecs) => setCoaster((c) => (c ? { ...c, specs: s } : c))}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-16 font-sans">
      <CoasterHero
        coaster={coaster}
        parkName={parkName}
        parkSlug={parkSlug}
        headerImage={headerImage}
        photoCount={photos.length}
        isAdminMode={isAdminMode}
        onPickHeader={() => setIsHeaderModalOpen(true)}
        onOpenPhoto={openPhoto}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="hidden sm:flex items-center justify-between mb-5">
          <Link href={parkHref} className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to {parkName || "park"}
          </Link>
        </div>

        <CoasterRankStrip
          stats={ranks}
          parkName={parkName}
          parkSlug={parkSlug}
          parkId={parkId}
          manufacturerName={coaster.manufacturerName}
          manufacturerId={coaster.manufacturerId}
        />

        <div className="mt-8 md:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-8 min-w-0 space-y-10 md:space-y-14">
            <div className="-mx-4 sm:mx-0">
              <CoasterPhotoStrip images={stripImages} coasterName={coaster.name} onOpen={openPhoto} />
            </div>

            {/* Phone: verdict and numbers before the reading. Desktop: they live in the right column. */}
            <div className="lg:hidden space-y-8">{overview}</div>

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

          <aside className="lg:col-span-4 min-w-0">
            <div className="lg:sticky lg:top-6 space-y-8">
              <div className="hidden lg:block space-y-8">{overview}</div>

              <section>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-3">Details</h2>
                <div className="rounded-2xl bg-slate-900/70 border border-slate-800 px-4 py-2">
                  <CoasterInfo coaster={coaster} onUpdate={refreshCoasterData} />
                </div>
              </section>

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
          parkId={coaster.parkId}
          onClose={() => setIsHeaderModalOpen(false)}
          onUpdate={() => loadGallery(coaster.id, coaster.name, coaster.parkId)}
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
