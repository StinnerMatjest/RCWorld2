"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type CoasterImage = {
  gallery_id: number;
  image_path: string;
  coaster_id: number;
  coaster_name: string;
  park_name: string;
  focuses: string[];
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

function focalColor(i: number) {
  return FOCAL_COLORS[i % FOCAL_COLORS.length];
}

function parsePct(s: string): { x: number; y: number } {
  const parts = s.split(" ");
  return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
}

function toFocusStr(f: { x: number; y: number }) {
  return `${f.x.toFixed(1)}% ${f.y.toFixed(1)}%`;
}

// ─── Focal editor for one image ───────────────────────────────────────────────

function ImageFocalEditor({ img, flags, onSaved }: {
  img: CoasterImage;
  flags: Set<string>;
  onSaved: (imagePath: string, focuses: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focals, setFocals] = useState<{ x: number; y: number }[]>(img.focuses.map(parsePct));
  // null = add mode (clicking the image places a new focal); a number = that focal
  // is being edited (clicking/dragging on the image moves it)
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const previewIdx = editIdx ?? (focals.length > 0 ? focals.length - 1 : null);
  const flaggedCount = focals.filter((_, i) => flags.has(`${img.image_path}::${i}`)).length;

  function toPct(cx: number, cy: number) {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100)),
    };
  }

  function moveEditing(cx: number, cy: number) {
    const pos = toPct(cx, cy);
    if (!pos || editIdx === null) return;
    setFocals(prev => prev.map((f, i) => (i === editIdx ? pos : f)));
    setDirty(true);
  }

  function handleImageDown(e: React.PointerEvent) {
    const pos = toPct(e.clientX, e.clientY);
    if (!pos) return;
    if (editIdx !== null) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      moveEditing(e.clientX, e.clientY);
    } else {
      setFocals(prev => [...prev, pos]);
      setDirty(true);
    }
  }

  function removeFocal(i: number) {
    setFocals(prev => prev.filter((_, j) => j !== i));
    setEditIdx(null);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const list = focals.map(toFocusStr);
    try {
      const res = await fetch("/api/zoomle/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coaster_id: img.coaster_id, image_path: img.image_path, set_focuses: list,
        }),
      });
      if (!res.ok) { setError("Save failed"); return; }
      onSaved(img.image_path, list);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      {/* Collapsed header */}
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-slate-800/50 transition-colors cursor-pointer">
        <div className="relative w-16 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
          <Image src={img.image_path} alt="" fill className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">
            {focals.length === 0
              ? <span className="text-amber-400">⚠ No focals — click to set up</span>
              : <span className="text-slate-400">
                  🎯 {focals.length} focal{focals.length !== 1 ? "s" : ""}
                  {flaggedCount > 0 && <span className="text-rose-400"> · {flaggedCount} flagged</span>}
                  {dirty && <span className="text-amber-400"> · unsaved</span>}
                </span>}
          </p>
        </div>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 bg-slate-800/30">
          <div className="flex flex-col md:flex-row md:items-stretch">

            {/* Col 1 — focal thumbnails: click to edit, ✕ to delete */}
            <div className="p-4 md:w-72 flex-shrink-0 flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Focals ({focals.length}) — click to edit
              </p>
              {focals.length === 0 ? (
                <p className="text-xs text-slate-500">Click anywhere on the image to place a focal point.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {focals.map((f, i) => {
                    const color = focalColor(i);
                    const isEditing = editIdx === i;
                    const isFlagged = flags.has(`${img.image_path}::${i}`);
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <button onClick={() => setEditIdx(isEditing ? null : i)}
                          className="relative rounded-lg overflow-hidden cursor-pointer transition-all"
                          style={{ aspectRatio: "3/2", ...(isEditing ? { boxShadow: `0 0 0 3px ${color}` } : {}) }}
                          title={isEditing ? `Editing focal #${i + 1} — click to stop` : `Focal #${i + 1} — click to edit`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.image_path} alt="" className="w-full h-full object-cover"
                            style={{ transform: `scale(9) translate(${50 - f.x}%, ${50 - f.y}%)`, transformOrigin: "50% 50%" }} />
                          {isFlagged && (
                            <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                              <span className="text-lg">🚩</span>
                            </div>
                          )}
                          <div className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 rounded text-white"
                            style={{ background: isEditing ? color : "rgba(0,0,0,0.5)" }}>
                            {i + 1}{isEditing ? " ✏️" : ""}
                          </div>
                        </button>
                        <button onClick={() => removeFocal(i)}
                          className="text-[9px] font-bold text-center text-slate-500 hover:text-rose-400 transition-colors cursor-pointer">
                          ✕ delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Col 2 — image: click to add, or move the selected focal */}
            <div className="border-t md:border-t-0 md:border-l border-slate-700 p-4 flex flex-col gap-2 md:flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {editIdx !== null
                  ? <>Moving focal <span style={{ color: focalColor(editIdx) }}>#{editIdx + 1}</span> — click or drag to reposition</>
                  : "Click to add a focal"}
              </p>
              <div className="relative rounded-xl overflow-hidden select-none cursor-crosshair"
                style={{ aspectRatio: "3/2", touchAction: "none" }}
                onPointerDown={handleImageDown}
                onPointerMove={e => { if (dragging.current) moveEditing(e.clientX, e.clientY); }}
                onPointerUp={() => { dragging.current = false; }}
                onPointerCancel={() => { dragging.current = false; }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={img.image_path} alt="" draggable={false}
                  className="w-full h-full object-cover block select-none pointer-events-none" />
                {focals.map((f, i) => {
                  const color = focalColor(i);
                  const isEditing = editIdx === i;
                  return (
                    <button key={i}
                      onPointerDown={e => {
                        e.stopPropagation();
                        if (isEditing) {
                          dragging.current = true;
                          // Capture on the parent container so moves track across the image
                          (e.currentTarget.parentElement as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
                        } else {
                          setEditIdx(i);
                        }
                      }}
                      title={isEditing ? `Focal #${i + 1} — drag to move` : `Focal #${i + 1} — click to edit`}
                      className={`absolute ${isEditing ? "cursor-move" : "cursor-pointer"}`}
                      style={{ left: `${f.x}%`, top: `${f.y}%`, transform: "translate(-50%,-50%)", zIndex: isEditing ? 10 : 1, touchAction: "none" }}>
                      <div className={`rounded-full border-2 flex items-center justify-center font-black text-white ${isEditing ? "w-9 h-9 text-[11px]" : "w-6 h-6 text-[8px]"}`}
                        style={{ borderColor: color, background: `${color}88`, boxShadow: isEditing ? `0 0 0 2px rgba(0,0,0,0.5), 0 0 10px ${color}` : "0 0 0 1.5px rgba(0,0,0,0.4)" }}>
                        {i + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Col 3 — game preview + actions */}
            <div className="border-t md:border-t-0 md:border-l border-slate-700 p-4 md:flex-1 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {previewIdx !== null
                  ? <>Game preview — focal <span style={{ color: focalColor(previewIdx) }}>#{previewIdx + 1}</span></>
                  : "Game preview"}
              </p>
              <div className="relative rounded-2xl overflow-hidden bg-slate-800 flex-1" style={{ aspectRatio: "3/2" }}>
                {previewIdx !== null && focals[previewIdx] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={img.image_path} alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: `scale(9) translate(${50 - focals[previewIdx].x}%, ${50 - focals[previewIdx].y}%)`, transformOrigin: "50% 50%" }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                    Place a focal to preview
                  </div>
                )}
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 mt-auto">
                {editIdx !== null && (
                  <>
                    <button onClick={() => removeFocal(editIdx)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors cursor-pointer">
                      Delete #{editIdx + 1}
                    </button>
                    <button onClick={() => setEditIdx(null)}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white cursor-pointer">
                      Done
                    </button>
                  </>
                )}
                <button onClick={save} disabled={saving || (focals.length === 0 && img.focuses.length === 0)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer disabled:opacity-50 ${saved ? "bg-emerald-500 text-white" : "bg-white text-slate-900 hover:opacity-80"}`}>
                  {saving ? "Saving…" : saved ? "Saved ✓" : `Save ${focals.length} focal${focals.length !== 1 ? "s" : ""}${dirty ? " •" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Coaster accordion ────────────────────────────────────────────────────────

function CoasterRow({ group, flags, onToggleCoaster, onSaved }: {
  group: CoasterGroup;
  flags: Set<string>;
  onToggleCoaster: (id: number, enabled: boolean) => void;
  onSaved: (imagePath: string, focuses: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalFocals = group.images.reduce((s, img) => s + img.focuses.length, 0);
  const flaggedCount = group.images.reduce((s, img) =>
    s + img.focuses.filter((_, fi) => flags.has(`${img.image_path}::${fi}`)).length, 0);
  const activeFocals = totalFocals - flaggedCount;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${group.coaster_enabled ? "border-slate-700" : "border-slate-800"}`}>
      <div className={`flex items-center gap-3 px-4 py-3 bg-slate-900 ${!group.coaster_enabled ? "opacity-40" : ""}`}>
        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left cursor-pointer">
          <p className="font-black text-sm text-white">{group.coaster_name}</p>
          <p className="text-xs text-slate-500">
            {group.park_name} · {group.images.length} image{group.images.length !== 1 ? "s" : ""} ·{" "}
            {totalFocals === 0
              ? <span className="text-amber-400 font-bold">no focals set</span>
              : <>{activeFocals}/{totalFocals} focals active</>}
          </p>
        </button>
        <span className="text-slate-600 text-xs select-none">{open ? "▲" : "▼"}</span>
        <button onClick={() => onToggleCoaster(group.coaster_id, !group.coaster_enabled)}
          className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors cursor-pointer ${group.coaster_enabled ? "bg-emerald-500" : "bg-slate-700"}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${group.coaster_enabled ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 bg-slate-800/40 p-3 flex flex-col gap-2">
          {group.images.map(img => (
            <ImageFocalEditor key={img.gallery_id} img={img} flags={flags} onSaved={onSaved} />
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
      setFlags(new Set<string>(
        (flagData.flags ?? []).map((f: any) => `${f.image_path}::${f.focal_index}`)
      ));

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
          focuses: Array.isArray(img.focuses) ? img.focuses : [],
        });
      }
      setGroups(Array.from(map.values()));
      setMissing(poolData.missing ?? []);
      setLoading(false);
    });
  }, []);

  function handleSaved(imagePath: string, focuses: string[]) {
    // Saving also clears the image's flags server-side (indices may have shifted)
    setFlags(prev => new Set(Array.from(prev).filter(k => !k.startsWith(`${imagePath}::`))));
    setGroups(prev => prev.map(g => ({
      ...g,
      images: g.images.map(img => img.image_path === imagePath ? { ...img, focuses } : img),
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

  const needSetup = filtered.filter(g => g.images.every(img => img.focuses.length === 0));
  const configured = filtered.filter(g => g.images.some(img => img.focuses.length > 0));

  const totalActive = groups.reduce((s, g) => {
    if (!g.coaster_enabled) return s;
    return s + g.images.reduce((si, img) =>
      si + img.focuses.filter((_, fi) => !flags.has(`${img.image_path}::${fi}`)).length, 0);
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
      ) : groups.length === 0 ? (
        <p className="text-center text-slate-400 py-12 text-sm">No coasters found.</p>
      ) : (
        <>
          {needSetup.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚠️</span>
                <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest">
                  Coasters missing focals
                </h2>
                <span className="text-xs font-bold text-slate-400">{needSetup.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {needSetup.map(g => (
                  <CoasterRow key={g.coaster_id} group={g} flags={flags}
                    onToggleCoaster={toggleCoaster} onSaved={handleSaved} />
                ))}
              </div>
            </div>
          )}

          {configured.length > 0 && (
            <div>
              {needSetup.length > 0 && (
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                  Configured
                </h2>
              )}
              <div className="flex flex-col gap-3">
                {configured.map(g => (
                  <CoasterRow key={g.coaster_id} group={g} flags={flags}
                    onToggleCoaster={toggleCoaster} onSaved={handleSaved} />
                ))}
              </div>
            </div>
          )}

          {search && filtered.length === 0 && (
            <p className="text-center text-slate-400 py-12 text-sm">No matches.</p>
          )}

          {!search && missing.length > 0 && (
            <div className="mt-8 max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🖼️</span>
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
        </>
      )}
    </div>
  );
}
