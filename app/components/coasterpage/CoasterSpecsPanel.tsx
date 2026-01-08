"use client";

import React, { useState } from "react";
import type { RollerCoasterSpecs } from "@/app/types";
import CoasterSpecsModal from "./CoasterSpecsModal";
import { useAdminMode } from "@/app/context/AdminModeContext";

interface CoasterSpecsPanelProps {
  specs: RollerCoasterSpecs | null | undefined;
  coasterId: number;
}

// Helper to format numbers safely
const formatNumber = (value: number | null | undefined, decimals = 1) => {
  if (value === null || value === undefined) return null;
  return value.toFixed(decimals).replace(".", ",");
};

interface SpecRowProps {
  label: string;
  value: React.ReactNode | null | undefined;
  unit?: string;
  isAdmin: boolean;
}

const SpecRow = ({ label, value, unit = "", isAdmin }: SpecRowProps) => {
  const isEmpty = value === null || value === undefined || value === "" || value === "-";

  if (isEmpty && !isAdmin) {
    return null;
  }


  const displayValue = isEmpty ? "-" : value;
  const displayUnit = isEmpty ? "" : unit;

  return (
    <div className={`flex justify-between items-baseline py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 ${isEmpty ? "opacity-60" : ""}`}>
      <span className="text-sm font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-base font-semibold text-gray-900 dark:text-gray-200 text-right">
        {displayValue} <span className="text-xs text-gray-400 font-normal ml-0.5">{displayUnit}</span>
      </span>
    </div>
  );
};

const CoasterSpecsPanel: React.FC<CoasterSpecsPanelProps> = ({ specs: initialSpecs, coasterId }) => {
  const [specs, setSpecs] = useState<RollerCoasterSpecs | null | undefined>(initialSpecs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAdminMode } = useAdminMode();

  const handleSave = (updatedSpecs: RollerCoasterSpecs) => {
    setSpecs(updatedSpecs);
  };

  const displaySpecs = specs || ({} as RollerCoasterSpecs);

  const modalSpecs = specs ? {
    ...specs,
    verticalAngle: specs.verticalAngle ?? (specs as any).vertical_angle,
    duration: specs.duration ?? (specs as any).duration_sec,
  } : null;

  return (
    <>
      <div className="flex flex-col w-full relative group">

        {/* Header with Edit Button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Specifications</h3>
          {isAdminMode && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-md transition-colors cursor-pointer"
              title="Edit Specs"
              aria-label="Edit specifications"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          )}
        </div>

        {/* Rows */}
        <SpecRow label="Type" value={displaySpecs.type} isAdmin={isAdminMode} />
        <SpecRow label="Class" value={displaySpecs.classification} isAdmin={isAdminMode} />
        <SpecRow label="Length" value={formatNumber(displaySpecs.length)} unit="ft" isAdmin={isAdminMode} />
        <SpecRow label="Height" value={formatNumber(displaySpecs.height)} unit="ft" isAdmin={isAdminMode} />
        <SpecRow label="Drop" value={formatNumber(displaySpecs.drop)} unit="ft" isAdmin={isAdminMode} />
        <SpecRow label="Speed" value={formatNumber(displaySpecs.speed)} unit="mph" isAdmin={isAdminMode} />
        <SpecRow label="Inversions" value={displaySpecs.inversions} isAdmin={isAdminMode} />
        <SpecRow label="Vert Angle" value={formatNumber(displaySpecs.verticalAngle)} unit="°" isAdmin={isAdminMode} />
        <SpecRow label="G-Force" value={formatNumber(displaySpecs.gforce)} unit="G" isAdmin={isAdminMode} />
        <SpecRow label="Duration" value={displaySpecs.duration} unit="sec" isAdmin={isAdminMode} />

        {(displaySpecs.notes || isAdminMode) && (
          <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block mb-1">
              Notes
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed min-h-[1.25rem]">
              {displaySpecs.notes || (isAdminMode ? <span className="text-gray-300 italic">No notes added...</span> : null)}
            </p>
          </div>
        )}

      </div>

      <CoasterSpecsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialSpecs={modalSpecs}
        coasterId={coasterId}
      />
    </>
  );
};

export default CoasterSpecsPanel;