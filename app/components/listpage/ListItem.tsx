"use client";

import React from "react";
import type { RankingListItem } from "@/app/types";

interface Props {
  item: RankingListItem;
}

const ListItem: React.FC<Props> = ({ item }) => {
  return (
    <div className="mb-12 md:mb-16 bg-slate-900/40 rounded-3xl border border-slate-800/60 overflow-hidden shadow-2xl group transition-all duration-300 hover:border-brand/30">

      {/* Header Bar */}
      <div className="bg-slate-800/40 px-6 py-4 md:px-10 md:py-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-4">
          <span className="text-brand text-5xl md:text-6xl drop-shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]">
            #{item.rank}
          </span>
          {item.title}
        </h2>
        {item.subtitle && (
          <p className="text-sm md:text-base text-brand/80 font-bold uppercase tracking-widest md:text-right">
            {item.subtitle}
          </p>
        )}
      </div>

      <div className="p-6 md:p-10 space-y-10">
        {/* Block 1 */}
        {(item.textBlock1 || item.image1) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {item.textBlock1 && (
              <div className="text-slate-300 leading-relaxed text-base md:text-lg whitespace-pre-wrap order-2 lg:order-1">
                {item.textBlock1}
              </div>
            )}
            {item.image1 && (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 order-1 lg:order-2 group-hover:shadow-brand/5 transition-shadow duration-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image1}
                  alt={`${item.title} - view 1`}
                  className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        {/* Block 2 */}
        {(item.textBlock2 || item.image2) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {item.image2 && (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 order-1 group-hover:shadow-brand/5 transition-shadow duration-500">
                <img
                  src={item.image2}
                  alt={`${item.title} - view 2`}
                  className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
              </div>
            )}
            {item.textBlock2 && (
              <div className="text-slate-300 leading-relaxed text-base md:text-lg whitespace-pre-wrap order-2">
                {item.textBlock2}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListItem;