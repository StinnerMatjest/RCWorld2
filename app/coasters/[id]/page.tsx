"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { RollerCoaster } from "@/app/types";
import MainPageButton from "@/app/components/MainPageButton";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { getRatingColor } from "@/app/utils/design";
import CoasterInfo from "@/app/components/coasterpage/CoasterInfo";
import CoasterSpecsPanel from "@/app/components/coasterpage/CoasterSpecsPanel";
import CoasterGallery from "@/app/components/coasterpage/CoasterGallery";

const CoasterPage: React.FC = () => {
  const { id: coasterId } = useParams();
  const [coaster, setCoaster] = useState<RollerCoaster | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coasterId) return;
    (async () => {
      const res = await fetch(`/api/coasters/${coasterId}`);
      const data = await res.json();
      setCoaster(data.coaster);
      setLoading(false);
    })();
  }, [coasterId]);

  if (loading || !coaster) return <LoadingSpinner />;

  return (
    <div className="w-full">
      {/* <CoasterHeader coaster={coaster} /> */}

      <div className="grid grid-cols-1 md:grid-cols-[20%_1fr_1fr] gap-6 w-full py-10 px-6 md:px-20 bg-base-200 dark:bg-gray-900">
        {/* Left Panel: Coaster Info */}
        <div className="
          bg-blue-50 dark:bg-gray-800
          rounded-2xl p-6 text-center space-y-6 self-start
          border border-gray-300 dark:border-white/10
          shadow-sm dark:shadow-xl
          ring ring-gray-200 dark:ring-white/10
        ">
          <h2 className="text-xl font-semibold mb-1 dark:text-white">Coaster Info</h2>
          <div className="border-t border-gray-300 dark:border-white/10 my-3" />
          <CoasterInfo coaster={coaster} />
        </div>

        {/* Middle Panel: */}
        <div className="space-y-6">
          <h2 className="text-2xl md:text-4xl font-bold dark:text-white text-center">
            {coaster.name}
          </h2>
          <div className="border-t border-gray-300 dark:border-white/10 my-3" />

          <div
            className={`
      w-full max-w-xs md:max-w-sm
      aspect-square
      flex items-center justify-center
      rounded-2xl
      border-4
      ${coaster.rating !== null ? getRatingColor(Number(coaster.rating)) : "border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400"}
      bg-white dark:bg-gray-800
      font-bold
      shadow-lg
      mx-auto
      transition-all
    `}
          >
            <span className="text-[6rem] md:text-[8rem] leading-none">
              {coaster.rating ?? "N/A"}
            </span>
          </div>
        </div>

        {/* Right Panel: Technical Specs + Gallery */}
        <div className="space-y-6">
          <CoasterSpecsPanel specs={coaster.specs} />
          <CoasterGallery coasterId={coaster.id} coasterName={coaster.name} />
        </div>
      </div>

      <div className="flex justify-center py-10">
        <MainPageButton />
      </div>
    </div>
  );
};

export default CoasterPage;
