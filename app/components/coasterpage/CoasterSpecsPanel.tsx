"use client";

import React from "react";
import type { RollerCoasterSpecs } from "@/app/types";

interface CoasterSpecsPanelProps {
  specs: RollerCoasterSpecs | null | undefined;
}

const formatNumber = (value: number | null | undefined, decimals = 1) => {
  if (value === null || value === undefined) return "-";
  return value.toFixed(decimals).replace(".", ",");
};

const CoasterSpecsPanel: React.FC<CoasterSpecsPanelProps> = ({ specs }) => {
  if (!specs) return <p className="text-gray-500 dark:text-gray-400">No specs available.</p>;

  return (
    <div className="
      bg-blue-50 dark:bg-gray-800
      rounded-2xl p-6 space-y-4
      border border-gray-300 dark:border-white/10
      shadow-sm dark:shadow-xl
      ring ring-gray-200 dark:ring-white/10
    ">
      <h2 className="text-xl font-semibold mb-3 dark:text-white">Technical Specs</h2>

      <div className="grid grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
        <div>Type:</div>
        <div>{specs.type ?? "-"}</div>

        <div>Classification:</div>
        <div>{specs.classification ?? "-"}</div>

        <div>Length:</div>
        <div>{formatNumber(specs.length)} ft</div>

        <div>Height:</div>
        <div>{formatNumber(specs.height)} ft</div>

        <div>Drop:</div>
        <div>{formatNumber(specs.drop)} ft</div>

        <div>Speed:</div>
        <div>{formatNumber(specs.speed)} mph</div>

        <div>Inversions:</div>
        <div>{specs.inversions ?? "-"}</div>

        <div>Vertical Angle:</div>
        <div>{formatNumber(specs.verticalAngle)}°</div>

        <div>G-Force:</div>
        <div>{formatNumber(specs.gforce)} G</div>

        <div>Duration:</div>
        <div>{specs.duration ? `${specs.duration} sec` : "-"}</div>

        <div>Notes:</div>
        <div className="col-span-1 md:col-span-1">{specs.notes ?? "-"}</div>
      </div>
    </div>
  );
};

export default CoasterSpecsPanel;
