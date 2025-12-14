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

const SpecRow = ({ label, value, unit = "" }: { label: string; value: React.ReactNode; unit?: string }) => (
  <div className="flex justify-between items-baseline py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <span className="text-sm font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
      {label}
    </span>
    <span className="text-base font-semibold text-gray-900 dark:text-gray-200 text-right">
      {value} <span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>
    </span>
  </div>
);

const CoasterSpecsPanel: React.FC<CoasterSpecsPanelProps> = ({ specs }) => {
  if (!specs) return <p className="text-gray-400 italic text-sm">No specs available.</p>;

  return (
    <div className="flex flex-col w-full">
      <SpecRow label="Type" value={specs.type ?? "-"} />
      <SpecRow label="Class" value={specs.classification ?? "-"} />
      <SpecRow label="Length" value={formatNumber(specs.length)} unit="ft" />
      <SpecRow label="Height" value={formatNumber(specs.height)} unit="ft" />
      <SpecRow label="Drop" value={formatNumber(specs.drop)} unit="ft" />
      <SpecRow label="Speed" value={formatNumber(specs.speed)} unit="mph" />
      <SpecRow label="Inversions" value={specs.inversions ?? "-"} />
      <SpecRow label="Vert Angle" value={formatNumber(specs.verticalAngle)} unit="°" />
      <SpecRow label="G-Force" value={formatNumber(specs.gforce)} unit="G" />
      <SpecRow label="Duration" value={specs.duration} unit="sec" />
      
      {specs.notes && (
        <div className="pt-3 mt-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">
            Notes
          </span>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {specs.notes}
          </p>
        </div>
      )}
    </div>
  );
};

export default CoasterSpecsPanel;