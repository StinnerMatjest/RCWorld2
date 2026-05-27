"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminMode } from "@/app/context/AdminModeContext";

type HistoryPost = {
  id: number;
  caption: string;
  hashtags: string;
  image_url: string;
  park_name: string;
  category: string;
  published_to: string[];
  published_at: string;
};

type Stats = {
  total: string;
  facebook: string;
  instagram: string;
  both: string;
  unique_parks: string;
};

export default function SocialHistoryPage() {
  const { isAdminMode } = useAdminMode();
  const [posts, setPosts] = useState<HistoryPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [topParks, setTopParks] = useState<{ park_name: string; count: string }[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/social/history")
      .then(r => r.json())
      .then(d => { setPosts(d.posts ?? []); setStats(d.stats); setTopParks(d.topParks ?? []); });
  }, []);

  if (!isAdminMode) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-slate-400">Enable admin mode to access this page.</p></div>;
  }

  const fbIcon = <span className="inline-flex w-5 h-5 rounded bg-blue-600 text-white text-[9px] font-bold items-center justify-center">f</span>;
  const igIcon = <span className="inline-flex w-5 h-5 rounded bg-gradient-to-br from-pink-500 to-orange-400 text-white text-[9px] font-bold items-center justify-center">ig</span>;

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 sm:px-6 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Post History</h1>
            <p className="text-slate-400 text-sm mt-1">All published posts and statistics</p>
          </div>
          <Link href="/admin/social" className="text-sm text-orange-400 hover:text-orange-300">← Back to queue</Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
              { label: "Total posts", value: stats.total },
              { label: "Facebook", value: stats.facebook },
              { label: "Instagram", value: stats.instagram },
              { label: "Both platforms", value: stats.both },
              { label: "Parks featured", value: stats.unique_parks },
            ].map(s => (
              <div key={s.label} className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <p className="text-2xl font-bold text-orange-400">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Top parks */}
        {topParks.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 mb-8">
            <p className="text-sm font-semibold text-slate-300 mb-3">Most featured parks</p>
            <div className="flex flex-wrap gap-2">
              {topParks.map(p => (
                <span key={p.park_name} className="bg-slate-700 rounded-full px-3 py-1 text-sm text-slate-200">
                  {p.park_name} <span className="text-orange-400 font-bold">{p.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Post list */}
        {posts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-4xl mb-3">📭</p>
            <p>No posts published yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map(post => (
              <div key={post.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:bg-slate-750"
                  onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.image_url} alt="" className="w-16 h-12 object-cover rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-orange-400 truncate">
                      {post.park_name}{post.category ? ` · ${post.category}` : ""}
                    </p>
                    <p className="text-xs text-slate-300 truncate mt-0.5">{post.caption.split("\n")[0]}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {post.published_to?.includes("facebook") && fbIcon}
                    {post.published_to?.includes("instagram") && igIcon}
                    <span className="text-xs text-slate-500 ml-2">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </div>
                </button>

                {expanded === post.id && (
                  <div className="px-5 pb-5 border-t border-slate-700 pt-4 grid sm:grid-cols-2 gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.image_url} alt="" className="w-full rounded-xl object-cover max-h-48" />
                    <div>
                      <p className="text-sm text-white whitespace-pre-line leading-relaxed">{post.caption}</p>
                      <p className="text-xs text-blue-400 mt-2">{post.hashtags}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
