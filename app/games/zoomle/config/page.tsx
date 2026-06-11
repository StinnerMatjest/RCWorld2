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

const FOCAL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8",
];

function parsePct(s: string): { x: number; y: number } {
  const parts = s.split(" ");
  return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
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
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const overrides: Record<string, string> = img.focuses_override ?? {};

  function startEdit(fi: number) {
    setFocus(parsePct(overrides[String(fi)] ?? GRID_FOCUSES[fi]));
    setEditing(fi);
    setError("");
  }

  function apply(cx: number, cy: number) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setFocus({
      x: Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100)),
    });
  }

  async function save() {
    if (editing === null) return;
    setSaving(true);
    setError("");
    const focusStr = `${focus.x.toFixed(1)}% ${focus.y.toFixed(1)}%`;
    try {
      const res = await fetch("/api/zoomle/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coaster_id: img.coaster_id, image_path: img.image_path,
          focal_override: { focal_index: editing, focus: focusStr },
        }),
      });
      if (!res.ok) { setError("Save failed"); return; }
      onFocalSaved(img.image_path, editing, focusStr);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const focusStr = `${focus.x.toFixed(1)}% ${focus.y.toFixed(1)}%`;
  const allFocals = editing !== null
    ? GRID_FOCUSES.map((gf, i) => parsePct(i === editing ? focusStr : (overrides[String(i)] ?? gf)))
    : [];

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      {/* Collapsed header */}
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-slate-800/50 transition-colors cursor-pointer">
        <div className="relative w-16 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
          <Image src={img.image_path} alt="" fill className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-400 truncate">
            {GRID_FOCUSES.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length > 0
              ? `${GRID_FOCUSES.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length} flagged`
              : "All 9 active"}
            {Object.keys(overrides).length > 0 && ` · ${Object.keys(overrides).length} customised`}
          </p>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 bg-slate-800/30">
          <div className="flex flex-col md:flex-row md:items-stretch">

            {/* Col 1 — 3×3 grid, fixed width */}
            <div className="p-4 md:w-72 flex-shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                Click to flag · ✏️ to edit
              </p>
              <div className="grid grid-cols-3 gap-2">
                {GRID_FOCUSES.map((gridFocus, fi) => {
                  const key = `${img.image_path}::${fi}`;
                  const isFlagged = flags.has(key);
                  const custom = overrides[String(fi)];
                  const isEditing = editing === fi;
                  const color = FOCAL_COLORS[fi];
                  const originStr = isEditing ? focusStr : (custom ?? gridFocus);
                  const originPos = parsePct(originStr);
                  return (
                    <div key={fi} className="flex flex-col gap-1">
                      <button
                        onClick={() => !isEditing && onToggleFlag(img.image_path, fi)}
                        className={`relative rounded-lg overflow-hidden transition-all ${isEditing
                            ? "cursor-default ring-[3px]"
                            : isFlagged
                              ? "cursor-pointer ring-2 ring-rose-500 opacity-50"
                              : "cursor-pointer hover:ring-2 hover:ring-blue-400"
                          }`}
                        style={{ aspectRatio: "3/2", ...(isEditing ? { boxShadow: `0 0 0 3px ${color}` } : {}) }}
                        title={isEditing ? `Editing focal #${fi + 1}` : isFlagged ? "Flagged — click to unflag" : "Click to flag"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.image_path} alt="" className="w-full h-full object-cover"
                          style={{ transform: `scale(9) translate(${50 - originPos.x}%, ${50 - originPos.y}%)`, transformOrigin: "50% 50%" }} />
                        {isFlagged && !isEditing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                            <span className="text-lg">🚩</span>
                          </div>
                        )}
                        <div className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 rounded bg-black/50 text-white">
                          {fi + 1}{custom ? " ✏️" : ""}
                        </div>
                      </button>
                      <button
                        onClick={() => isEditing ? setEditing(null) : startEdit(fi)}
                        className={`text-[9px] font-bold text-center transition-colors cursor-pointer ${isEditing ? "" : "text-slate-500 hover:text-slate-300"}`}
                        style={{ color: isEditing ? color : undefined }}>
                        {isEditing ? "close ✕" : "✏️ edit"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Col 2 — Always-visible overview; becomes selector when editing */}
            <div className={`border-t md:border-t-0 md:border-l border-slate-700 p-4 flex flex-col gap-2 ${editing !== null ? "md:flex-1" : "md:w-72 flex-shrink-0"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {editing !== null
                  ? <>Selector — focal <span style={{ color: FOCAL_COLORS[editing] }}>#{editing + 1}</span> <span className="normal-case font-normal text-slate-400 ml-1">{focusStr}</span></>
                  : "All focal points"}
              </p>
              <div
                className={`relative rounded-xl overflow-hidden select-none ${editing !== null ? "cursor-crosshair" : ""}`}
                style={{ aspectRatio: editing !== null ? "3/2" : "4/3" }}
                onMouseDown={editing !== null ? e => { dragging.current = true; apply(e.clientX, e.clientY); } : undefined}
                onMouseMove={editing !== null ? e => { if (dragging.current) apply(e.clientX, e.clientY); } : undefined}
                onMouseUp={editing !== null ? () => { dragging.current = false; } : undefined}
                onMouseLeave={editing !== null ? () => { dragging.current = false; } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={img.image_path} alt="" draggable={false}
                  className="w-full h-full object-cover block select-none pointer-events-none" />

                {GRID_FOCUSES.map((gf, i) => {
                  const pos = parsePct(i === editing ? focusStr : (overrides[String(i)] ?? gf));
                  const isActive = i === editing;
                  const color = FOCAL_COLORS[i];
                  return (
                    <div key={i} className="absolute pointer-events-none"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", zIndex: isActive ? 10 : 1 }}>
                      {isActive ? (
                        <>
                          {/* Crosshair lines */}
                          <div className="absolute" style={{ top: "50%", left: "50%", width: 60, height: 2, background: color, transform: "translate(-100%, -50%)", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          <div className="absolute" style={{ top: "50%", left: "50%", width: 60, height: 2, background: color, transform: "translate(0, -50%)", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          <div className="absolute" style={{ top: "50%", left: "50%", width: 2, height: 60, background: color, transform: "translate(-50%, -100%)", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          <div className="absolute" style={{ top: "50%", left: "50%", width: 2, height: 60, background: color, transform: "translate(-50%, 0)", boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
                          <div className="w-10 h-10 rounded-full border-[3px] flex items-center justify-center text-xs font-black"
                            style={{ borderColor: color, background: `${color}66`, color: "#fff", boxShadow: `0 0 0 3px rgba(0,0,0,0.5), 0 0 12px ${color}` }}>
                            {i + 1}
                          </div>
                        </>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] font-black"
                          style={{ borderColor: color, background: `${color}88`, color: "#fff", boxShadow: "0 0 0 1.5px rgba(0,0,0,0.4)" }}>
                          {i + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Col 3 — Game preview + save (only while editing) */}
            {editing !== null && (
              <div className="border-t md:border-t-0 md:border-l border-slate-700 p-4 md:flex-1 flex flex-col gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Game preview</p>
                <div className="relative rounded-2xl overflow-hidden bg-slate-800 flex-1" style={{ aspectRatio: "3/2" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_path} alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: `scale(9) translate(${50 - focus.x}%, ${50 - focus.y}%)`, transformOrigin: "50% 50%" }} />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 mt-auto">
                  <button onClick={save} disabled={saving}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${saved ? "bg-emerald-500 text-white" : "bg-white text-slate-900 hover:opacity-80"}`}>
                    {saving ? "Saving…" : saved ? "Saved ✓" : "Save focal"}
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-200 cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
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
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${group.coaster_enabled ? "border-slate-700" : "border-slate-800"
      }`}>
      <div className={`flex items-center gap-3 px-4 py-3 bg-slate-900 ${!group.coaster_enabled ? "opacity-40" : ""}`}>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="font-black text-sm text-white">{group.coaster_name}</p>
          <p className="text-xs text-slate-500">{group.park_name} · {group.images.length} image{group.images.length !== 1 ? "s" : ""} · {activeFocals}/{totalFocals} focals active</p>
        </button>
        <span className="text-slate-600 text-xs select-none">{open ? "▲" : "▼"}</span>
        <button onClick={() => onToggleCoaster(group.coaster_id, !group.coaster_enabled)}
          className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors cursor-pointer ${group.coaster_enabled ? "bg-emerald-500" : "bg-slate-700"
            }`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${group.coaster_enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 bg-slate-800/40 p-3 flex flex-col gap-2">
          {group.images.map(img => (
            <ImageFocalGrid key={img.gallery_id} img={img} flags={flags}
              onToggleFlag={onToggleFlag} onFocalSaved={onFocalSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ZoomleConfig() {
  const [groups, setGroups] = useState<CoasterGroup[]>([]);
  const [missing, setMissing] = useState<{ id: number; name: string; slug: string; park_name: string }[]>([]);
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
      setMissing(poolData.missing ?? []);
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
    <div className="min-h-screen bg-[#0f172a] px-6 py-8">
      <div className="mb-6 flex items-center justify-between max-w-2xl">
        <div>
          <h1 className="text-2xl font-black text-white">🔍 Zoomle Config</h1>
          <p className="text-sm text-slate-400 mt-1">
            {totalActive} active focal points · {groups.length} coasters
          </p>
        </div>
        <Link href="/games/zoomle" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">← Back</Link>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search coasters or parks…"
        className="w-full max-w-2xl rounded-2xl border-2 border-slate-700 bg-[#0f172a] px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-5" />

      {loading ? (
        <p className="text-center text-slate-400 py-12">Loading…</p>
      ) : filtered.length === 0 && !search ? (
        <p className="text-center text-slate-400 py-12 text-sm">No coasters found.</p>
      ) : (
        <>
          {filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {filtered.map(g => (
                <CoasterRow key={g.coaster_id} group={g} flags={flags}
                  onToggleFlag={toggleFlag} onToggleCoaster={toggleCoaster}
                  onFocalSaved={handleFocalSaved} />
              ))}
            </div>
          )}
          {search ? null : missing.length > 0 && (
            <div className="mt-8 max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚠️</span>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Not in Zoomle
                </h2>
                <span className="text-xs font-bold text-slate-400">{missing.length} coaster{missing.length !== 1 ? "s" : ""}</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                These coasters have no gallery images whose title contains their name. Add a matching image title to include them.
              </p>
              <div className="rounded-2xl border-2 border-dashed border-slate-700 overflow-hidden">
                {missing.map((c, i) => (
                  <Link key={c.id} href={`/coasters/${c.slug ?? c.id}`} target="_blank"
                    className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors ${i > 0 ? "border-t border-slate-800" : ""}`}>
                    <div>
                      <p className="text-sm font-bold text-slate-300">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.park_name}</p>
                    </div>
                    <span className="text-slate-600 text-xs">↗</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {search && filtered.length === 0 && (
            <p className="text-center text-slate-400 py-12 text-sm">No matches.</p>
          )}
        </>
      )}
    </div>
  );
}