"use client";

import { AlertTriangle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { RatingWarningType } from "@/app/types";
import WarningCreatorModal from "./WarningCreatorModal";

interface RatingWarningProps {
  warning: RatingWarningType | RatingWarningType[];
  isAdminMode?: boolean;
  ratingId?: number;
  onUpdate?: () => void;
  coasters: import("@/app/types").RollerCoaster[];
  tooltipDirection?: "up" | "down";
  iconSizeClass?: string;
  align?: "left" | "center" | "right" | "auto"; // NEW PROP
}

const RatingWarning: React.FC<RatingWarningProps> = ({
  warning,
  isAdminMode,
  ratingId,
  onUpdate,
  coasters,
  tooltipDirection = "down",
  iconSizeClass = "w-3.5 h-3.5",
  align = "auto",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (align !== "auto") return; // Skip auto-flip if alignment is explicitly provided
    if (showTooltip && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const container = tooltipRef.current.closest('.overflow-hidden');
      let isClipped = false;

      // Upgrade flip check to respect overflow-hidden containers
      if (container) {
        isClipped = rect.right > container.getBoundingClientRect().right - 8;
      } else {
        isClipped = rect.right > window.innerWidth - 8;
      }
      setFlipped(isClipped);
    }
  }, [showTooltip, align]);

  const warningsArray = Array.isArray(warning) ? warning : [warning];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAdminMode && ratingId) {
      setShowTooltip(false);
      setShowModal(true);
    } else {
      setShowTooltip((prev) => !prev);
    }
  };

  let highestSeverityLevel = 0;
  warningsArray.forEach((w) => {
    const sev = w.severity || "Moderate";
    if (sev === "Major") highestSeverityLevel = Math.max(highestSeverityLevel, 2);
    else if (sev === "Moderate") highestSeverityLevel = Math.max(highestSeverityLevel, 1);
  });

  let colorClass = "";
  if (warningsArray.length === 1) {
    if (highestSeverityLevel === 2) colorClass = "text-red-400"; // Changed from 600
    else if (highestSeverityLevel === 1) colorClass = "text-yellow-400"; // Bumped from 500 to match
    else colorClass = "text-slate-400";
  } else {
    if (highestSeverityLevel === 2) colorClass = "text-white drop-shadow-sm";
    else if (highestSeverityLevel === 1) colorClass = "text-red-400"; // Changed from 600
    else colorClass = "text-yellow-400"; // Bumped from 500 to match
  }

  // Determine horizontal positioning classes based on the new align prop
  let horizontalClass = "left-0";
  if (align === "right" || (align === "auto" && flipped)) {
    horizontalClass = "right-0";
  } else if (align === "center") {
    horizontalClass = "left-1/2 -translate-x-1/2";
  }

  return (
    <>
      <div
        className="relative inline-flex items-center cursor-pointer gap-1"
        onMouseEnter={() => !showModal && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleClick}
      >
        <AlertTriangle
          className={`${iconSizeClass} transition-transform ${isAdminMode ? "hover:scale-110" : ""} ${colorClass}`}
          aria-label="Rating Warning"
        />

        {showTooltip && warningsArray.length > 0 && (
          <div
            ref={tooltipRef}
            className={`absolute ${tooltipDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"} w-56 p-2 rounded-2xl bg-neutral-800 text-white text-sm shadow-lg z-50 whitespace-pre-line pointer-events-none ${horizontalClass}`}
          >
            {warningsArray.map((w, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <div className="flex justify-between items-center mb-0.5">
                  <p className="font-semibold text-yellow-400">{w.ride}</p>
                  <span className={`text-[10px] px-1.5 rounded-full ${w.severity === "Major" ? "bg-red-500/20 text-red-300" :
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

      {showModal && ratingId && (
        <WarningCreatorModal
          ratingId={ratingId}
          existingWarnings={warningsArray}
          onClose={() => setShowModal(false)}
          onSaved={() => { if (onUpdate) onUpdate(); }}
          coasters={coasters}
        />
      )}
    </>
  );
};

export default RatingWarning;