"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { RatingWarningType } from "@/app/types";

interface RatingWarningProps {
  warning: RatingWarningType | RatingWarningType[]; // support single & multiple warnings
}

const RatingWarning: React.FC<RatingWarningProps> = ({ warning }) => {
  const [show, setShow] = useState(false);

  const warningsArray = Array.isArray(warning) ? warning : [warning];
  const rideText = warningsArray.map((w) => w.ride).join(", ");
  const noteText = warningsArray.map((w) => w.note).join("\n");

  return (
    <div
      className="relative inline-block ml-2 cursor-pointer"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <AlertTriangle
        className={`w-4 h-4 ${warningsArray.length > 1 ? "text-red-600" : "text-yellow-500"}`}
        aria-label="Rating Warning"
      />
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 p-2 rounded-2xl bg-neutral-800 text-white text-sm shadow-lg z-50 whitespace-pre-line">
          {warningsArray.map((w, i) => (
            <div key={i} className="mb-1">
              <p className="font-semibold text-yellow-400">{w.ride}</p>
              <p className="text-xs opacity-90">{w.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatingWarning;
