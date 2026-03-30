"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { RatingWarningType } from "@/app/types";
import WarningCreatorModal from "./WarningCreatorModal";

interface RatingWarningProps {
  warning: RatingWarningType | RatingWarningType[];
  isAdminMode?: boolean;
  ratingId?: number;
  onUpdate?: () => void;
  coasters: import("@/app/types").RollerCoaster[];
}

const RatingWarning: React.FC<RatingWarningProps> = ({ 
  warning, 
  isAdminMode, 
  ratingId, 
  onUpdate,
  coasters
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const warningsArray = Array.isArray(warning) ? warning : [warning];

  const handleClick = (e: React.MouseEvent) => {
    if (isAdminMode && ratingId) {
      e.stopPropagation();
      setShowTooltip(false);
      setShowModal(true);
    }
  };

  // Determine the highest severity present in the array
  let highestSeverityLevel = 0; // 0 = Minor, 1 = Moderate, 2 = Major
  
  warningsArray.forEach((w) => {
    const sev = w.severity || "Moderate"; // Fallback
    if (sev === "Major") highestSeverityLevel = Math.max(highestSeverityLevel, 2);
    else if (sev === "Moderate") highestSeverityLevel = Math.max(highestSeverityLevel, 1);
  });
  let colorClass = "";
  
  if (warningsArray.length === 1) {
    if (highestSeverityLevel === 2) colorClass = "text-red-600";
    else if (highestSeverityLevel === 1) colorClass = "text-yellow-500";
    else colorClass = "text-gray-400"; // Minor
  } else if (warningsArray.length >= 2) {
    // Escalation!
    if (highestSeverityLevel === 2) colorClass = "text-slate-900 dark:text-white drop-shadow-sm"; // Escalate to Black (or white in dark mode)
    else if (highestSeverityLevel === 1) colorClass = "text-red-600"; // Escalate to Red
    else colorClass = "text-yellow-500"; // Escalate to Yellow
  }

  return (
    <>
      <div
        className="relative inline-flex items-center ml-2 cursor-pointer gap-1"
        onMouseEnter={() => !showModal && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleClick}
      >
        <AlertTriangle
          className={`w-4 h-4 transition-transform ${
            isAdminMode ? "hover:scale-110" : ""
          } ${colorClass}`}
          aria-label="Rating Warning"
        />

        {/* Warning Tooltip */}
        {showTooltip && warningsArray.length > 0 && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-2 rounded-2xl bg-neutral-800 text-white text-sm shadow-lg z-50 whitespace-pre-line pointer-events-none">
            {warningsArray.map((w, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex justify-between items-center mb-0.5">
                  <p className="font-semibold text-yellow-400">{w.ride}</p>
                  <span className={`text-[10px] px-1.5 rounded-full ${
                    w.severity === "Major" ? "bg-red-500/20 text-red-300" :
                    w.severity === "Minor" ? "bg-gray-500/30 text-gray-300" :
                    "bg-yellow-500/20 text-yellow-300"
                  }`}>
                    {w.severity || "Moderate"}
                  </span>
                </div>
                <p className="text-xs opacity-90">{w.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Manager Modal */}
      {showModal && ratingId && (
        <WarningCreatorModal
          ratingId={ratingId}
          existingWarnings={warningsArray}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            if (onUpdate) onUpdate();
          }}
          coasters={coasters}
        />
      )}
    </>
  );
};

export default RatingWarning;