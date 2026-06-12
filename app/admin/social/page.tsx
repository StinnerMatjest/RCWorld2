"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAdminMode } from "@/app/context/AdminModeContext";

type Post = {
  id: number;
  caption: string;
  hashtags: string;
  image_url: string;
  park_id: number;
  park_name: string;
  reasoning: string;
  status: string;
  published_to: string[];
  category?: string;
  scheduled_at?: string;
  scheduled_platforms?: string[];
  ig_crop_url?: string;
};

type GalleryImage = { id: number; title: string; path: string };
type ParkOption = { id: number; name: string; country: string };
type CropMode = "wide" | "square" | "portrait";

function GalleryImageButton({ img, onClick }: { img: GalleryImage; onClick: () => void }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <button className="relative aspect-video overflow-hidden rounded-lg group cursor-pointer" onClick={onClick}>
      <Image
        src={img.path}
        alt={img.title}
        fill
        sizes="(max-width: 640px) 50vw, 320px"
        quality={60}
        className="object-cover group-hover:scale-105 transition-transform"
        onLoad={e => {
          // Thumbnail keeps the original aspect ratio, so the IG check still holds.
          const el = e.currentTarget;
          const ratio = el.naturalWidth / el.naturalHeight;
          setOk(ratio >= 0.8 && ratio <= 1.91);
        }}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
        <span className="text-white text-[10px] line-clamp-2">{img.title}</span>
      </div>
      {ok === false && <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full">IG ✕</div>}
      {ok === true  && <div className="absolute top-1 right-1 bg-green-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-full">IG ✓</div>}
    </button>
  );
}

type IgCrop = { x: number; y: number; w: number; h: number; ratio: "1:1" | "4:5" };
type IgCropResult = { url: string; ratio: "1:1" | "4:5" };

function CropEditorModal({ imageUrl, onApply, onClose, uploading }: {
  imageUrl: string;
  onApply: (crop: IgCrop) => void;
  onClose: () => void;
  uploading?: boolean;
}) {
  const [displayW, setDisplayW] = useState(440);
  const [ratio, setRatio] = useState<"1:1" | "4:5">("1:1");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const touchRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const calc = () => setDisplayW(Math.min(440, window.innerWidth - 96));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const displayH = natural ? Math.round(displayW / (natural.w / natural.h)) : displayW;
  const cropRatio = ratio === "1:1" ? 1 : 4 / 5;
  const imgRatio = natural ? natural.w / natural.h : 1;

  let boxW: number, boxH: number;
  if (cropRatio <= imgRatio) {
    boxH = Math.min(displayH, displayW / cropRatio);
    boxW = Math.round(boxH * cropRatio);
    boxH = Math.round(boxH);
  } else {
    boxW = displayW;
    boxH = Math.round(boxW / cropRatio);
  }

  const maxX = displayW - boxW;
  const maxY = displayH - boxH;

  useEffect(() => {
    setOffset({ x: Math.round(maxX / 2), y: Math.round(maxY / 2) });
  }, [ratio, natural, displayW]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setOffset({
      x: Math.max(0, Math.min(maxX, dragRef.current.ox + dx)),
      y: Math.max(0, Math.min(maxY, dragRef.current.oy + dy)),
    });
  }
  function onMouseUp() { dragRef.current = null; }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.sx;
    const dy = t.clientY - touchRef.current.sy;
    setOffset({
      x: Math.max(0, Math.min(maxX, touchRef.current.ox + dx)),
      y: Math.max(0, Math.min(maxY, touchRef.current.oy + dy)),
    });
    e.preventDefault();
  }
  function onTouchEnd() { touchRef.current = null; }

  function handleApply() {
    if (!natural) return;
    const scale = natural.w / displayW;
    onApply({
      x: Math.round(offset.x * scale),
      y: Math.round(offset.y * scale),
      w: Math.round(boxW * scale),
      h: Math.round(boxH * scale),
      ratio,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 w-full" style={{ maxWidth: displayW + 48 }}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-700">
          <h2 className="font-bold text-base">Crop for Instagram</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="flex gap-2 px-4 sm:px-6 pt-4 pb-3 flex-wrap">
          {(["1:1", "4:5"] as const).map(r => (
            <button key={r} onClick={() => setRatio(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${ratio === r ? "bg-pink-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
              {r === "1:1" ? "Square 1:1" : "Portrait 4:5"}
            </button>
          ))}
          <span className="text-slate-500 text-xs self-center ml-auto">Drag to reposition</span>
        </div>

        {/* Crop canvas */}
        <div className="mx-4 sm:mx-6 mb-4 rounded-xl overflow-hidden select-none"
          style={{ width: displayW, height: displayH, position: "relative", cursor: "grab", background: "#0f172a", touchAction: "none" }}
          onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" draggable={false}
            style={{ position: "absolute", width: displayW, height: displayH, objectFit: "fill" }}
            onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          <div style={{
            position: "absolute", left: offset.x, top: offset.y, width: boxW, height: boxH,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", border: "2px solid white", cursor: "grab",
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)",
            backgroundSize: `${Math.round(boxW/3)}px ${Math.round(boxH/3)}px`,
            touchAction: "none",
          }} onMouseDown={onMouseDown}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
        </div>

        <div className="flex justify-end gap-3 px-4 sm:px-6 pb-5">
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-white cursor-pointer px-4 py-2">Cancel</button>
          <button onClick={handleApply} disabled={!natural || uploading}
            className="text-sm bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer">
            {uploading ? "Uploading…" : "Apply crop"}
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CROP_STYLES: Record<CropMode, string> = {
  wide:     "aspect-video",
  square:   "aspect-square",
  portrait: "aspect-[4/5]",
};

const CATEGORIES: { key: string; label: string }[] = [
  { key: "bestCoaster",           label: "Best Coaster" },
  { key: "coasterDepth",          label: "Coaster Depth" },
  { key: "waterRides",            label: "Water Rides" },
  { key: "flatridesAndDarkrides", label: "Flat Rides & Dark Rides" },
  { key: "parkAppearance",        label: "Park Appearance" },
  { key: "food",                  label: "Food" },
  { key: "snacksAndDrinks",       label: "Snacks & Drinks" },
  { key: "parkPracticality",      label: "Park Practicality" },
  { key: "rideOperations",        label: "Ride Operations" },
  { key: "parkManagement",        label: "Park Management" },
  { key: "overall",               label: "Overall" },
];

export default function SocialAdminPage() {
  const { isAdminMode } = useAdminMode();
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Record<number, { caption: string; hashtags: string; image_url: string }>>({});
  const [scheduling, setScheduling] = useState<Record<number, { datetime: string; platforms: string[] }>>({});
  const [cropMode, setCropMode] = useState<Record<number, CropMode>>({});
  const [igRatio, setIgRatio] = useState<Record<number, boolean>>({});
  const [igCropData, setIgCropData] = useState<Record<number, IgCropResult>>({});
  const [cropEditor, setCropEditor] = useState<{ postId: number; imageUrl: string } | null>(null);
  const [cropUploading, setCropUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [promptText, setPromptText] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [gallery, setGallery] = useState<{ postId: number; images: GalleryImage[] } | null>(null);

  // Create post state
  const [showCreate, setShowCreate] = useState(false);
  const [allParks, setAllParks] = useState<ParkOption[]>([]);
  const [parkSearch, setParkSearch] = useState("");
  const [selectedPark, setSelectedPark] = useState<ParkOption | null>(null);
  const [createGallery, setCreateGallery] = useState<GalleryImage[]>([]);
  const [createForm, setCreateForm] = useState({ image_url: "", caption: "", hashtags: "", category: "" });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const parkSearchRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/social/queue");
    const { posts: data } = await res.json();
    setPosts(data ?? []);
    const crops: Record<number, IgCropResult> = {};
    for (const p of (data ?? []) as Post[]) {
      if (p.ig_crop_url) crops[p.id] = { url: p.ig_crop_url, ratio: "1:1" };
    }
    setIgCropData(prev => ({ ...crops, ...prev }));
  }

  useEffect(() => {
    load();
    fetch("/api/social/generate").then(r => r.json()).then(d => setPromptText(d.prompt ?? ""));
  }, []);

  async function generate() {
    setGenerating(true);
    const res = await fetch("/api/social/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(showPrompt ? { customPrompt: promptText } : {}),
    });
    const data = await res.json();
    setGenerating(false);
    if (data.error) { alert(data.error); return; }
    await load();
  }

  async function savePrompt() {
    setSavingPrompt(true);
    await fetch("/api/social/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText }),
    });
    setSavingPrompt(false);
    setPromptDirty(false);
  }

  function startEditing(post: Post) {
    setEditing(prev => ({ ...prev, [post.id]: { caption: post.caption, hashtags: post.hashtags, image_url: post.image_url } }));
  }

  async function save(post: Post) {
    const ed = editing[post.id];
    if (!ed) return;
    await fetch(`/api/social/queue/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ed),
    });
    setEditing(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    await load();
  }

  async function reject(id: number) {
    await fetch(`/api/social/queue/${id}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  async function openGallery(post: Post) {
    startEditing(post);
    const res = await fetch(`/api/park/${post.park_id}/gallery`);
    const { gallery: imgs } = await res.json();
    const filtered = (imgs as GalleryImage[]).filter(i =>
      i.path && !/\.(mp4|webm|mov)/i.test(i.path)
    );
    setGallery({ postId: post.id, images: filtered });
  }

  async function publish(post: Post, platforms: ("facebook" | "instagram")[]) {
    setPublishing(post.id);
    const ed = editing[post.id];
    if (ed) {
      await fetch(`/api/social/queue/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ed),
      });
    }
    const igImageUrl = igCropData[post.id]?.url;
    const res = await fetch(`/api/social/publish/${post.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms, ...(igImageUrl ? { ig_image_url: igImageUrl } : {}) }),
    });
    const data = await res.json();
    setPublishing(null);
    if (data.errors?.length) {
      setFeedback(prev => ({ ...prev, [post.id]: "Error: " + data.errors.join(", ") }));
    } else {
      setFeedback(prev => ({ ...prev, [post.id]: `Posted to ${platforms.join(" + ")} ✓` }));
      setTimeout(() => load(), 1200);
    }
  }

  async function schedule(post: Post) {
    const sched = scheduling[post.id];
    if (!sched?.datetime) return;
    const ed = editing[post.id];
    await fetch(`/api/social/queue/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(ed ?? {}),
        scheduled_at: new Date(sched.datetime).toISOString(),
        platforms: sched.platforms,
      }),
    });
    setEditing(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    setScheduling(prev => { const n = { ...prev }; delete n[post.id]; return n; });
    setFeedback(prev => ({ ...prev, [post.id]: `Scheduled for ${new Date(sched.datetime).toLocaleString("en-GB")} ✓` }));
    await load();
  }

  async function unschedule(post: Post) {
    await fetch(`/api/social/queue/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_at: null, platforms: null }),
    });
    await load();
  }

  // Create post helpers
  async function openCreate() {
    if (allParks.length === 0) {
      const res = await fetch("/api/parks");
      const { parks } = await res.json();
      setAllParks(parks ?? []);
    }
    setShowCreate(true);
    setParkSearch("");
    setSelectedPark(null);
    setCreateGallery([]);
    setCreateForm({ image_url: "", caption: "", hashtags: "", category: "" });
    setTimeout(() => parkSearchRef.current?.focus(), 50);
  }

  async function selectCreatePark(park: ParkOption) {
    setSelectedPark(park);
    setParkSearch(park.name);
    const res = await fetch(`/api/park/${park.id}/gallery`);
    const { gallery: imgs } = await res.json();
    setCreateGallery((imgs as GalleryImage[]).filter(i => i.path && !/\.(mp4|webm|mov)/i.test(i.path)));
    setCreateForm(prev => ({ ...prev, image_url: "" }));
  }

  async function generateCaption() {
    if (!selectedPark || !createForm.category) return;
    setGeneratingCaption(true);
    const res = await fetch("/api/social/generate-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ park_id: selectedPark.id, category: createForm.category }),
    });
    const data = await res.json();
    setGeneratingCaption(false);
    if (data.error) { alert(data.error); return; }
    setCreateForm(prev => ({ ...prev, caption: data.caption, hashtags: data.hashtags }));
  }

  async function submitCreate() {
    if (!selectedPark || !createForm.image_url) return;
    setCreateSubmitting(true);
    await fetch("/api/social/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createForm, park_id: selectedPark.id, park_name: selectedPark.name }),
    });
    setCreateSubmitting(false);
    setShowCreate(false);
    await load();
  }

  const filteredParks = parkSearch.length > 1
    ? allParks.filter(p => p.name.toLowerCase().includes(parkSearch.toLowerCase())).slice(0, 8)
    : [];

  if (!isAdminMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-lg">Enable admin mode to access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold">Social Media Queue</h1>
            <p className="text-slate-400 text-sm mt-1">Review and publish AI-drafted posts to Facebook & Instagram</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/social/history" className="text-sm text-slate-400 hover:text-orange-400 transition-colors">History →</Link>
            <button
              onClick={openCreate}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
            >
              + Create post
            </button>
            <button
              onClick={generate}
              disabled={generating}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
            >
              {generating ? "Generating…" : "Generate posts"}
            </button>
          </div>
        </div>

        {/* Best time to post */}
        <div className="mb-6 bg-slate-800/60 rounded-2xl border border-slate-700 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Best times to post (CET)</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-blue-400 font-semibold mb-1">Facebook</p>
              <p className="text-slate-300">Tue–Thu <span className="text-white font-semibold">13:00–15:00</span></p>
              <p className="text-slate-300">Wed–Fri <span className="text-white font-semibold">19:00–21:00</span></p>
              <p className="text-slate-500 text-xs mt-1">Weekends: 10:00–12:00 works well</p>
            </div>
            <div>
              <p className="text-pink-400 font-semibold mb-1">Instagram</p>
              <p className="text-slate-300">Mon–Fri <span className="text-white font-semibold">11:00–13:00</span></p>
              <p className="text-slate-300">Tue & Wed <span className="text-white font-semibold">19:00–21:00</span></p>
              <p className="text-slate-500 text-xs mt-1">Avoid Mon mornings and Sun evenings</p>
            </div>
          </div>
        </div>

        {/* Prompt editor */}
        <div className="mb-6 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <button
            onClick={() => setShowPrompt(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            <span>Prompt editor {showPrompt ? "(saved prompt is used for all future generates)" : ""}</span>
            <span className="text-slate-500">{showPrompt ? "▲" : "▼"}</span>
          </button>
          {showPrompt && (
            <div className="px-5 pb-5">
              <textarea
                rows={12}
                value={promptText}
                onChange={e => { setPromptText(e.target.value); setPromptDirty(true); }}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-slate-500 text-xs">Saved prompt is used for all future generates. Custom edits here override it for one run only.</p>
                <button
                  onClick={savePrompt}
                  disabled={!promptDirty || savingPrompt}
                  className="text-xs bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold px-4 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  {savingPrompt ? "Saving…" : "Save prompt"}
                </button>
              </div>
            </div>
          )}
        </div>

        {posts.length === 0 && !generating && (
          <div className="text-center py-24 text-slate-500">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg">Queue is empty — hit "Generate new posts" to get started.</p>
          </div>
        )}

        <div className="grid gap-6">
          {posts.map(post => {
            const ed = editing[post.id];
            const caption = ed?.caption ?? post.caption;
            const hashtags = ed?.hashtags ?? post.hashtags;
            const imageUrl = ed?.image_url ?? post.image_url;
            const isDirty = !!ed;
            const isScheduled = post.status === "scheduled";
            const sched = scheduling[post.id];
            const crop = cropMode[post.id] ?? "wide";

            return (
              <div key={post.id} className={`bg-slate-800 rounded-2xl overflow-hidden border ${isScheduled ? "border-amber-500/50" : "border-slate-700"}`}>
                {isScheduled && (
                  <div className="flex items-center justify-between px-5 py-2 bg-amber-500/10 border-b border-amber-500/30">
                    <span className="text-amber-400 text-xs font-semibold">
                      Scheduled · {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      {post.scheduled_platforms?.length ? ` · ${post.scheduled_platforms.join(" + ")}` : ""}
                    </span>
                    <button onClick={() => unschedule(post)} className="text-xs text-amber-500 hover:text-red-400 cursor-pointer">Cancel</button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-0">
                  {/* Image with crop toggle */}
                  <div className="w-full sm:w-52 flex-shrink-0 flex flex-col">
                    <div className={`relative ${CROP_STYLES[crop]} w-full group/img cursor-pointer overflow-hidden max-h-64 sm:max-h-none`} onClick={() => openGallery(post)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={post.park_name}
                        className="w-full h-full object-cover"
                        onLoad={e => {
                          const img = e.currentTarget;
                          const ratio = img.naturalWidth / img.naturalHeight;
                          setIgRatio(prev => ({ ...prev, [post.id]: ratio >= 0.8 && ratio <= 1.91 }));
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-full">Change image</span>
                      </div>
                      {igRatio[post.id] === false && (
                        <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">IG ✕</div>
                      )}
                      {igRatio[post.id] === true && (
                        <div className="absolute top-1.5 right-1.5 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">IG ✓</div>
                      )}
                    </div>
                    {/* Crop toggle */}
                    <div className="flex gap-1 px-2 py-1.5 bg-slate-900/60">
                      {(["wide", "square", "portrait"] as CropMode[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setCropMode(prev => ({ ...prev, [post.id]: m }))}
                          title={m === "wide" ? "16:9 landscape" : m === "square" ? "1:1 square" : "4:5 portrait (Instagram)"}
                          className={`flex-1 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${crop === m ? "bg-slate-500 text-white" : "text-slate-500 hover:text-slate-300"}`}
                        >
                          {m === "wide" ? "▬" : m === "square" ? "■" : "▮"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-orange-400 font-bold text-sm">
                          {post.park_name}
                          {post.category && <span className="text-slate-400 font-normal"> · {post.category}</span>}
                        </span>
                        {post.reasoning && <p className="text-slate-500 text-xs mt-0.5 italic">"{post.reasoning}"</p>}
                      </div>
                      <button onClick={() => reject(post.id)} className="text-slate-500 hover:text-red-400 text-xs transition-colors cursor-pointer flex-shrink-0">Reject</button>
                    </div>

                    <textarea
                      rows={4}
                      value={caption}
                      onChange={e => setEditing(prev => ({ ...prev, [post.id]: { caption: e.target.value, hashtags: prev[post.id]?.hashtags ?? post.hashtags, image_url: prev[post.id]?.image_url ?? post.image_url } }))}
                      className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />

                    <input
                      type="text"
                      value={hashtags}
                      onChange={e => setEditing(prev => ({ ...prev, [post.id]: { caption: prev[post.id]?.caption ?? post.caption, hashtags: e.target.value, image_url: prev[post.id]?.image_url ?? post.image_url } }))}
                      className="w-full bg-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      placeholder="hashtags…"
                    />

                    {/* Publish buttons */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {isDirty && (
                        <button onClick={() => save(post)} className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">Save edits</button>
                      )}
                      <button onClick={() => publish(post, ["facebook"])} disabled={publishing === post.id} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 rounded-lg cursor-pointer">Post to Facebook</button>
                      <button onClick={() => publish(post, ["instagram"])} disabled={publishing === post.id} className="text-xs bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-3 py-1.5 rounded-lg cursor-pointer">Post to Instagram</button>
                      <button onClick={() => publish(post, ["facebook", "instagram"])} disabled={publishing === post.id} className="text-xs bg-gradient-to-r from-blue-600 to-pink-600 hover:opacity-90 disabled:opacity-50 px-3 py-1.5 rounded-lg cursor-pointer font-semibold">
                        {publishing === post.id ? "Posting…" : "Post to Both"}
                      </button>
                      {feedback[post.id] && <span className="text-xs text-green-400 ml-1">{feedback[post.id]}</span>}
                    </div>

                    {/* Instagram crop */}
                    <div className="flex items-center gap-2">
                      {igRatio[post.id] === false && !igCropData[post.id] && (
                        <span className="text-red-400 text-xs">Image too wide for Instagram —</span>
                      )}
                      {igCropData[post.id] && (
                        <span className="text-green-400 text-xs">IG crop set ({igCropData[post.id].ratio}) —</span>
                      )}
                      {(igRatio[post.id] === false || igCropData[post.id]) && (
                        <button
                          onClick={() => setCropEditor({ postId: post.id, imageUrl: ed?.image_url ?? post.image_url })}
                          className="text-xs text-pink-400 hover:text-pink-300 underline cursor-pointer"
                        >
                          {igCropData[post.id] ? "Edit crop" : "Set crop"}
                        </button>
                      )}
                      {igRatio[post.id] === true && (
                        <button
                          onClick={() => setCropEditor({ postId: post.id, imageUrl: ed?.image_url ?? post.image_url })}
                          className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          Customize IG crop
                        </button>
                      )}
                    </div>

                    {/* Schedule section */}
                    <div className="border-t border-slate-700 pt-3 mt-1">
                      <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Schedule</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="datetime-local"
                          value={sched?.datetime ?? (post.scheduled_at ? toLocalDatetimeInput(post.scheduled_at) : "")}
                          onChange={e => setScheduling(prev => ({ ...prev, [post.id]: { datetime: e.target.value, platforms: prev[post.id]?.platforms ?? ["facebook", "instagram"] } }))}
                          className="bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 text-xs">
                          {["facebook", "instagram"].map(p => {
                            const selected = (sched?.platforms ?? post.scheduled_platforms ?? ["facebook", "instagram"]).includes(p);
                            return (
                              <button
                                key={p}
                                onClick={() => setScheduling(prev => {
                                  const cur = prev[post.id]?.platforms ?? post.scheduled_platforms ?? ["facebook", "instagram"];
                                  const next = selected ? cur.filter(x => x !== p) : [...cur, p];
                                  return { ...prev, [post.id]: { datetime: prev[post.id]?.datetime ?? (post.scheduled_at ? toLocalDatetimeInput(post.scheduled_at) : ""), platforms: next } };
                                })}
                                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${selected ? p === "facebook" ? "bg-blue-600 text-white" : "bg-pink-600 text-white" : "bg-slate-700 text-slate-400"}`}
                              >
                                {p === "facebook" ? "FB" : "IG"}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => schedule(post)}
                          disabled={!sched?.datetime && !post.scheduled_at}
                          className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          {isScheduled ? "Update schedule" : "Schedule"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gallery picker modal */}
      {gallery && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setGallery(null)}>
          <div className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[80vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Pick an image</h2>
              <button onClick={() => setGallery(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gallery.images.map(img => (
                <GalleryImageButton
                  key={img.id}
                  img={img}
                  onClick={() => {
                    setEditing(prev => ({ ...prev, [gallery.postId]: { ...(prev[gallery.postId] ?? { caption: posts.find(p=>p.id===gallery.postId)?.caption ?? "", hashtags: posts.find(p=>p.id===gallery.postId)?.hashtags ?? "" }), image_url: img.path } }));
                    setIgCropData(prev => { const n = { ...prev }; delete n[gallery.postId]; return n; });
                    fetch(`/api/social/queue/${gallery.postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ig_crop_url: null }) });
                    setGallery(null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Crop editor modal */}
      {cropEditor && (
        <CropEditorModal
          imageUrl={cropEditor.imageUrl}
          uploading={cropUploading}
          onApply={async crop => {
            setCropUploading(true);
            try {
              const res = await fetch("/api/social/crop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...crop, imageUrl: cropEditor.imageUrl, postId: cropEditor.postId }),
              });
              const { url } = await res.json();
              setIgCropData(prev => ({ ...prev, [cropEditor.postId]: { url, ratio: crop.ratio } }));
              await fetch(`/api/social/queue/${cropEditor.postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ig_crop_url: url }),
              });
            } finally {
              setCropUploading(false);
              setCropEditor(null);
            }
          }}
          onClose={() => setCropEditor(null)}
        />
      )}

      {/* Create post modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create post</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white cursor-pointer text-xl px-1">✕</button>
            </div>

            {/* Park search */}
            <div className="relative mb-4">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5 block">Park</label>
              <input
                ref={parkSearchRef}
                type="text"
                value={parkSearch}
                onChange={e => { setParkSearch(e.target.value); if (selectedPark && e.target.value !== selectedPark.name) setSelectedPark(null); }}
                placeholder="Search parks…"
                className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {filteredParks.length > 0 && !selectedPark && (
                <div className="absolute z-10 top-full mt-1 w-full bg-slate-700 rounded-xl border border-slate-600 overflow-hidden shadow-xl">
                  {filteredParks.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectCreatePark(p)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-600 cursor-pointer flex justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-slate-400 text-xs">{p.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category picker */}
            {selectedPark && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setCreateForm(prev => ({ ...prev, category: cat.key }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${createForm.category === cat.key ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {createForm.category && (
                  <button
                    onClick={generateCaption}
                    disabled={generatingCaption}
                    className="mt-3 flex items-center gap-2 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    {generatingCaption ? "Generating…" : "✦ Generate caption with AI"}
                  </button>
                )}
              </div>
            )}

            {/* Image picker */}
            {selectedPark && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5 block">Image</label>
                {createGallery.length === 0 ? (
                  <p className="text-slate-500 text-sm">No gallery images found for this park.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {createGallery.map(img => (
                      <button
                        key={img.id}
                        onClick={() => setCreateForm(prev => ({ ...prev, image_url: img.path }))}
                        className={`relative aspect-video overflow-hidden rounded-lg cursor-pointer ring-2 transition-all ${createForm.image_url === img.path ? "ring-orange-500" : "ring-transparent hover:ring-slate-400"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.path} alt={img.title} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Caption */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5 block">Caption</label>
              <textarea
                rows={5}
                value={createForm.caption}
                onChange={e => setCreateForm(prev => ({ ...prev, caption: e.target.value }))}
                placeholder="Write your post caption…"
                className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Hashtags */}
            <div className="mb-5">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1.5 block">Hashtags</label>
              <input
                type="text"
                value={createForm.hashtags}
                onChange={e => setCreateForm(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#ParkRating #ThemePark …"
                className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="text-sm text-slate-400 hover:text-white cursor-pointer px-4 py-2">Cancel</button>
              <button
                onClick={submitCreate}
                disabled={!selectedPark || !createForm.image_url || createSubmitting}
                className="text-sm bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
              >
                {createSubmitting ? "Adding…" : "Add to queue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
