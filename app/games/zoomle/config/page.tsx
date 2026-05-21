"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { GRID_FOCUSES } from "@/app/games/zoomle/constants";

type CoasterImage = {
  gallery_id: number;
  image_path: string;
  coaster_id: number;
  coaster_name: string;
  park_name: string;
  focuses_override?: Record<string, string>;
};

type CoasterGroup = {
  coaster_id: number;
  coaster_name: string;
  park_name: string;
  coaster_enabled: boolean;
  images: CoasterImage[];
};

function FocalCellEditor({ img, fi, currentFocus, onSave, onClose }: {
  img: CoasterImage; fi: number; currentFocus: string;
  onSave: (focus: string) => void; onClose: () => void;
}) {
  const [focus, setFocus] = useState(() => {
    const [x, y] = currentFocus.split(" ").map(v => parseInt(v));
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  });
  const [saving, setSaving] = useState(false);
  const dragging = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const focusStr = `${focus.x}% ${focus.y}%`;

  const apply = (cx: number, cy: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFocus({
      x: Math.max(0, Math.min(100, Math.round(((cx - rect.left) / rect.width) * 100))),
      y: Math.max(0, Math.min(100, Math.round(((cy - rect.top) / rect.height) * 100))),
    });
  };

  async function save() {
    setSaving(true);
    await fetch("/api/zoomle/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coaster_id: img.coaster_id, image_path: img.image_path,
        focal_override: { focal_index: fi, focus: focusStr }
      }),
    });
    setSaving(false);
    onSave(focusStr);
  }

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Edit focal {fi + 1} — drag to reposition
        <span className="normal-case font-normal ml-2">{focusStr}</span>
      </p>
      <div className="relative rounded-xl overflow-hidden cursor-crosshair select-none"
        onMouseDown={e => { dragging.current = true; apply(e.clientX, e.clientY); }}
        onMouseMove={e => { if (dragging.current) apply(e.clientX, e.clientY); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={img.image_path} alt="" draggable={false}
          className="w-full block select-none"
          style={{ aspectRatio: "3/2", objectFit: "cover", display: "block" }} />
        <div className="absolute pointer-events-none" style={{ left: `${focus.x}%`, top: `${focus.y}%`, transform: "translate(-50%,-50%)" }}>
          <div className="w-5 h-5 rounded-full border-2 border-white shadow-lg bg-white/20" />
          <div className="absolute top-1/2 left-1/2 h-px w-8 -translate-y-1/2 -translate-x-full bg-white/80" />
          <div className="absolute top-1/2 left-1/2 h-px w-8 -translate-y-1/2 bg-white/80" />
          <div className="absolute top-1/2 left-1/2 w-px h-8 -translate-x-1/2 -translate-y-full bg-white/80" />
          <div className="absolute top-1/2 left-1/2 w-px h-8 -translate-x-1/2 bg-white/80" />
        </div>
      </div>
      {/* Preview */}
      <div className="relative rounded-lg overflow-hidden bg-slate-800" style={{ aspectRatio: "3/2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.image_path} alt="" className="w-full h-full object-cover"
          style={{ transform: "scale(9)", transformOrigin: focusStr }} />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50">
          {saving ? "Saving…" : "Save focal"}
        </button>
        <button onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── 3×3 grid for one image ──────────────────────────────────────────────────

function ImageFocalGrid({ img, flags, onToggleFlag, onFocalSaved }: {
  img: CoasterImage;
  flags: Set<string>;
  onToggleFlag: (imagePath: string, fi: number) => void;
  onFocalSaved: (imagePath: string, fi: number, focus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const overrides: Record<string, string> = img.focuses_override ?? {};

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <div className="relative w-16 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700">
          <Image src={img.image_path} alt="" fill className="object-cover" unoptimized />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
            {GRID_FOCUSES.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length > 0
              ? `${GRID_FOCUSES.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length} flagged`
              : "All 9 active"}
            {Object.keys(overrides).length > 0 && ` · ${Object.keys(overrides).length} customised`}
          </p>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-800/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Click preview to flag · ✏️ to edit focal
          </p>
          <div className="grid grid-cols-3 gap-2">
            {GRID_FOCUSES.map((gridFocus, fi) => {
              const key = `${img.image_path}::${fi}`;
              const isFlagged = flags.has(key);
              const customFocus = overrides[String(fi)];
              const activeFocus = customFocus ?? gridFocus;
              const isEditing = editing === fi;
              return (
                <div key={fi} className="flex flex-col gap-1">
                  <button onClick={() => !isEditing && onToggleFlag(img.image_path, fi)}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${isFlagged ? "ring-2 ring-rose-500 opacity-50" : "hover:ring-2 hover:ring-blue-400"
                      }`}
                    style={{ aspectRatio: "3/2" }}
                    title={isFlagged ? "Flagged — click to unflag" : "Click to flag"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image_path} alt="" className="w-full h-full object-cover"
                      style={{ transform: "scale(9)", transformOrigin: activeFocus }} />
                    {isFlagged && (
                      <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                        <span className="text-lg">🚩</span>
                      </div>
                    )}
                    <div className="absolute bottom-0.5 left-0.5 bg-black/50 text-white text-[8px] font-bold px-1 rounded">
                      {fi + 1}{customFocus ? " ✏️" : ""}
                    </div>
                  </button>
                  <button onClick={() => setEditing(isEditing ? null : fi)}
                    className={`text-[9px] font-bold text-center transition-colors cursor-pointer ${isEditing ? "text-blue-500" : "text-slate-400 hover:text-slate-600"
                      }`}>
                    {isEditing ? "close ✕" : "✏️ edit"}
                  </button>
                </div>
              );
            })}
          </div>

          {editing !== null && (
            <FocalCellEditor
              img={img}
              fi={editing}
              currentFocus={overrides[String(editing)] ?? GRID_FOCUSES[editing]}
              onSave={(focus) => { onFocalSaved(img.image_path, editing, focus); setEditing(null); }}
              onClose={() => setEditing(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Coaster accordion ────────────────────────────────────────────────────────

function CoasterRow({ group, flags, onToggleFlag, onToggleCoaster, onFocalSaved }: {
  group: CoasterGroup;
  flags: Set<string>;
  onToggleFlag: (imagePath: string, fi: number) => void;
  onToggleCoaster: (id: number, enabled: boolean) => void;
  onFocalSaved: (imagePath: string, fi: number, focus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const flaggedCount = group.images.reduce((s, img) =>
    s + GRID_FOCUSES.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length, 0);
  const totalFocals = group.images.length * 9;
  const activeFocals = totalFocals - flaggedCount;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${group.coaster_enabled ? "border-slate-200 dark:border-slate-700" : "border-slate-100 dark:border-slate-800"
      }`}>
      <div className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 ${!group.coaster_enabled ? "opacity-40" : ""}`}>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="font-black text-sm text-slate-900 dark:text-white">{group.coaster_name}</p>
          <p className="text-xs text-slate-400">{group.park_name} · {group.images.length} image{group.images.length !== 1 ? "s" : ""} · {activeFocals}/{totalFocals} focals active</p>
        </button>
        <span className="text-slate-300 dark:text-slate-600 text-xs select-none">{open ? "▲" : "▼"}</span>
        <button onClick={() => onToggleCoaster(group.coaster_id, !group.coaster_enabled)}
          className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors cursor-pointer ${group.coaster_enabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
            }`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${group.coaster_enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 flex flex-col gap-2">
          {group.images.map(img => (
            <ImageFocalGrid key={img.gallery_id} img={img} flags={flags}
              onToggleFlag={onToggleFlag}
              onFocalSaved={onFocalSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZoomleConfig() {
  const [groups, setGroups] = useState<CoasterGroup[]>([]);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/zoomle/images?all=1").then(r => r.json()),
      fetch("/api/zoomle/flag").then(r => r.json()),
    ]).then(([poolData, flagData]) => {
      const flagSet = new Set<string>(
        (flagData.flags ?? []).map((f: any) => `${f.image_path}::${f.focal_index}`)
      );
      setFlags(flagSet);

      const map = new Map<number, CoasterGroup>();
      for (const img of (poolData.images ?? [])) {
        if (!map.has(img.coaster_id)) {
          map.set(img.coaster_id, {
            coaster_id: img.coaster_id, coaster_name: img.coaster_name,
            coaster_enabled: img.coaster_enabled, park_name: img.park_name,
            images: [],
          });
        }
        map.get(img.coaster_id)!.images.push({
          gallery_id: img.gallery_id, image_path: img.image_path,
          coaster_id: img.coaster_id, coaster_name: img.coaster_name,
          park_name: img.park_name,
          focuses_override: img.focuses_override ?? {},
        });
      }
      setGroups(Array.from(map.values()));
      setLoading(false);
    });
  }, []);

  async function toggleFlag(imagePath: string, fi: number) {
    const key = `${imagePath}::${fi}`;
    const wasFlagged = flags.has(key);
    setFlags(prev => {
      const next = new Set(prev);
      wasFlagged ? next.delete(key) : next.add(key);
      return next;
    });
    await fetch("/api/zoomle/flag", {
      method: wasFlagged ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_path: imagePath, focal_index: fi }),
    });
  }

  function handleFocalSaved(imagePath: string, fi: number, focus: string) {
    setGroups(prev => prev.map(g => ({
      ...g,
      images: g.images.map(img => img.image_path === imagePath
        ? { ...img, focuses_override: { ...(img.focuses_override ?? {}), [String(fi)]: focus } }
        : img),
    })));
  }

  async function toggleCoaster(id: number, enabled: boolean) {
    setGroups(prev => prev.map(g => g.coaster_id === id ? { ...g, coaster_enabled: enabled } : g));
    await fetch("/api/zoomle/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coaster_id: id, coaster_enabled: enabled }),
    });
  }

  const filtered = groups.filter(g =>
    !search.trim() ||
    g.coaster_name.toLowerCase().includes(search.toLowerCase()) ||
    g.park_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive = groups.reduce((s, g) => {
    if (!g.coaster_enabled) return s;
    return s + g.images.reduce((si, img) =>
      si + GRID_FOCUSES.filter((_, fi) => !flags.has(`${img.image_path}::${fi}`)).length, 0);
  }, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">🔍 Zoomle Config</h1>
            <p className="text-sm text-slate-400 mt-1">
              {totalActive} active focal points · {groups.length} coasters
            </p>
          </div>
          <Link href="/games/zoomle" className="text-sm font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">← Back</Link>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search coasters or parks…"
          className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 mb-5" />

        {loading ? (
          <p className="text-center text-slate-400 py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">
            {search ? "No matches." : "No coasters found."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(g => (
              <CoasterRow key={g.coaster_id} group={g} flags={flags}
                onToggleFlag={toggleFlag} onToggleCoaster={toggleCoaster}
                onFocalSaved={handleFocalSaved} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
