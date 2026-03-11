"use client";

import React from "react";
import Image from "next/image";
import type { RankingListItem } from "@/app/types";

interface Props {
  item: RankingListItem;
}

const ListItem: React.FC<Props> = ({ item }) => {
  return (
    <div className="mb-16 border-b border-gray-300 dark:border-gray-700 pb-12 last:border-0">
      
      {/* Header: Title & Subtitle */}
      <div className="text-right mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">
          {item.rank}) {item.title}
        </h2>
        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 italic">
          {item.subtitle}
        </p>
      </div>

      <div className="space-y-6">
        {/* Block 1: Text Left, Image Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">
            {item.textBlock1}
          </p>
          <div className="relative w-full aspect-video md:aspect-[4/3] rounded-lg overflow-hidden shadow-md">
            <Image
              src={item.image1}
              alt={`${item.title} image 1`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>

        {/* Block 2: Image Left, Text Right */}
        {item.image2 && item.textBlock2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="relative w-full aspect-video md:aspect-[4/3] rounded-lg overflow-hidden shadow-md order-2 md:order-1">
              <Image
                src={item.image2}
                alt={`${item.title} image 2`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base order-1 md:order-2">
              {item.textBlock2}
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default ListItem;